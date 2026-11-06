import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

interface ToggleRowOptions {
    key: string;
    title: string;
    subtitle: string;
    choices: Array<[string, string]>;
}

function toggleRow(settings: Gio.Settings, {key, title, subtitle, choices}: ToggleRowOptions): Adw.ActionRow {
    const row = new Adw.ActionRow({title, subtitle});
    const group = new Adw.ToggleGroup({valign: Gtk.Align.CENTER});
    for (const [name, label] of choices)
        group.add(new Adw.Toggle({name, label}));
    settings.bind(key, group, 'active-name', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(group);
    return row;
}

export class GeneralPage extends Adw.PreferencesPage {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillGeneralPage'}, this);
    }

    constructor(settings: Gio.Settings) {
        super({title: _('General'), icon_name: 'preferences-system-symbolic'});

        const appearance = new Adw.PreferencesGroup({
            title: _('Panel Appearance'),
            description: _('Choose what the active account looks like in the top bar'),
        });
        appearance.add(toggleRow(settings, {
            key: 'panel-percentage-mode',
            title: _('Percentage'),
            subtitle: _('Show how much of the limit is left, or how much is used'),
            choices: [['remaining', _('Remaining')], ['used', _('Used')]],
        }));
        appearance.add(toggleRow(settings, {
            key: 'panel-display-style',
            title: _('Panel Style'),
            subtitle: _('How the selected account’s reading appears in the top bar'),
            choices: [['text', _('Percentage')], ['ring', _('Ring')], ['bar', _('Bar')]],
        }));
        this.add(appearance);

        const updates = new Adw.PreferencesGroup({title: _('Updates')});
        const interval = new Adw.SpinRow({
            title: _('Refresh Interval'),
            subtitle: _('Seconds between quota updates'),
            adjustment: new Gtk.Adjustment({lower: 60, upper: 3600, step_increment: 60, page_increment: 300}),
        });
        settings.bind('refresh-interval-seconds', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
        updates.add(interval);
        this.add(updates);
    }
}
