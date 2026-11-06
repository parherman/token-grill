import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {readProviders, writeProviders} from '../core/config.js';
import {isCancellation} from '../core/gio.js';
import {formatText} from '../core/i18n.js';
import {reorderProviders} from '../core/providerOrder.js';
import type {ProviderInstance} from '../core/types.js';
import {credentialLabel, credentialState, providerSubtitle} from './credentialStatus.js';
import {DiscoverDialog} from './discoverDialog.js';
import {discoverAccounts} from './discovery.js';
import {ProviderEditorDialog} from './providerEditorDialog.js';
import {ReorderDialog} from './reorderDialog.js';
import {providerIcon, setAccessibleLabel} from './widgets.js';

export class ProvidersPage extends Adw.PreferencesPage {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillProvidersPage'}, this);
    }

    _settings: Gio.Settings;
    _window: Adw.PreferencesWindow;
    _extensionPath: string;
    _group: Adw.PreferencesGroup | null = null;
    _cancellable = new Gio.Cancellable();

    constructor(settings: Gio.Settings, window: Adw.PreferencesWindow, extensionPath: string) {
        super({title: _('Providers'), icon_name: 'system-users-symbolic'});
        this._settings = settings;
        this._window = window;
        this._extensionPath = extensionPath;
        window.connect('close-request', () => {
            this._cancellable.cancel();
            return false;
        });
        this._render();
    }

    _render(): void {
        this._cancellable.cancel();
        this._cancellable = new Gio.Cancellable();
        if (this._group)
            this.remove(this._group);

        const providers = readProviders(this._settings);
        this._group = new Adw.PreferencesGroup({
            title: _('Accounts'),
            description: _('Select an account to edit it'),
            header_suffix: this._buildHeaderActions(providers),
        });
        if (!providers.length) {
            this._group.add(new Adw.ActionRow({
                title: _('No Accounts Yet'),
                subtitle: _('Add one, or use Discover to find accounts already signed in'),
            }));
        }
        for (const provider of providers)
            this._group.add(this._buildRow(provider));

        const add = new Adw.ButtonRow({title: _('Add Account…'), start_icon_name: 'list-add-symbolic'});
        add.connect('activated', () => this._edit(null));
        this._group.add(add);
        this.add(this._group);
    }

    _buildHeaderActions(providers: ProviderInstance[]): Gtk.Box {
        const box = new Gtk.Box({spacing: 6, valign: Gtk.Align.CENTER});
        const reorder = new Gtk.Button({label: _('Reorder…'), css_classes: ['flat'], sensitive: providers.length >= 2});
        reorder.connect('clicked', () => this._reorder(providers));
        box.append(reorder);
        const discover = new Gtk.Button({
            label: _('Discover…'),
            css_classes: ['flat'],
            tooltip_text: _('Find accounts already signed in on this computer'),
        });
        discover.connect('clicked', () => this._discover());
        box.append(discover);
        return box;
    }

    _buildRow(provider: ProviderInstance): Adw.ActionRow {
        const row = new Adw.ActionRow({
            title: provider.displayName,
            subtitle: providerSubtitle(provider, _('Checking credentials…')),
            activatable: true,
        });
        const cancellable = this._cancellable;
        credentialState(provider, cancellable).then(state => {
            if (!cancellable.is_cancelled())
                row.subtitle = providerSubtitle(provider, credentialLabel(state));
        }).catch(error => {
            if (!isCancellation(error))
                logError(error, 'Token Grill');
        });
        row.add_prefix(providerIcon(this._extensionPath, provider.kind));

        const enabled = new Gtk.Switch({
            active: provider.enabled,
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Enable collection'),
        });
        enabled.connect('notify::active', () => this._setEnabled(provider.id, enabled.active));
        row.add_suffix(enabled);

        const editLabel = formatText(_('Edit %s'), provider.displayName);
        const edit = new Gtk.Button({
            icon_name: 'document-edit-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: editLabel,
            css_classes: ['flat'],
        });
        setAccessibleLabel(edit, editLabel);
        edit.connect('clicked', () => this._edit(provider));
        row.add_suffix(edit);
        row.connect('activated', () => this._edit(provider));
        return row;
    }

    _setEnabled(providerId: string, enabled: boolean): void {
        const providers = readProviders(this._settings).map(provider =>
            provider.id === providerId ? {...provider, enabled} : provider);
        writeProviders(this._settings, providers);
    }

    _persist(providers: ProviderInstance[]): void {
        writeProviders(this._settings, reorderProviders(providers, providers.map(provider => provider.id)));
        this._render();
    }

    _edit(provider: ProviderInstance | null): void {
        const onSave = (value: ProviderInstance) => {
            const providers = readProviders(this._settings);
            const index = providers.findIndex(item => item.id === value.id);
            if (index >= 0)
                providers[index] = value;
            else
                providers.push(value);
            this._persist(providers);
        };
        const onDelete = (providerId: string) => {
            this._persist(readProviders(this._settings).filter(item => item.id !== providerId));
        };
        new ProviderEditorDialog(this._settings, provider, onSave, onDelete).present(this._window);
    }

    _reorder(providers: ProviderInstance[]): void {
        new ReorderDialog(providers, this._extensionPath, ordered => this._persist(ordered)).present(this._window);
    }

    _discover(): void {
        const providers = readProviders(this._settings);
        const {found, candidates} = discoverAccounts(providers);
        if (found.length) {
            const onAdd = (selected: ProviderInstance[]) => this._persist([...providers, ...selected]);
            new DiscoverDialog(found, this._extensionPath, onAdd).present(this._window);
            return;
        }
        const alert = candidates
            ? new Adw.AlertDialog({
                heading: _('All Discovered Accounts Are Already Configured'),
                body: _('Every account home found on this computer is already in Token Grill.'),
            })
            : new Adw.AlertDialog({
                heading: _('No New Accounts Found'),
                body: _('Token Grill looked for Codex and Claude homes named ~/.codex* and ~/.claude*, ' +
                    'the Kiro CLI data store, and Antigravity homes in ~/.gemini, ~/.antigravity, and ~/.config/Antigravity.'),
            });
        alert.add_response('close', _('Close'));
        alert.present(this._window);
    }
}
