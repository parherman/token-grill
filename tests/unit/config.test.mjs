import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIGURATION_VERSION, migrateProviderSettings, normalizeProvider, readProviders} from '../../build/tests/config.mjs';

function fakeSettings(providers, version = CONFIGURATION_VERSION) {
    const values = {'provider-instances-json': JSON.stringify(providers), 'configuration-version': version};
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

test('single-window kinds always use their only window', () => {
    const [kiro] = normalizeProvider(entry({kind: 'kiro', accountHome: '/home/test/.local/share/kiro-cli', panelWindowPreference: 'weekly'}));
    assert.equal(kiro.panelWindowPreference, 'monthly');
    assert.equal(kiro.localHistoryEnabled, false);
});

test('legacy entries are migrated once and the result is stable', () => {
    const settings = fakeSettings([entry({schemaVersion: 1, accent: 'not-a-colour'})], 1);
    migrateProviderSettings(settings);
    const [migrated] = JSON.parse(settings.values['provider-instances-json']);
    assert.equal(migrated.schemaVersion, CONFIGURATION_VERSION);
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
