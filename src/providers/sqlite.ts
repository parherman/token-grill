import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type GdaNamespace from 'gi://Gda?version=5.0';

import {CollectorError, type ErrorText} from '../core/errors.js';
import {isIoError} from '../core/gio.js';

const STAMP_ATTRIBUTES = 'standard::type,standard::size,time::modified,time::modified-usec';

export async function loadGda(dependencyText: ErrorText): Promise<typeof GdaNamespace> {
    let module: {default: typeof GdaNamespace};
    try {
        module = await import('gi://Gda?version=5.0');
    } catch {
        throw new CollectorError('dependency', dependencyText);
    }
    module.default.init();
    return module.default;
}

export async function fileStamp(path: string, cancellable: Gio.Cancellable | null): Promise<string | null> {
    try {
        const info = await Gio.File.new_for_path(path).query_info_async(
            STAMP_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable);
        if (info.get_file_type() !== Gio.FileType.REGULAR)
            throw GLib.Error.new_literal(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_REGULAR_FILE, 'Credential path is not a regular file');
        return `${info.get_size()}:${info.get_attribute_uint64('time::modified')}:${info.get_attribute_uint32('time::modified-usec')}`;
    } catch (error) {
        if (isIoError(error, Gio.IOErrorEnum.NOT_FOUND))
            return null;
        throw error;
    }
}

// Gda 5 has no asynchronous queries. Callers first check database and WAL stamps.
export function withReadOnlyDatabase<T>(Gda: typeof GdaNamespace, path: string,
    appendExtension: boolean, read: (connection: GdaNamespace.Connection) => T): T {
    const directory = Gda.rfc1738_encode(GLib.path_get_dirname(path));
    const name = Gda.rfc1738_encode(GLib.path_get_basename(path));
    const suffix = appendExtension ? '' : ';APPEND_DB_EXTENSION=FALSE';
    const connection = Gda.Connection.open_from_string('SQLite', `DB_DIR=${directory};DB_NAME=${name}${suffix}`, null, Gda.ConnectionOptions.READ_ONLY);
    try {
        // Some Gda SQLite builds treat READ_ONLY as advisory; query_only enforces it.
        connection.execute_select_command('PRAGMA query_only = ON');
        return read(connection);
    } finally {
        connection.close();
    }
}
