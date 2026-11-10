import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {
    CollectorError,
    httpError,
    INVALID_JSON,
    NOT_ALLOWED,
    OFFLINE,
    providerErrorInfo,
    serviceErrorReason,
    TIMED_OUT,
    TLS_FAILED,
    TOO_LARGE,
} from '../core/errors.js';
import {isCancellation, isIoError} from '../core/gio.js';
import type {Translator} from '../core/i18n.js';
import type {ProviderInstance, ProviderSnapshot, RefreshSource, SourceResult, UsageEvent} from '../core/types.js';
import type {PricingCatalog} from '../pricing/catalog.js';
import type {AggregateStore} from '../storage/aggregateStore.js';
import type {CheckpointStore} from '../storage/checkpointStore.js';
import {scanHistory} from './history.js';
import {KIRO_SERVICE_HOSTS} from './kiro/endpoints.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

// libsoup applies the session's User-Agent to every request, so this one
// string names every monitored service: the Antigravity quota API answers 403
// to clients whose User-Agent does not mention Antigravity.
export const USER_AGENT = 'TokenGrill (+https://github.com/sh02sahil/token-grill; usage monitor for Codex, Claude, Kiro, Antigravity and Cursor)';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ALLOWED_HOSTS = new Set([
    'api2.cursor.sh',
    'api.anthropic.com',
    'chatgpt.com',
    'cloudcode-pa.googleapis.com',
    'oauth2.googleapis.com',
    ...KIRO_SERVICE_HOSTS,
]);
const KIRO_OIDC_HOST = /^oidc\.[a-z0-9-]+\.amazonaws\.com$/;

export type RequestJson = (method: string, url: string, headers: Record<string, string>, body?: unknown) => Promise<unknown>;
export type LimitsUpdate = Partial<Pick<ProviderSnapshot, 'plan' | 'account' | 'windows'>>;

export interface CollectorContext {
    aggregates: AggregateStore;
    checkpoints: CheckpointStore;
    catalog: PricingCatalog;
    cancellable: Gio.Cancellable;
    tr: Translator;
    // True when the user explicitly asked for this refresh.
    manual: boolean;
    requestJson: RequestJson;
    onSourcePhase: (source: RefreshSource) => void;
    onSourceResult: (source: RefreshSource, result: SourceResult) => void;
}

export interface ProviderCollector {
    collect(instance: ProviderInstance, context: CollectorContext, snapshot: ProviderSnapshot): Promise<ProviderSnapshot>;
}

function urlAllowed(url: string): boolean {
    const uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
    const host = uri.get_host() ?? '';
    if (uri.get_scheme() !== 'https' || uri.get_userinfo())
        return false;
    return ALLOWED_HOSTS.has(host) || KIRO_OIDC_HOST.test(host);
}

function networkError(error: unknown): unknown {
    if (isCancellation(error) || !(error instanceof GLib.Error))
        return error;
    if (isIoError(error, Gio.IOErrorEnum.TIMED_OUT))
        return new CollectorError('timeout', TIMED_OUT);
    if (error.domain === Gio.tls_error_quark())
        return new CollectorError('http', TLS_FAILED);
    return new CollectorError('offline', OFFLINE);
}

