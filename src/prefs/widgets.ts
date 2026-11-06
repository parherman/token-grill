import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {providerIconFile} from '../core/providerMetadata.js';
import type {AccentColor, ProviderKind} from '../core/types.js';

export function providerIcon(extensionPath: string, kind: ProviderKind): Gtk.Image {
    const file = Gio.File.new_for_path(`${extensionPath}/icons/providers/${providerIconFile(kind)}`);
    return new Gtk.Image({gicon: Gio.FileIcon.new(file)});
}

export function setAccessibleLabel(widget: Gtk.Widget, label: string): void {
    widget.update_property([Gtk.AccessibleProperty.LABEL], [label]);
}

export function accentName(color: AccentColor): string {
    const names: Record<AccentColor, string> = {
        blue: _('Blue'),
        teal: _('Teal'),
        green: _('Green'),
        yellow: _('Yellow'),
        orange: _('Orange'),
        red: _('Red'),
        pink: _('Pink'),
        purple: _('Purple'),
        slate: _('Slate'),
    };
    return names[color];
}
