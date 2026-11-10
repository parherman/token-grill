import Adw from 'gi://Adw';
import type Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {newProvider, QUOTA_WINDOW_PREFERENCES, readProviders} from '../core/config.js';
import {formatText} from '../core/i18n.js';
import {authFileCandidates, defaultHome, displayPath, expandPath, providerPaths} from '../core/paths.js';
import {PROVIDER_KINDS, providerMetadata} from '../core/providerMetadata.js';
import {ACCENTS, type AccentColor, type ProviderInstance, type ProviderKind} from '../core/types.js';
import {
    firstProviderValidationError,
    type ProviderValidationCode,
    type ProviderValidationResult,
    validateProviderDraft,
} from './providerValidation.js';
import {accentName, setAccessibleLabel} from './widgets.js';

interface GeneratedDefaults {
    name: string;
    home: string;
    accent: AccentColor;
}

function generatedDefaults(kind: ProviderKind): GeneratedDefaults {
    const metadata = providerMetadata(kind);
    return {name: metadata.label, home: displayPath(defaultHome(kind)), accent: metadata.defaultAccent};
}

function validationMessage(code: ProviderValidationCode): string {
    const messages: Record<ProviderValidationCode, string> = {
        'required': _('This field is required'),
        'not-absolute': _('Use an absolute path or one that starts with ~/'),
        'duplicate-home': _('Another account already uses this home'),
    };
    return messages[code];
}

function quotaWindowLabels(): string[] {
    return [_('Automatic'), _('Five-hour'), _('Weekly'), _('Monthly')];
}

