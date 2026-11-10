import {CollectorError, NO_USAGE} from '../../core/errors.js';
import {isRecord} from '../../core/json.js';
import {emptySnapshot, type ProviderInstance, type ProviderSnapshot} from '../../core/types.js';
import {BaseCollector, type CollectorContext, type LimitsUpdate} from '../base.js';
import {CursorAuthStore} from './auth.js';
import type {CursorAuth} from './authRecords.js';
import {cursorTimestamp, normalizeCursorUsage} from './normalize.js';

const USAGE_URL = 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage';
const SUMMARY_URL = 'https://api2.cursor.sh/auth/usage-summary';

export class CursorCollector extends BaseCollector {
    private readonly _auth = new CursorAuthStore();
    private readonly _identities = new Map<string, string>();

    async collect(instance: ProviderInstance, context: CollectorContext, snapshot: ProviderSnapshot): Promise<ProviderSnapshot> {
        if (!instance.liveUsageEnabled)
            return snapshot;
        let next = snapshot;
        try {
            const {path, auth} = await this._auth.load(instance, context.cancellable);
            const identity = `${path}\n${auth.identity}`;
            // A new identity must never inherit stale quota from the previous sign-in.
            if (this._identities.get(instance.id) !== identity)
                next = emptySnapshot(instance.id);
            this._identities.set(instance.id, identity);
            return this.limitsReady(context, next, await this._fetchLimits(context, auth));
        } catch (error) {
            if (error instanceof CollectorError && ['auth-missing', 'auth-invalid', 'auth-expired', 'permission', 'dependency'].includes(error.code))
                next = emptySnapshot(instance.id);
            return this.limitsFailed(context, next, error);
        }
    }

    private async _fetchLimits(context: CollectorContext, auth: CursorAuth): Promise<LimitsUpdate> {
        const headers = {'Authorization': `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1'};
        const payload = await context.requestJson('POST', USAGE_URL, headers, {});
        let windows = normalizeCursorUsage(payload, context.tr);
        if (windows === null && isRecord(payload) && !Object.hasOwn(payload, 'planUsage') &&
            typeof payload.billingCycleStart === 'string' && payload.billingCycleStart === payload.billingCycleEnd &&
            cursorTimestamp(payload.billingCycleStart) !== null) {
            // Enterprise seats expose their personal budget through the usage summary.
            const summary = await context.requestJson('GET', SUMMARY_URL, {'Authorization': headers.Authorization});
            if (isRecord(summary) && summary.membershipType === 'enterprise') {
                const start = cursorTimestamp(summary.billingCycleStart);
                const end = cursorTimestamp(summary.billingCycleEnd);
                const now = Date.now();
                if (start !== null && end !== null && start <= now && end > now)
                    windows = normalizeCursorUsage(summary, context.tr);
            }
        }
        if (windows === null)
            throw new CollectorError('response-shape', NO_USAGE);
        return {windows};
    }
}
