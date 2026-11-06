import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

import type {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {migrateProviderSettings, readProviders, writeProviders} from './core/config.js';
import {activeProvider} from './core/display.js';
import {isCancellation} from './core/gio.js';
import {parseTestNotificationRequest} from './core/notificationPolicy.js';
import {Scheduler, type SchedulerJob} from './core/scheduler.js';
import {snapshotFingerprint} from './core/snapshotFingerprint.js';
import {
    emptySnapshot,
    type PanelDisplayStyle,
    type PanelPercentageMode,
    type ProviderInstance,
    type ProviderKind,
    type ProviderRuntimeState,
    type ProviderSnapshot,
    type RefreshPhase,
    type RefreshSource,
} from './core/types.js';
import {loadCatalog, type PricingCatalog} from './pricing/catalog.js';
import {requestJson, USER_AGENT, type CollectorContext, type ProviderCollector} from './providers/base.js';
import {createCollectors} from './providers/registry.js';
import {TokenGrillIndicator, type IndicatorController} from './shell/indicator.js';
import {NotificationStore} from './shell/notifications.js';
import type {QuotaWindow} from './shell/providerCard.js';
import {TRANSLATOR} from './shell/translator.js';
import {AggregateStore} from './storage/aggregateStore.js';
import {CheckpointStore} from './storage/checkpointStore.js';

const SOURCE_PHASES: Record<RefreshSource, RefreshPhase> = {
    'limits': 'fetching-limits',
    'reset-credits': 'fetching-reset-credits',
    'history': 'scanning-history',
};

function idleState(): ProviderRuntimeState {
    return {phase: 'idle', outcome: null, completedAt: null, sources: {'limits': null, 'reset-credits': null, 'history': null}};
}

// Constructed only from TokenGrillExtension.enable(); stop() releases everything it creates.
export class Runtime implements IndicatorController {
    private readonly _extension: Extension;
    private _settings: Gio.Settings | null;
    private _cancellable: Gio.Cancellable | null = new Gio.Cancellable();
    private _session: Soup.Session | null = new Soup.Session({timeout: 30, user_agent: USER_AGENT});
    private _aggregates: AggregateStore | null;
    private _checkpoints: CheckpointStore | null;
    private _notifications: NotificationStore | null;
    private _collectors: Record<ProviderKind, ProviderCollector> | null = createCollectors();
    private _scheduler: Scheduler | null;
    private _indicator: TokenGrillIndicator | null = null;
    private _settingsChangedId: number | null = null;
    private _catalog: PricingCatalog = {};
    private _providers: ProviderInstance[] = [];
    private readonly _snapshots = new Map<string, ProviderSnapshot>();
    private readonly _runtimeStates = new Map<string, ProviderRuntimeState>();
    private _paused = false;
    private _lastTestNonce = '';

    constructor(extension: Extension) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._aggregates = new AggregateStore(extension.getLogger());
        this._checkpoints = new CheckpointStore(extension.getLogger());
        this._notifications = new NotificationStore(extension);
        this._scheduler = new Scheduler(
            jobs => this._collect(jobs).catch(error => this._extension.getLogger().error(error)),
            this._settings.get_uint('refresh-interval-seconds'));
    }

    start(): void {
        this._initialize().catch(error => {
            if (!isCancellation(error))
                this._extension.getLogger().error(error);
        });
    }

    stop(): void {
        this._cancellable!.cancel();
        this._cancellable = null;

        this._scheduler!.destroy();
        this._scheduler = null;

        if (this._settingsChangedId !== null)
            this._settings!.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;

        this._indicator?.destroy();
        this._indicator = null;

        this._session!.abort();
        this._session = null;

        this._collectors = null;

        // Final writes touch only our own state files, never Shell objects, so they may finish after disable().
        const logger = this._extension.getLogger();
        Promise.all([this._aggregates!.flush(), this._checkpoints!.flush(), this._notifications!.flush()])
            .catch(error => logger.warn(error));
        this._notifications!.destroy();
        this._notifications = null;
        this._aggregates = null;
        this._checkpoints = null;
        this._settings = null;

        this._snapshots.clear();
        this._runtimeStates.clear();
        this._providers = [];
        this._catalog = {};
    }

    refreshAll(): void {
        this._requestRefresh(this._providers.filter(provider => provider.enabled).map(provider => provider.id));
    }

    refreshProvider(providerId: string): void {
        if (this._providers.some(provider => provider.id === providerId && provider.enabled))
            this._requestRefresh([providerId]);
    }

    selectProvider(providerId: string): void {
        if (!this._providers.some(provider => provider.id === providerId && provider.enabled))
            return;
        this._settings!.set_string('active-provider-id', providerId);
    }

    selectQuotaWindow(providerId: string, window: QuotaWindow): void {
        if (!this._providers.some(provider => provider.id === providerId))
            return;
        this._providers = this._providers.map(provider =>
            provider.id === providerId ? {...provider, panelWindowPreference: window} : provider);
        // The settings handler sees the providers already up to date and only re-renders.
        writeProviders(this._settings!, this._providers);
        this._render();
    }

    openPreferences(): void {
        this._extension.openPreferences();
    }

    setPaused(paused: boolean): void {
        if (paused === this._paused)
            return;
        this._paused = paused;
        this._scheduler!.setPaused(paused);
        this._render();
    }

    private async _initialize(): Promise<void> {
        const cancellable = this._cancellable!;
        const [catalog] = await Promise.all([
            loadCatalog(`${this._extension.path}/pricing-v1.json`, cancellable),
            this._aggregates!.initialize(cancellable),
            this._checkpoints!.initialize(cancellable),
            this._notifications!.initialize(cancellable),
        ]);
        if (cancellable.is_cancelled())
            return;

        const settings = this._settings!;
        this._catalog = catalog;
        migrateProviderSettings(settings);
        this._providers = readProviders(settings);
        this._ensureActiveProvider();

        this._indicator = new TokenGrillIndicator(this._extension.path, this);
        Main.panel.addToStatusArea(this._extension.uuid, this._indicator, 1, 'right');
        this._settingsChangedId = settings.connect('changed', (_settings, key) => this._onSettingChanged(key));

        const scheduler = this._scheduler!;
        scheduler.setProviders(this._providers);
        scheduler.start();
        this._render();
        this._refreshEnabled();
    }

    private _onSettingChanged(key: string): void {
        switch (key) {
        case 'provider-instances-json':
        case 'configuration-version':
            this._reload();
            break;
        case 'notification-test-request':
            this._sendTestNotification(this._settings!.get_string(key));
            break;
        case 'refresh-interval-seconds':
            this._scheduler!.setIntervalSeconds(this._settings!.get_uint(key));
            break;
        default:
            this._render();
        }
    }

    private _reload(): void {
        const next = readProviders(this._settings!);
        if (JSON.stringify(next) === JSON.stringify(this._providers)) {
            this._render();
            return;
        }
        const retained = new Set(next.map(provider => provider.id));
        const removed = this._providers.filter(provider => !retained.has(provider.id)).map(provider => provider.id);
        for (const id of removed) {
            this._snapshots.delete(id);
            this._runtimeStates.delete(id);
            this._notifications!.removeProvider(id);
        }
        if (removed.length)
            this._removeStoredHistory(removed);
        this._providers = next;
        this._ensureActiveProvider();
        this._scheduler!.setProviders(next);
        this._render();
        this._refreshEnabled();
    }

    // Startup and configuration changes refresh silently, so a paused session is not reported as failed.
    private _refreshEnabled(): void {
        this._scheduler!.refresh(this._providers.filter(provider => provider.enabled).map(provider => provider.id));
    }

    private _removeStoredHistory(providerIds: string[]): void {
        const aggregates = this._aggregates!;
        const checkpoints = this._checkpoints!;
        Promise.all(providerIds.flatMap(id => [aggregates.removeProvider(id), checkpoints.removeProvider(id)]))
            .catch(error => this._extension.getLogger().warn(error));
    }

    private _sendTestNotification(value: string): void {
        const request = parseTestNotificationRequest(value);
        if (!request || request.nonce === this._lastTestNonce)
            return;
        const provider = this._providers.find(item => item.id === request.providerId);
        if (!provider)
            return;
        this._lastTestNonce = request.nonce;
        const step = this._settings!.get_uint('notification-step-percent');
        this._notifications!.notifyTest(provider, this._snapshots.get(provider.id) ?? null, step, this._percentageMode());
    }

    private _requestRefresh(providerIds: string[]): void {
        if (!providerIds.length)
            return;
        for (const id of providerIds)
            this._runtimeStates.set(id, {...idleState(), phase: 'queued'});
        this._render();
        if (this._scheduler!.refresh(providerIds))
            return;
        for (const id of providerIds)
            this._finish(id, 'failed');
        this._render();
    }

    private async _collect(jobs: SchedulerJob[]): Promise<void> {
        const cancellable = this._cancellable!;
        for (const job of jobs) {
            // One account at a time, so progress shows per account and requests are not bursty.
            // eslint-disable-next-line no-await-in-loop
            await this._refreshProvider(job.provider, job.manual, cancellable);
            if (cancellable.is_cancelled())
                return;
            this._render();
        }
        this._scheduler!.complete();
    }

    private async _refreshProvider(provider: ProviderInstance, manual: boolean, cancellable: Gio.Cancellable): Promise<void> {
        const state: ProviderRuntimeState = {...idleState(), phase: 'fetching-limits'};
        this._runtimeStates.set(provider.id, state);
        this._render();

        const session = this._session!;
        const context: CollectorContext = {
            aggregates: this._aggregates!,
            checkpoints: this._checkpoints!,
            catalog: this._catalog,
            cancellable,
            tr: TRANSLATOR,
            manual,
            requestJson: (method, url, headers, body) => requestJson(session, method, url, headers, body, cancellable),
            onSourcePhase: source => {
                if (cancellable.is_cancelled())
                    return;
                state.phase = SOURCE_PHASES[source];
                this._render();
            },
            onSourceResult: (source, result) => {
                if (cancellable.is_cancelled())
                    return;
                state.sources[source] = result;
            },
        };

        const previous = this._snapshots.get(provider.id) ?? null;
        let snapshot: ProviderSnapshot;
        try {
            snapshot = await this._collectors![provider.kind].collect(provider, context, previous ?? emptySnapshot(provider.id));
        } catch (error) {
            if (cancellable.is_cancelled())
                return;
            // Expected failures come back as snapshot.error; anything thrown is a bug.
            this._extension.getLogger().error(error);
            this._finish(provider.id, 'failed');
            return;
        }
        if (cancellable.is_cancelled())
            return;

        this._snapshots.set(provider.id, snapshot);
        const settings = this._settings!;
        if (settings.get_boolean('notifications-enabled'))
            this._notifications!.notifyMilestones(provider, snapshot, settings.get_uint('notification-step-percent'), this._percentageMode());

        if (snapshot.error)
            this._finish(provider.id, 'failed');
        else if (Object.values(state.sources).includes('failed'))
            this._finish(provider.id, 'partial');
        else if (previous && snapshotFingerprint(previous) === snapshotFingerprint(snapshot))
            this._finish(provider.id, 'unchanged');
        else
            this._finish(provider.id, 'changed');
    }

    private _finish(providerId: string, outcome: ProviderRuntimeState['outcome']): void {
        const state = this._runtimeStates.get(providerId) ?? idleState();
        this._runtimeStates.set(providerId, {...state, phase: 'idle', outcome, completedAt: Date.now()});
    }

    private _ensureActiveProvider(): void {
        const settings = this._settings!;
        const activeId = settings.get_string('active-provider-id');
        const current = activeProvider(this._providers, activeId);
        if (current && current.id !== activeId)
            settings.set_string('active-provider-id', current.id);
    }

    private _percentageMode(): PanelPercentageMode {
        return this._settings!.get_string('panel-percentage-mode') === 'used' ? 'used' : 'remaining';
    }

    private _displayStyle(): PanelDisplayStyle {
        const style = this._settings!.get_string('panel-display-style');
        return style === 'ring' || style === 'bar' ? style : 'text';
    }

    private _render(): void {
        this._indicator?.update({
            providers: this._providers,
            snapshots: this._snapshots,
            runtimeStates: this._runtimeStates,
            activeProviderId: this._settings!.get_string('active-provider-id'),
            mode: this._percentageMode(),
            style: this._displayStyle(),
            paused: this._paused,
        });
    }
}
