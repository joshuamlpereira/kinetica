// XChaCha20-Poly1305 AEAD wrapper.
//
// Output layout (fixed across the codebase): `nonce || ciphertext_with_tag`.
// XChaCha nonces are 24 bytes, the Poly1305 tag is 16 bytes, so the
// minimum blob size is 24 + 16 = 40 bytes. Decrypt requires that prefix
// shape exactly; tampered tag → libsodium throws, propagated to the caller.

import { randomBytes } from './random.ts';
import { sodium } from './_sodium.ts';

export const NONCE_BYTES = 24;
export const TAG_BYTES = 16;
export const KEY_BYTES = 32;

export function aeadEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  associatedData: Uint8Array | null = null,
): Uint8Array {
  if (key.length !== KEY_BYTES) {
    throw new Error(`aeadEncrypt: key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
  const s = sodium();
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    associatedData,
    null,
    nonce,
    key,
  );
  const blob = new Uint8Array(nonce.length + ciphertext.length);
  blob.set(nonce, 0);
  blob.set(ciphertext, nonce.length);
  return blob;
}

export function aeadDecrypt(
  blob: Uint8Array,
  key: Uint8Array,
  associatedData: Uint8Array | null = null,
): Uint8Array {
  if (key.length !== KEY_BYTES) {
    throw new Error(`aeadDecrypt: key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
  if (blob.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error(
      `aeadDecrypt: blob too short (${blob.length}); expected at least ` +
        `${NONCE_BYTES + TAG_BYTES} bytes (nonce + tag)`,
    );
  }
  const s = sodium();
  const nonce = blob.subarray(0, NONCE_BYTES);
  const ciphertext = blob.subarray(NONCE_BYTES);
  // libsodium throws on bad tag — let it propagate. Per docs/SECURITY.md §9
  // we never `try/catch: pass` in crypto paths; the caller decides what a
  // failed open means (wrong passphrase, tampering, version mismatch).
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    associatedData,
    nonce,
    key,
  );
}