function historySubtitle(kind: ProviderKind): string {
    const metadata = providerMetadata(kind);
    if (metadata.localHistorySupported)
        return _('Index token accounting without storing prompts or responses');
    return formatText(_('%s does not keep local history; live quota is still available'), metadata.label);
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

function optionalPath(value: string): string | null {
    return value.trim() ? expandPath(value) : null;
}

export class ProviderEditorDialog extends Adw.Dialog {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillProviderEditorDialog'}, this);
    }

    _settings: Gio.Settings;
    _base: ProviderInstance;
    _isNew: boolean;
    _onSave: (provider: ProviderInstance) => void;
    _onDelete: (providerId: string) => void;
    _generated: GeneratedDefaults;
    _accent: AccentColor;
    _swatches = new Map<AccentColor, Gtk.ToggleButton>();
    _saveButton: Gtk.Button;
    _kind: Adw.ComboRow;
    _name: Adw.EntryRow;
    _home: Adw.EntryRow;
    _auth: Adw.EntryRow;
    _sessions: Adw.EntryRow;
    _resolved: Adw.ActionRow;
    _showInPanel: Adw.SwitchRow;
    _quotaWindow: Adw.ComboRow;
    _live: Adw.SwitchRow;
    _history: Adw.SwitchRow;

    constructor(
        settings: Gio.Settings,
        provider: ProviderInstance | null,
        onSave: (provider: ProviderInstance) => void,
        onDelete: (providerId: string) => void
    ) {
        super({
            title: provider ? _('Edit Account') : _('Add Account'),
            content_width: 560,
            content_height: 680,
        });
        this._settings = settings;
        this._isNew = !provider;
        this._base = provider ?? newProvider('codex', '');
        this._onSave = onSave;
        this._onDelete = onDelete;
        this._generated = generatedDefaults(this._base.kind);
        this._accent = provider?.accent ?? this._generated.accent;

        const header = new Adw.HeaderBar({show_start_title_buttons: false, show_end_title_buttons: false});
        const cancel = new Gtk.Button({label: _('Cancel')});
        cancel.connect('clicked', () => this.close());
        header.pack_start(cancel);
        this._saveButton = new Gtk.Button({label: _('Save'), css_classes: ['suggested-action']});
        this._saveButton.connect('clicked', () => this._save());
        header.pack_end(this._saveButton);

        const page = new Adw.PreferencesPage();
        const toolbar = new Adw.ToolbarView({content: page});
        toolbar.add_top_bar(header);
        this.set_child(toolbar);

        const identity = new Adw.PreferencesGroup({
            title: _('Identity'),
            description: _('Give this account a clear name so it is easy to select in the top bar'),
        });
        this._kind = new Adw.ComboRow({
            title: _('Provider'),
            model: Gtk.StringList.new(PROVIDER_KINDS.map(kind => providerMetadata(kind).label)),
            selected: PROVIDER_KINDS.indexOf(this._base.kind),
        });
        this._name = new Adw.EntryRow({title: _('Display Name'), text: provider?.displayName ?? this._generated.name});
        this._home = new Adw.EntryRow({title: _('Account Home'), text: provider?.accountHome ?? this._generated.home});
        identity.add(this._kind);
        identity.add(this._name);
        identity.add(this._home);
        page.add(identity);

        const accent = new Adw.PreferencesGroup({
            title: _('Account Accent'),
            description: _('Accent colors tell accounts of the same service apart'),
        });
        accent.add(this._buildSwatches());
        page.add(accent);

        const locations = new Adw.PreferencesGroup({
            title: _('Data Locations'),
            description: _('Paths are absolute or begin with ~/; overrides are optional'),
        });
        const advanced = new Adw.ExpanderRow({
            title: _('Advanced Path Overrides'),
            subtitle: _('Use only for nonstandard installations'),
        });
        this._auth = new Adw.EntryRow({title: _('Auth File Override'), text: provider?.authFileOverride ?? ''});
        this._sessions = new Adw.EntryRow({
            title: _('Sessions Directory Override'),
            text: provider?.sessionsDirectoryOverride ?? '',
        });
        advanced.add_row(this._auth);
        advanced.add_row(this._sessions);
        locations.add(advanced);
        this._resolved = new Adw.ActionRow({title: _('Resolved Paths'), subtitle_selectable: true});
        locations.add(this._resolved);
        page.add(locations);

        const panel = new Adw.PreferencesGroup({title: _('Panel Display')});
        this._showInPanel = new Adw.SwitchRow({
            title: _('Show in Top Bar'),
            subtitle: _('Use this account as a selectable top bar tab'),
            active: this._base.showInPanel,
        });
        this._quotaWindow = new Adw.ComboRow({
            title: _('Quota Window'),
            subtitle: _('The limit that drives this account’s panel reading'),
            model: Gtk.StringList.new(quotaWindowLabels()),
            selected: QUOTA_WINDOW_PREFERENCES.indexOf(this._base.panelWindowPreference),
        });
        panel.add(this._showInPanel);
        panel.add(this._quotaWindow);
        page.add(panel);

        const collection = new Adw.PreferencesGroup({title: _('Collection')});
        this._live = new Adw.SwitchRow({
            title: _('Live Quota'),
            subtitle: _('Read the service quota endpoint using this account'),
            active: this._base.liveUsageEnabled,
        });
        this._history = new Adw.SwitchRow({title: _('Local History'), active: this._base.localHistoryEnabled});
        collection.add(this._live);
        collection.add(this._history);
        page.add(collection);

        if (provider)
            page.add(this._buildRemoval());

        this._updateCapabilities();
        this._refresh();

        this._kind.connect('notify::selected', () => this._onKindChanged());
        for (const row of [this._name, this._home, this._auth, this._sessions]) {
            row.connect('notify::text', () => {
                this._markDirty();
                this._refresh();
            });
        }
        for (const row of [this._showInPanel, this._live, this._history])
            row.connect('notify::active', () => this._markDirty());
        this._quotaWindow.connect('notify::selected', () => this._markDirty());
        this.connect('close-attempt', () => this._confirmDiscard());
    }

    _buildSwatches(): Gtk.Box {
        const box = new Gtk.Box({spacing: 6, margin_top: 8, margin_bottom: 8, halign: Gtk.Align.START});
        let first: Gtk.ToggleButton | null = null;
        for (const color of ACCENTS) {
            const name = accentName(color);
            const button = new Gtk.ToggleButton({
                css_classes: ['tokengrill-swatch', `tokengrill-accent-${color}`],
                tooltip_text: name,
            });
            setAccessibleLabel(button, formatText(_('%s Accent'), name));
            button.set_group(first);
            button.active = color === this._accent;
            button.connect('toggled', () => {
                if (!button.active)
                    return;
                this._accent = color;
                this._markDirty();
            });
            first ??= button;
            this._swatches.set(color, button);
            box.append(button);
        }
        return box;
    }

    _buildRemoval(): Adw.PreferencesGroup {
        const removal = new Adw.PreferencesGroup({
            title: _('Remove Account'),
            description: _('Credentials, sessions, and files of the service are never changed'),
        });
        const remove = new Adw.ButtonRow({title: _('Delete Account'), start_icon_name: 'user-trash-symbolic'});
        // The css_classes property would replace the classes the row sets on itself.
        remove.add_css_class('destructive-action');
        remove.connect('activated', () => this._confirmDelete());
        removal.add(remove);
        return removal;
    }

    _selectedKind(): ProviderKind {
        return PROVIDER_KINDS[this._kind.selected] ?? this._base.kind;
    }

    _markDirty(): void {
        this.can_close = false;
    }

    _onKindChanged(): void {
        if (this._isNew) {
            const next = generatedDefaults(this._selectedKind());
            if (this._name.text === this._generated.name)
                this._name.text = next.name;
            if (this._home.text === this._generated.home)
                this._home.text = next.home;
            if (this._accent === this._generated.accent)
                this._selectAccent(next.accent);
            this._generated = next;
        }
        this._markDirty();
        this._updateCapabilities();
        this._refresh();
    }

    _selectAccent(color: AccentColor): void {
        for (const [swatchColor, button] of this._swatches) {
            if (swatchColor === color)
                button.active = true;
        }
    }

    _updateCapabilities(): void {
        const kind = this._selectedKind();
        const metadata = providerMetadata(kind);
        if (!metadata.localHistorySupported)
            this._history.active = false;
        this._history.sensitive = metadata.localHistorySupported;
        this._history.subtitle = historySubtitle(kind);
        this._sessions.sensitive = metadata.localHistorySupported;
        if (metadata.quotaWindows.length === 1)
            this._quotaWindow.selected = QUOTA_WINDOW_PREFERENCES.indexOf(metadata.defaultQuotaWindow);
        this._quotaWindow.sensitive = metadata.quotaWindows.length > 1;
    }

    _draft(): ProviderInstance {
        return {
            ...this._base,
            kind: this._selectedKind(),
            displayName: this._name.text.trim(),
            accountHome: this._home.text.trim(),
            authFileOverride: this._auth.text.trim() || null,
            sessionsDirectoryOverride: this._sessions.text.trim() || null,
        };
    }

    _refresh(): ProviderValidationResult {
        const draft = this._draft();
        const result = validateProviderDraft(draft, readProviders(this._settings), expandPath);
        const {errors} = result;
        markField(this._name, errors.displayName);
        markField(this._home, errors.accountHome);
        markField(this._auth, errors.authFileOverride);
        markField(this._sessions, errors.sessionsDirectoryOverride);

        const firstError = firstProviderValidationError(result);
        this._saveButton.sensitive = result.valid;
        this._saveButton.tooltip_text = firstError ? validationMessage(firstError) : null;

        if (errors.accountHome === 'not-absolute' || errors.accountHome === 'required' ||
            errors.authFileOverride || errors.sessionsDirectoryOverride) {
            this._resolved.subtitle = _('Enter valid paths to see the resolved locations');
        } else {
            const paths = providerPaths(draft);
            const credentials = draft.kind === 'cursor' ? authFileCandidates(draft) : [paths.authFile];
            this._resolved.subtitle = [...credentials, ...paths.historyDirectories].map(displayPath).join(' · ');
        }
        return result;
    }

    _save(): void {
        if (!this._refresh().valid)
            return;
        const draft = this._draft();
        const metadata = providerMetadata(draft.kind);
        const quotaWindow = metadata.quotaWindows.length === 1
            ? metadata.defaultQuotaWindow
            : QUOTA_WINDOW_PREFERENCES[this._quotaWindow.selected] ?? metadata.defaultQuotaWindow;
        this._onSave({
            ...draft,
            accountHome: expandPath(draft.accountHome),
            authFileOverride: optionalPath(this._auth.text),
            sessionsDirectoryOverride: optionalPath(this._sessions.text),
            accent: this._accent,
            showInPanel: this._showInPanel.active,
            liveUsageEnabled: this._live.active,
            localHistoryEnabled: metadata.localHistorySupported && this._history.active,
            panelWindowPreference: quotaWindow,
        });
        this.force_close();
    }

    _confirmDiscard(): void {
        const alert = new Adw.AlertDialog({
            heading: _('Discard Changes?'),
            body: _('Your changes to this account have not been saved.'),
            close_response: 'keep',
        });
        alert.add_response('keep', _('Keep Editing'));
        alert.add_response('discard', _('Discard'));
        alert.set_response_appearance('discard', Adw.ResponseAppearance.DESTRUCTIVE);
        alert.connect('response', (_alert, response) => {
            if (response === 'discard')
                this.force_close();
        });
        alert.present(this);
    }

    _confirmDelete(): void {
        const alert = new Adw.AlertDialog({
            heading: _('Delete Account?'),
            body: _('This removes the account’s Token Grill configuration and collected aggregates. Credentials, sessions, and files of the service are untouched.'),
            close_response: 'cancel',
        });
        alert.add_response('cancel', _('Cancel'));
        alert.add_response('delete', _('Delete'));
        alert.set_response_appearance('delete', Adw.ResponseAppearance.DESTRUCTIVE);
        alert.connect('response', (_alert, response) => {
            if (response !== 'delete')
                return;
            this.force_close();
            this._onDelete(this._base.id);
        });
        alert.present(this);
    }
}
