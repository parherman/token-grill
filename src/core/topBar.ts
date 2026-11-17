// What the top bar shows: one entry per service, holding the accounts the user
// ticked in the popup.  Pure, so the Shell code only draws the result.
import {limitName, mostUsedWindow} from './display.js';
import type {Translator} from './i18n.js';
import {BALANCE_KEY} from './types.js';
import type {
    AccentValue,
    Balance,
    CanonicalQuotaWindow,
    ProviderInstance,
    ProviderKind,
    ProviderSnapshot,
    TopBarSelection,
    UsageWindow,
} from './types.js';

const WINDOW_RANK: Record<CanonicalQuotaWindow, number> = {
    'five-hour': 0,
    'weekly': 1,
    'monthly': 2,
    'other': 3,
};

type WindowsOf = Pick<ProviderSnapshot, 'windows'> | null | undefined;

export interface TopBarAccount {
    id: string;
    name: string;
    accent: AccentValue;
    limits: UsageWindow[];
    balance: Balance | null;
    // The balance is below the amount the user asked to be warned at.
    low: boolean;
    // Nothing to draw: the ticked limits are not in the latest reading.
    missing: boolean;
}

export interface TopBarGroup {
    kind: ProviderKind;
    accounts: TopBarAccount[];
}

export function limitKey(window: Pick<UsageWindow, 'id' | 'canonicalWindow'>): string {
    return window.canonicalWindow === 'other' ? window.id : window.canonicalWindow;
}

// The popup's order: five-hour, weekly, monthly, then other limits as the service lists them.
export function orderedLimits(snapshot: WindowsOf): UsageWindow[] {
    return [...snapshot?.windows ?? []].sort((a, b) => WINDOW_RANK[a.canonicalWindow] - WINDOW_RANK[b.canonicalWindow]);
}

export function isShown(instance: Pick<ProviderInstance, 'topBar'>): boolean {
    return instance.topBar.automatic || instance.topBar.limits.length > 0;
}

export function shownLimits(instance: Pick<ProviderInstance, 'topBar'>, snapshot: WindowsOf): UsageWindow[] {
    if (instance.topBar.automatic) {
        const pressing = mostUsedWindow(snapshot ?? null);
        return pressing ? [pressing] : [];
    }
    return orderedLimits(snapshot).filter(window => instance.topBar.limits.includes(limitKey(window)));
}

function inPopupOrder(keys: string[], snapshot: WindowsOf): string[] {
    const order = orderedLimits(snapshot).map(limitKey);
    const known = order.filter(key => keys.includes(key));
    return [...known, ...keys.filter(key => !order.includes(key))];
}

export function toggleLimit(instance: Pick<ProviderInstance, 'topBar'>, key: string, snapshot: WindowsOf): TopBarSelection {
    if (instance.topBar.automatic) {
        const [pressing] = shownLimits(instance, snapshot);
        const kept = pressing ? limitKey(pressing) : key;
        // With no automatic switch for a sole quota, the checked row acts as an on/off control.
        if (snapshot?.windows.length === 1 && pressing && kept === key)
            return {automatic: false, limits: []};
        // Keep the automatically shown quota when the user switches to manual selection.
        return {automatic: false, limits: inPopupOrder([...new Set([kept, key])], snapshot)};
    }
    const current = instance.topBar.limits;
    const limits = current.includes(key) ? current.filter(item => item !== key) : [...current, key];
    return {automatic: false, limits: inPopupOrder(limits, snapshot)};
}

export function setAutomatic(selection: TopBarSelection, on: boolean): TopBarSelection {
    return on ? {automatic: true, limits: []} : {automatic: false, limits: selection.limits};
}

// One line for preferences, which have no readings: limits are named from their keys.
export function topBarSummary(tr: Translator, selection: TopBarSelection): string {
    const {_} = tr;
    if (selection.automatic)
        return _('Picked automatically');
    if (!selection.limits.length)
        return _('Not in the top bar');
    return selection.limits.map(key => {
        if (key === BALANCE_KEY)
            return _('Balance');
        const canonical = (['five-hour', 'weekly', 'monthly'] as const).find(window => window === key);
        return canonical ? limitName(tr, {id: canonical, canonicalWindow: canonical, label: ''}) : key.replaceAll('_', ' ');
    }).join(', ');
}

export function topBarGroups(providers: ProviderInstance[], snapshots: Map<string, ProviderSnapshot>): TopBarGroup[] {
    const groups: TopBarGroup[] = [];
    for (const provider of providers) {
        if (!provider.enabled || !isShown(provider))
            continue;
        let group = groups.find(item => item.kind === provider.kind);
        if (!group) {
            group = {kind: provider.kind, accounts: []};
            groups.push(group);
        }
        const snapshot = snapshots.get(provider.id);
        const limits = shownLimits(provider, snapshot);
        // Pick Automatically shows the balance meter of a balance service, so it warns too.
        const showsBalance = provider.topBar.limits.includes(BALANCE_KEY) || limits.some(window => limitKey(window) === BALANCE_KEY);
        const balance = showsBalance ? snapshot?.balance ?? null : null;
        const low = balance !== null && provider.lowBalance !== null && balance.amount < provider.lowBalance;
        group.accounts.push({id: provider.id, name: provider.displayName, accent: provider.accent, limits, balance, low, missing: !limits.length && !balance});
    }
    return groups;
}
