import {clampFraction, isRecord, numberAt, recordAt, stringAt, toEpochMs} from '../../core/json.js';
import type {CanonicalQuotaWindow, UsageWindow} from '../../core/types.js';
import {claimType} from '../windows.js';

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export interface CodexUsage {
    windows: UsageWindow[];
    plan: string | null;
}

// The duration identifies a window; `primary` and `secondary` only describe
// the order the service lists them in.
function canonicalFor(seconds: number | null): CanonicalQuotaWindow {
    if (seconds !== null && Math.abs(seconds - 5 * HOUR_SECONDS) <= 2 * HOUR_SECONDS)
        return 'five-hour';
    if (seconds !== null && Math.abs(seconds - 7 * DAY_SECONDS) <= DAY_SECONDS)
        return 'weekly';
    return 'other';
}

// `used_percent` is in percentage points (0-100), including fractional values:
// 1 means 1% used, not a fully consumed ratio.
// The plan's own windows keep their position-based ids; a model limit is named
// after the model and its window, so a choice in the popup follows it.
function normalizeWindow(window: Record<string, unknown>, name: string | null, index: number, claimed: Set<CanonicalQuotaWindow>): UsageWindow | null {
    const percentagePoints = numberAt(window, 'used_percent');
    if (percentagePoints === null)
        return null;
    const durationSeconds = numberAt(window, 'limit_window_seconds');
    const duration = canonicalFor(durationSeconds);
    const type = claimType(claimed, duration, name ?? 'Usage limit');
    return {
        id: name === null ? `${type.canonicalWindow}-${index}` : `${name}:${duration}`,
        ...type,
        used: null,
        limit: null,
        percent: clampFraction(percentagePoints / 100),
        resetAt: toEpochMs(window.reset_at),
        durationSeconds,
        unit: null,
    };
}

function rateLimitWindows(rateLimit: Record<string, unknown> | null): Record<string, unknown>[] {
    if (!rateLimit)
        return [];
    return [recordAt(rateLimit, 'primary_window'), recordAt(rateLimit, 'secondary_window')]
        .filter((window): window is Record<string, unknown> => window !== null);
}

export function normalizeCodexUsage(payload: unknown): CodexUsage {
    if (!isRecord(payload))
        return {windows: [], plan: null};
    const sources: Array<[Record<string, unknown>, string | null]> = rateLimitWindows(recordAt(payload, 'rate_limit'))
        .map(window => [window, null]);
    // Plans with model-specific limits list them separately, each with its own windows.
    const additional = Array.isArray(payload.additional_rate_limits) ? payload.additional_rate_limits.filter(isRecord) : [];
    for (const limit of additional) {
        const name = stringAt(limit, 'limit_name') ?? 'Usage limit';
        for (const window of rateLimitWindows(recordAt(limit, 'rate_limit')))
            sources.push([window, name]);
    }
    const windows: UsageWindow[] = [];
    const claimed = new Set<CanonicalQuotaWindow>();
    for (const [window, name] of sources) {
        const normalized = normalizeWindow(window, name, windows.length, claimed);
        if (normalized)
            windows.push(normalized);
    }
    return {windows, plan: stringAt(payload, 'plan_type')};
}
