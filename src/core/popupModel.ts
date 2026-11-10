// Pure presentation helpers for the top-bar popup.  Kept free of GNOME imports
// so the wording and grouping can be unit-tested.
import {formatTokenCount, type HistoryMetrics} from './historyMetrics.js';
import {formatText, type Translator} from './i18n.js';
import {providerMetadata} from './providerMetadata.js';
import {durationUntil, formatDuration} from './timeMath.js';
import type {LimitResetCredit, ProviderInstance, ProviderKind, ProviderRuntimeState, ProviderSnapshot, UsageWindow} from './types.js';

export interface ChooserAccount {
    id: string;
    displayName: string;
    shortName: string;
    accent: ProviderInstance['accent'];
    selected: boolean;
    attention: boolean;
}

export interface ChooserGroup {
    kind: ProviderKind;
    label: string;
    accounts: ChooserAccount[];
    selected: boolean;
    attention: boolean;
}

type SnapshotLookup = Pick<Map<string, Pick<ProviderSnapshot, 'error'> | null>, 'get'>;

// Drops a leading provider name ("Codex - Work" → "Work") so account
// buttons stay short; names that merely contain the provider are kept.
export function shortAccountName(displayName: string, providerLabel: string): string {
    const escaped = providerLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = displayName.match(new RegExp(`^${escaped}\\s*[-–—·:/|]\\s*(.+)$`, 'i'));
    return match?.[1] ? match[1].trim() : displayName;
}

export function accountGroups(providers: ProviderInstance[], activeId: string, snapshots: SnapshotLookup): ChooserGroup[] {
    const enabled = providers.filter(provider => provider.enabled);
    const active = enabled.find(provider => provider.id === activeId) || enabled[0] || null;
    const groups: ChooserGroup[] = [];
    for (const provider of enabled) {
        let group = groups.find(item => item.kind === provider.kind);
        if (!group) {
            group = {kind: provider.kind, label: providerMetadata(provider.kind).label, accounts: [], selected: false, attention: false};
            groups.push(group);
        }
        const selected = provider.id === active?.id;
        const attention = Boolean(snapshots.get(provider.id)?.error);
        group.accounts.push({
            id: provider.id,
            displayName: provider.displayName,
            shortName: shortAccountName(provider.displayName, group.label),
            accent: provider.accent,
            selected,
            attention,
        });
        group.selected ||= selected;
        group.attention ||= attention;
    }
    return groups;
}

function formatQuotaNumber(value: number): string {
    return value.toLocaleString(undefined, {maximumFractionDigits: 6});
}

function quotaValueLabel(tr: Translator, window: Partial<UsageWindow>): string {
    const {_} = tr;
    if (window.unit !== 'credits' || window.used == null || !Number.isFinite(window.used))
        return '';
    const used = formatQuotaNumber(window.used);
    if (window.limit == null || !Number.isFinite(window.limit) || window.limit <= 0)
        return formatText(_('%s credits used · pooled or unlimited'), used);
    return formatText(_('%s of %s credits'), used, formatQuotaNumber(window.limit));
}

export function windowPace(tr: Translator, window: Partial<UsageWindow> | null, now = Date.now()): string | null {
    if (!window || window.percent == null || !Number.isFinite(window.percent) || window.percent < 0 || window.percent > 1)
        return null;
    let seconds = window.durationSeconds ?? null;
    if (seconds === null && window.canonicalWindow === 'five-hour')
        seconds = 18000;
    else if (seconds === null && window.canonicalWindow === 'weekly')
        seconds = 604800;
    if (seconds === null || seconds <= 0 || !Number.isFinite(seconds * 1000) || window.resetAt == null || !Number.isFinite(window.resetAt) || !Number.isFinite(now))
        return null;
    const start = window.resetAt - seconds * 1000;
    if (now < start || now >= window.resetAt)
        return null;
    const reserve = Math.round(((now - start) / (seconds * 1000) - window.percent) * 100);
    const {_} = tr;
    if (reserve > 0)
        return formatText(_('%d%% in reserve'), reserve);
    if (reserve < 0)
        return formatText(_('%d%% ahead of pace'), -reserve);
    return _('On pace');
}

export function windowCaption(tr: Translator, window: Partial<UsageWindow> | null, dateTime: (timestamp: number) => string, now = Date.now()): string {
    const {_} = tr;
    if (!window)
        return _('No data yet');
    const quota = quotaValueLabel(tr, window);
    const resetAt = window.resetAt ?? null;
    const parts = durationUntil(resetAt, now);
    if (!parts || resetAt === null || Number.isNaN(new Date(resetAt).getTime())) {
        const unknown = _('Reset time unknown');
        return quota ? formatText(_('%s · %s'), quota, unknown) : unknown;
    }
    let reset: string;
    if (parts.expired && resetAt < now)
        reset = formatText(_('Reset time passed (%s)'), dateTime(resetAt));
    else if (parts.totalMinutes < 1)
        reset = formatText(_('Resets now (%s)'), dateTime(resetAt));
    else
        reset = formatText(_('Resets in %s (%s)'), formatDuration(tr, parts, true), dateTime(resetAt));
    return quota ? formatText(_('%s · %s'), quota, reset) : reset;
}

