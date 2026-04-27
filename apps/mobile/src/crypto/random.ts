// Cryptographically secure random bytes.
//
// Single audit surface for any randomness used by the crypto layer. Anything
// that needs randomness (nonces, salts, ephemeral keys) MUST go through here,
// never `Math.random`, never `crypto.getRandomValues` directly.

import { sodium } from './_sodium.ts';

export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`randomBytes: length must be a positive integer, got ${length}`);
  }
  return sodium().randombytes_buf(length);
}
