import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {activeProvider} from '../core/display.js';
import {accountGroups, type ChooserGroup} from '../core/popupModel.js';
import {topBarGroups} from '../core/topBar.js';
import type {
    PanelDisplayStyle,
    PanelPercentageMode,
    ProviderInstance,
    ProviderKind,
    ProviderRuntimeState,
    ProviderSnapshot,
} from '../core/types.js';
import {accentDot, providerIcon} from './accountChip.js';
import {InfoItem, ProviderDetail, StaticMenuItem} from './providerCard.js';
import {createToggleGroup, type ToggleItem, type ToggleSegment} from './toggleGroup.js';
import {createTopBarEntry, entryDescription} from './topBar.js';

export interface IndicatorController {
    refreshAll(): void;
    refreshProvider(providerId: string): void;
    selectProvider(providerId: string): void;
    selectService(kind: ProviderKind): void;
    toggleLimit(providerId: string, key: string): void;
    setAutomatic(providerId: string, on: boolean): void;
    openPreferences(): void;
    setPaused(paused: boolean): void;
}

export interface IndicatorState {
    providers: ProviderInstance[];
    snapshots: Map<string, ProviderSnapshot>;
    runtimeStates: Map<string, ProviderRuntimeState>;
    activeProviderId: string;
    mode: PanelPercentageMode;
    style: PanelDisplayStyle;
    accountPicker: 'buttons' | 'dropdown';
    paused: boolean;
}

// Owned children of the panel button and its menu; they are destroyed with it.
interface IndicatorParts {
    panelBox: St.BoxLayout;
    menuBox: St.BoxLayout;
    chooser: ChooserItem;
    accountMenu: PopupMenu.PopupSubMenuMenuItem;
    chooserSeparator: PopupMenu.PopupSeparatorMenuItem;
    detail: ProviderDetail;
    empty: InfoItem;
    refreshAll: StayOpenMenuItem;
    automatic: PopupMenu.PopupSwitchMenuItem;
}

// Three short account names fit per row; longer names get two so they stay readable.
const SHORT_NAME_LENGTH = 9;

// Light text on the menu means a dark shell style.
function hasLightText(actor: St.Widget): boolean {
    const color = actor.get_theme_node().get_foreground_color();
    return (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255 >= 0.5;
}

function toggleContent(): St.BoxLayout {
    return new St.BoxLayout({style_class: 'tokengrill-toggle-content', x_align: Clutter.ActorAlign.CENTER});
}

function attentionIcon(): St.Icon {
    return new St.Icon({icon_name: 'dialog-warning-symbolic', icon_size: 12, y_align: Clutter.ActorAlign.CENTER});
}

// A plain menu item that runs its action and keeps the menu open, so progress
// stays visible after "Refresh All Accounts".
class StayOpenMenuItem extends PopupMenu.PopupMenuItem {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillStayOpenMenuItem'}, this);
    }

    private _callback: () => void;

    constructor(text: string, callback: () => void) {
        super(text);
        this._callback = callback;
    }

    override activate(_event: Clutter.Event): void {
        if (this.sensitive)
            this._callback();
    }
}

