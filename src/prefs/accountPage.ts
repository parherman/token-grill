import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {accentHex, normalizeAccent} from '../core/accent.js';
import {readProviders} from '../core/config.js';
import {isCancellation} from '../core/gio.js';
import {formatText} from '../core/i18n.js';
import {displayPath, expandPath} from '../core/paths.js';
import {providerMetadata} from '../core/providerMetadata.js';
import {topBarSummary} from '../core/topBar.js';
import {ACCENTS, type AccentColor, type AccountApp, type ProviderInstance} from '../core/types.js';
import {credentialLabel, credentialState} from './credentialStatus.js';
import {clearApiKey, presentKeyError, storeApiKey} from './keyStore.js';
import {validateProviderDraft, type ProviderValidationCode} from './providerValidation.js';
import {TRANSLATOR} from './translator.js';
import {accentName, setAccessibleLabel} from './widgets.js';

const PROVIDERS_KEY = 'provider-instances-json';

export interface AccountActions {
    update: (provider: ProviderInstance) => void;
    remove: (providerId: string) => void;
}

// App names are product names and stay as they are.
const APP_NAMES: Record<AccountApp, string> = {
    'codex-cli': 'Codex CLI',
    'claude-code': 'Claude Code',
    'kiro-cli': 'Kiro CLI',
    'antigravity': 'Antigravity',
    'opencode': 'OpenCode',
    'github-cli': 'GitHub CLI',
    'copilot-cli': 'Copilot CLI',
    'keyring': 'GNOME Keyring',
    'claude-settings': 'Claude Code',
    'kimi-cli': 'Kimi CLI',
    'cursor-ide': 'Cursor IDE',
    'cursor-agent': 'Cursor Agent',
};

// Apps whose sign-in is a file in the account home, so the home and file can be changed.
const FILE_APPS: AccountApp[] = ['codex-cli', 'claude-code', 'kiro-cli', 'antigravity', 'github-cli', 'claude-settings', 'kimi-cli', 'cursor-ide', 'cursor-agent'];

function validationMessage(code: ProviderValidationCode): string {
    const messages: Record<ProviderValidationCode, string> = {
        'required': _('This field is required'),
        'not-absolute': _('Use an absolute path or one that starts with ~/'),
        'duplicate-home': _('Another account already uses this home'),
    };
    return messages[code];
}

function markField(row: Adw.EntryRow, code: ProviderValidationCode | undefined): void {
    if (code) {
        row.add_css_class('error');
        row.tooltip_text = validationMessage(code);
    } else {
        row.remove_css_class('error');
        row.tooltip_text = null;
    }
}

function hexFromRgba(rgba: Gdk.RGBA): string {
    const channel = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0');
    return `#${channel(rgba.red)}${channel(rgba.green)}${channel(rgba.blue)}`;
}

function rgbaFromHex(hex: string): Gdk.RGBA {
    const rgba = new Gdk.RGBA();
    rgba.parse(hex);
    return rgba;
}

