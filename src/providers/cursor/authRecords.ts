import GLib from 'gi://GLib';

import {CollectorError} from '../../core/errors.js';
import {isRecord, numberAt, parseRecord, stringAt} from '../../core/json.js';

export interface CursorAuth {
    accessToken: string;
    identity: string;
    expiresAt: number | null;
}

function invalidAuth(): CollectorError {
    return new CollectorError('auth-invalid', ({_}) => _('The Cursor sign-in data could not be read.'));
}

export function parseCursorAuth(payload: unknown, profile?: unknown): CursorAuth {
    if (!isRecord(payload))
        throw invalidAuth();
    if (payload.accessToken === undefined || payload.accessToken === '')
        throw new CollectorError('auth-missing', ({_}) => _('Cursor is not signed in.'));
    const accessToken = stringAt(payload, 'accessToken');
    if (!accessToken)
        throw invalidAuth();
    if (/^curs[A-Za-z0-9_-]+$/.test(accessToken)) {
        const identity = isRecord(profile) ? stringAt(profile, 'authId') : null;
        if (!identity || !/^[A-Za-z0-9_-]+\|user_[A-Za-z0-9_-]+$/.test(identity))
            throw invalidAuth();
        return {accessToken, identity, expiresAt: null};
    }
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken))
        throw invalidAuth();
    const encoded = accessToken.split('.')[1]!;
    const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const claims = parseRecord(new TextDecoder().decode(GLib.base64_decode(base64)));
    const identity = claims ? stringAt(claims, 'sub') : null;
    if (!claims || !identity)
        throw invalidAuth();
    const expiry = numberAt(claims, 'exp');
    if (Object.hasOwn(claims, 'exp') && (expiry === null || expiry < 0))
        throw invalidAuth();
    return {
        accessToken,
        identity,
        expiresAt: expiry === null ? null : expiry * 1000,
    };
}

export function requireFreshCursorAuth(auth: CursorAuth, now = Date.now()): void {
    if (auth.expiresAt !== null && auth.expiresAt <= now)
        throw new CollectorError('auth-expired', ({_}) => _('The Cursor sign-in has expired.'));
}
