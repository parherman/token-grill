// The selected account's details, built from native GNOME Shell menu items so
// the popup follows the shell theme, accent colour, and light/dark style.
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import {formatTime} from 'resource:///org/gnome/shell/misc/dateUtils.js';
import * as Animation from 'resource:///org/gnome/shell/ui/animation.js';
import * as BarLevel from 'resource:///org/gnome/shell/ui/barLevel.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {displayLabel, displayPercent, pressureClass, selectWindow} from '../core/display.js';
import {historyMetrics} from '../core/historyMetrics.js';
import {errorText, historySummary, refreshStatusText, windowCaption} from '../core/popupModel.js';
import {providerMetadata} from '../core/providerMetadata.js';
import {durationUntil, formatDuration} from '../core/timeMath.js';
import type {
    CanonicalQuotaWindow,
    LimitResetCreditSummary,
    PanelPercentageMode,
    ProviderInstance,
    ProviderRuntimeState,
    ProviderSnapshot,
    UsageWindow,
} from '../core/types.js';
import {providerMark} from './accountChip.js';
import {TRANSLATOR} from './translator.js';

export type QuotaWindow = Exclude<CanonicalQuotaWindow, 'other'>;

export interface ProviderDetailActions {
    refresh: (provider: ProviderInstance) => void;
    selectWindow: (provider: ProviderInstance, window: QuotaWindow) => void;
}

const WINDOWS: QuotaWindow[] = ['five-hour', 'weekly', 'monthly'];

function windowName(window: QuotaWindow): string {
    if (window === 'five-hour')
        return _('Five-hour');
    if (window === 'weekly')
        return _('Weekly');
    return _('Monthly');
}

function label(text: string, styleClass: string, params: Partial<St.Label.ConstructorProps> = {}): St.Label {
    return new St.Label({text, style_class: styleClass, y_align: Clutter.ActorAlign.CENTER, ...params});
}

function wrappingLabel(styleClass: string, params: Partial<St.Label.ConstructorProps> = {}): St.Label {
    const actor = label('', styleClass, params);
    actor.clutter_text.line_wrap = true;
    actor.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return actor;
}

function clockLabel(timestamp: number): string {
    return formatTime(new Date(timestamp), {timeOnly: true});
}

function countdown(timestamp: number): string {
    const parts = durationUntil(timestamp);
    return parts ? formatDuration(TRANSLATOR, parts) : '';
}

// Display-only rows stay reactive (so the theme does not render them as
// insensitive) but are never activatable, hovered, or focused.
export class StaticMenuItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillStaticMenuItem'}, this);
    }

    constructor(styleClass: string) {
        super({reactive: true, activate: false, hover: false, can_focus: false, style_class: styleClass});
        this.track_hover = false;
    }
}

// Account name, plan, refresh status, and a refresh button.
class IdentityItem extends StaticMenuItem {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillIdentityItem'}, this);
    }

    private _markBin: St.Bin;
    private _title: St.Label;
    private _subtitle: St.Label;
    private _status: St.Label;
    private _spinner: Animation.Spinner;
    private _refreshButton: St.Button;
    private _busy = false;

    constructor(onRefresh: () => void) {
        super('tokengrill-identity');
        this._markBin = new St.Bin({y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._markBin);

        const text = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'tokengrill-identity-text',
        });
        this._title = label('', 'tokengrill-title');
        this._subtitle = wrappingLabel('tokengrill-caption');
        this._status = wrappingLabel('tokengrill-caption');
        text.add_child(this._title);
        text.add_child(this._subtitle);
        text.add_child(this._status);
        this.add_child(text);

        this._spinner = new Animation.Spinner(16, {animate: true, hideOnStop: true});
        this._spinner.y_align = Clutter.ActorAlign.CENTER;
        this.add_child(this._spinner);

        this._refreshButton = new St.Button({
            style_class: 'icon-button flat',
            can_focus: true,
            y_align: Clutter.ActorAlign.CENTER,
            child: new St.Icon({icon_name: 'view-refresh-symbolic'}),
            accessible_name: _('Refresh This Account'),
        });
        this._refreshButton.connect('clicked', () => onRefresh());
        this.add_child(this._refreshButton);
    }

    setMark(actor: Clutter.Actor): void {
        this._markBin.set_child(actor);
    }

    setText(title: string, subtitle: string, status: string): void {
        this._title.set_text(title);
        this._subtitle.set_text(subtitle);
        this._status.set_text(status);
    }

    setBusy(busy: boolean): void {
        if (busy === this._busy)
            return;
        this._busy = busy;
        // The spinner takes the button's place while this account refreshes.
        this._refreshButton.visible = !busy;
        if (busy)
            this._spinner.play();
        else
            this._spinner.stop();
    }
}

