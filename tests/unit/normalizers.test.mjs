import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCodexUsage} from '../../build/tests/codex-normalize.mjs';
import {normalizeClaudeUsage} from '../../build/tests/claude-normalize.mjs';
import {normalizeKiroUsage} from '../../build/tests/kiro-normalize.mjs';

test('Codex weekly-only response is a valid weekly window', () => {
    const result = normalizeCodexUsage({plan_type: 'plus', rate_limit: {primary_window: {used_percent: 26, limit_window_seconds: 604800, reset_after_seconds: 535574, reset_at: 1786598031}}});
    assert.equal(result.plan, 'plus');
    assert.equal(result.windows.length, 1);
    assert.equal(result.windows[0].canonicalWindow, 'weekly');
    assert.equal(result.windows[0].percent, 0.26);
    assert.equal(result.windows[0].resetAt, 1786598031000);
    assert.equal(result.windows[0].durationSeconds, 604800);
});

test('Codex duration, rather than primary/secondary naming, identifies windows', () => {
    const result = normalizeCodexUsage({rate_limit: {primary_window: {used_percent: 40, limit_window_seconds: 18000}, secondary_window: {used_percent: 100, limit_window_seconds: 604800}}});
    assert.deepEqual(result.windows.map(window => window.canonicalWindow), ['five-hour', 'weekly']);
    assert.equal(result.windows[0].percent, 0.4);
    assert.equal(result.windows[1].percent, 1);
});

test('Codex retains the actual duration of a quota classified as five-hour', () => {
    const result = normalizeCodexUsage({rate_limit: {primary_window: {used_percent: 46, limit_window_seconds: 10800}}});
    assert.equal(result.windows[0].canonicalWindow, 'five-hour');
    assert.equal(result.windows[0].durationSeconds, 10800);
});

test('Codex percentage-point fields handle values at and below one percent', () => {
    const onePercent = normalizeCodexUsage({rate_limit: {primary_window: {used_percent: 1, limit_window_seconds: 604800}}});
    const fractionalPercent = normalizeCodexUsage({rate_limit: {primary_window: {used_percent: 0.4, limit_window_seconds: 604800}}});

    assert.equal(onePercent.windows[0].percent, 0.01);
    assert.equal(Math.round((1 - onePercent.windows[0].percent) * 100), 99);
    assert.equal(fractionalPercent.windows[0].percent, 0.004);
});

test('Codex percentage clamping remains safe', () => {
    const clamped = normalizeCodexUsage({
        rate_limit: {
            primary_window: {used_percent: -5, limit_window_seconds: 18000},
            secondary_window: {used_percent: 150, limit_window_seconds: 604800},
        },
    });

    assert.deepEqual(clamped.windows.map(window => window.percent), [0, 1]);
});

test('Claude OAuth usage maps canonical windows and ISO reset times', () => {
    const windows = normalizeClaudeUsage({five_hour: {utilization: 68, resets_at: '2026-08-07T12:00:00Z'}, seven_day: {utilization: 12, resets_at: '2026-08-13T12:00:00Z'}});
    assert.deepEqual(windows.map(window => window.canonicalWindow), ['five-hour', 'weekly']);
    assert.equal(windows[0].percent, 0.68);
    assert.equal(windows[1].percent, 0.12);
    assert.equal(windows[0].resetAt, Date.parse('2026-08-07T12:00:00Z'));
});

test('Claude utilization is always percentage points, including values at and below one percent', () => {
    const windows = normalizeClaudeUsage({five_hour: {utilization: 1.0}, seven_day: {utilization: 0.4}});
    assert.equal(windows[0].percent, 0.01);
    assert.equal(Math.round((1 - windows[0].percent) * 100), 99);
    assert.equal(windows[1].percent, 0.004);
});