// Providers form a libadwaita-style toggle group; a provider's accounts use the
// flat variant below it.
class ChooserItem extends StaticMenuItem {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillChooserItem'}, this);
    }

    private _extensionPath: string;
    private _onSelect: (providerId: string) => void;
    private _lastByKind = new Map<ChooserGroup['kind'], string>();
    private _box: St.BoxLayout;
    private _segments: ToggleSegment[] = [];
    private _key = '';

    constructor(extensionPath: string, onSelect: (providerId: string) => void) {
        super('tokengrill-chooser');
        this._extensionPath = extensionPath;
        this._onSelect = onSelect;
        this._box = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style_class: 'tokengrill-chooser-box'});
        this.add_child(this._box);
    }

    update(groups: ChooserGroup[], showAccounts: boolean): void {
        const selectedGroup = groups.find(group => group.selected);
        const selectedAccount = selectedGroup?.accounts.find(account => account.selected);
        if (selectedGroup && selectedAccount)
            this._lastByKind.set(selectedGroup.kind, selectedAccount.id);
        // Rebuild only when something visible changed, so keyboard focus survives
        // the frequent refresh-progress updates.
        const key = JSON.stringify([groups, showAccounts]);
        if (key === this._key)
            return;
        this._key = key;
        const focused = global.stage.get_key_focus();
        const focusedId = this._segments.find(segment => segment.button === focused)?.id ?? null;
        this._box.destroy_all_children();
        this._segments = [];
        this._addRow(groups.map(group => this._providerItem(group)), false);
        const accounts = showAccounts && selectedGroup && selectedGroup.accounts.length > 1 ? selectedGroup.accounts : [];
        const perRow = accounts.every(account => account.shortName.length <= SHORT_NAME_LENGTH) ? 3 : 2;
        for (let start = 0; start < accounts.length; start += perRow) {
            this._addRow(accounts.slice(start, start + perRow).map(account => {
                const content = toggleContent();
                content.add_child(accentDot(account, 8));
                content.add_child(new St.Label({text: account.shortName, y_align: Clutter.ActorAlign.CENTER}));
                if (account.attention)
                    content.add_child(attentionIcon());
                const names = account.attention ? [account.displayName, _('needs attention')] : [account.displayName];
                return {
                    id: `account:${account.id}`,
                    child: content,
                    checked: account.selected,
                    accessibleName: names.join(', '),
                    onActivate: () => this._onSelect(account.id),
                };
            }), true);
        }
        if (!focusedId)
            return;
        const target = this._segments.find(segment => segment.id === focusedId) ??
            this._segments.find(segment => segment.button.checked);
        target?.button.grab_key_focus();
    }

    private _providerItem(group: ChooserGroup): ToggleItem {
        const count = group.accounts.length;
        const content = toggleContent();
        content.add_child(providerIcon(this._extensionPath, group.kind, 16));
        if (count > 1) {
            content.add_child(new St.Label({
                text: `${count}`,
                style_class: 'tokengrill-toggle-count',
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }
        if (group.attention)
            content.add_child(attentionIcon());
        const names = [group.label];
        const detail = count > 1 ? ngettext('%d account', '%d accounts', count).format(count) : group.accounts[0]?.displayName;
        if (detail && detail !== group.label)
            names.push(detail);
        if (group.attention)
            names.push(_('needs attention'));
        return {
            id: `provider:${group.kind}`,
            child: content,
            checked: group.selected,
            accessibleName: names.join(', '),
            onActivate: () => {
                const remembered = group.accounts.find(account => account.id === this._lastByKind.get(group.kind));
                const account = remembered ?? group.accounts[0];
                if (account)
                    this._onSelect(account.id);
            },
        };
    }

    private _addRow(items: ToggleItem[], flat: boolean): void {
        const {group, segments} = createToggleGroup(items, flat);
        this._box.add_child(group);
        this._segments.push(...segments);
    }
}

export class TokenGrillIndicator extends PanelMenu.Button {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillIndicator'}, this);
    }

    private _extensionPath: string;
    private _ui: IndicatorParts | null;
    private _themeContext: St.ThemeContext | null;
    private _themeChangedId: number | null;
    private _controller: IndicatorController | null = null;
    private _openStateId: number | null = null;
    private _entries = new Map<ProviderKind, St.BoxLayout>();
    private _accountMenuKey = '';
    private _state: IndicatorState | null = null;

    constructor(extensionPath: string, controller: IndicatorController) {
        super(0.5, _('Token Grill'));
        this._extensionPath = extensionPath;
        const panelBox = new St.BoxLayout({style_class: 'panel-status-menu-box tokengrill-panel-box'});
        this.add_child(panelBox);

        const menu = this.menu as PopupMenu.PopupMenu;
        const menuBox = menu.box;
        menuBox.add_style_class_name('tokengrill-menu');

        const chooser = new ChooserItem(extensionPath, id => controller.selectProvider(id));
        menu.addMenuItem(chooser);
        // The account list as a submenu, when the account picker is set to a dropdown.
        const accountMenu = new PopupMenu.PopupSubMenuMenuItem('', false);
        menu.addMenuItem(accountMenu);
        const chooserSeparator = new PopupMenu.PopupSeparatorMenuItem();
        menu.addMenuItem(chooserSeparator);
        const detail = new ProviderDetail(extensionPath, {
            refresh: provider => controller.refreshProvider(provider.id),
            toggleLimit: (provider, key) => controller.toggleLimit(provider.id, key),
            setAutomatic: (provider, on) => controller.setAutomatic(provider.id, on),
        });
        menu.addMenuItem(detail);
        const empty = new InfoItem();
        empty.setText(_('No accounts yet. Add one in Preferences.'));
        menu.addMenuItem(empty);
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const refreshAll = new StayOpenMenuItem(_('Refresh All Accounts'), () => controller.refreshAll());
        menu.addMenuItem(refreshAll);
        const automatic = new PopupMenu.PopupSwitchMenuItem(_('Automatic Updates'), true);
        automatic.connectObject('toggled', (_item: PopupMenu.PopupSwitchMenuItem, state: boolean) => controller.setPaused(!state), automatic);
        menu.addMenuItem(automatic);
        if (Main.sessionMode.allowSettings)
            menu.addAction(_('Preferences…'), () => controller.openPreferences());
        this._ui = {panelBox, menuBox, chooser, accountMenu, chooserSeparator, detail, empty, refreshAll, automatic};
        this._controller = controller;
        // Opening the menu from a service's entry shows that service.
        this._openStateId = menu.connect('open-state-changed', (_menu, open) => {
            const hovered = [...this._entries].find(([, entry]) => entry.hover);
            if (open && hovered)
                controller.selectService(hovered[0]);
            if (open && this._state)
                this._renderMenu(this._state);
        });

        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._themeChangedId = this._themeContext.connect('changed', () => this._updateThemeClasses());
    }

    // St has no currentColor, so the toggle tints and meter colours in
    // stylesheet.css are chosen per shell style from the actual text colour of
    // the menu and of the panel.  Theme nodes exist
    // only on stage, so this runs from update() once the menu has been added.
    private _updateThemeClasses(): void {
        const {menuBox, panelBox} = this._ui!;
        if (hasLightText(panelBox))
            panelBox.remove_style_class_name('tokengrill-light');
        else
            panelBox.add_style_class_name('tokengrill-light');
        if (hasLightText(menuBox))
            menuBox.remove_style_class_name('tokengrill-light');
        else
            menuBox.add_style_class_name('tokengrill-light');
        if (St.Settings.get().high_contrast)
            menuBox.add_style_class_name('tokengrill-high-contrast');
        else
            menuBox.remove_style_class_name('tokengrill-high-contrast');
    }

    update(state: IndicatorState): void {
        this._state = state;
        this._updateThemeClasses();
        this._renderPanel(state);
        this._renderMenu(state);
    }

    private _renderPanel(state: IndicatorState): void {
        const {panelBox} = this._ui!;
        panelBox.destroy_all_children();
        this._entries.clear();
        const groups = topBarGroups(state.providers, state.snapshots);
        if (!groups.length) {
            panelBox.add_child(new St.Icon({
                gicon: Gio.icon_new_for_string(`${this._extensionPath}/token-grill-symbolic.svg`),
                style_class: 'system-status-icon',
            }));
            panelBox.set_accessible_name(state.providers.length
                ? _('Token Grill, no accounts shown in the top bar')
                : _('Token Grill, no provider accounts configured'));
            return;
        }
        for (const group of groups) {
            const entry = createTopBarEntry(this._extensionPath, group, state.style, state.mode);
            this._entries.set(group.kind, entry);
            panelBox.add_child(entry);
        }
        panelBox.set_accessible_name(groups.map(group => entryDescription(group, state.mode)).join('. '));
    }

    private _renderMenu(state: IndicatorState): void {
        const {chooser, chooserSeparator, detail, empty, refreshAll, automatic} = this._ui!;
        const current = activeProvider(state.providers, state.activeProviderId);
        const groups = accountGroups(state.providers, current?.id ?? '', state.snapshots);
        const dropdown = state.accountPicker === 'dropdown';
        chooser.visible = groups.length > 1 || groups.some(group => group.accounts.length > 1);
        chooserSeparator.visible = chooser.visible;
        if (chooser.visible)
            chooser.update(groups, !dropdown);
        this._updateAccountMenu(groups.find(group => group.selected)?.accounts ?? [], dropdown);
        const snapshot = current ? state.snapshots.get(current.id) ?? null : null;
        const runtime = current ? state.runtimeStates.get(current.id) ?? null : null;
        detail.update(current, snapshot, state.mode, runtime);

        const hasProviders = current !== null;
        empty.visible = !hasProviders;
        const busy = [...state.runtimeStates.values()].filter(runtimeState => runtimeState.phase !== 'idle').length;
        refreshAll.visible = hasProviders;
        refreshAll.label.set_text(busy
            ? ngettext('Refreshing %d Account…', 'Refreshing %d Accounts…', busy).format(busy)
            : _('Refresh All Accounts'));
        refreshAll.setSensitive(busy === 0);
        automatic.visible = hasProviders;
        automatic.setToggleState(!state.paused);
    }

    private _updateAccountMenu(accounts: ChooserGroup['accounts'], dropdown: boolean): void {
        const {accountMenu} = this._ui!;
        accountMenu.visible = dropdown && accounts.length > 1;
        if (!accountMenu.visible)
            return;
        const selected = accounts.find(account => account.selected);
        accountMenu.label.set_text(selected?.displayName ?? '');
        const key = JSON.stringify(accounts);
        if (key === this._accountMenuKey)
            return;
        this._accountMenuKey = key;
        accountMenu.menu.removeAll();
        for (const account of accounts) {
            const item = new PopupMenu.PopupMenuItem(account.displayName);
            item.insert_child_at_index(accentDot(account, 8), 1);
            item.setOrnament(account.selected ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            if (account.attention)
                item.add_child(attentionIcon());
            item.connectObject('activate', () => this._controller!.selectProvider(account.id), item);
            accountMenu.menu.addMenuItem(item);
        }
    }

    override destroy(): void {
        this._state = null;
        (this.menu as PopupMenu.PopupMenu).disconnect(this._openStateId!);
        this._openStateId = null;
        this._themeContext!.disconnect(this._themeChangedId!);
        this._themeChangedId = null;
        this._themeContext = null;
        this._controller = null;
        this._entries.clear();
        this._ui = null;
        super.destroy();
    }
}
