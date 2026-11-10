// Uses synthetic credentials and in-memory HTTP responses with the built modules.
import Gda from 'gi://Gda?version=5.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const root = GLib.path_get_dirname(GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]));
const [, metadata] = GLib.file_get_contents(`${root}/metadata.json`);
const dist = `${root}/dist/${JSON.parse(new TextDecoder().decode(metadata)).uuid}`;
const {CursorAuthStore, readCursorDatabase} = await import(`file://${dist}/providers/cursor/auth.js`);
const {CursorCollector} = await import(`file://${dist}/providers/cursor/collector.js`);
const {newProvider} = await import(`file://${dist}/core/config.js`);
const {emptySnapshot} = await import(`file://${dist}/core/types.js`);
const {CollectorError} = await import(`file://${dist}/core/errors.js`);
const {UNTRANSLATED} = await import(`file://${dist}/core/i18n.js`);

function assert(value, message) {
    if (!value)
        throw new Error(message);
}

async function rejects(operation, code) {
    try {
        await operation();
    } catch (error) {
        assert(error instanceof CollectorError && error.code === code, `Expected ${code}`);
        return;
    }
    throw new Error(`Expected ${code}`);
}

function token(identity, expiry = 2000000000) {
    const claims = GLib.base64_encode(new TextEncoder().encode(JSON.stringify({sub: identity, exp: expiry})));
    return `fixture.${claims.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}.signature`;
}

const directory = GLib.dir_make_tmp('tokengrill cursor;XXXXXX');
const profile = GLib.build_filenamev([directory, 'work']);
const databaseDirectory = GLib.build_filenamev([profile, 'User', 'globalStorage']);
GLib.mkdir_with_parents(databaseDirectory, 0o700);
const database = GLib.build_filenamev([databaseDirectory, 'state.vscdb']);
const connectionString = `DB_DIR=${Gda.rfc1738_encode(databaseDirectory)};DB_NAME=state.vscdb;APPEND_DB_EXTENSION=FALSE`;
const account = newProvider('cursor', profile);
Gda.init();
const writer = Gda.Connection.open_from_string('SQLite', connectionString, null, Gda.ConnectionOptions.NONE);

function writeIdentity(identity, expiry) {
    writer.execute_non_select_command(`INSERT OR REPLACE INTO ItemTable VALUES ('cursorAuth/accessToken', '${token(identity, expiry)}')`);
}

