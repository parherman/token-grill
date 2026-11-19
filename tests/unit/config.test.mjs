import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIGURATION_VERSION, ENTRY_SCHEMA_VERSION, migrateProviderSettings, needsRefresh, newProvider, normalizeProvider, readProviders} from '../../build/tests/config.mjs';

function fakeSettings(providers, version = CONFIGURATION_VERSION, activeId = '') {
    const values = {'provider-instances-json': JSON.stringify(providers), 'configuration-version': version, 'active-provider-id': activeId};
    return {
        values,
        get_string: key => values[key],
        get_uint: key => values[key],
        set_string: (key, value) => {
            values[key] = value;
        },
        set_uint: (key, value) => {
            values[key] = value;
        },
    };
}

const entry = overrides => ({schemaVersion: 2, id: 'a', kind: 'codex', displayName: 'Personal', accountHome: '~/.codex', ...overrides});

test('independent Codex homes remain independent provider instances', () => {
    const providers = readProviders(fakeSettings([entry({}), entry({id: 'b', displayName: 'Work', accountHome: '~/.codex2'})]));
    assert.deepEqual(providers.map(provider => provider.id), ['a', 'b']);
    assert.notEqual(providers[0].accountHome, providers[1].accountHome);
});

test('invalid kinds, schema versions and homes are rejected', () => {
    assert.deepEqual(normalizeProvider(entry({kind: 'unknown'})), []);
    assert.deepEqual(normalizeProvider(entry({schemaVersion: 3})), []);
    assert.deepEqual(normalizeProvider(entry({accountHome: 'relative/home'})), []);
});

test('invalid override paths are dropped rather than rejecting the account', () => {
    const [provider] = normalizeProvider(entry({authFileOverride: 'relative.json', sessionsDirectoryOverride: '~/sessions'}));
    assert.equal(provider.authFileOverride, null);
    assert.equal(provider.sessionsDirectoryOverride, '~/sessions');
});

test('a single-window account upgrades to its only limit', () => {
    const settings = fakeSettings([v031('k1', 'kiro', 'weekly')], 2, 'k1');
    migrateProviderSettings(settings);
    const [kiro] = readProviders(settings);
    assert.deepEqual(kiro.topBar, {automatic: false, limits: ['monthly']});
    assert.equal(kiro.localHistoryEnabled, false);
});

test('legacy entries are migrated once and the result is stable', () => {
    const settings = fakeSettings([entry({schemaVersion: 1, accent: 'not-a-colour'})], 1);
    migrateProviderSettings(settings);
    const [migrated] = JSON.parse(settings.values['provider-instances-json']);
    assert.equal(migrated.schemaVersion, ENTRY_SCHEMA_VERSION);
    assert.equal(settings.values['configuration-version'], CONFIGURATION_VERSION);
    const once = settings.values['provider-instances-json'];
    migrateProviderSettings(settings);
    assert.equal(settings.values['provider-instances-json'], once);
});

test('a legacy value with an unreadable entry is kept for recovery', () => {
    const stored = [entry({schemaVersion: 1}), entry({schemaVersion: 1, id: 'b', kind: 'unknown'})];
    const settings = fakeSettings(stored, 1);
    migrateProviderSettings(settings);
    assert.deepEqual(JSON.parse(settings.values['provider-instances-json']), stored);
    assert.equal(settings.values['configuration-version'], 1);
});

// The shape of a real 0.3.1 configuration: seven accounts, every entry with showInPanel and panelWindowPreference.
const v031 = (id, kind, preference, extra = {}) => ({
    schemaVersion: 2, id, kind, displayName: `Account ${id}`, accent: 'blue', enabled: true, showInPanel: true,
    sortOrder: Number(id.slice(1)), accountHome: kind === 'kiro' ? '/home/test/.local/share/kiro-cli' : `~/.${kind}-${id}`,
    authFileOverride: null, sessionsDirectoryOverride: null, liveUsageEnabled: true,
    localHistoryEnabled: kind === 'codex', panelWindowPreference: preference, ...extra,
});
const realConfiguration = () => [
    v031('a0', 'claude', 'five-hour', {accent: 'orange'}),
    v031('a1', 'codex', 'five-hour'),
    v031('a2', 'codex', 'five-hour', {accent: 'teal'}),
    v031('a3', 'codex', 'five-hour', {accent: 'green'}),
    v031('a4', 'kiro', 'monthly', {accent: 'purple'}),
    v031('a5', 'antigravity', 'automatic', {accent: 'teal'}),
    v031('a6', 'claude', 'five-hour', {accent: 'red'}),
];

