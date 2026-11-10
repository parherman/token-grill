import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCENT_COLORS, accentStyleClass, normalizeAccent} from '../../build/tests/accent.mjs';
import {UNTRANSLATED} from '../../build/tests/i18n.mjs';
import {accountGroups, creditExpiryText, errorText, historySummary, refreshStatusText, shortAccountName, windowCaption} from '../../build/tests/popup-model.mjs';

const provider = (id, kind, displayName, extra = {}) => ({id, kind, displayName, enabled: true, accent: 'blue', localHistoryEnabled: false, panelWindowPreference: 'automatic', ...extra});

test('account accents use the GNOME accent palette and migrate the previous custom names', () => {
    assert.deepEqual(Object.keys(ACCENT_COLORS), ['blue', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'slate']);
    assert.equal(ACCENT_COLORS.blue, '#3584e4');
    assert.equal(accentStyleClass('slate'), 'tokengrill-accent-slate');
    assert.equal(accentStyleClass('cyan'), 'tokengrill-accent-teal');
    assert.equal(normalizeAccent('cyan', 'green'), 'teal');
    assert.equal(normalizeAccent('amber', 'green'), 'yellow');
    assert.equal(normalizeAccent('purple', 'green'), 'purple');
    assert.equal(normalizeAccent('mauve', 'green'), 'green');
    assert.equal(normalizeAccent(undefined, 'orange'), 'orange');
});

test('account names drop the provider prefix only when it is a separate leading word', () => {
    assert.equal(shortAccountName('Codex - Personal', 'Codex'), 'Personal');
    assert.equal(shortAccountName('Claude – Sahil', 'Claude'), 'Sahil');
    assert.equal(shortAccountName('codex: work', 'Codex'), 'work');
    assert.equal(shortAccountName('Kiro', 'Kiro'), 'Kiro');
    assert.equal(shortAccountName('Codexical', 'Codex'), 'Codexical');
    assert.equal(shortAccountName('My Codex', 'Codex'), 'My Codex');
});

test('the chooser groups enabled accounts by provider in first-appearance order', () => {
    const providers = [
        provider('c1', 'claude', 'Claude - Sahil'),
        provider('x1', 'codex', 'Codex - Personal'),
        provider('x2', 'codex', 'Codex - Work'),
        provider('k1', 'kiro', 'Kiro'),
        provider('x3', 'codex', 'Codex - Spare', {enabled: false}),
        provider('c2', 'claude', 'Claude - Work'),
    ];
    const snapshots = new Map([['x2', {error: 'refresh failed'}]]);
    const groups = accountGroups(providers, 'x2', snapshots);
    assert.deepEqual(groups.map(group => group.kind), ['claude', 'codex', 'kiro']);
    assert.deepEqual(groups.map(group => group.label), ['Claude', 'Codex', 'Kiro']);
    assert.deepEqual(groups[1].accounts.map(account => [account.id, account.shortName]), [['x1', 'Personal'], ['x2', 'Work']]);
    assert.deepEqual(groups[0].accounts.map(account => account.id), ['c1', 'c2']);
    assert.deepEqual(groups.map(group => group.selected), [false, true, false]);
    assert.equal(groups[1].attention, true, 'a failing account flags its provider');
    assert.equal(groups[0].attention, false);
    assert.equal(groups[1].accounts[1].attention, true);
});

test('the chooser falls back to the first account when the active one is missing or disabled', () => {
    const groups = accountGroups([provider('a', 'codex', 'Codex'), provider('b', 'kiro', 'Kiro')], 'gone', new Map());
    assert.deepEqual(groups.map(group => group.selected), [true, false]);
});

const tr = UNTRANSLATED;
const number = value => value.toLocaleString(undefined, {maximumFractionDigits: 6});

test('window captions show exact credits, reset countdown and local date/time', () => {
    const now = Date.UTC(2026, 9, 13, 10, 0);
    const dateTime = timestamp => new Date(timestamp).toISOString();
    const kiro = {unit: 'credits', used: 4042.73, limit: 5000, resetAt: now + (18 * 24 + 13) * 3600000};
    assert.equal(windowCaption(tr, kiro, dateTime, now), `${number(4042.73)} of ${number(5000)} credits · Resets in 18d 13h (2026-10-31T23:00:00.000Z)`);
    assert.equal(windowCaption(tr, {resetAt: now + 2 * 3600000 + 10 * 60000}, dateTime, now), 'Resets in 2h 10m (2026-10-13T12:10:00.000Z)');
    assert.equal(windowCaption(tr, {resetAt: now - 1000}, dateTime, now), 'Reset time passed (2026-10-13T09:59:59.000Z)');
    assert.equal(windowCaption(tr, {unit: 'credits', used: 12.5, limit: 0, resetAt: null}, dateTime, now), `${number(12.5)} credits used · pooled or unlimited · Reset time unknown`);
    assert.equal(windowCaption(tr, null, dateTime, now), 'No data yet');
});

test('window captions distinguish imminent resets from cached reset times in the past', () => {
    const now = Date.UTC(2026, 9, 13, 10, 0);
    const dateTime = timestamp => new Date(timestamp).toISOString();
    assert.equal(windowCaption(tr, {resetAt: now + 30000}, dateTime, now), 'Resets now (2026-10-13T10:00:30.000Z)');
    assert.equal(windowCaption(tr, {resetAt: now}, dateTime, now), 'Resets now (2026-10-13T10:00:00.000Z)');
    assert.equal(windowCaption(tr, {resetAt: now - 3 * 86400000}, dateTime, now), 'Reset time passed (2026-10-10T10:00:00.000Z)');
});