// One quota window.  Activating it chooses the window shown in the top bar
// without closing the menu; the dot ornament marks the current choice.
class WindowItem extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillWindowItem'}, this);
    }

    private _title: string;
    private _onSelect: () => void;
    private _warning: St.Icon;
    private _value: St.Label;
    private _meter: BarLevel.BarLevel;
    private _caption: St.Label;

    constructor(title: string, onSelect: () => void) {
        super({style_class: 'tokengrill-window-item'});
        this._title = title;
        this._onSelect = onSelect;
        this.setOrnament(PopupMenu.Ornament.NO_DOT);

        const box = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style_class: 'tokengrill-window-box'});
        const head = new St.BoxLayout({x_expand: true});
        const nameLabel = label(title, 'tokengrill-window-name', {x_expand: true});
        this._warning = new St.Icon({icon_name: 'dialog-warning-symbolic', style_class: 'popup-menu-icon', visible: false});
        this._value = label('—', 'tokengrill-value');
        head.add_child(nameLabel);
        head.add_child(this._warning);
        head.add_child(this._value);

        this._meter = new BarLevel.BarLevel({
            style_class: 'slider tokengrill-meter',
            x_expand: true,
            reactive: false,
            can_focus: false,
            accessible_name: _('%s usage').format(title),
        });
        this._caption = wrappingLabel('tokengrill-caption');
        box.add_child(head);
        box.add_child(this._meter);
        box.add_child(this._caption);
        this.add_child(box);
        this.label_actor = nameLabel;
    }

    override activate(_event: Clutter.Event): void {
        this._onSelect();
    }

    update(window: UsageWindow | null, mode: PanelPercentageMode, selected: boolean): void {
        const percent = displayPercent(window, mode);
        const pressure = pressureClass(window);
        const value = window ? displayLabel(TRANSLATOR, window, mode) : _('Unavailable');
        this._value.set_text(value);
        this._meter.value = percent ?? 0;
        this._meter.visible = percent !== null;
        this._caption.set_text(windowCaption(TRANSLATOR, window));
        // Pressure is shown with an icon as well as the number, never colour alone.
        this._warning.visible = pressure !== 'neutral';
        this.setOrnament(selected ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NO_DOT);

        const parts = [this._title, value];
        if (window?.resetAt)
            parts.push(_('resets in %s').format(countdown(window.resetAt)));
        if (pressure === 'critical')
            parts.push(_('almost exhausted'));
        else if (pressure === 'warning')
            parts.push(_('running low'));
        if (selected)
            parts.push(_('shown in the top bar'));
        this.accessible_name = parts.join(', ');
    }
}

// A non-interactive line of text, optionally led by an icon.
export class InfoItem extends StaticMenuItem {
    static {
        GObject.registerClass({GTypeName: 'TokenGrillInfoItem'}, this);
    }

    private _label: St.Label;

    constructor(iconName: string | null = null) {
        super('tokengrill-info-item');
        if (iconName)
            this.add_child(new St.Icon({icon_name: iconName, style_class: 'popup-menu-icon', y_align: Clutter.ActorAlign.START}));
        this._label = wrappingLabel('tokengrill-caption', {x_expand: true});
        this.add_child(this._label);
        this.label_actor = this._label;
    }

    setText(text: string | null): void {
        this._label.set_text(text ?? '');
        this.visible = Boolean(text);
    }
}

function creditsMenuText(summary: LimitResetCreditSummary, count: number): string {
    if (summary.stale)
        return ngettext('Reset Credits · %d Available (Cached)', 'Reset Credits · %d Available (Cached)', count).format(count);
    return ngettext('Reset Credits · %d Available', 'Reset Credits · %d Available', count).format(count);
}

function creditsNoneText(summary: LimitResetCreditSummary | null): string | null {
    return summary?.availableCount === 0 ? _('Reset credits: none available') : null;
}

export class ProviderDetail extends PopupMenu.PopupMenuSection {
    private _extensionPath: string;
    private _actions: ProviderDetailActions;
    private _instance: ProviderInstance | null = null;
    private _identity: IdentityItem;
    private _error: InfoItem;
    private _windows = new Map<QuotaWindow, WindowItem>();
    private _credits: PopupMenu.PopupSubMenuMenuItem;
    private _creditsNone: InfoItem;
    private _history: InfoItem;
    private _items: PopupMenu.PopupBaseMenuItem[];
    private _creditsKey = '';