// Every request goes to a fixed service host over HTTPS, without redirects and
// with a bounded body, so a bad configuration cannot send credentials elsewhere.
export async function requestJson(
    session: Soup.Session,
    method: string,
    url: string,
    headers: Record<string, string>,
    body: unknown,
    cancellable: Gio.Cancellable
): Promise<unknown> {
    if (!urlAllowed(url))
        throw new CollectorError('http', NOT_ALLOWED);
    const message = Soup.Message.new(method, url);
    message.set_flags(Soup.MessageFlags.NO_REDIRECT);
    const requestHeaders = message.get_request_headers();
    for (const [name, value] of Object.entries(headers))
        requestHeaders.append(name, value);
    if (body !== undefined) {
        const contentType = headers['Content-Type'] ?? 'application/json';
        message.set_request_body_from_bytes(contentType, new GLib.Bytes(new TextEncoder().encode(JSON.stringify(body))));
    }

    // A request of its own lets an oversized response be dropped without cancelling the whole refresh.
    const request = new Gio.Cancellable();
    const parentId = cancellable.connect(() => request.cancel());
    let oversized = false;
    const headersId = message.connect('got-headers', () => {
        if (message.get_response_headers().get_content_length() > MAX_RESPONSE_BYTES) {
            oversized = true;
            request.cancel();
        }
    });
    let bytes: GLib.Bytes;
    try {
        bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, request);
    } catch (error) {
        throw oversized ? new CollectorError('response-shape', TOO_LARGE) : networkError(error);
    } finally {
        message.disconnect(headersId);
        cancellable.disconnect(parentId);
    }

    if (bytes.get_size() > MAX_RESPONSE_BYTES)
        throw new CollectorError('response-shape', TOO_LARGE);
    const text = new TextDecoder().decode(bytes.toArray());
    // get_status() returns the Soup.Status enum, and GJS throws for codes it
    // does not list, such as 429 Too Many Requests.
    const status = message.status_code;
    if (status < 200 || status >= 300)
        throw httpError(status, serviceErrorReason(text));
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new CollectorError('response-shape', INVALID_JSON);
    }
}

function startOfUtcDay(): number {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today.getTime();
}

function historyError(error: unknown): unknown {
    if (isCancellation(error) || !(error instanceof GLib.Error))
        return error;
    return new CollectorError('local-history', ({_}) => _('The local usage history could not be updated.'));
}

export abstract class BaseCollector implements ProviderCollector {
    abstract collect(instance: ProviderInstance, context: CollectorContext, snapshot: ProviderSnapshot): Promise<ProviderSnapshot>;

    // Expected failures keep the last known values, marked stale; anything else is a bug and propagates.
    protected failed(snapshot: ProviderSnapshot, error: unknown, tr: Translator): ProviderSnapshot {
        if (!(error instanceof CollectorError))
            throw error;
        const errorInfo = providerErrorInfo(error, tr);
        return {...snapshot, state: snapshot.lastUpdated ? 'stale' : 'error', error: errorInfo.message, errorInfo};
    }

    protected limitsReady(context: CollectorContext, snapshot: ProviderSnapshot, update: LimitsUpdate): ProviderSnapshot {
        context.onSourceResult('limits', 'success');
        const now = Date.now();
        return {...snapshot, ...update, state: 'ready', lastUpdated: now, quotaFetchedAt: now, error: null, errorInfo: null};
    }

    protected limitsFailed(context: CollectorContext, snapshot: ProviderSnapshot, error: unknown): ProviderSnapshot {
        context.onSourceResult('limits', 'failed');
        return this.failed(snapshot, error, context.tr);
    }

    protected async collectLimits(
        context: CollectorContext,
        snapshot: ProviderSnapshot,
        fetch: () => Promise<LimitsUpdate>
    ): Promise<ProviderSnapshot> {
        let update: LimitsUpdate;
        try {
            update = await fetch();
        } catch (error) {
            return this.limitsFailed(context, snapshot, error);
        }
        return this.limitsReady(context, snapshot, update);
    }

    protected async collectHistory(
        instance: ProviderInstance,
        context: CollectorContext,
        snapshot: ProviderSnapshot,
        parseLine: (line: string) => UsageEvent | null
    ): Promise<ProviderSnapshot> {
        const {aggregates, checkpoints, catalog} = context;
        context.onSourcePhase('history');
        try {
            await scanHistory(instance, parseLine, aggregates, checkpoints, context.cancellable);
            await Promise.all([aggregates.flush(), checkpoints.flush()]);
        } catch (error) {
            context.onSourceResult('history', 'failed');
            return this.failed(snapshot, historyError(error), context.tr);
        }
        context.onSourceResult('history', 'success');
        const today = startOfUtcDay();
        const monthStart = Date.now() - MONTH_MS;
        return {
            ...snapshot,
            totals: aggregates.totals(instance.id, 0),
            todayTotals: aggregates.totals(instance.id, today),
            monthTotals: aggregates.totals(instance.id, monthStart),
            todayCost: aggregates.cost(instance.id, today, catalog),
            monthCost: aggregates.cost(instance.id, monthStart, catalog),
            localHistoryUpdatedAt: Date.now(),
        };
    }
}
