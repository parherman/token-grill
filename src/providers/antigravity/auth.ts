import type Gio from 'gi://Gio';

import {CollectorError} from '../../core/errors.js';
import {numberAt, stringAt, toEpochMs} from '../../core/json.js';
import {authFileCandidates} from '../../core/paths.js';
import type {ProviderInstance} from '../../core/types.js';
import {credentialErrorStatus, readCredentialJson, type CredentialStatus} from '../credentials.js';
import {lookupAgyKeyringToken} from './keyringAuth.js';

// A token this close to expiry is refreshed first, so it cannot expire in flight.
const TOKEN_SKEW_MS = 60 * 1000;

// File credentials from the Antigravity app carry an OAuth client and can be
// refreshed here; the agy CLI's keyring token can only be renewed by agy itself.
export interface AntigravityAuth {
    source: 'file' | 'keyring';
    clientId: string | null;
    clientSecret: string | null;
    refreshToken: string | null;
    accessToken: string | null;
    expiresAt: number | null;
}

export function isAntigravityRefreshable(auth: AntigravityAuth): boolean {
    return Boolean(auth.refreshToken && auth.clientId && auth.clientSecret);
}

export function isAntigravityTokenFresh(auth: AntigravityAuth): boolean {
    return Boolean(auth.accessToken) && auth.expiresAt !== null && auth.expiresAt > Date.now() + TOKEN_SKEW_MS;
}

function notSignedIn(): CollectorError {
    return new CollectorError('auth-missing', ({_}) => _('Antigravity is not signed in.'));
}

async function loadFileAuth(instance: ProviderInstance, cancellable: Gio.Cancellable | null): Promise<AntigravityAuth> {
    for (const path of authFileCandidates(instance)) {
        let payload: Record<string, unknown>;
        try {
            // The first file that exists wins, so they are read in order.
            // eslint-disable-next-line no-await-in-loop
            payload = await readCredentialJson(path, cancellable);
        } catch (error) {
            if (!(error instanceof CollectorError) || error.code !== 'auth-missing')
                throw error;
            continue;
        }
        const auth: AntigravityAuth = {
            source: 'file',
            clientId: stringAt(payload, 'client_id'),
            clientSecret: stringAt(payload, 'client_secret'),
            refreshToken: stringAt(payload, 'refresh_token'),
            accessToken: stringAt(payload, 'access_token'),
            expiresAt: toEpochMs(numberAt(payload, 'expiry_date')),
        };
        if (!auth.accessToken && !auth.refreshToken)
            throw notSignedIn();
        return auth;
    }
    throw notSignedIn();
}

async function loadKeyringAuth(cancellable: Gio.Cancellable): Promise<AntigravityAuth | null> {
    const token = await lookupAgyKeyringToken(cancellable);
    if (!token)
        return null;
    return {source: 'keyring', clientId: null, clientSecret: null, ...token};
}

function settle<T>(promise: Promise<T>): Promise<{value: T | null; error: unknown}> {
    return promise.then(value => ({value, error: null}), (error: unknown) => {
        if (!(error instanceof CollectorError))
            throw error;
        return {value: null, error};
    });
}

// A usable credential file wins, because it can be refreshed without the user.
// Otherwise a live keyring token takes over from a stale file, so an account
// signed in through agy keeps working.
export async function resolveAntigravityAuth(instance: ProviderInstance, cancellable: Gio.Cancellable): Promise<AntigravityAuth> {
    const file = await settle(loadFileAuth(instance, cancellable));
    if (file.value && (isAntigravityTokenFresh(file.value) || isAntigravityRefreshable(file.value)))
        return file.value;
    const keyring = await settle(loadKeyringAuth(cancellable));
    if (keyring.value && (!file.value || isAntigravityTokenFresh(keyring.value)))
        return keyring.value;
    if (file.value)
        return file.value;
    // A broken keyring explains more than the missing file it stands in for.
    throw keyring.error ?? file.error;
}

export async function antigravityCredentialStatus(instance: ProviderInstance, cancellable: Gio.Cancellable): Promise<CredentialStatus> {
    let auth: AntigravityAuth;
    try {
        auth = await resolveAntigravityAuth(instance, cancellable);
    } catch (error) {
        return credentialErrorStatus(error);
    }
    if (isAntigravityTokenFresh(auth))
        return 'authenticated';
    if (isAntigravityRefreshable(auth))
        return 'expired-refreshable';
    return auth.source === 'keyring' ? 'expired-external' : 'login-required';
}
