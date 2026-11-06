import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {formatText} from '../core/i18n.js';
import {providerMetadata} from '../core/providerMetadata.js';
import type {ProviderInstance} from '../core/types.js';
import {providerIcon, setAccessibleLabel} from './widgets.js';

function moveButton(iconName: string, label: string, sensitive: boolean): Gtk.Button {
    const button = new Gtk.Button({
        icon_name: iconName,
        tooltip_text: label,
        css_classes: ['flat'],
        valign: Gtk.Align.CENTER,
        sensitive,
    });
    setAccessibleLabel(button, label);
    return button;
}

export class ReorderDialog extends Adw.Dialog {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillReorderDialog'}, this);
    }

    _providers: ProviderInstance[];
    _extensionPath: string;
    _list: Gtk.ListBox;

    constructor(providers: ProviderInstance[], extensionPath: string, onSave: (providers: ProviderInstance[]) => void) {
        super({title: _('Reorder Accounts'), content_width: 520, content_height: 560});
        this._providers = [...providers];
        this._extensionPath = extensionPath;

        const header = new Adw.HeaderBar({show_start_title_buttons: false, show_end_title_buttons: false});
        const cancel = new Gtk.Button({label: _('Cancel')});
        cancel.connect('clicked', () => this.close());
        header.pack_start(cancel);
        const save = new Gtk.Button({label: _('Save'), css_classes: ['suggested-action']});
        save.connect('clicked', () => {
            onSave(this._providers);
            this.close();
        });
        header.pack_end(save);

        const group = new Adw.PreferencesGroup({
            description: _('Drag accounts, or use the arrow buttons, to set their order in Preferences and the Token Grill menu'),
        });
        this._list = new Gtk.ListBox({selection_mode: Gtk.SelectionMode.NONE, css_classes: ['boxed-list']});
        group.add(this._list);
        const page = new Adw.PreferencesPage();
        page.add(group);

        const toolbar = new Adw.ToolbarView({content: page});
        toolbar.add_top_bar(header);
        this.set_child(toolbar);
        this._render();
    }

    _render(): void {
        this._list.remove_all();
        const last = this._providers.length - 1;
        this._providers.forEach((provider, index) => {
            const {label} = providerMetadata(provider.kind);
            const row = new Adw.ActionRow({
                title: provider.displayName,
                subtitle: provider.enabled ? label : formatText(_('%s · Disabled'), label),
            });
            row.add_prefix(new Gtk.Image({icon_name: 'list-drag-handle-symbolic'}));
            row.add_prefix(providerIcon(this._extensionPath, provider.kind));

            const up = moveButton('go-up-symbolic', formatText(_('Move %s Up'), provider.displayName), index > 0);
            up.connect('clicked', () => this._move(provider.id, index - 1));
            row.add_suffix(up);
            const down = moveButton('go-down-symbolic', formatText(_('Move %s Down'), provider.displayName), index < last);
            down.connect('clicked', () => this._move(provider.id, index + 1));
            row.add_suffix(down);

            const drag = new Gtk.DragSource({actions: Gdk.DragAction.MOVE});
            drag.connect('prepare', () => Gdk.ContentProvider.new_for_value(provider.id));
            row.add_controller(drag);
            const drop = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);
            drop.connect('drop', (_target, draggedId, _x, y) => {
                this._drop(String(draggedId), provider.id, y > row.get_height() / 2);
                return true;
            });
            row.add_controller(drop);
            this._list.append(row);
        });
    }

    _move(providerId: string, requestedIndex: number): void {
        const provider = this._providers.find(item => item.id === providerId);
        if (!provider)
            return;
        const remaining = this._providers.filter(item => item.id !== providerId);
        remaining.splice(Math.max(0, Math.min(remaining.length, requestedIndex)), 0, provider);
        this._providers = remaining;
        this._render();
    }

    _drop(providerId: string, targetId: string, after: boolean): void {
        if (providerId === targetId)
            return;
        const provider = this._providers.find(item => item.id === providerId);
        if (!provider)
            return;
        const remaining = this._providers.filter(item => item.id !== providerId);
        const targetIndex = remaining.findIndex(item => item.id === targetId);
        if (targetIndex < 0)
            return;
        remaining.splice(targetIndex + (after ? 1 : 0), 0, provider);
        this._providers = remaining;
        this._render();
    }
}
