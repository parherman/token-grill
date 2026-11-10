// Reads a synthetic kiro-cli database through the built extension's Gda code,
// then confirms that a read-only connection refuses writes. Uses no network
// and no real data. Run `npm run build` first.
import Gda from 'gi://Gda?version=5.0';
import GLib from 'gi://GLib';

const root = GLib.path_get_dirname(GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]));
const [, metadata] = GLib.file_get_contents(`${root}/metadata.json`);
const dist = `${root}/dist/${JSON.parse(new TextDecoder().decode(metadata)).uuid}`;
const {readKiroAuth, kiroDatabaseStamp} = await import(`file://${dist}/providers/kiro/auth.js`);
const {withReadOnlyDatabase} = await import(`file://${dist}/providers/sqlite.js`);

// A directory name that needs RFC 1738 encoding in the connection string.
const directory = GLib.dir_make_tmp('tokengrill kiro;XXXXXX');
const database = GLib.build_filenamev([directory, 'data.sqlite3']);
const connectionString = `DB_DIR=${Gda.rfc1738_encode(directory)};DB_NAME=data.sqlite3`;
const token = JSON.stringify({access_token: 'sanitized', expires_at: '2030-01-01T00:00:00Z', region: 'eu-central-1'});
const profile = JSON.stringify({arn: 'arn:aws:codewhisperer:eu-central-1:1:profile/fixture', profile_name: 'fixture'});

Gda.init();
const writable = Gda.Connection.open_from_string('SQLite', connectionString, null, Gda.ConnectionOptions.NONE);
writable.execute_select_command('PRAGMA journal_mode=WAL').get_n_rows();
writable.execute_non_select_command('CREATE TABLE auth_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
writable.execute_non_select_command('CREATE TABLE state (key TEXT PRIMARY KEY, value BLOB)');
writable.execute_non_select_command(`INSERT INTO auth_kv VALUES ('kirocli:odic:token', '${token}')`);
writable.execute_non_select_command(`INSERT INTO state VALUES ('api.codewhisperer.profile', '${profile}')`);
const before = await kiroDatabaseStamp(`${database}.db`, null);
writable.execute_non_select_command(`UPDATE auth_kv SET value='${token.replace('sanitized', 'rotated')}' WHERE key='kirocli:odic:token'`);
if (before === await kiroDatabaseStamp(`${database}.db`, null))
    throw new Error('Kiro WAL changes were not detected');

const auth = await readKiroAuth(database);
if (auth.accessToken !== 'rotated' || auth.serviceRegion !== 'eu-central-1' || !auth.profileArn)
    throw new Error('The Kiro fixture was not read correctly');

let opened;
try {
    withReadOnlyDatabase(Gda, database, true, connection => {
        opened = connection;
        connection.execute_non_select_command("UPDATE auth_kv SET value = 'changed'");
    });
    throw new Error('A read-only Gda connection accepted a write');
} catch (error) {
    if (!(error instanceof GLib.Error))
        throw error;
}
if (opened.is_opened())
    throw new Error('SQLite connection remained open after an error');
withReadOnlyDatabase(Gda, database, true, connection => {
    opened = connection;
    connection.execute_select_command('SELECT value FROM auth_kv');
});
if (opened.is_opened())
    throw new Error('SQLite connection remained open after success');
writable.close();
for (const suffix of ['', '-wal', '-shm'])
    GLib.unlink(`${database}.db${suffix}`);
GLib.rmdir(directory);
console.log('Kiro Gda read-only check passed');