    constructor(extensionPath: string, actions: ProviderDetailActions) {
        super();
        this._extensionPath = extensionPath;
        this._actions = actions;
        this._identity = new IdentityItem(() => this._withInstance(instance => this._actions.refresh(instance)));
        this._error = new InfoItem('dialog-warning-symbolic');
        for (const window of WINDOWS) {
            const item = new WindowItem(windowName(window), () => this._withInstance(instance => this._actions.selectWindow(instance, window)));
            this._windows.set(window, item);
        }
        this._credits = new PopupMenu.PopupSubMenuMenuItem(_('Reset Credits'), false);
        this._creditsNone = new InfoItem();
        this._history = new InfoItem();
        this._items = [this._identity, this._error, ...this._windows.values(), this._credits, this._creditsNone, this._history];
        for (const item of this._items)
            this.addMenuItem(item);
    }

    private _withInstance(callback: (instance: ProviderInstance) => void): void {
        if (this._instance)
            callback(this._instance);
    }

    update(
        instance: ProviderInstance | null,
        snapshot: ProviderSnapshot | null,
        mode: PanelPercentageMode,
        runtime: ProviderRuntimeState | null
    ): void {
        this._instance = instance;
        if (!instance) {
            for (const item of this._items)
                item.visible = false;
            return;
        }
        const metadata = providerMetadata(instance.kind);
        this._identity.visible = true;
        this._identity.setMark(providerMark(this._extensionPath, instance, 28));
        // Provider, account, and plan, skipping repeats such as a plan named after the provider.
        const subtitle: string[] = [];
        for (const part of [metadata.label, snapshot?.account, snapshot?.plan]) {
            if (part && !subtitle.some(existing => existing.toLowerCase() === part.toLowerCase()))
                subtitle.push(part);
        }
        this._identity.setText(instance.displayName, subtitle.join(' · '), refreshStatusText(TRANSLATOR, snapshot, runtime, clockLabel));
        this._identity.setBusy(runtime !== null && runtime.phase !== 'idle');

        this._error.setText(errorText(TRANSLATOR, snapshot, instance));

        const preference = instance.panelWindowPreference;
        const automatic = preference === 'automatic' ? selectWindow(snapshot, preference) : null;
        for (const [canonical, item] of this._windows) {
            const window = snapshot?.windows.find(candidate => candidate.canonicalWindow === canonical) ?? null;
            item.visible = metadata.quotaWindows.includes(canonical) && (canonical !== 'weekly' || window !== null);
            if (!item.visible)
                continue;
            const selected = preference === canonical || automatic?.canonicalWindow === canonical;
            item.update(window, mode, selected);
        }

        this._updateCredits(snapshot?.resetCredits ?? null);
        this._history.setText(historySummary(TRANSLATOR, historyMetrics(instance, snapshot, runtime)));
    }

    private _updateCredits(summary: LimitResetCreditSummary | null): void {
        const count = summary?.availableCount ?? 0;
        this._credits.visible = summary !== null && count > 0;
        this._creditsNone.setText(creditsNoneText(summary));
        if (!summary || count === 0) {
            this._credits.menu.close();
            return;
        }
        this._credits.label.set_text(creditsMenuText(summary, count));
        this._credits.accessible_name = this._credits.label.text;
        const key = JSON.stringify([count, summary.stale, summary.fetchedAt, summary.credits]);
        if (key === this._creditsKey)
            return;
        this._creditsKey = key;
        this._credits.menu.removeAll();
        const credits = summary.credits;
        if (credits.length < count) {
            const note = new InfoItem();
            if (credits.length)
                note.setText(_('%d of %d expiry dates supplied by the provider').format(credits.length, count));
            else
                note.setText(ngettext('%d usage-limit reset available', '%d usage-limit resets available', count).format(count));
            this._credits.menu.addMenuItem(note);
        }
        for (const credit of credits) {
            const title = credit.title || _('Usage-limit reset');
            const row = new InfoItem();
            if (credit.expiresAt)
                row.setText(_('%s · expires %s (in %s)').format(title, formatTime(new Date(credit.expiresAt)), countdown(credit.expiresAt)));
            else
                row.setText(_('%s · expiry unavailable').format(title));
            this._credits.menu.addMenuItem(row);
        }
    }
}
