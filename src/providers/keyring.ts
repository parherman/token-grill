import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type Secret from 'gi://Secret?version=1';

import {CollectorError, type ErrorText} from '../core/errors.js';
import {isCancellation} from '../core/gio.js';

// A running Secret Service answers in milliseconds, but when none is running
// D-Bus activation waits about 25 seconds, which would stall every refresh.
const LOOKUP_TIMEOUT_MS = 3000;

// Token Grill's own items: an API key the user pasted, keyed by account id.
export const TOKEN_GRILL_KEY_SCHEMA = 'org.gnome.shell.extensions.tokengrill.ApiKey';

export interface KeyringTexts {
    // libsecret is not installed.
    missingLibrary: ErrorText;
    // No Secret Service answered in time, or the keyring is locked.
    unavailable: ErrorText;
}

type KeyringSession = 'shared' | 'fresh';

// libsecret is optional, so a missing library becomes a message instead of a failed import.
export async function importSecret(texts: KeyringTexts): Promise<typeof Secret> {
    let module: {default: typeof Secret};
    try {
        module = await import('gi://Secret?version=1');
    } catch {
        throw new CollectorError('dependency', texts.missingLibrary);
    }
    Gio._promisify(module.default.Service.prototype, 'search', 'search_finish');
    return module.default;
}

function secretService(library: typeof Secret, cancellable: Gio.Cancellable, session: KeyringSession): Promise<Secret.Service> {
    return new Promise((resolve, reject) => {
        const finish: Gio.AsyncReadyCallback<Secret.Service> = (_source, result) => {
            try {
                resolve(session === 'fresh' ? library.Service.open_finish(result) : library.Service.get_finish(result));
            } catch (error) {
                reject(error);
            }
        };
        if (session === 'fresh')
            library.Service.open(library.Service.$gtype, null, library.ServiceFlags.NONE, cancellable, finish);
        else
            library.Service.get(library.ServiceFlags.NONE, cancellable, finish);
    });
}

// Reads another app's keyring item. Never asks the keyring to unlock: a password
// prompt during a background refresh would be hostile, so a locked keyring counts
// as unavailable. A plain lookup would unlock a locked match, so this searches
// without SearchFlags.UNLOCK and reads only items that are already unlocked.
export async function lookupSecret(
    schemaName: string,
    attributes: Record<string, string>,
    cancellable: Gio.Cancellable,
    texts: KeyringTexts,
    session: KeyringSession = 'shared'
): Promise<string | null> {
    const Secret = await importSecret(texts);
    const attributeTypes = Object.fromEntries(Object.keys(attributes).map(name => [name, Secret.SchemaAttributeType.STRING]));
    const schema = Secret.Schema.new(schemaName, Secret.SchemaFlags.NONE, attributeTypes);
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
    let items: Secret.Item[];
    let service: Secret.Service | null = null;
    let sessionOwner: string | null = null;
    try {
        service = await secretService(Secret, lookup, session);
        if (session === 'fresh')
            sessionOwner = service.get_name_owner();
        items = await service.search(schema, attributes, Secret.SearchFlags.LOAD_SECRETS, lookup);
    } catch (error) {
        if (!timedOut && (isCancellation(error) || !(error instanceof GLib.Error)))
            throw error;
        throw new CollectorError('dependency', texts.unavailable);
    } finally {
        removeTimeout();
        cancellable.disconnect(parentId);
        if (service && sessionOwner && service.get_name_owner() === sessionOwner) {
            const sessionPath = service.get_session_dbus_path();
            // libsecret frees the local proxy, but closing its remote session requires an explicit call.
            if (sessionPath) {
                service.get_connection().call(sessionOwner, sessionPath, 'org.freedesktop.Secret.Session', 'Close', null, null,
                    Gio.DBusCallFlags.NO_AUTO_START, -1, null, null);
            }
        }
    }
    const unlocked = items.find(item => !item.get_locked());
    if (!unlocked && items.length)
        throw new CollectorError('dependency', texts.unavailable);
    return unlocked?.get_secret()?.get_text() ?? null;
}