export function creditExpiryText(tr: Translator, credit: LimitResetCredit, dateTime: (timestamp: number) => string, now = Date.now()): string {
    const {_} = tr;
    const title = credit.title || _('Usage-limit reset');
    const expiresAt = credit.expiresAt;
    const parts = durationUntil(expiresAt, now);
    if (!parts || expiresAt === null || Number.isNaN(new Date(expiresAt).getTime()))
        return formatText(_('%s · Expiry unavailable'), title);
    if (parts.expired)
        return formatText(_('%s · Expired (%s)'), title, dateTime(expiresAt));
    return formatText(_('%s · Expires in %s (%s)'), title, formatDuration(tr, parts, true), dateTime(expiresAt));
}

function updatedText(tr: Translator, clockText: string, fetchedAt: number, now: number): string {
    const {_, ngettext} = tr;
    const minutes = Math.max(0, Math.floor((now - fetchedAt) / 60000));
    if (minutes < 1)
        return formatText(_('Updated %s · just now'), clockText);
    if (minutes < 60)
        return formatText(ngettext('Updated %s · %d min ago', 'Updated %s · %d min ago', minutes), clockText, minutes);
    const hours = Math.floor(minutes / 60);
    return formatText(ngettext('Updated %s · %d h ago', 'Updated %s · %d h ago', hours), clockText, hours);
}

export function refreshStatusText(
    tr: Translator,
    snapshot: Pick<ProviderSnapshot, 'quotaFetchedAt'> | null,
    runtime: Pick<ProviderRuntimeState, 'phase' | 'outcome' | 'completedAt'> | null,
    clock: (timestamp: number) => string,
    now = Date.now()
): string {
    const {_} = tr;
    switch (runtime?.phase) {
    case 'queued':
        return _('Waiting to refresh…');
    case 'fetching-limits':
        return _('Refreshing limits…');
    case 'fetching-reset-credits':
        return _('Limits updated, checking reset credits…');
    case 'scanning-history':
        return _('Limits updated, scanning history…');
    }
    const fetchedAt = snapshot?.quotaFetchedAt ?? null;
    if (runtime?.outcome === 'failed' && fetchedAt)
        return formatText(_('Refresh failed · showing data from %s'), clock(fetchedAt));
    if (runtime?.outcome === 'failed')
        return _('Refresh failed');
    if (runtime?.outcome === 'partial')
        return _('Limits updated · some sources unavailable');
    if (runtime?.outcome === 'unchanged' && runtime.completedAt)
        return formatText(_('Checked %s · no change'), clock(runtime.completedAt));
    if (fetchedAt)
        return updatedText(tr, clock(fetchedAt), fetchedAt, now);
    return _('Not refreshed yet');
}

// One line of local-history figures, or null when the account has none to show.
export function historySummary(tr: Translator, metrics: HistoryMetrics): string | null {
    const {_} = tr;
    switch (metrics.state) {
    case 'unsupported':
    case 'off':
        return null;
    case 'waiting':
        return _('Local history: waiting for the first scan');
    case 'updating':
        return _('Local history: updating…');
    case 'failed':
        return _('Local history: scan failed');
    }
    const today = formatTokenCount(metrics.todayTokens);
    const month = formatTokenCount(metrics.monthTokens);
    if (metrics.monthCost === null)
        return formatText(_('Today %s tokens · 30 days %s tokens'), today, month);
    return formatText(_('Today %s tokens · 30 days %s tokens · ≈ $%s at API prices'), today, month, metrics.monthCost.toFixed(2));
}

// Provider messages state the problem; the fix is added here once, per service.
function withSignInHint(tr: Translator, kind: ProviderKind, message: string): string {
    const {_} = tr;
    const templates: Record<ProviderKind, string> = {
        codex: _('%s Run codex login.'),
        claude: _('%s Run claude and sign in.'),
        kiro: _('%s Run kiro-cli login.'),
        antigravity: _('%s Sign in again with Antigravity or agy.'),
    };
    return formatText(templates[kind], message);
}

export function errorText(tr: Translator, snapshot: Pick<ProviderSnapshot, 'error' | 'errorInfo'> | null, instance: Pick<ProviderInstance, 'kind'>): string | null {
    const {_} = tr;
    if (!snapshot?.error)
        return null;
    switch (snapshot.errorInfo?.recovery) {
    case 'reauthenticate':
        return withSignInHint(tr, instance.kind, snapshot.error);
    case 'retry':
        return formatText(_('%s Try again later.'), snapshot.error);
    default:
        return snapshot.error;
    }
}