test('window captions leave missing reset dates unavailable without formatting them', () => {
    const dateTime = () => {
        throw new Error('Unavailable timestamp was formatted');
    };
    for (const resetAt of [null, undefined, NaN, Infinity, 1e20])
        assert.equal(windowCaption(tr, {resetAt}, dateTime), 'Reset time unknown');
});

test('reset credit expiry uses countdown followed by the date/time', () => {
    const now = Date.UTC(2026, 9, 13, 10, 0);
    const dateTime = timestamp => new Date(timestamp).toISOString();
    const credit = {title: 'Weekly reset', expiresAt: now + (18 * 24 + 13) * 3600000};
    assert.equal(creditExpiryText(tr, credit, dateTime, now), 'Weekly reset · Expires in 18d 13h (2026-10-31T23:00:00.000Z)');
    assert.equal(creditExpiryText(tr, {...credit, title: null, expiresAt: now + 30000}, dateTime, now), 'Usage-limit reset · Expires in less than 1m (2026-10-13T10:00:30.000Z)');
    assert.equal(creditExpiryText(tr, {...credit, expiresAt: now - 1000}, dateTime, now), 'Weekly reset · Expired (2026-10-13T09:59:59.000Z)');
    assert.equal(creditExpiryText(tr, {...credit, expiresAt: null}, dateTime, now), 'Weekly reset · Expiry unavailable');
    assert.equal(creditExpiryText(tr, {...credit, expiresAt: 1e20}, dateTime, now), 'Weekly reset · Expiry unavailable');
});

test('refresh status reads as a sentence and reflects each refresh phase', () => {
    const clock = () => '14:52';
    const now = Date.UTC(2026, 9, 13, 10, 0);
    const fetched = {quotaFetchedAt: now - 3 * 60000};
    const state = (phase, outcome = null) => ({phase, outcome, completedAt: now});
    assert.equal(refreshStatusText(tr, fetched, state('fetching-limits'), clock, now), 'Refreshing limits…');
    assert.equal(refreshStatusText(tr, fetched, state('queued'), clock, now), 'Waiting to refresh…');
    assert.equal(refreshStatusText(tr, fetched, state('scanning-history'), clock, now), 'Limits updated, scanning history…');
    assert.equal(refreshStatusText(tr, fetched, state('idle', 'failed'), clock, now), 'Refresh failed · showing data from 14:52');
    assert.equal(refreshStatusText(tr, null, state('idle', 'failed'), clock, now), 'Refresh failed');
    assert.equal(refreshStatusText(tr, fetched, state('idle', 'unchanged'), clock, now), 'Checked 14:52 · no change');
    assert.equal(refreshStatusText(tr, fetched, null, clock, now), 'Updated 14:52 · 3 min ago');
    assert.equal(refreshStatusText(tr, {quotaFetchedAt: now - 2 * 3600000}, null, clock, now), 'Updated 14:52 · 2 h ago');
    assert.equal(refreshStatusText(tr, {quotaFetchedAt: now}, null, clock, now), 'Updated 14:52 · just now');
    assert.equal(refreshStatusText(tr, null, null, clock, now), 'Not refreshed yet');
});

test('history summary appears only with real history data', () => {
    const metrics = (state, extra = {}) => ({state, todayTokens: 0, monthTokens: 0, monthCost: null, ...extra});
    assert.equal(historySummary(tr, metrics('unsupported')), null);
    assert.equal(historySummary(tr, metrics('off')), null);
    assert.equal(historySummary(tr, metrics('updating')), 'Local history: updating…');
    assert.equal(historySummary(tr, metrics('waiting')), 'Local history: waiting for the first scan');
    assert.equal(historySummary(tr, metrics('failed')), 'Local history: scan failed');
    assert.equal(historySummary(tr, metrics('ready', {todayTokens: 1.2e6, monthTokens: 41e6, monthCost: 12.4})), 'Today 1.2M tokens · 30 days 41.0M tokens · ≈ $12.40 at API prices');
    assert.equal(historySummary(tr, metrics('ready', {todayTokens: 1.2e6, monthTokens: 41e6})), 'Today 1.2M tokens · 30 days 41.0M tokens');
});

test('error text adds the service-specific fix once', () => {
    const snapshot = (error, recovery) => ({error, errorInfo: {recovery}});
    assert.equal(errorText(tr, snapshot('kiro-cli is not signed in.', 'reauthenticate'), {kind: 'kiro'}), 'kiro-cli is not signed in. Run kiro-cli login.');
    assert.equal(errorText(tr, snapshot('The Codex sign-in has expired.', 'reauthenticate'), {kind: 'codex'}), 'The Codex sign-in has expired. Run codex login.');
    assert.equal(errorText(tr, snapshot('Claude Code is not signed in.', 'reauthenticate'), {kind: 'claude'}), 'Claude Code is not signed in. Run claude and sign in.');
    assert.equal(errorText(tr, snapshot('The service did not answer in time.', 'retry'), {kind: 'codex'}), 'The service did not answer in time. Try again later.');
    assert.equal(errorText(tr, snapshot('Kiro accounts need the Gda 5.0 library (gir1.2-gda-5.0).', 'none'), {kind: 'kiro'}),
        'Kiro accounts need the Gda 5.0 library (gir1.2-gda-5.0).');
    assert.equal(errorText(tr, {error: null}, {kind: 'kiro'}), null);
});
