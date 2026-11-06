import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {readProviders} from '../core/config.js';
import {formatText} from '../core/i18n.js';
import type {ProviderInstance} from '../core/types.js';

function accountLabel(provider: ProviderInstance): string {
    return provider.enabled ? provider.displayName : formatText(_('%s (disabled)'), provider.displayName);
}

export class NotificationsPage extends Adw.PreferencesPage {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillNotificationsPage'}, this);
    }

    _settings: Gio.Settings;
    _providers: ProviderInstance[] = [];
    _account: Adw.ComboRow;
    _send: Gtk.Button;

    constructor(settings: Gio.Settings, window: Adw.PreferencesWindow) {
        super({title: _('Notifications'), icon_name: 'preferences-system-notifications-symbolic'});
        this._settings = settings;

        const alerts = new Adw.PreferencesGroup({
            title: _('Quota Alerts'),
            description: _('Each account sends at most one alert when its selected limit crosses a usage step'),
        });
        const enabled = new Adw.SwitchRow({
            title: _('Usage Notifications'),
            subtitle: _('Follow the quota window selected for each account'),
        });
        settings.bind('notifications-enabled', enabled, 'active', Gio.SettingsBindFlags.DEFAULT);
        const step = new Adw.SpinRow({
            title: _('Notification Step'),
            subtitle: _('Percentage of the limit between notifications'),
            adjustment: new Gtk.Adjustment({lower: 5, upper: 50, step_increment: 5, page_increment: 10}),
        });
        settings.bind('notification-step-percent', step, 'value', Gio.SettingsBindFlags.DEFAULT);
        alerts.add(enabled);
        alerts.add(step);
        this.add(alerts);

        const test = new Adw.PreferencesGroup({
            title: _('Test Notification'),
            description: _('Preview the current notification of an account without changing alert tracking'),
        });
        this._account = new Adw.ComboRow({title: _('Account')});
        const sendRow = new Adw.ActionRow({
            title: _('Send Test Notification'),
            subtitle: _('Works even when usage notifications are off'),
        });
        this._send = new Gtk.Button({label: _('Send Test'), css_classes: ['suggested-action'], valign: Gtk.Align.CENTER});
        this._send.connect('clicked', () => this._sendTest());
        sendRow.add_suffix(this._send);
        test.add(this._account);
        test.add(sendRow);
        this.add(test);

        this._updateAccounts();
        const providersId = settings.connect('changed::provider-instances-json', () => this._updateAccounts());
        const activeId = settings.connect('changed::active-provider-id', () => this._updateAccounts());
        window.connect('close-request', () => {
            settings.disconnect(providersId);
            settings.disconnect(activeId);
            return false;
        });
    }

    _updateAccounts(): void {
        this._providers = readProviders(this._settings);
        const activeId = this._settings.get_string('active-provider-id');
        const activeIndex = this._providers.findIndex(provider => provider.id === activeId);
        this._account.model = Gtk.StringList.new(this._providers.map(accountLabel));
        this._account.selected = Math.max(0, activeIndex);
        const hasAccounts = this._providers.length > 0;
        this._account.sensitive = hasAccounts;
        this._send.sensitive = hasAccounts;
    }

    _sendTest(): void {
        const provider = this._providers[this._account.selected];
        if (!provider)
            return;
        const request = {providerId: provider.id, nonce: GLib.uuid_string_random()};
        this._settings.set_string('notification-test-request', JSON.stringify(request));
    }
}
