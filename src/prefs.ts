import type Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {migrateProviderSettings} from './core/config.js';
import {DataPage} from './prefs/dataPage.js';
import {GeneralPage} from './prefs/generalPage.js';
import {NotificationsPage} from './prefs/notificationsPage.js';
import {ProvidersPage} from './prefs/providersPage.js';

export default class TokenGrillPreferences extends ExtensionPreferences {
    override fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();
        migrateProviderSettings(settings);

        const display = window.get_display();
        const css = new Gtk.CssProvider();
        css.load_from_path(`${this.path}/prefs.css`);
        Gtk.StyleContext.add_provider_for_display(display, css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        window.connect('close-request', () => {
            Gtk.StyleContext.remove_provider_for_display(display, css);
            return false;
        });

        window.add(new GeneralPage(settings));
        window.add(new ProvidersPage(settings, window, this.path));
        window.add(new NotificationsPage(settings, window));
        window.add(new DataPage());
        return Promise.resolve();
    }
}
