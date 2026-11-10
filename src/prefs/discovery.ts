import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {newProvider} from '../core/config.js';
import {authFileCandidates, defaultHome, expandPath, pathExists, providerPaths} from '../core/paths.js';
import {providerMetadata} from '../core/providerMetadata.js';
import type {ProviderInstance, ProviderKind} from '../core/types.js';

const HOME_PREFIXES: Array<[string, ProviderKind]> = [['.codex', 'codex'], ['.claude', 'claude']];

export interface Discovery {
    found: ProviderInstance[];
    candidates: number;
}

function hasCredentials(provider: ProviderInstance): boolean {
    return authFileCandidates(provider).some(pathExists);
}

function prefixedHomes(): ProviderInstance[] {
    const home = Gio.File.new_for_path(GLib.get_home_dir());
    const enumerator = home.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    const providers: ProviderInstance[] = [];
    for (const info of enumerator) {
        if (info.get_file_type() !== Gio.FileType.DIRECTORY)
            continue;
        const name = info.get_name();
        const match = HOME_PREFIXES.find(([prefix]) => name.startsWith(prefix));
        if (!match)
            continue;
        const [prefix, kind] = match;
        const provider = newProvider(kind, `~/${name}`);
        if (!hasCredentials(provider) && !providerPaths(provider).historyDirectories.some(pathExists))
            continue;
        provider.displayName = `${providerMetadata(kind).label}${name.slice(prefix.length)}`;
        providers.push(provider);
    }
    enumerator.close(null);
    return providers;
}

function antigravityHomes(): ProviderInstance[] {
    const home = GLib.get_home_dir();
    // The agy CLI keeps its token in the keyring, so its home is recognised by its own state files.
    const cliHome = GLib.build_filenamev([home, '.gemini', 'antigravity-cli']);
    const cliMarkers = ['settings.json', 'installation_id'].map(name => GLib.build_filenamev([cliHome, name]));
    const providers = [];
    if (cliMarkers.some(pathExists))
        providers.push(newProvider('antigravity', cliHome));
    const otherHomes = [
        GLib.build_filenamev([home, '.gemini', 'antigravity']),
        GLib.build_filenamev([home, '.antigravity']),
        GLib.build_filenamev([home, '.config', 'Antigravity']),
    ];
    for (const path of otherHomes) {
        const provider = newProvider('antigravity', path);
        if (hasCredentials(provider))
            providers.push(provider);
    }
    return providers;
}

function kiroHomes(): ProviderInstance[] {
    const provider = newProvider('kiro', defaultHome('kiro'));
    return hasCredentials(provider) ? [provider] : [];
}

function cursorHomes(): ProviderInstance[] {
    const homes = [
        {home: defaultHome('cursor'), displayName: 'Cursor IDE'},
        {home: GLib.build_filenamev([GLib.get_user_config_dir(), 'cursor']), displayName: 'Cursor Agent'},
    ];
    return homes
        .map(({home, displayName}) => ({...newProvider('cursor', home), displayName}))
        .filter(hasCredentials);
}

export function discoverAccounts(configured: ProviderInstance[]): Discovery {
    const known = new Set(configured.map(provider => expandPath(provider.accountHome)));
    const candidates = [...prefixedHomes(), ...kiroHomes(), ...antigravityHomes(), ...cursorHomes()];
    const found = [];
    for (const candidate of candidates) {
        const home = expandPath(candidate.accountHome);
        if (known.has(home))
            continue;
        known.add(home);
        found.push(candidate);
    }
    return {found, candidates: candidates.length};
}
