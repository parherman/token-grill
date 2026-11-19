// AES-128 decryption adapted from the Stanford JavaScript Crypto Library 1.0.8.
// https://github.com/bitwiseshiftleft/sjcl/blob/1.0.8/core/aes.js
// Copyright (c) 2009-2015, Emily Stark, Mike Hamburg and Dan Boneh at
// Stanford University. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

export const AES_BLOCK_LENGTH = 16;
const ROUND_KEY_WORDS = 44;

type Tables = {
    sbox: Uint8Array;
    inverseSbox: Uint8Array;
    inverseMix: [Uint32Array, Uint32Array, Uint32Array, Uint32Array];
};

let tables: Tables | null = null;

function makeTables(): Tables {
    const sbox = new Uint8Array(256);
    const inverseSbox = new Uint8Array(256);
    const inverseMix: Tables['inverseMix'] = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    const double = new Uint8Array(256);
    const third = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        const twice = (i << 1) ^ ((i >>> 7) * 0x11b);
        double[i] = twice;
        third[twice ^ i] = i;
    }

    let value = 0;
    let inverse = 0;
    while (!sbox[value]) {
        const rotated = inverse ^ (inverse << 1) ^ (inverse << 2) ^ (inverse << 3) ^ (inverse << 4);
        const substitute = (rotated >>> 8) ^ (rotated & 255) ^ 0x63;
        sbox[value] = substitute;
        inverseSbox[substitute] = value;
        const twice = double[value]!;
        const fourTimes = double[twice]!;
        const eightTimes = double[fourTimes]!;
        let mixed = (eightTimes * 0x1010101) ^ (fourTimes * 0x10001) ^ (twice * 0x101) ^ (value * 0x1010100);
        for (const table of inverseMix) {
            mixed = (mixed << 24) ^ (mixed >>> 8);
            table[substitute] = mixed;
        }
        value ^= twice || 1;
        inverse = third[inverse]! || 1;
    }
    return {sbox, inverseSbox, inverseMix};
}

function decryptionKeys(key: DataView, {sbox, inverseMix: [t0, t1, t2, t3]}: Tables): Uint32Array {
    const forward = new Uint32Array(ROUND_KEY_WORDS);
    for (let i = 0; i < 4; i++)
        forward[i] = key.getUint32(4 * i);
    let roundConstant = 1;
    for (let i = 4; i < forward.length; i++) {
        let word = forward[i - 1]!;
        if (i % 4 === 0) {
            const substituted = (sbox[word >>> 24]! << 24) ^ (sbox[(word >>> 16) & 255]! << 16) ^ (sbox[(word >>> 8) & 255]! << 8) ^ sbox[word & 255]!;
            word = (substituted << 8) ^ (substituted >>> 24) ^ (roundConstant << 24);
            roundConstant = (roundConstant << 1) ^ ((roundConstant >>> 7) * 0x11b);
        }
        forward[i] = forward[i - 4]! ^ word;
    }

    const reverse = new Uint32Array(forward.length);
    for (let i = forward.length; i > 0; i--) {
        const index = forward.length - i;
        const word = forward[index % 4 ? i : i - 4]!;
        reverse[index] = i <= 4 || index < 4
            ? word
            : t0[sbox[word >>> 24]!]! ^ t1[sbox[(word >>> 16) & 255]!]! ^ t2[sbox[(word >>> 8) & 255]!]! ^ t3[sbox[word & 255]!]!;
    }
    forward.fill(0);
    return reverse;
}

function decryptBlock(input: DataView, offset: number, key: Uint32Array, {inverseSbox: sbox, inverseMix: [t0, t1, t2, t3]}: Tables): number[] {
    let a = input.getUint32(offset) ^ key[0]!;
    let b = input.getUint32(offset + 12) ^ key[1]!;
    let c = input.getUint32(offset + 8) ^ key[2]!;
    let d = input.getUint32(offset + 4) ^ key[3]!;
    let index = 4;
    for (; index < key.length - 4; index += 4) {
        const nextA = t0[a >>> 24]! ^ t1[(b >>> 16) & 255]! ^ t2[(c >>> 8) & 255]! ^ t3[d & 255]! ^ key[index]!;
        const nextB = t0[b >>> 24]! ^ t1[(c >>> 16) & 255]! ^ t2[(d >>> 8) & 255]! ^ t3[a & 255]! ^ key[index + 1]!;
        const nextC = t0[c >>> 24]! ^ t1[(d >>> 16) & 255]! ^ t2[(a >>> 8) & 255]! ^ t3[b & 255]! ^ key[index + 2]!;
        d = t0[d >>> 24]! ^ t1[(a >>> 16) & 255]! ^ t2[(b >>> 8) & 255]! ^ t3[c & 255]! ^ key[index + 3]!;
        a = nextA;
        b = nextB;
        c = nextC;
    }

    const output = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        output[(4 - i) % 4] = (sbox[a >>> 24]! << 24) ^ (sbox[(b >>> 16) & 255]! << 16) ^ (sbox[(c >>> 8) & 255]! << 8) ^ sbox[d & 255]! ^ key[index + i]!;
        [a, b, c, d] = [b, c, d, a];
    }
    return output;
}

export function decryptAes128Cbc(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array | null {
    tables ??= makeTables();
    const roundKeys = decryptionKeys(new DataView(key.buffer, key.byteOffset, key.byteLength), tables);
    const input = new DataView(ciphertext.buffer, ciphertext.byteOffset, ciphertext.byteLength);
    const output = new Uint8Array(ciphertext.length);
    const plaintext = new DataView(output.buffer);
    let previous = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
    let previousOffset = 0;
    for (let offset = 0; offset < ciphertext.length; offset += AES_BLOCK_LENGTH) {
        const block = decryptBlock(input, offset, roundKeys, tables);
        for (let word = 0; word < block.length; word++)
            plaintext.setUint32(offset + 4 * word, block[word]! ^ previous.getUint32(previousOffset + 4 * word));
        previous = input;
        previousOffset = offset;
    }
    roundKeys.fill(0);

    const padding = output.at(-1) ?? 0;
    if (padding < 1 || padding > AES_BLOCK_LENGTH || !output.subarray(-padding).every(value => value === padding)) {
        output.fill(0);
        return null;
    }
    return output.subarray(0, output.length - padding);
}