try {
    // Consume the PRAGMA result so its mode-change lock is released.
    writer.execute_select_command('PRAGMA journal_mode=WAL').get_n_rows();
    const decoy = Gda.Connection.open_from_string('SQLite', `${connectionString.replace('DB_NAME=state.vscdb;', 'DB_NAME=state.vscdb.db;')}`, null, Gda.ConnectionOptions.NONE);
    decoy.execute_non_select_command('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)');
    decoy.execute_non_select_command(`INSERT INTO ItemTable VALUES ('cursorAuth/accessToken', '${token('fixture-decoy')}')`);
    decoy.close();
    writer.execute_non_select_command('CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)');
    writeIdentity('fixture-work');
    assert((await readCursorDatabase(database)).identity === 'fixture-work', 'Gda could not read the Cursor token');
    const store = new CursorAuthStore();
    const first = await store.load(account, null);
    assert(first.auth === (await store.load(account, null)).auth, 'An unchanged database was reopened');
    writer.execute_non_select_command("INSERT INTO ItemTable VALUES ('cursorAuth/cachedScopedProfile', '{\"authId\":\"grok|user_fixture_opaque\"}')");
    writer.execute_non_select_command("UPDATE ItemTable SET value='curs_fixture_opaque' WHERE key='cursorAuth/accessToken'");
    assert((await store.load(account, null)).auth.identity === 'grok|user_fixture_opaque', 'Opaque credentials did not use the scoped profile');
    writer.execute_non_select_command("UPDATE ItemTable SET value='{\"authId\":\"grok|user_rotated_profile\"}' WHERE key='cursorAuth/cachedScopedProfile'");
    assert((await store.load(account, null)).auth.identity === 'grok|user_rotated_profile', 'Profile-only WAL changes were ignored');
    writer.execute_non_select_command("UPDATE ItemTable SET value='{}' WHERE key='cursorAuth/cachedScopedProfile'");
    await rejects(() => store.load(account, null), 'auth-invalid');
    writeIdentity('fixture-personal');
    assert((await store.load(account, null)).auth.identity === 'fixture-personal', 'WAL changes did not invalidate credentials');

    const agentPath = GLib.build_filenamev([profile, 'auth.json']);
    GLib.file_set_contents(agentPath, JSON.stringify({accessToken: token('fixture-agent')}));
    assert((await store.load(account, null)).auth.identity === 'fixture-personal', 'Agent credentials overrode the IDE');
    const agent = {...account, authFileOverride: agentPath};
    assert((await store.load(agent, null)).auth.identity === 'fixture-agent', 'Explicit Agent credentials were ignored');
    await rejects(() => store.load({...account, authFileOverride: `${directory}/missing.json`}, null), 'auth-missing');
    await rejects(() => store.load(newProvider('cursor', `${directory}/missing-profile`), null), 'auth-missing');

    const readonly = Gda.Connection.open_from_string('SQLite', connectionString, null, Gda.ConnectionOptions.READ_ONLY);
    readonly.execute_select_command('PRAGMA query_only=ON');
    let refused = false;
    try {
        readonly.execute_non_select_command("UPDATE ItemTable SET value='changed'");
    } catch (error) {
        assert(error instanceof GLib.Error, 'Unexpected SQLite write failure');
        refused = true;
    } finally {
        readonly.close();
    }
    assert(refused, 'Read-only SQLite accepted a write');

    const collector = new CursorCollector();
    const cycleStart = Date.now() - 15 * 86400000;
    const cycleEnd = cycleStart + 30 * 86400000;
    const context = {
        tr: UNTRANSLATED,
        cancellable: new Gio.Cancellable(),
        manual: true,
        onSourcePhase: () => {},
        onSourceResult: () => {},
        requestJson: (method, url, headers, body) => {
            assert(method === 'POST' && url.endsWith('/GetCurrentPeriodUsage'), 'Unexpected current-period request');
            assert(headers.Authorization === `Bearer ${token('fixture-personal')}`, 'Wrong account credentials');
            assert(JSON.stringify(body) === '{}', 'Unexpected RPC body');
            return Promise.resolve({billingCycleStart: '1792060056178', billingCycleEnd: '1792664856178', planUsage: {totalPercentUsed: 42}});
        },
    };
    let snapshot = await collector.collect(account, context, emptySnapshot(account.id));
    assert(snapshot.state === 'ready' && snapshot.windows[0].percent === 0.42, 'Collector did not publish the primary quota');
    context.requestJson = () => Promise.reject(new CollectorError('timeout', ({_}) => _('Fixture timeout')));
    snapshot = await collector.collect(account, context, snapshot);
    assert(snapshot.state === 'stale' && snapshot.windows[0].percent === 0.42, 'Same-account network failure lost its reading');
    writeIdentity('fixture-personal', 2000000001);
    snapshot = await collector.collect(account, context, snapshot);
    assert(snapshot.state === 'stale', 'Token rotation changed the account identity');
    writeIdentity('fixture-new-account');
    snapshot = await collector.collect(account, context, snapshot);
    assert(snapshot.state === 'error' && snapshot.windows.length === 0, 'A new account inherited stale usage');

    context.requestJson = (method, url) => {
        if (url.endsWith('/GetCurrentPeriodUsage'))
            return Promise.resolve({billingCycleStart: String(cycleStart), billingCycleEnd: String(cycleStart), displayThreshold: 200});
        assert(method === 'GET' && url === 'https://api2.cursor.sh/auth/usage-summary', 'Unexpected Enterprise fallback');
        return Promise.resolve({
            membershipType: 'enterprise',
            billingCycleStart: new Date(cycleStart).toISOString(), billingCycleEnd: new Date(cycleEnd).toISOString(),
            individualUsage: {overall: {enabled: true, used: 25, limit: 100, remaining: 75}},
            teamUsage: {onDemand: {used: 9999, limit: null}},
        });
    };
    snapshot = await collector.collect(account, context, snapshot);
    assert(snapshot.state === 'ready' && snapshot.windows[0].percent === 0.25, 'Enterprise fallback did not use the personal quota');
    for (const dates of [{}, {billingCycleStart: '2020-01-01T00:00:00Z', billingCycleEnd: '2020-02-01T00:00:00Z'}]) {
        for (const allowance of [{isUnlimited: true}, {individualUsage: {overall: {enabled: false}}}]) {
            context.requestJson = (method, url) => Promise.resolve(url.endsWith('/GetCurrentPeriodUsage') ? {
                billingCycleStart: String(cycleStart), billingCycleEnd: String(cycleStart), displayThreshold: 200,
            } : {membershipType: 'enterprise', ...dates, ...allowance});
            const oldSummary = await collector.collect(account, context, snapshot);
            assert(oldSummary.state === 'stale' && oldSummary.windows[0].percent === 0.25, 'An inapplicable Enterprise absence cleared current quotas');
        }
    }
    for (const payload of [{isUnlimited: true}, {planUsage: {enabled: false}}]) {
        context.requestJson = (method, url) => {
            assert(url.endsWith('/GetCurrentPeriodUsage'), 'An authoritative allowance triggered the summary fallback');
            return Promise.resolve(payload);
        };
        const unavailable = await collector.collect(account, context, snapshot);
        assert(unavailable.state === 'ready' && unavailable.windows.length === 0 && unavailable.errorInfo === null, 'A confirmed absent allowance retained obsolete usage');
    }
    for (const payload of [{}, null, {planUsage: {}}, {planUsage: {totalPercentUsed: 'invalid'}}]) {
        context.requestJson = (method, url) => {
            assert(url.endsWith('/GetCurrentPeriodUsage'), 'Malformed data triggered an unrelated summary');
            return Promise.resolve(payload);
        };
        const malformed = await collector.collect(account, context, snapshot);
        assert(malformed.state === 'stale' && malformed.windows[0].percent === 0.25 && malformed.errorInfo.code === 'response-shape', 'Malformed data cleared cached usage');
    }
    for (const code of ['timeout', 'offline', 'rate-limited', 'auth-invalid']) {
        context.requestJson = () => Promise.reject(new CollectorError(code, ({_}) => _('Fixture failure')));
        const failed = await collector.collect(account, context, snapshot);
        assert(failed.errorInfo.code === code, 'A collection failure lost its error code');
        assert(code === 'auth-invalid' ? failed.windows.length === 0 : failed.state === 'stale' && failed.windows[0].percent === 0.25,
            'A collection failure did not preserve account isolation');
        assert(!failed.error.includes('curs_') && !failed.error.includes('signature'), 'A collection error exposed credentials');
    }
    context.requestJson = () => Promise.resolve({planUsage: {totalPercentUsed: 33}});
    const fresh = await collector.collect(account, context, snapshot);
    assert(fresh.state === 'ready' && fresh.windows[0].percent === 0.33, 'A new quota did not replace cached usage');
    context.requestJson = (method, url) => Promise.resolve(url.endsWith('/GetCurrentPeriodUsage') ? {} : {
        membershipType: 'pro', individualUsage: {overall: {used: 25, limit: 100}},
    });
    const legacySummary = await collector.collect(account, context, emptySnapshot(account.id));
    assert(legacySummary.windows.length === 0, 'An obsolete personal summary became the current allowance');
    writer.execute_non_select_command("UPDATE ItemTable SET value='invalid'");
    await rejects(() => store.load(account, null), 'auth-invalid');
    snapshot = await collector.collect(account, context, snapshot);
    assert(snapshot.windows.length === 0 && snapshot.errorInfo.code === 'auth-invalid', 'Invalid credentials retained old account usage');
    GLib.unlink(agentPath);
} finally {
    writer.close();
    for (const suffix of ['', '-wal', '-shm'])
        GLib.unlink(`${database}${suffix}`);
    GLib.unlink(`${database}.db`);
    for (const path of [databaseDirectory, `${profile}/User`, profile, directory])
        GLib.rmdir(path);
}
console.log('Cursor read-only SQLite, WAL, profile isolation, and collector checks passed');
