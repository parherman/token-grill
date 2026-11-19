import GLib from 'gi://GLib';

import {CollectorError} from '../../core/errors.js';
import {AES_BLOCK_LENGTH, decryptAes128Cbc} from './aes.js';

const MAX_ENCODED_TOKEN_LENGTH = 64 * 1024;
const VERSION_LENGTH = 3;
const IV = new Uint8Array(AES_BLOCK_LENGTH).fill(0x20);
const SALT_BLOCK = new Uint8Array([...new TextEncoder().encode('saltysalt'), 0, 0, 0, 1]);

function invalidCiphertext(): CollectorError {
    return new CollectorError('auth-invalid', ({_}) => _('The encrypted Cursor IDE sign-in could not be read.'));
}

export function decodeCursorCiphertext(encoded: string): Uint8Array {
    if (encoded.length > MAX_ENCODED_TOKEN_LENGTH)
        throw invalidCiphertext();
    const blob = GLib.base64_decode(encoded);
    if (blob.length <= VERSION_LENGTH || GLib.base64_encode(blob) !== encoded)
        throw invalidCiphertext();
    if (new TextDecoder().decode(blob.subarray(0, VERSION_LENGTH)) !== 'v11')
        throw new CollectorError('auth-invalid', ({_}) => _('The Cursor IDE sign-in uses an unsupported encryption format.'));
    const ciphertext = blob.subarray(VERSION_LENGTH);
    if (ciphertext.length % AES_BLOCK_LENGTH !== 0)
        throw invalidCiphertext();
    return ciphertext;
}

export function decryptCursorCiphertext(ciphertext: Uint8Array, password: string): string {
    // Linux OSCrypt uses one PBKDF2-SHA1 round and needs only the first 16 bytes.
    const passwordBytes = new TextEncoder().encode(password);
    const digest = GLib.compute_hmac_for_bytes(GLib.ChecksumType.SHA1, passwordBytes, SALT_BLOCK);
    passwordBytes.fill(0);
    const key = new Uint8Array(AES_BLOCK_LENGTH);
    for (let i = 0; i < key.length; i++)
        key[i] = Number.parseInt(digest.slice(2 * i, 2 * i + 2), 16);

    const plaintext = decryptAes128Cbc(ciphertext, key, IV);
    key.fill(0);
    if (plaintext === null)
        throw invalidCiphertext();
    const token = new TextDecoder().decode(plaintext);
    plaintext.fill(0);
    return token;
}
