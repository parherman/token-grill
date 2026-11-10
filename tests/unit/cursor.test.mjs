import test from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {newProvider, normalizeProvider} from '../../build/tests/config.mjs';
import {authFileCandidates, defaultHome, providerPaths} from '../../build/tests/paths.mjs';
import {UNTRANSLATED} from '../../build/tests/i18n.mjs';
import {parseCursorAuth, requireFreshCursorAuth} from '../../build/tests/cursor-auth-records.mjs';
import {normalizeCursorUsage} from '../../build/tests/cursor-normalize.mjs';
import {windowPace} from '../../build/tests/popup-model.mjs';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const token = claims => `fixture.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
const usage = planUsage => ({billingCycleStart: '1792060056178', billingCycleEnd: '1792664856178', planUsage});

test('Cursor accounts support independent homes without local history', () => {
    const [work] = normalizeProvider({...newProvider('cursor', '~/cursor-work'), localHistoryEnabled: true});
    const [personal] = normalizeProvider(newProvider('cursor', '~/cursor-personal'));
    assert.equal(work.kind, 'cursor');
    assert.equal(work.localHistoryEnabled, false);
    assert.notEqual(work.accountHome, personal.accountHome);
    assert.equal(defaultHome('cursor'), '/home/test/.config/Cursor');
});

test('Cursor tokens carry a stable identity across token rotation', () => {
    const first = parseCursorAuth({accessToken: token({sub: 'fixture-work', exp: NOW / 1000 + 600})});
    const rotated = parseCursorAuth({accessToken: token({sub: 'fixture-work', exp: NOW / 1000 + 1200})});
    const personal = parseCursorAuth({accessToken: token({sub: 'fixture-personal'})});
    assert.equal(first.identity, rotated.identity);
    assert.notEqual(first.identity, personal.identity);
    assert.equal(first.expiresAt, NOW + 600000);
    assert.equal(personal.expiresAt, null);
    assert.doesNotThrow(() => requireFreshCursorAuth(first, NOW));
    assert.throws(() => requireFreshCursorAuth(first, NOW + 600000), {code: 'auth-expired'});
});

test('Cursor rejects malformed and missing sign-ins before sending credentials', () => {
    for (const payload of [{}, {accessToken: ''}])
        assert.throws(() => parseCursorAuth(payload), {code: 'auth-missing'});
    for (const accessToken of [42, 'cursor-safe-storage:v1:encrypted', 'not-a-jwt', 'a.b.c\n', token({}), token({sub: 'fixture', exp: 'invalid'})])
        assert.throws(() => parseCursorAuth({accessToken}), {code: 'auth-invalid'});
});

test('Cursor opaque tokens require an independent scoped profile identity', () => {
    const accessToken = 'curs_fixture_opaque_token';
    const profile = {authId: 'grok|user_fixture', displayName: 'Fixture'};
    const auth = parseCursorAuth({accessToken}, profile);
    assert.equal(auth.identity, 'grok|user_fixture');
    assert.equal(auth.expiresAt, null);
    assert.equal(auth.accessToken, accessToken);
    assert.equal(parseCursorAuth({accessToken: 'curs_fixture_rotated'}, profile).identity, auth.identity);
    for (const invalid of [undefined, null, {}, [], {authId: ''}, {authId: 42}, {authId: 'user_fixture'},
        {authId: 'grok|'}, {authId: 'grok|user_fixture\n'}, {authId: 'grok|user_fixture|other'}])
        assert.throws(() => parseCursorAuth({accessToken}, invalid), {code: 'auth-invalid'});
    for (const invalid of ['arbitrary', 'curs', 'curs_fixture\r\nheader', 'curs_fixture token', token({})])
        assert.throws(() => parseCursorAuth({accessToken: invalid}, profile), {code: 'auth-invalid'});
});

test('Cursor JWT identity takes precedence over the cached profile', () => {
    const auth = parseCursorAuth({accessToken: token({sub: 'jwt-account', exp: NOW / 1000 + 600})}, {authId: 'grok|user_other'});
    assert.equal(auth.identity, 'jwt-account');
    assert.equal(auth.expiresAt, NOW + 600000);
    assert.equal(parseCursorAuth({accessToken: token({sub: 'jwt-account'})}, {}).identity, 'jwt-account');
});

test('Cursor current-period percentages use percentage points and millisecond-string reset dates', () => {
    const [window] = normalizeCursorUsage(usage({totalPercentUsed: 10.205850487540628, autoPercentUsed: 10.205850487540628, apiPercentUsed: 0}), UNTRANSLATED);
    assert.equal(window.percent, 0.10205850487540628);
    assert.equal(window.canonicalWindow, 'weekly');
    assert.equal(window.resetAt, 1792664856178);
    assert.equal(normalizeCursorUsage(usage({totalPercentUsed: 0.4}), UNTRANSLATED)[0].percent, 0.004);
    assert.equal(normalizeCursorUsage(usage({totalPercentUsed: 0}), UNTRANSLATED)[0].percent, 0);
    assert.equal(normalizeCursorUsage(usage({totalPercentUsed: 150}), UNTRANSLATED)[0].percent, 1);
});

test('Cursor included budgets use the allowance remaining rather than a different percentage definition', () => {
    const payload = {
        billingCycleStart: '1768399334000',
        billingCycleEnd: '1771077734000',
        planUsage: {totalSpend: 23222, remaining: 16778, limit: 40000, totalPercentUsed: 15.48},
    };
    const [window] = normalizeCursorUsage(payload, UNTRANSLATED);
    assert.equal(window.percent, 0.58055);
    assert.equal(window.canonicalWindow, 'monthly');
    assert.equal(window.resetAt, 1771077734000);
});

test('Cursor Enterprise summary uses the personal overall allowance', () => {
    const [window] = normalizeCursorUsage({
        billingCycleStart: '2026-11-01T00:00:00.000Z',
        billingCycleEnd: '2026-12-01T00:00:00.000Z',
        membershipType: 'enterprise',
        isUnlimited: false,
        individualUsage: {overall: {enabled: true, used: 2500, limit: 10000, remaining: 7500}},
        teamUsage: {onDemand: {enabled: true, used: 999999, limit: null, remaining: null}},
    }, UNTRANSLATED);
    assert.equal(window.percent, 0.25);
    assert.equal(window.resetAt, Date.parse('2026-12-01T00:00:00Z'));
    assert.equal(window.canonicalWindow, 'monthly');
    assert.equal(window.durationSeconds, 2592000);
    assert.equal(windowPace(UNTRANSLATED, window, Date.parse('2026-11-16T00:00:00Z')), '25% in reserve');
});

test('Cursor separates confirmed absence of quota from unrecognized data', () => {
    for (const payload of [{isUnlimited: true}, usage({enabled: false}), {individualUsage: {overall: {enabled: false}}}])
        assert.deepEqual(normalizeCursorUsage(payload, UNTRANSLATED), []);
    for (const payload of [null, [], {}, usage({}), usage({totalPercentUsed: '0'}), usage({totalPercentUsed: -1}),
        {individualUsage: {overall: {used: 5, limit: 0}}}])
        assert.equal(normalizeCursorUsage(payload, UNTRANSLATED), null);
});

test('Cursor unknown periods have a truthful label and invalid dates stay unavailable', () => {
    const [window] = normalizeCursorUsage({planUsage: {totalPercentUsed: 10}, billingCycleEnd: 'invalid'}, UNTRANSLATED);
    assert.equal(window.canonicalWindow, 'other');
    assert.equal(window.label, 'Current period');
    assert.equal(window.resetAt, null);
    const [zero] = normalizeCursorUsage({planUsage: {totalPercentUsed: 0}, billingCycleStart: '0', billingCycleEnd: '0'}, UNTRANSLATED);
    assert.equal(zero.resetAt, null);
});

test('Cursor credential candidates stay inside the configured profile', () => {
    const account = {kind: 'cursor', accountHome: '~/cursor-work', authFileOverride: null, sessionsDirectoryOverride: null};
    assert.deepEqual(authFileCandidates(account), [
        '/home/test/cursor-work/User/globalStorage/state.vscdb',
        '/home/test/cursor-work/auth.json',
    ]);
    assert.equal(providerPaths(account).authFile, '/home/test/cursor-work/User/globalStorage/state.vscdb');
    assert.deepEqual(authFileCandidates({...account, authFileOverride: '~/personal/auth.json'}), ['/home/test/personal/auth.json']);
    assert.deepEqual(authFileCandidates({...account, accountHome: '~/.config/cursor'}), [
        '/home/test/.config/cursor/User/globalStorage/state.vscdb',
        '/home/test/.config/cursor/auth.json',
    ]);
});
