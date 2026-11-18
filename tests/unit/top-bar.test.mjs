import test from 'node:test';
import assert from 'node:assert/strict';
import {UNTRANSLATED} from '../../build/tests/i18n.mjs';
import {isShown, limitKey, orderedLimits, setAutomatic, shownLimits, toggleLimit, topBarGroups, topBarSummary} from '../../build/tests/top-bar.mjs';

const window = (id, canonicalWindow, percent) => ({id, canonicalWindow, label: id, used: null, limit: null, percent, resetAt: null, unit: null});
const fiveHour = window('five_hour', 'five-hour', 0.6);
const weekly = window('seven_day', 'weekly', 0.88);
const opus = window('seven_day_opus', 'other', 0.42);
const snapshot = (windows, extra = {}) => ({windows, balance: null, ...extra});
const account = (id, kind, topBar, extra = {}) => ({id, kind, accent: 'blue', enabled: true, topBar, ...extra});
const auto = {automatic: true, limits: []};

test('limit keys are canonical windows, or the window id for other limits', () => {
    assert.equal(limitKey(fiveHour), 'five-hour');
    assert.equal(limitKey(opus), 'seven_day_opus');
});

test('first click while automatic keeps the shown limit and adds the clicked one', () => {
    const selection = toggleLimit(account('a', 'claude', auto), 'five-hour', snapshot([fiveHour, weekly]));
    assert.deepEqual(selection, {automatic: false, limits: ['five-hour', 'weekly']});
});

test('first click on the automatic limit pins it', () => {
    assert.deepEqual(toggleLimit(account('a', 'claude', auto), 'weekly', snapshot([fiveHour, weekly])), {automatic: false, limits: ['weekly']});
});

test('clicking the sole automatically shown quota removes it from the top bar', () => {
    const data = snapshot([{...fiveHour, percent: 0}]);
    const removed = toggleLimit(account('a', 'codex', auto), 'five-hour', data);
    assert.deepEqual(removed, {automatic: false, limits: []});
    const restored = toggleLimit(account('a', 'codex', removed), 'five-hour', data);
    assert.deepEqual(shownLimits({topBar: restored}, data), data.windows);
});

test('later clicks toggle, and unticking the last limit hides the account', () => {
    const data = snapshot([fiveHour, weekly]);
    const added = toggleLimit(account('a', 'claude', {automatic: false, limits: ['weekly']}), 'five-hour', data);
    assert.deepEqual(added, {automatic: false, limits: ['five-hour', 'weekly']});
    const removed = toggleLimit(account('a', 'claude', {automatic: false, limits: ['weekly']}), 'weekly', data);
    assert.deepEqual(removed, {automatic: false, limits: []});
    assert.equal(isShown({topBar: removed}), false);
});

test('limits follow the popup order', () => {
    const data = snapshot([opus, weekly, fiveHour]);
    assert.deepEqual(orderedLimits(data).map(limitKey), ['five-hour', 'weekly', 'seven_day_opus']);
    const shown = shownLimits(account('a', 'claude', {automatic: false, limits: ['weekly', 'seven_day_opus', 'five-hour']}), data);
    assert.deepEqual(shown.map(limitKey), ['five-hour', 'weekly', 'seven_day_opus']);
});

test('automatic shows the limit closest to running out', () => {
    assert.deepEqual(shownLimits(account('a', 'claude', auto), snapshot([fiveHour, weekly])), [weekly]);
});

test('turning automatic on clears the ticks, turning it off keeps them', () => {
    assert.deepEqual(setAutomatic({automatic: false, limits: ['weekly']}, true), {automatic: true, limits: []});
    assert.deepEqual(setAutomatic({automatic: true, limits: []}, false), {automatic: false, limits: []});
});

test('a ticked limit the service stopped reporting is skipped', () => {
    const snapshots = new Map([['a', snapshot([weekly])], ['b', snapshot([weekly])]]);
    const groups = topBarGroups([
        account('a', 'claude', {automatic: false, limits: ['five-hour', 'weekly']}),
        account('b', 'claude', {automatic: false, limits: ['five-hour']}),
    ], snapshots);
    assert.deepEqual(groups[0].accounts.map(item => [item.id, item.limits.map(limitKey), item.missing]), [
        ['a', ['weekly'], false],
        ['b', [], true],
    ]);
});

test('balance accounts are shown by the balance key', () => {
    const balance = {amount: 42.1, currency: 'CNY'};
    const groups = topBarGroups([account('d', 'deepseek', {automatic: false, limits: ['balance']}, {displayName: 'API', lowBalance: 50})], new Map([['d', snapshot([], {balance})]]));
    assert.deepEqual(groups[0].accounts[0], {id: 'd', name: 'API', accent: 'blue', limits: [], balance, low: true, missing: false});
});

test('groups keep account order and skip hidden and disabled accounts', () => {
    const snapshots = new Map();
    const groups = topBarGroups([
        account('c1', 'codex', auto),
        account('k', 'kiro', auto),
        account('c2', 'codex', auto),
        account('c3', 'codex', {automatic: false, limits: []}),
        account('x', 'claude', auto, {enabled: false}),
    ], snapshots);
    assert.deepEqual(groups.map(group => [group.kind, group.accounts.map(item => item.id)]), [['codex', ['c1', 'c2']], ['kiro', ['k']]]);
});

test('the top-bar summary names the chosen limits', () => {
    assert.equal(topBarSummary(UNTRANSLATED, {automatic: true, limits: []}), 'Picked automatically');
    assert.equal(topBarSummary(UNTRANSLATED, {automatic: false, limits: []}), 'Not in the top bar');
    assert.equal(topBarSummary(UNTRANSLATED, {automatic: false, limits: ['five-hour', 'weekly']}), 'Five-hour, Weekly');
    assert.equal(topBarSummary(UNTRANSLATED, {automatic: false, limits: ['balance', 'seven_day_opus']}), 'Balance, seven day opus');
});

test('a DeepSeek account on Pick Automatically still warns of a low balance', () => {
    const balance = {amount: 3, currency: 'CNY'};
    const meter = window('balance', 'other', 0.9);
    const groups = topBarGroups([account('d', 'deepseek', auto, {lowBalance: 10})], new Map([['d', snapshot([meter], {balance})]]));
    assert.equal(groups[0].accounts[0].low, true);
    assert.deepEqual(groups[0].accounts[0].balance, balance);
});