// One account: what users change often first, rare options folded away.
// Changes apply at once, like GNOME Settings.
export class AccountPage extends Adw.NavigationPage {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillAccountPage'}, this);
    }

    private readonly _settings: Gio.Settings;
    private readonly _actions: AccountActions;
    private readonly _cancellable = new Gio.Cancellable();
    private readonly _swatches = new Map<AccentColor, Gtk.ToggleButton>();
    private readonly _custom: Gtk.ColorDialogButton;
    private readonly _topBar: Adw.ActionRow;
    private _provider: ProviderInstance;
    private _changedId: number | null;

    constructor(settings: Gio.Settings, provider: ProviderInstance, actions: AccountActions) {
        super({title: provider.displayName, tag: provider.id});
        this._settings = settings;
        this._provider = provider;
        this._actions = actions;
        const metadata = providerMetadata(provider.kind);

        const page = new Adw.PreferencesPage();
        const header = new Adw.HeaderBar();
        const toolbar = new Adw.ToolbarView({content: page});
        toolbar.add_top_bar(header);
        this.set_child(toolbar);

        const main = new Adw.PreferencesGroup();
        const name = new Adw.EntryRow({title: _('Name'), text: provider.displayName, show_apply_button: true});
        name.connect('apply', () => this._rename(name));
        main.add(name);

        this._custom = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({title: _('Custom Color'), with_alpha: false}),
            rgba: rgbaFromHex(accentHex(provider.accent)),
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Custom Color'),
        });
        setAccessibleLabel(this._custom, _('Custom Color'));

        main.add(this._signedInRow());
        this._topBar = new Adw.ActionRow({title: _('Top Bar'), subtitle: this._topBarText()});
        main.add(this._topBar);

        // Kept near the top: the promise is that history is visible without scrolling.
        if (metadata.localHistorySupported && provider.app === metadata.apps[0]) {
            const history = new Adw.SwitchRow({
                title: _('Local History'),
                subtitle: _('Index token accounting without storing prompts or responses'),
                active: provider.localHistoryEnabled,
            });
            history.connect('notify::active', () => this._apply({localHistoryEnabled: history.active}));
            main.add(history);
        }
        page.add(main);

        const colors = new Adw.PreferencesGroup({title: _('Color')});
        colors.add(this._buildSwatches());
        page.add(colors);

        const more = new Adw.PreferencesGroup();
        more.add(this._moreOptions());
        page.add(more);
        page.add(this._removal());

        this._changedId = settings.connect(`changed::${PROVIDERS_KEY}`, () => this._onStoredChanged());
        this.connect('hidden', () => this._release());
        this.connect('destroy', () => this._release());
    }

    private _release(): void {
        this._cancellable.cancel();
        if (this._changedId !== null)
            this._settings.disconnect(this._changedId);
        this._changedId = null;
    }

    // The popup can change the top-bar choice while this page is open.
    private _onStoredChanged(): void {
        const stored = readProviders(this._settings).find(item => item.id === this._provider.id);
        if (!stored)
            return;
        this._provider = stored;
        this._topBar.subtitle = this._topBarText();
    }

    private _topBarText(): string {
        // Translators: the account's top-bar choice, then a hint.
        return formatText(_('%s · Change this in the popup'), topBarSummary(TRANSLATOR, this._provider.topBar));
    }

    private _apply(change: Partial<ProviderInstance>): void {
        this._provider = {...this._provider, ...change};
        this._actions.update(this._provider);
    }

    private _rename(row: Adw.EntryRow): void {
        const text = row.text.trim();
        if (!text) {
            markField(row, 'required');
            return;
        }
        markField(row, undefined);
        this.title = text;
        this._apply({displayName: text});
    }

    private _buildSwatches(): Gtk.Box {
        const box = new Gtk.Box({spacing: 4, margin_top: 8, margin_bottom: 8, halign: Gtk.Align.START});
        for (const color of ACCENTS) {
            const label = accentName(color);
            const button = new Gtk.ToggleButton({
                css_classes: ['tokengrill-swatch', `tokengrill-accent-${color}`],
                tooltip_text: label,
                valign: Gtk.Align.CENTER,
                active: color === this._provider.accent,
            });
            setAccessibleLabel(button, label);
            button.connect('clicked', () => this._chooseAccent(color));
            this._swatches.set(color, button);
            box.append(button);
        }
        this._custom.connect('notify::rgba', () => {
            const hex = hexFromRgba(this._custom.rgba);
            if (hex !== accentHex(this._provider.accent))
                this._chooseAccent(normalizeAccent(hex, providerMetadata(this._provider.kind).defaultAccent));
        });
        box.append(this._custom);
        return box;
    }

    private _chooseAccent(accent: ProviderInstance['accent']): void {
        if (accent !== this._provider.accent)
            this._apply({accent});
        for (const [color, button] of this._swatches)
            button.active = color === accent;
        // Stored first, so the custom button's handler sees this colour as current and ignores the echo.
        this._custom.rgba = rgbaFromHex(accentHex(accent));
    }

    private _signedInRow(): Adw.ActionRow {
        const provider = this._provider;
        const where = FILE_APPS.includes(provider.app) && provider.accountHome ? displayPath(provider.accountHome) : null;
        const app = APP_NAMES[provider.app];
        // Translators: an app name, then where its sign-in is read.
        const source = where ? formatText(_('%s · %s'), app, where) : app;
        const row = new Adw.ActionRow({title: _('Signed In With'), subtitle: source});
        credentialState(provider, this._cancellable).then(state => {
            row.subtitle = formatText(_('%s · %s'), source, credentialLabel(state));
        }).catch(error => {
            if (!isCancellation(error))
                logError(error, 'Token Grill');
        });
        return row;
    }

    private _moreOptions(): Adw.ExpanderRow {
        const provider = this._provider;
        const metadata = providerMetadata(provider.kind);
        const more = new Adw.ExpanderRow({title: _('More Options')});

        const live = new Adw.SwitchRow({
            title: _('Live Quota'),
            subtitle: _('Read the service quota endpoint using this account'),
            active: provider.liveUsageEnabled,
        });
        live.connect('notify::active', () => this._apply({liveUsageEnabled: live.active}));
        more.add_row(live);

        if (FILE_APPS.includes(provider.app)) {
            more.add_row(this._pathRow(_('Account Home'), provider.accountHome, 'accountHome'));
            more.add_row(this._pathRow(_('Sign-In File Override'), provider.authFileOverride ?? '', 'authFileOverride'));
            if (metadata.localHistorySupported && provider.app === metadata.apps[0])
                more.add_row(this._pathRow(_('Sessions Directory Override'), provider.sessionsDirectoryOverride ?? '', 'sessionsDirectoryOverride'));
        }

        if (metadata.measure === 'balance') {
            const warn = new Adw.SpinRow({
                title: _('Warn Below'),
                subtitle: _('Alert when the balance drops below this amount; 0 turns it off'),
                digits: 2,
                adjustment: new Gtk.Adjustment({lower: 0, upper: 100000, step_increment: 1, page_increment: 10, value: provider.lowBalance ?? 0}),
            });
            warn.connect('notify::value', () => this._apply({lowBalance: warn.value > 0 ? warn.value : null}));
            more.add_row(warn);
        }
        if (provider.app === 'keyring')
            more.add_row(this._replaceKeyRow());
        return more;
    }

    // Paths apply when confirmed, and only when valid.
    private _pathRow(title: string, value: string, field: 'accountHome' | 'authFileOverride' | 'sessionsDirectoryOverride'): Adw.EntryRow {
        const row = new Adw.EntryRow({title, text: value, show_apply_button: true});
        row.connect('apply', () => {
            const text = row.text.trim();
            const draft = {...this._provider, [field]: field === 'accountHome' ? text : text || null};
            // Two apps can share a home, such as Claude Code and DeepSeek in ~/.claude.
            const others = readProviders(this._settings).filter(item => item.accountHome && item.kind === this._provider.kind && item.app === this._provider.app);
            const {errors} = validateProviderDraft(draft, others, expandPath);
            markField(row, errors[field]);
            if (errors[field])
                return;
            this._apply({[field]: text ? expandPath(text) : null});
        });
        return row;
    }

    private _replaceKeyRow(): Adw.PasswordEntryRow {
        const row = new Adw.PasswordEntryRow({title: _('Replace API Key'), show_apply_button: true});
        row.connect('apply', () => {
            const key = row.text.trim();
            if (!key)
                return;
            storeApiKey(this._provider.id, key, this._cancellable).then(() => {
                row.text = '';
            }).catch(error => {
                presentKeyError(error, this);
            });
        });
        return row;
    }

    private _removal(): Adw.PreferencesGroup {
        const group = new Adw.PreferencesGroup({description: _('Credentials, sessions and files of the app are never changed')});
        const remove = new Adw.ButtonRow({title: _('Remove Account'), start_icon_name: 'user-trash-symbolic'});
        // The css_classes property would replace the classes the row sets on itself.
        remove.add_css_class('destructive-action');
        remove.connect('activated', () => this._confirmRemove());
        group.add(remove);
        return group;
    }

    private _confirmRemove(): void {
        const alert = new Adw.AlertDialog({
            heading: _('Remove Account?'),
            body: this._provider.app === 'keyring'
                ? _('This removes the account, its collected totals and its API key from the keyring.')
                : _('This removes the account and its collected totals from Token Grill. The app’s sign-in is untouched.'),
            close_response: 'cancel',
        });
        alert.add_response('cancel', _('Cancel'));
        alert.add_response('remove', _('Remove'));
        alert.set_response_appearance('remove', Adw.ResponseAppearance.DESTRUCTIVE);
        alert.connect('response', (_alert, response) => {
            if (response !== 'remove')
                return;
            if (this._provider.app === 'keyring')
                clearApiKey(this._provider.id, null).catch(error => logError(error, 'Token Grill'));
            this._actions.remove(this._provider.id);
        });
        alert.present(this);
    }
}
