import type {Translator} from '../../core/i18n.js';
import {clampFraction, isRecord, numberAt, recordAt, toEpochMs} from '../../core/json.js';
import type {CanonicalQuotaWindow, UsageWindow} from '../../core/types.js';

const DAY_MS = 86400000;

export function cursorTimestamp(value: unknown): number | null {
    const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    const result = toEpochMs(numeric);
    return result !== null && result > 0 ? result : null;
}

function period(start: number | null, end: number | null): CanonicalQuotaWindow {
    if (start === null || end === null || end <= start)
        return 'other';
    const days = (end - start) / DAY_MS;
    if (Math.abs(days - 7) < 1 / DAY_MS)
        return 'weekly';
    return days >= 27 && days <= 32 ? 'monthly' : 'other';
}

// The current-period RPC is authoritative for weekly accounts. Older dashboard
// summaries can still describe an obsolete monthly allowance for those accounts.
export function normalizeCursorUsage(payload: unknown, {_}: Translator): UsageWindow[] | null {
    if (!isRecord(payload))
        return null;
    if (payload.isUnlimited === true)
        return [];
    const plan = recordAt(payload, 'planUsage');
    const individual = recordAt(payload, 'individualUsage');
    const overall = individual ? recordAt(individual, 'overall') : null;
    const pool = plan ?? overall;
    if (!pool)
        return null;
    if (pool.enabled === false)
        return [];
    const limit = numberAt(pool, 'limit');
    const remaining = numberAt(pool, 'remaining');
    const used = numberAt(pool, 'used');
    let fraction: number | null = null;
    if (limit !== null && limit > 0 && remaining !== null && remaining >= 0) {
        fraction = (limit - remaining) / limit;
    } else if (overall && limit !== null && limit > 0 && used !== null && used >= 0) {
        fraction = used / limit;
    } else if (plan) {
        const percent = numberAt(plan, 'totalPercentUsed');
        if (percent !== null && percent >= 0)
            fraction = percent / 100;
    }
    if (fraction === null || fraction < 0)
        return null;
    const start = cursorTimestamp(payload.billingCycleStart);
    const end = cursorTimestamp(payload.billingCycleEnd);
    const canonicalWindow = period(start, end);
    let label = _('Current period');
    if (canonicalWindow === 'weekly')
        label = _('Weekly');
    else if (canonicalWindow === 'monthly')
        label = _('Monthly');
    return [{
        id: 'primary',
        canonicalWindow,
        label,
        used: null,
        limit: null,
        percent: clampFraction(fraction),
        resetAt: end,
        durationSeconds: start !== null && end !== null && end > start ? (end - start) / 1000 : null,
        unit: null,
    }];
}