test('Claude limits array fills windows missing from legacy fields', () => {
    const windows = normalizeClaudeUsage({
        five_hour: {utilization: 1.0, resets_at: '2026-10-13T13:00:00.032642+00:00'},
        seven_day: null,
        seven_day_opus: null,
        limits: [
            {kind: 'session', group: 'session', percent: 1, resets_at: '2026-10-13T13:00:00.032642+00:00', scope: null, is_active: true},
            {kind: 'weekly_scoped', group: 'weekly', percent: 0, resets_at: '2026-10-20T03:00:00+00:00', scope: {model: {id: null, display_name: 'Fable'}, surface: null}, is_active: false},
        ],
    });
    assert.deepEqual(windows.map(window => window.canonicalWindow), ['five-hour', 'weekly']);
    assert.equal(windows[0].id, 'five_hour');
    assert.equal(windows[0].percent, 0.01);
    assert.equal(windows[1].label, 'Weekly · Fable');
    assert.equal(windows[1].percent, 0);
    assert.equal(windows[1].resetAt, Date.parse('2026-10-20T03:00:00+00:00'));
});

test('Claude limits array prefers an unscoped weekly limit over a model-scoped one', () => {
    const windows = normalizeClaudeUsage({
        limits: [
            {kind: 'weekly_scoped', group: 'weekly', percent: 80, scope: {model: {display_name: 'Fable'}}},
            {kind: 'weekly', group: 'weekly', percent: 30, scope: null},
        ],
    });
    assert.equal(windows.length, 1);
    assert.equal(windows[0].label, 'Weekly');
    assert.equal(windows[0].percent, 0.3);
});

test('Kiro precision credit usage maps to a monthly window', () => {
    const result = normalizeKiroUsage({
        usageBreakdownList: [{resourceType: 'CREDIT', currentUsage: 0, currentUsageWithPrecision: 0.04, usageLimit: 2000, usageLimitWithPrecision: 2000, nextDateReset: 1788192000}],
        subscriptionInfo: {subscriptionTitle: 'KIRO PRO+', type: 'PRO_PLUS'},
    });
    assert.equal(result.plan, 'KIRO PRO+');
    assert.deepEqual(result.windows[0], {
        id: 'monthly-credits', canonicalWindow: 'monthly', label: 'Monthly credits', used: 0.04, limit: 2000,
        percent: 0.00002, resetAt: 1788192000000, unit: 'credits',
    });
});

test('Kiro supports integer fields and response-level reset fallback', () => {
    const result = normalizeKiroUsage({usageBreakdownList: [{resourceType: 'CREDIT', currentUsage: 10, usageLimit: 100}], nextDateReset: 1788192000});
    assert.equal(result.windows[0].percent, 0.1);
    assert.equal(result.windows[0].resetAt, 1788192000000);
});

test('Kiro pooled quotas preserve credits without inventing a percentage', () => {
    const result = normalizeKiroUsage({usageBreakdownList: [{resourceType: 'CREDIT', currentUsageWithPrecision: 12.5, usageLimitWithPrecision: 0}]});
    assert.equal(result.windows[0].used, 12.5);
    assert.equal(result.windows[0].limit, 0);
    assert.equal(result.windows[0].percent, null);
});

test('Kiro clamps over-limit usage and rejects unusable shapes', () => {
    assert.equal(normalizeKiroUsage({usageBreakdownList: [{resourceType: 'CREDIT', currentUsage: 120, usageLimit: 100}]}).windows[0].percent, 1);
    assert.deepEqual(normalizeKiroUsage({usageBreakdownList: [{resourceType: 'TOKEN', foo: 1}]}).windows, []);
    assert.deepEqual(normalizeKiroUsage(null).windows, []);
});

test('Codex model-specific limits are listed after the account limits', () => {
    const result = normalizeCodexUsage({
        rate_limit: {primary_window: {used_percent: 10, limit_window_seconds: 18000}},
        additional_rate_limits: [{limit_name: 'GPT-5.6 Sol', rate_limit: {primary_window: {used_percent: 50, limit_window_seconds: 86400}}}],
    });
    assert.deepEqual(result.windows.map(window => [window.canonicalWindow, window.label]), [['five-hour', 'Five-hour'], ['other', 'GPT-5.6 Sol']]);
});
