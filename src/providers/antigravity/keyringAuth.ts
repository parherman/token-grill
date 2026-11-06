import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type Secret from 'gi://Secret?version=1';

import {CollectorError, type ErrorText} from '../../core/errors.js';
import {isCancellation} from '../../core/gio.js';
import {AGY_KEYRING_ATTRIBUTES, AGY_KEYRING_SCHEMA, parseAgyKeyringPayload, type AgyKeyringToken} from './keyringPayload.js';

// A running Secret Service answers in milliseconds, but when none is running
// D-Bus activation waits about 25 seconds, which would stall every refresh.
const LOOKUP_TIMEOUT_MS = 3000;

const KEYRING_UNAVAILABLE: ErrorText = ({_}) => _('The system keyring is not available, so the agy sign-in cannot be read.');

async function importSecret(): Promise<typeof Secret> {
    let module: {default: typeof Secret};
    try {
        module = await import('gi://Secret?version=1');
    } catch {
        throw new CollectorError('dependency', ({_}) => _('Antigravity CLI accounts need the libsecret library (gir1.2-secret-1).'));
    }
    Gio._promisify(module.default, 'password_lookup', 'password_lookup_finish');
    return module.default;
}

// Never asks the keyring to unlock: a password prompt during a background
// refresh would be hostile, so a locked keyring counts as unavailable.
export async function lookupAgyKeyringToken(cancellable: Gio.Cancellable): Promise<AgyKeyringToken | null> {
    const Secret = await importSecret();
    const schema = Secret.Schema.new(AGY_KEYRING_SCHEMA, Secret.SchemaFlags.NONE, {
        service: Secret.SchemaAttributeType.STRING,
        username: Secret.SchemaAttributeType.STRING,
    });
    const lookup = new Gio.Cancellable();
    let timedOut = false;
    let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, LOOKUP_TIMEOUT_MS, () => {
        timeoutId = 0;
        timedOut = true;
        lookup.cancel();
        return GLib.SOURCE_REMOVE;
    });
    const removeTimeout = () => {
        if (timeoutId) {
            GLib.Source.remove(timeoutId);
            timeoutId = 0;
        }
    };
    // Connected after the timeout exists: connect() runs the handler at once
    // when the cancellable is already cancelled.
    const parentId = cancellable.connect(() => {
        removeTimeout();
        lookup.cancel();
    });
    let raw: string | null;
    try {
        raw = await Secret.password_lookup(schema, AGY_KEYRING_ATTRIBUTES, lookup);
    } catch (error) {
        if (!timedOut && (isCancellation(error) || !(error instanceof GLib.Error)))
            throw error;
        throw new CollectorError('dependency', KEYRING_UNAVAILABLE);
    } finally {
        removeTimeout();
        cancellable.disconnect(parentId);
    }
    if (!raw)
        return null;
    const token = parseAgyKeyringPayload(raw);
    if (!token)
        throw new CollectorError('auth-invalid', ({_}) => _('The agy sign-in in the system keyring could not be read.'));
    return token;
}
