import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import type {ProviderInstance, ProviderKind, ProviderPaths} from './types.js';

const DEFAULT_HOMES: Record<ProviderKind, string[]> = {
    codex: ['.codex'],
    claude: ['.claude'],
    kiro: [],
    antigravity: ['.gemini', 'antigravity-cli'],
    cursor: [],
};

// Antigravity tools have written their OAuth credentials under each of these names.
const ANTIGRAVITY_AUTH_FILES = ['acp_token.json', 'oauth_creds.json', 'credentials.json'];

const AUTH_FILES: Record<ProviderKind, string> = {
    codex: 'auth.json',
    claude: '.credentials.json',
    kiro: 'data.sqlite3',
    antigravity: 'acp_token.json',
    cursor: 'User/globalStorage/state.vscdb',
};

const HISTORY_DIRECTORIES: Record<ProviderKind, string[]> = {
    codex: ['sessions', 'archived_sessions'],
    claude: ['projects'],
    kiro: [],
    antigravity: [],
    cursor: [],
};

export function expandPath(value: string): string {
    const trimmed = value.trim();
    if (!trimmed)
        throw new Error('A path is required.');
    if (trimmed.startsWith('~/'))
        return GLib.build_filenamev([GLib.get_home_dir(), trimmed.slice(2)]);
    if (!trimmed.startsWith('/'))
        throw new Error('Paths must be absolute or start with ~/.');
    return GLib.canonicalize_filename(trimmed, null);
}

export function displayPath(value: string): string {
    const home = GLib.get_home_dir();
    if (value === home)
        return '~';
    if (value.startsWith(`${home}/`))
        return `~/${value.slice(home.length + 1)}`;
    return value;
}

export function defaultHome(kind: ProviderKind): string {
    if (kind === 'cursor')
        return GLib.build_filenamev([GLib.get_user_config_dir(), 'Cursor']);
    if (kind === 'kiro')
        return GLib.build_filenamev([GLib.get_user_data_dir(), 'kiro-cli']);
    return GLib.build_filenamev([GLib.get_home_dir(), ...DEFAULT_HOMES[kind]]);
}

// Normalized providers always hold valid paths, so this never throws for them.
export function providerPaths(instance: ProviderInstance): ProviderPaths {
    const home = expandPath(instance.accountHome);
    const authFile = instance.authFileOverride
        ? expandPath(instance.authFileOverride)
        : GLib.build_filenamev([home, AUTH_FILES[instance.kind]]);
    const historyDirectories = instance.sessionsDirectoryOverride
        ? [expandPath(instance.sessionsDirectoryOverride)]
        : HISTORY_DIRECTORIES[instance.kind].map(name => GLib.build_filenamev([home, name]));
    return {authFile, historyDirectories};
}

// The files tried for an account's credentials, in order of preference.
export function authFileCandidates(instance: ProviderInstance): string[] {
    if (instance.kind === 'cursor' && !instance.authFileOverride)
        return [providerPaths(instance).authFile, GLib.build_filenamev([expandPath(instance.accountHome), 'auth.json'])];
    if (instance.kind !== 'antigravity' || instance.authFileOverride)
        return [providerPaths(instance).authFile];
    const home = expandPath(instance.accountHome);
    return ANTIGRAVITY_AUTH_FILES.map(name => GLib.build_filenamev([home, name]));
}

// Preferences process only: a small, user-triggered synchronous check (PR-9).
export function pathExists(path: string): boolean {
    return Gio.File.new_for_path(path).query_exists(null);
}
