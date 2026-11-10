import {readFile, readdir, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const metadata = JSON.parse(await readFile(path.join(root, 'metadata.json'), 'utf8'));
const errors = [];
const expectedUuid = 'tokengrill@sh02sahil.github.io';
const expectedUrl = 'https://github.com/sh02sahil/token-grill';
const allowedMetadataKeys = new Set(['name', 'description', 'uuid', 'url', 'shell-version', 'settings-schema', 'version-name']);
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

if (metadata.uuid !== expectedUuid)
    errors.push(`Public UUID must be ${expectedUuid}.`);
if (metadata.url !== expectedUrl)
    errors.push(`Project URL must be ${expectedUrl}.`);
if (JSON.stringify(metadata['shell-version']) !== JSON.stringify(['50', '51']))
    errors.push('The release must target GNOME Shell 50 and 51.');
if (metadata['settings-schema'] !== 'org.gnome.shell.extensions.tokengrill')
    errors.push('Unexpected settings schema.');
// PRACTICES 3.2: letters, numbers, space and period, 1 to 16 characters.
if (!/^(?!^[. ]+$)[a-zA-Z0-9 .]{1,16}$/.test(metadata['version-name'] ?? ''))
    errors.push('version-name is missing or is not a valid EGO version name.');
if (metadata['version-name'] !== packageJson.version)
    errors.push(`version-name ${metadata['version-name']} does not agree with package.json ${packageJson.version}.`);
for (const key of Object.keys(metadata)) {
    if (!allowedMetadataKeys.has(key))
        errors.push(`Unnecessary metadata key: ${key}`);
}

async function listFiles(directory, skip = new Set()) {
    const files = [];
    for (const entry of await readdir(directory, {withFileTypes: true})) {
        if (skip.has(entry.name))
            continue;
        const child = path.join(directory, entry.name);
        if (entry.isDirectory())
            files.push(...await listFiles(child, skip));
        else
            files.push(child);
    }
    return files;
}

// Source-level guards for rules Shexli cannot see (PRACTICES.md AI-4, X-1, X-2, TS-11).
for (const file of await listFiles(path.join(root, 'src'))) {
    const relative = path.relative(root, file);
    const source = await readFile(file, 'utf8');
    if (/@ts-(nocheck|ignore)/.test(source))
        errors.push(`${relative}: type checking is disabled.`);
    if (/child_process|execFile|GLib\.spawn|Gio\.Subprocess/.test(source))
        errors.push(`${relative}: runtime code must not launch subprocesses.`);
    if (/set_tooltip_text/.test(source) && relative.startsWith('src/shell/'))
        errors.push(`${relative}: Shell code must not call GTK-only set_tooltip_text().`);
}

// Development traces that must never be published (personal paths, private UUIDs,
// the AI personal-use notice, design-tool headers).
const forbidden = [
    new RegExp(['tokengrill', 'local'].join('@'), 'i'),
    new RegExp(['tokens', '4', 'breakfast'].join('[ _-]*'), 'i'),
    new RegExp(['replace', 'me'].join('-'), 'i'),
    new RegExp(['replace-with-your', 'public-uuid'].join('-'), 'i'),
    new RegExp(['Do NOT', 'upload'].join(' '), 'i'),
    new RegExp(['Generated with AI', 'personal use'].join(' for '), 'i'),
    new RegExp(['component', 'scope:'].join('-'), 'i'),
    new RegExp(["'\\.t3'", "'userdata'"].join(',\\s*')),
];
const textExtensions = new Set(['.md', '.json', '.mjs', '.js', '.ts', '.xml', '.sh', '.css', '.svg', '.txt']);
const scanned = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding: 'utf8'})
    .split('\0').filter(Boolean).map(file => path.join(root, file));
// The checker and the rulebook name the patterns in order to ban them.
const traceRules = new Set(['tools/release-check.mjs', 'PRACTICES.md']);
for (const file of scanned.filter(name => textExtensions.has(path.extname(name)))) {
    if (traceRules.has(path.relative(root, file)))
        continue;
    const text = await readFile(file, 'utf8');
    for (const pattern of forbidden) {
        if (pattern.test(text))
            errors.push(`Private-development trace in ${path.relative(root, file)}: ${pattern}`);
    }
}

for (const screenshot of ['panel-indicator.png', 'usage-dashboard.png']) {
    try {
        if ((await stat(path.join(root, 'docs', 'screenshots', screenshot))).size < 10_000)
            errors.push(`Screenshot is unexpectedly small: ${screenshot}`);
    } catch {
        errors.push(`README screenshot is missing: ${screenshot}`);
    }
}

const dist = path.join(root, 'dist', metadata.uuid);
try {
    const packaged = (await listFiles(dist)).map(file => path.relative(dist, file));
    for (const required of ['metadata.json', 'extension.js', 'prefs.js', 'schemas/org.gnome.shell.extensions.tokengrill.gschema.xml']) {
        if (!packaged.includes(required))
            errors.push(`Required release file is missing: ${required}`);
    }
    for (const file of packaged) {
        if (/\.map$|\.d\.ts$|\.ts$|node_modules|tests?\/|MANIFEST|NOTICE/.test(file))
            errors.push(`Development-only file is packaged: ${file}`);
        if (file.startsWith('icons/') && !file.endsWith('-symbolic.svg'))
            errors.push(`Packaged icons must be symbolic SVGs: ${file}`);
        if (!file.endsWith('.js'))
            continue;
        const lines = (await readFile(path.join(dist, file), 'utf8')).split('\n');
        lines.forEach((line, index) => {
            if (line.length > 200)
                errors.push(`${file}:${index + 1} is longer than 200 characters.`);
            if (/^\s*var\s/.test(line))
                errors.push(`${file}:${index + 1} uses var.`);
        });
    }
    if (packaged.includes('schemas/gschemas.compiled'))
        errors.push('Compiled settings schemas must not be present in dist/.');
    const packagedMetadata = JSON.parse(await readFile(path.join(dist, 'metadata.json'), 'utf8'));
    if (packagedMetadata.uuid !== metadata.uuid)
        errors.push('Packaged metadata UUID differs from source metadata.');
} catch {
    errors.push('Build the extension before running release validation.');
}

const releaseZip = path.join(root, 'build', 'releases', `${metadata.uuid}.shell-extension.zip`);
try {
    await stat(releaseZip);
    const entries = execFileSync('unzip', ['-Z1', releaseZip], {encoding: 'utf8'}).split('\n').filter(Boolean);
    if (entries.includes('schemas/gschemas.compiled'))
        errors.push('Compiled settings schemas must not be present in the release ZIP.');
} catch (error) {
    if (error.code !== 'ENOENT')
        errors.push(`Could not inspect the existing release ZIP: ${error.message}`);
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Release metadata and package tree are ready for ${metadata.uuid}.`);
}
