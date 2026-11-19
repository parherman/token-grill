import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {CollectorError} from '../../core/errors.js';
import {isIoError} from '../../core/gio.js';
import {parseRecord} from '../../core/json.js';
import {authFileCandidates} from '../../core/paths.js';
import type {ProviderInstance} from '../../core/types.js';
import {credentialFileError, readCredentialJson} from '../credentials.js';
import {lookupSecret, type KeyringTexts} from '../keyring.js';
import {fileStamp, loadGda, withReadOnlyDatabase} from '../sqlite.js';
import {parseCursorAuth, requireFreshCursorAuth, type CursorAuth} from './authRecords.js';
import {decodeCursorCiphertext, decryptCursorCiphertext} from './safeStorage.js';

const AUTH_QUERY = "SELECT key, CAST(value AS TEXT) FROM ItemTable WHERE key IN ('cursorAuth/accessToken', 'cursorAuth/cachedScopedProfile')";
const ENCRYPTED_TOKEN_PREFIX = 'cursor-safe-storage:v1:';
const KEYRING_SCHEMA = 'chrome_libsecret_os_crypt_password_v2';
const KEYRING_ATTRIBUTES = {application: 'Cursor'};
const KEYRING_TEXTS: KeyringTexts = {
    missingLibrary: ({_}) => _('Encrypted Cursor IDE sign-ins need the libsecret library (gir1.2-secret-1).'),
    unavailable: ({_}) => _('The system keyring is locked or unavailable.'),
};

export async function readCursorDatabase(path: string, cancellable: Gio.Cancellable | null = null): Promise<CursorAuth> {
    const Gda = await loadGda(({_}) => _('Cursor IDE accounts need the Gda 5.0 library (gir1.2-gda-5.0).'));
    let record: {accessToken: unknown; profile: unknown};
    try {
        record = withReadOnlyDatabase(Gda, path, false, connection => {
            const model = connection.execute_select_command(AUTH_QUERY);
            let accessToken: unknown;
            let profile: unknown;
            for (let row = 0; row < model.get_n_rows(); row++) {
                const key = model.get_value_at(0, row);
                const value = model.get_value_at(1, row);
                if (key === 'cursorAuth/accessToken')
                    accessToken = value;
                else if (key === 'cursorAuth/cachedScopedProfile' && typeof value === 'string')
                    profile = parseRecord(value);
            }
            return {accessToken, profile};
        });
    } catch (error) {
        throw databaseError(error);
    }
    const {profile} = record;
    let {accessToken} = record;
    if (typeof accessToken === 'string' && accessToken.startsWith(ENCRYPTED_TOKEN_PREFIX)) {
        const ciphertext = decodeCursorCiphertext(accessToken.slice(ENCRYPTED_TOKEN_PREFIX.length));
        // A long-running Shell can hold a shared libsecret session that the keyring has discarded.
        const password = await lookupSecret(KEYRING_SCHEMA, KEYRING_ATTRIBUTES, cancellable ?? new Gio.Cancellable(), KEYRING_TEXTS, 'fresh');
        if (!password)
            throw new CollectorError('dependency', ({_}) => _('The Cursor Safe Storage key is unavailable in the system keyring.'));
        accessToken = decryptCursorCiphertext(ciphertext, password);
    }
    return parseCursorAuth({accessToken}, profile);
}

async function credentialStamp(path: string, cancellable: Gio.Cancellable | null): Promise<string | null> {
    try {
        return await fileStamp(path, cancellable);
    } catch (error) {
        if (isIoError(error, Gio.IOErrorEnum.NOT_REGULAR_FILE))
            throw new CollectorError('auth-invalid', ({_}) => _('The Cursor credential path is not a regular file.'));
        throw credentialFileError(error, path);
    }
}

function databaseError(error: unknown): unknown {
    return error instanceof GLib.Error
        ? new CollectorError('auth-invalid', ({_}) => _('The Cursor sign-in database could not be read.'))
        : error;
}

async function credentialPath(instance: ProviderInstance, cancellable: Gio.Cancellable | null): Promise<{path: string; stamp: string}> {
    for (const path of authFileCandidates(instance)) {
        // A present IDE store owns this profile, even when its sign-in is invalid.
        // eslint-disable-next-line no-await-in-loop
        const stamp = await credentialStamp(path, cancellable);
        if (stamp !== null)
            return {path, stamp};
    }
    throw new CollectorError('auth-missing', ({_}) => _('Cursor is not signed in at this account home.'));
}

export class CursorAuthStore {
    private readonly _stored = new Map<string, {stamp: string; auth: CursorAuth}>();

    async load(instance: ProviderInstance, cancellable: Gio.Cancellable | null): Promise<{path: string; auth: CursorAuth}> {
        const {path, stamp: mainStamp} = await credentialPath(instance, cancellable);
        const database = path.endsWith('.vscdb');
        if (!database && !path.endsWith('.json'))
            throw new CollectorError('auth-invalid', ({_}) => _('The Cursor credential file format is not supported.'));
        const walStamp = database ? await credentialStamp(`${path}-wal`, cancellable) : null;
        const stamp = `${mainStamp}|${walStamp ?? ''}`;
        let cached = this._stored.get(path);
        if (cached?.stamp !== stamp) {
            const auth = database ? await readCursorDatabase(path, cancellable) : parseCursorAuth(await readCredentialJson(path, cancellable));
            cached = {stamp, auth};
            this._stored.set(path, cached);
        }
        requireFreshCursorAuth(cached.auth);
        return {path, auth: cached.auth};
    }
}