test('a real 0.3.1 configuration keeps every account and the bar looks the same', () => {
    const settings = fakeSettings(realConfiguration(), 2, 'a1');
    migrateProviderSettings(settings);
    const migrated = readProviders(settings);
    assert.deepEqual(migrated.map(provider => provider.id), ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
    assert.deepEqual(migrated.map(provider => provider.accent), ['orange', 'blue', 'teal', 'green', 'purple', 'teal', 'red']);
    assert.deepEqual(migrated.map(provider => provider.localHistoryEnabled), [false, true, true, true, false, false, false]);
    assert.deepEqual(migrated.find(provider => provider.id === 'a1').topBar, {automatic: false, limits: ['five-hour']});
    for (const provider of migrated.filter(item => item.id !== 'a1'))
        assert.deepEqual(provider.topBar, {automatic: false, limits: []});
    assert.equal(settings.values['configuration-version'], 3);
});

test('migration turns an automatic active account into automatic', () => {
    const settings = fakeSettings(realConfiguration(), 2, 'a5');
    migrateProviderSettings(settings);
    assert.deepEqual(readProviders(settings).find(provider => provider.id === 'a5').topBar, {automatic: true, limits: []});
});

test('migration without a stored active account uses the first enabled account', () => {
    const settings = fakeSettings(realConfiguration(), 2, '');
    migrateProviderSettings(settings);
    assert.deepEqual(readProviders(settings)[0].topBar, {automatic: false, limits: ['five-hour']});
});

test('migration without a stored active account follows the account 0.3.x showed', () => {
    const accounts = realConfiguration().map(item => ({...item, showInPanel: item.id === 'a4'}));
    const settings = fakeSettings(accounts, 2, '');
    migrateProviderSettings(settings);
    assert.deepEqual(readProviders(settings).find(provider => provider.id === 'a4').topBar, {automatic: false, limits: ['monthly']});
});

test('migration gives existing accounts their native app', () => {
    const settings = fakeSettings(realConfiguration(), 2, 'a1');
    migrateProviderSettings(settings);
    assert.deepEqual(readProviders(settings).map(provider => provider.app),
        ['claude-code', 'codex-cli', 'codex-cli', 'codex-cli', 'kiro-cli', 'antigravity', 'claude-code']);
});

// 0.3.x needs entry format 2, an id, a kind it knows and a home; it fills in the rest.
test('migrated entries stay readable by 0.3.x', () => {
    const settings = fakeSettings(realConfiguration(), 2, 'a1');
    migrateProviderSettings(settings);
    for (const stored of JSON.parse(settings.values['provider-instances-json'])) {
        assert.equal(stored.schemaVersion, 2);
        assert.equal(typeof stored.id, 'string');
        assert.ok(['codex', 'claude', 'kiro', 'antigravity'].includes(stored.kind));
        assert.equal(typeof stored.accountHome, 'string');
    }
});

test('migration runs once', () => {
    const settings = fakeSettings(realConfiguration(), 2, 'a1');
    migrateProviderSettings(settings);
    const once = settings.values['provider-instances-json'];
    settings.values['active-provider-id'] = 'a0';
    migrateProviderSettings(settings);
    assert.equal(settings.values['provider-instances-json'], once);
});

test('a top-bar choice stored before the version bump survives migration', () => {
    const settings = fakeSettings([v031('a1', 'codex', 'five-hour', {topBar: {automatic: false, limits: ['weekly']}})], 2, 'a1');
    migrateProviderSettings(settings);
    assert.deepEqual(readProviders(settings)[0].topBar, {automatic: false, limits: ['weekly']});
});

test('malformed accents fall back to the service default', () => {
    for (const accent of ['#12345', '#GGGGGG', 'mauve', 42])
        assert.equal(normalizeProvider(entry({accent}))[0].accent, 'green');
    assert.equal(normalizeProvider(entry({accent: '#A1B2C3'}))[0].accent, '#a1b2c3');
});

test('an unknown app falls back to the first supported app', () => {
    assert.equal(normalizeProvider(entry({app: 'vscode'}))[0].app, 'codex-cli');
});

test('stored top-bar limits survive normalization and non-string keys are dropped', () => {
    const [provider] = normalizeProvider(entry({topBar: {automatic: false, limits: ['weekly', 7, 'seven_day_opus', 'weekly']}}));
    assert.deepEqual(provider.topBar, {automatic: false, limits: ['weekly', 'seven_day_opus']});
});

test('new accounts start on automatic', () => {
    const provider = newProvider('codex', 'codex-cli', '~/.codex');
    assert.deepEqual(provider.topBar, {automatic: true, limits: []});
    assert.equal(provider.app, 'codex-cli');
    assert.equal(provider.lowBalance, null);
});

test('a keyring account needs no home, other accounts do', () => {
    assert.equal(normalizeProvider(entry({kind: 'deepseek', app: 'keyring', accountHome: ''})).length, 1);
    assert.deepEqual(normalizeProvider(entry({kind: 'codex', app: 'codex-cli', accountHome: ''})), []);
});

// 0.3.x offered every limit in its editor and fell back to the most used one
// when the service did not report it; pinning such a limit would show nothing.
test('an upgraded limit the service never reports becomes automatic', () => {
    const settings = fakeSettings([v031('a1', 'codex', 'monthly')], 2, 'a1');
    migrateProviderSettings(settings);
    assert.deepEqual(readProviders(settings)[0].topBar, {automatic: true, limits: []});
});

test('only changes to how an account is read start a refresh', () => {
    const [base] = normalizeProvider(v031('a1', 'codex', 'weekly'));
    assert.equal(needsRefresh(undefined, base), true, 'a new account');
    for (const change of [{displayName: 'Renamed'}, {accent: 'red'}, {topBar: {automatic: true, limits: []}}, {lowBalance: 5}])
        assert.equal(needsRefresh(base, {...base, ...change}), false, JSON.stringify(change));
    for (const change of [{accountHome: '~/.codex2'}, {liveUsageEnabled: false}, {localHistoryEnabled: false}, {app: 'opencode'}, {authFileOverride: '/x'}])
        assert.equal(needsRefresh(base, {...base, ...change}), true, JSON.stringify(change));
    assert.equal(needsRefresh({...base, enabled: false}, base), true, 'turned back on');
});
