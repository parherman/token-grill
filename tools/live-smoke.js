// Collects one account against the real service with the built extension
// modules, outside GNOME Shell. Run `npm run build` first.
//
//     gjs -m tools/live-smoke.js <codex|claude|kiro|antigravity|cursor> [account-home] [auth-file]
//
// Prints the outcome and the usage windows only: no tokens and no e-mail address.
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import Gio from 'gi://Gio';

const [kind, home, authFile] = ARGV;
const root = GLib.path_get_dirname(GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]));
const [, metadata] = GLib.file_get_contents(`${root}/metadata.json`);
const dist = `${root}/dist/${JSON.parse(new TextDecoder().decode(metadata)).uuid}`;
const load = module => import(`file://${dist}/${module}`);

const [{newProvider}, {UNTRANSLATED}, {defaultHome, displayPath, providerPaths}, {emptySnapshot}, base, {createCollectors}, kiroAuth] = await Promise.all([
    load('core/config.js'),
    load('core/i18n.js'),
    load('core/paths.js'),
    load('core/types.js'),
    load('providers/base.js'),
    load('providers/registry.js'),
    load('providers/kiro/auth.js'),
]);

const collectors = createCollectors();
if (!(kind in collectors)) {
    console.error('Usage: gjs -m tools/live-smoke.js <codex|claude|kiro|antigravity|cursor> [account-home] [auth-file]');
    throw new Error(`Unknown kind: ${kind}`);
}
const instance = {...newProvider(kind, home ?? defaultHome(kind)), authFileOverride: authFile ?? null};
const session = new Soup.Session({timeout: 30, user_agent: base.USER_AGENT});
const cancellable = new Gio.Cancellable();
const context = {
    aggregates: null,
    checkpoints: null,
    catalog: {},
    cancellable,
    tr: UNTRANSLATED,
    manual: true,
    requestJson: (method, url, headers, body) => base.requestJson(session, method, url, headers, body, cancellable),
    onSourcePhase: () => {},
    onSourceResult: (source, result) => console.log(`  ${source}: ${result}`),
};

// The kiro-cli database must be exactly as it was: Token Grill only reads it.
const database = providerPaths(instance).authFile;
const stampBefore = kind === 'kiro' ? await kiroAuth.kiroDatabaseStamp(database, null) : null;

console.log(`${kind} ${displayPath(instance.accountHome)}`);
const snapshot = await collectors[kind].collect(instance, context, emptySnapshot(instance.id));
console.log(`  state: ${snapshot.state}${snapshot.errorInfo ? ` (${snapshot.errorInfo.code}: ${snapshot.error})` : ''}`);
console.log(`  plan: ${snapshot.plan ?? 'none'}; account reported: ${snapshot.account !== null}`);
for (const window of snapshot.windows) {
    const percent = window.percent === null ? 'no percentage' : `${(window.percent * 100).toFixed(1)}% used`;
    const reset = window.resetAt === null ? 'no reset time' : `resets ${new Date(window.resetAt).toISOString()}`;
    console.log(`  ${window.canonicalWindow} (${window.label}): ${percent}, ${reset}`);
}
if (snapshot.resetCredits)
    console.log(`  reset credits available: ${snapshot.resetCredits.availableCount}`);

if (stampBefore !== null && stampBefore !== await kiroAuth.kiroDatabaseStamp(database, null))
    throw new Error('The kiro-cli database changed during the read-only check');
