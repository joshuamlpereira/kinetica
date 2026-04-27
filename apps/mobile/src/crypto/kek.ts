// Passphrase → KEK derivation, and KEK ⇄ wrapped_master_key.
//
// The KEK (key-encryption key) never leaves the device. The server stores
// `wrapped_master_key`, which is the master XChaCha key encrypted under the
// KEK with XChaCha20-Poly1305 AEAD. Wrong passphrase → wrong KEK → AEAD
// rejects the tag → unwrap throws BEFORE any further work.

import { aeadDecrypt, aeadEncrypt, KEY_BYTES } from './aead.ts';
import { randomBytes } from './random.ts';
import { sodium } from './_sodium.ts';
import {
  ARGON2ID_MEM_LIMIT,
  ARGON2ID_OPS_LIMIT,
  KEK_BYTES,
  SALT_BYTES,
} from './argon2_params.ts';

export type Argon2idParams = {
  opsLimit: number;
  memLimit: number;
};

export const DEFAULT_ARGON2ID_PARAMS: Argon2idParams = {
  opsLimit: ARGON2ID_OPS_LIMIT,
  memLimit: ARGON2ID_MEM_LIMIT,
};

export function generatePasswordSalt(): Uint8Array {
  return randomBytes(SALT_BYTES);
}

export function deriveKEK(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2idParams = DEFAULT_ARGON2ID_PARAMS,
): Uint8Array {
  if (salt.length !== SALT_BYTES) {
    throw new Error(`deriveKEK: salt must be ${SALT_BYTES} bytes, got ${salt.length}`);
  }
  if (passphrase.length === 0) {
    throw new Error('deriveKEK: passphrase must be non-empty');
  }
  const s = sodium();
  return s.crypto_pwhash(
    KEK_BYTES,
    passphrase,
    salt,
    params.opsLimit,
    params.memLimit,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export function wrapMasterKey(masterKey: Uint8Array, kek: Uint8Array): Uint8Array {
  if (masterKey.length !== KEY_BYTES) {
    throw new Error(`wrapMasterKey: master key must be ${KEY_BYTES} bytes`);
  }
  return aeadEncrypt(masterKey, kek);
}

export function unwrapMasterKey(
  wrappedMasterKey: Uint8Array,
  kek: Uint8Array,
): Uint8Array {
  // Throws on AEAD tag mismatch — i.e. when the KEK is wrong because the
  // user typed the wrong passphrase. The throw is the local-first signal
  // that authentication has failed; no network call has been made.
  return aeadDecrypt(wrappedMasterKey, kek);
}
