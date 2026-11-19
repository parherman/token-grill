import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {newProvider} from '../core/config.js';
import {isCancellation} from '../core/gio.js';
import {formatText} from '../core/i18n.js';
import type {AccountApp, ProviderInstance, ProviderKind} from '../core/types.js';
import type {Candidate} from '../providers/candidates.js';
import {CandidateList} from './candidateList.js';
import {presentKeyError, storeApiKey} from './keyStore.js';
import {findCandidates} from './sources.js';
import {providerIcon, setAccessibleLabel} from './widgets.js';

// What to run to sign in, shown when an app has no account to add. Commands are not translated.
const SIGN_IN_COMMANDS: Partial<Record<AccountApp, string>> = {
    'codex-cli': 'codex login',
    'claude-code': 'claude auth login',
    'kiro-cli': 'kiro-cli login',
    'opencode': 'opencode auth login',
    'github-cli': 'gh auth login',
    'copilot-cli': 'copilot',
    'cursor-agent': 'agent login',
};

function emptyHint(app: AccountApp): string {
    const command = SIGN_IN_COMMANDS[app];
    if (command)
        return formatText(_('Sign in with %s, then try again'), command);
    return _('Sign in with the app, then try again');
}

// Starts from the app the user signs in with; every account lands in its own service.
export class AddAccountDialog extends Adw.Dialog {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillAddAccountDialog'}, this);
    }

    private readonly _configured: ProviderInstance[];
    private readonly _extensionPath: string;
    private readonly _onAdd: (providers: ProviderInstance[]) => void;
    private readonly _view = new Adw.NavigationView();
    private readonly _cancellable = new Gio.Cancellable();

    constructor(configured: ProviderInstance[], extensionPath: string, onAdd: (providers: ProviderInstance[]) => void) {
        super({title: _('Add Account'), content_width: 520, content_height: 600});
        this._configured = configured;
        this._extensionPath = extensionPath;
        this._onAdd = onAdd;
        this.connect('closed', () => this._cancellable.cancel());
        this._view.add(this._appsPage());
        this.set_child(this._view);
    }

    private _page(title: string, content: Gtk.Widget, action: Gtk.Widget | null = null): Adw.NavigationPage {
        const header = new Adw.HeaderBar();
        if (action)
            header.pack_end(action);
        const toolbar = new Adw.ToolbarView({content});
        toolbar.add_top_bar(header);
        return new Adw.NavigationPage({title, child: toolbar});
    }

    private _linkRow(title: string, subtitle: string, kind: ProviderKind, open: () => void): Adw.ActionRow {
        const row = new Adw.ActionRow({title, subtitle, activatable: true});
        row.add_prefix(providerIcon(this._extensionPath, kind));
        row.add_suffix(new Gtk.Image({icon_name: 'go-next-symbolic'}));
        row.connect('activated', open);
        return row;
    }

    private _appsPage(): Adw.NavigationPage {
        const group = new Adw.PreferencesGroup({title: _('Which App Do You Use?')});
        const open = (app: AccountApp, title: string) => () => this._view.push(this._candidatesPage(title, app));
        // App names are product names and stay as they are.
        group.add(this._linkRow('Codex CLI', '', 'codex', open('codex-cli', 'Codex CLI')));
        group.add(this._linkRow('Claude Code', '', 'claude', open('claude-code', 'Claude Code')));
        group.add(this._linkRow('Kiro', '', 'kiro', open('kiro-cli', 'Kiro')));
        group.add(this._linkRow('Cursor IDE', '', 'cursor', open('cursor-ide', 'Cursor IDE')));
        group.add(this._linkRow('Cursor Agent', '', 'cursor', open('cursor-agent', 'Cursor Agent')));
        group.add(this._linkRow('Antigravity', '', 'antigravity', open('antigravity', 'Antigravity')));
        group.add(this._linkRow('OpenCode', _('Accounts connected in OpenCode'), 'opencode-go', open('opencode', 'OpenCode')));
        group.add(this._linkRow('GitHub Copilot', _('Through Copilot CLI or GitHub CLI'), 'copilot', () => this._view.push(this._copilotPage())));
        group.add(this._linkRow('Kimi CLI', '', 'kimi', open('kimi-cli', 'Kimi CLI')));
        group.add(this._linkRow('DeepSeek', _('API key'), 'deepseek', () => this._view.push(this._deepSeekPage())));
        const page = new Adw.PreferencesPage();
        page.add(group);
        return this._page(_('Add Account'), page);
    }

    private _copilotPage(): Adw.NavigationPage {
        const group = new Adw.PreferencesGroup({
            title: _('Where Are You Signed In to GitHub?'),
            description: _('VS Code keeps its Copilot sign-in private, so sign in once with one of these apps'),
        });
        group.add(this._linkRow('Copilot CLI', 'copilot → /login', 'copilot', () => this._view.push(this._candidatesPage('Copilot CLI', 'copilot-cli'))));
        group.add(this._linkRow('GitHub CLI', 'gh auth login', 'copilot', () => this._view.push(this._candidatesPage('GitHub CLI', 'github-cli'))));
        const page = new Adw.PreferencesPage();
        page.add(group);
        return this._page('GitHub Copilot', page);
    }

    private _candidatesPage(title: string, app: AccountApp): Adw.NavigationPage {
        const add = new Gtk.Button({label: _('Add'), css_classes: ['suggested-action'], sensitive: false, visible: false});
        const stack = new Gtk.Stack();
        stack.add_named(new Adw.Spinner(), 'searching');
        const navigation = this._page(title, stack, add);
        findCandidates(app, this._configured, this._cancellable).then(candidates => {
            if (!candidates.length) {
                stack.add_named(new Adw.StatusPage({title: _('No Signed-In Account Found'), description: emptyHint(app), icon_name: 'system-search-symbolic'}), 'empty');
                stack.visible_child_name = 'empty';
                return;
            }
            const page = new Adw.PreferencesPage();
            page.add(this._candidateGroup(candidates, add, _('Choose the accounts to add')));
            stack.add_named(page, 'found');
            stack.visible_child_name = 'found';
        }).catch(error => {
            if (!isCancellation(error))
                logError(error, 'Token Grill');
        });
        return navigation;
    }

    private _candidateGroup(candidates: Candidate[], add: Gtk.Button, description: string): Adw.PreferencesGroup {
        const list = new CandidateList(candidates, this._configured, this._extensionPath, description);
        add.visible = list.addable > 0;
        list.connectChanged(anySelected => {
            add.sensitive = anySelected;
        });
        add.connect('clicked', () => {
            this._onAdd(list.selected());
            this.close();
        });
        return list.group;
    }

    private _deepSeekPage(): Adw.NavigationPage {
        const add = new Gtk.Button({label: _('Add'), css_classes: ['suggested-action'], sensitive: false, visible: false});
        const page = new Adw.PreferencesPage();
        const navigation = this._page('DeepSeek', page, add);
        const search = async () => {
            const [openCode, settings] = await Promise.all([
                findCandidates('opencode', this._configured, this._cancellable),
                findCandidates('claude-settings', this._configured, this._cancellable),
            ]);
            return [...openCode.filter(candidate => candidate.kind === 'deepseek'), ...settings];
        };
        search().then(candidates => {
            if (candidates.length)
                page.add(this._candidateGroup(candidates, add, _('Keys found on this computer')));
            page.add(this._pasteGroup());
        }).catch(error => {
            if (!isCancellation(error))
                logError(error, 'Token Grill');
        });
        return navigation;
    }

    private _pasteGroup(): Adw.PreferencesGroup {
        const group = new Adw.PreferencesGroup({
            title: _('Paste an API Key'),
            description: _('Kept in the GNOME keyring, never in settings, and removed with the account'),
        });
        const entry = new Adw.PasswordEntryRow({title: _('API Key')});
        const save = new Gtk.Button({label: _('Save to Keyring'), css_classes: ['suggested-action'], valign: Gtk.Align.CENTER, sensitive: false});
        setAccessibleLabel(save, _('Save the API key to the keyring'));
        entry.connect('changed', () => {
            save.sensitive = entry.text.trim().length > 0;
        });
        save.connect('clicked', () => this._saveKey(entry, save));
        entry.add_suffix(save);
        group.add(entry);
        return group;
    }

    private _saveKey(entry: Adw.PasswordEntryRow, save: Gtk.Button): void {
        const provider = newProvider('deepseek', 'keyring', '');
        // With no keyring running, D-Bus can take about 25 seconds to give up.
        save.sensitive = false;
        save.label = _('Saving…');
        storeApiKey(provider.id, entry.text.trim(), this._cancellable).then(() => {
            this._onAdd([provider]);
            this.close();
        }).catch(error => {
            if (isCancellation(error))
                return;
            save.sensitive = true;
            save.label = _('Save to Keyring');
            presentKeyError(error, this);
        });
    }
}
