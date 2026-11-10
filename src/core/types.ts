export type ProviderKind = 'codex' | 'claude' | 'kiro' | 'antigravity';
export type AccentColor = 'blue' | 'teal' | 'green' | 'yellow' | 'orange' | 'red' | 'pink' | 'purple' | 'slate';
export type QuotaWindowPreference = 'automatic' | 'five-hour' | 'weekly' | 'monthly';
export type PanelPercentageMode = 'remaining' | 'used';
export type PanelDisplayStyle = 'text' | 'ring' | 'bar';
export type ConnectionState = 'unknown' | 'ready' | 'local' | 'stale' | 'error' | 'disabled';
export type CanonicalQuotaWindow = 'five-hour' | 'weekly' | 'monthly' | 'other';
export type ProviderErrorCode =
    | 'auth-missing'
    | 'auth-expired'
    | 'auth-invalid'
    | 'unsupported-account'
    | 'dependency'
    | 'permission'
    | 'offline'
    | 'timeout'
    | 'rate-limited'
    | 'http'
    | 'response-shape'
    | 'local-history';
export type RefreshPhase = 'idle' | 'queued' | 'fetching-limits' | 'fetching-reset-credits' | 'scanning-history';
export type RefreshOutcome = 'changed' | 'unchanged' | 'partial' | 'failed';
export type RefreshSource = 'limits' | 'reset-credits' | 'history';
export type SourceResult = 'success' | 'failed';

export interface ProviderErrorInfo {
    code: ProviderErrorCode;
    message: string;
    recovery: 'retry' | 'reauthenticate' | 'edit-provider' | 'none';
}

export interface ProviderInstance {
    schemaVersion: 2;
    id: string;
    kind: ProviderKind;
    displayName: string;
    accent: AccentColor;
    enabled: boolean;
    showInPanel: boolean;
    sortOrder: number;
    accountHome: string;
    authFileOverride: string | null;
    sessionsDirectoryOverride: string | null;
    liveUsageEnabled: boolean;
    localHistoryEnabled: boolean;
    panelWindowPreference: QuotaWindowPreference;
}

export interface UsageWindow {
    id: string;
    canonicalWindow: CanonicalQuotaWindow;
    label: string;
    used: number | null;
    limit: number | null;
    percent: number | null;
    resetAt: number | null;
    durationSeconds?: number | null;
    unit: 'credits' | null;
}

export interface LimitResetCredit {
    title: string | null;
    expiresAt: number | null;
}

export interface LimitResetCreditSummary {
    availableCount: number;
    credits: LimitResetCredit[];
    fetchedAt: number;
    stale: boolean;
    error: ProviderErrorInfo | null;
}

export interface TokenTotals {
    input: number;
    output: number;
    cachedInput: number;
    cacheWrite: number;
    reasoning: number;
    total: number;
}

export interface ProviderSnapshot {
    providerId: string;
    state: ConnectionState;
    lastUpdated: number | null;
    error: string | null;
    errorInfo: ProviderErrorInfo | null;
    plan: string | null;
    account: string | null;
    windows: UsageWindow[];
    totals: TokenTotals;
    todayTotals: TokenTotals;
    monthTotals: TokenTotals;
    todayCost: number | null;
    monthCost: number | null;
    quotaFetchedAt: number | null;
    localHistoryUpdatedAt: number | null;
    resetCredits: LimitResetCreditSummary | null;
}

export interface ProviderRuntimeState {
    phase: RefreshPhase;
    outcome: RefreshOutcome | null;
    completedAt: number | null;
    sources: Record<RefreshSource, SourceResult | null>;
}

export interface UsageEvent {
    capturedAt: number;
    model: string | null;
    totals: TokenTotals;
}

export interface AggregateBucket {
    providerId: string;
    date: string;
    model: string;
    totals: TokenTotals;
}

export interface FileCheckpoint {
    providerId: string;
    path: string;
    size: number;
    mtime: number;
    offset: number;
    parserVersion: number;
}

export interface ProviderPaths {
    authFile: string;
    historyDirectories: string[];
}

export const EMPTY_TOTALS: TokenTotals = {
    input: 0,
    output: 0,
    cachedInput: 0,
    cacheWrite: 0,
    reasoning: 0,
    total: 0,
};

export const ACCENTS: AccentColor[] = ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'slate'];

export function emptySnapshot(providerId: string): ProviderSnapshot {
    return {
        providerId,
        state: 'unknown',
        lastUpdated: null,
        error: null,
        errorInfo: null,
        plan: null,
        account: null,
        windows: [],
        totals: {...EMPTY_TOTALS},
        todayTotals: {...EMPTY_TOTALS},
        monthTotals: {...EMPTY_TOTALS},
        todayCost: null,
        monthCost: null,
        quotaFetchedAt: null,
        localHistoryUpdatedAt: null,
        resetCredits: null,
    };
}
