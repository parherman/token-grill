import type Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type Gda from 'gi://Gda?version=5.0';

import {CollectorError} from '../../core/errors.js';
import {formatText} from '../../core/i18n.js';
import {displayPath, providerPaths} from '../../core/paths.js';
import type {ProviderInstance} from '../../core/types.js';
import {credentialErrorStatus, credentialFileError, type CredentialStatus} from '../credentials.js';
import {fileStamp, loadGda, withReadOnlyDatabase} from '../sqlite.js';
import {isKiroRefreshable, isKiroTokenFresh, parseKiroAuthRecords, type KiroAuth} from './authRecords.js';

// kiro-cli spells its OIDC keys "odic".
const TOKEN_QUERY = "SELECT value FROM auth_kv WHERE key = 'kirocli:odic:token'";
const REGISTRATION_QUERY = "SELECT value FROM auth_kv WHERE key = 'kirocli:odic:device-registration'";
// The state table declares its values as BLOB, which libgda only returns as text through a cast.
const PROFILE_QUERY = "SELECT CAST(value AS TEXT) FROM state WHERE key = 'api.codewhisperer.profile'";

// Changes when kiro-cli writes to its database, including writes still held in the write-ahead log.
export async function kiroDatabaseStamp(path: string, cancellable: Gio.Cancellable | null): Promise<string> {
    let stamps: Array<string | null>;
    try {
        stamps = await Promise.all([fileStamp(path, cancellable), fileStamp(`${path}-wal`, cancellable)]);
    } catch (error) {
        throw credentialFileError(error, path);
    }
    if (stamps[0] === null)
        throw new CollectorError('auth-missing', ({_}) => _('kiro-cli is not signed in.'));
    return stamps.join('|');
}

function selectText(connection: Gda.Connection, query: string): string | null {
    const model = connection.execute_select_command(query);
    if (model.get_n_rows() < 1)
        return null;
    const value = model.get_value_at(0, 0);
    return typeof value === 'string' ? value : null;
}

export async function readKiroAuth(path: string): Promise<KiroAuth> {
    const Gda = await loadGda(({_}) => _('Kiro accounts need the Gda 5.0 library (gir1.2-gda-5.0).'));
    try {
        return withReadOnlyDatabase(Gda, path, true, connection => parseKiroAuthRecords({
            token: selectText(connection, TOKEN_QUERY),
            registration: selectText(connection, REGISTRATION_QUERY),
            profile: selectText(connection, PROFILE_QUERY),
        }));
    } catch (error) {
        throw databaseError(error, path);
    }
}

function databaseError(error: unknown, path: string): unknown {
    if (!(error instanceof GLib.Error))
        return error;
    return new CollectorError('auth-invalid', ({_}) => formatText(_('The kiro-cli database at %s could not be read.'), displayPath(path)));
}

export async function kiroCredentialStatus(instance: ProviderInstance, cancellable: Gio.Cancellable | null): Promise<CredentialStatus> {
    const path = providerPaths(instance).authFile;
    let auth: KiroAuth;
    try {
        await kiroDatabaseStamp(path, cancellable);
        auth = await readKiroAuth(path);
    } catch (error) {
        return credentialErrorStatus(error);
    }
    if (isKiroTokenFresh(auth))
        return 'authenticated';
    return isKiroRefreshable(auth) ? 'expired-refreshable' : 'login-required';
}
