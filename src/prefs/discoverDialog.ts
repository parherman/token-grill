import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {formatText} from '../core/i18n.js';
import {displayPath} from '../core/paths.js';
import {providerMetadata} from '../core/providerMetadata.js';
import type {ProviderInstance} from '../core/types.js';
import {providerIcon} from './widgets.js';

export class DiscoverDialog extends Adw.Dialog {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillDiscoverDialog'}, this);
    }

    constructor(found: ProviderInstance[], extensionPath: string, onAdd: (providers: ProviderInstance[]) => void) {
        super({title: _('Discover Accounts'), content_width: 520, content_height: 520});

        const header = new Adw.HeaderBar({show_start_title_buttons: false, show_end_title_buttons: false});
        const cancel = new Gtk.Button({label: _('Cancel')});
        cancel.connect('clicked', () => this.close());
        header.pack_start(cancel);
        const add = new Gtk.Button({label: _('Add'), css_classes: ['suggested-action']});
        header.pack_end(add);

        const group = new Adw.PreferencesGroup({description: _('Select the accounts Token Grill should monitor')});
        const checks = found.map(provider => {
            const check = new Gtk.CheckButton({active: true, valign: Gtk.Align.CENTER});
            const row = new Adw.ActionRow({
                title: provider.displayName,
                // Translators: a service name, then the account's home directory.
                subtitle: formatText(_('%s · %s'), providerMetadata(provider.kind).label, displayPath(provider.accountHome)),
                activatable_widget: check,
            });
            row.add_prefix(check);
            row.add_suffix(providerIcon(extensionPath, provider.kind));
            group.add(row);
            return check;
        });
        for (const check of checks) {
            check.connect('toggled', () => {
                add.sensitive = checks.some(item => item.active);
            });
        }
        add.connect('clicked', () => {
            onAdd(found.filter((_provider, index) => checks[index]?.active));
            this.close();
        });

        const page = new Adw.PreferencesPage();
        page.add(group);
        const toolbar = new Adw.ToolbarView({content: page});
        toolbar.add_top_bar(header);
        this.set_child(toolbar);
    }
}
