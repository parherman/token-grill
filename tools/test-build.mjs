import {mkdir, rm} from 'node:fs/promises';
import path from 'node:path';

import * as esbuild from 'esbuild';

const root = process.cwd();
const out = path.join(root, 'build', 'tests');

// Node stand-ins for the few GLib and Gio calls that pure modules reach through core/paths.
const GI_STUBS = {
    'gi://GLib': `
        import {randomUUID} from 'node:crypto';
        import path from 'node:path';
        export default {
            build_filenamev: parts => path.join(...parts),
            canonicalize_filename: file => path.resolve(file),
            get_home_dir: () => '/home/test',
            get_user_config_dir: () => '/home/test/.config',
            base64_decode: value => new Uint8Array(Buffer.from(value, 'base64')),
            get_user_data_dir: () => '/home/test/.local/share',
            uuid_string_random: () => randomUUID(),
        };`,
    'gi://Gio': `
        export default {File: {new_for_path: () => ({query_exists: () => false})}};`,
};

const giStubs = {
    name: 'gi-stubs',
    setup(build) {
        build.onResolve({filter: /^gi:\/\//}, args => ({path: args.path, namespace: 'gi-stub'}));
        build.onLoad({filter: /.*/, namespace: 'gi-stub'}, args => {
            const contents = GI_STUBS[args.path];
            if (!contents)
                throw new Error(`No test stub for ${args.path}`);
            return {contents, loader: 'js', resolveDir: root};
        });
    },
};

const MODULES = [
    ['src/core/accent.ts', 'accent.mjs'],
    ['src/core/config.ts', 'config.mjs'],
    ['src/core/display.ts', 'display.mjs'],
    ['src/core/errors.ts', 'errors.mjs'],
    ['src/core/historyMetrics.ts', 'history-metrics.mjs'],
    ['src/core/i18n.ts', 'i18n.mjs'],
    ['src/core/notificationPolicy.ts', 'notification-policy.mjs'],
    ['src/core/paths.ts', 'paths.mjs'],
    ['src/core/popupModel.ts', 'popup-model.mjs'],
    ['src/core/providerMetadata.ts', 'provider-metadata.mjs'],
    ['src/core/providerOrder.ts', 'provider-order.mjs'],
    ['src/core/timeMath.ts', 'time-math.mjs'],
    ['src/prefs/providerValidation.ts', 'provider-validation.mjs'],
    ['src/pricing/calculator.ts', 'pricing-calculator.mjs'],
    ['src/providers/antigravity/endpoints.ts', 'antigravity-endpoints.mjs'],
    ['src/providers/antigravity/keyringPayload.ts', 'antigravity-keyring-payload.mjs'],
    ['src/providers/antigravity/normalize.ts', 'antigravity-normalize.mjs'],
    ['src/providers/claude/history.ts', 'claude-history.mjs'],
    ['src/providers/claude/normalize.ts', 'claude-normalize.mjs'],
    ['src/providers/codex/history.ts', 'codex-history.mjs'],
    ['src/providers/codex/normalize.ts', 'codex-normalize.mjs'],
    ['src/providers/codex/resetCreditsNormalize.ts', 'reset-credits-normalize.mjs'],
    ['src/providers/cursor/authRecords.ts', 'cursor-auth-records.mjs'],
    ['src/providers/cursor/normalize.ts', 'cursor-normalize.mjs'],
    ['src/providers/kiro/authRecords.ts', 'kiro-auth-records.mjs'],
    ['src/providers/kiro/endpoints.ts', 'kiro-endpoints.mjs'],
    ['src/providers/kiro/normalize.ts', 'kiro-normalize.mjs'],
    ['src/providers/kiro/usagePolicy.ts', 'kiro-usage-policy.mjs'],
];

await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
// One build with shared chunks, so every test sees a single copy of each
// module, as the extension does, and instanceof works across modules.
await esbuild.build({
    entryPoints: MODULES.map(([source, name]) => ({in: path.join(root, source), out: name.replace(/\.mjs$/, '')})),
    outdir: out,
    outExtension: {'.js': '.mjs'},
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'warning',
    plugins: [giStubs],
});
