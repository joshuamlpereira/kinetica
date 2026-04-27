// Master key generation and X25519 derivation from master.
//
// The master XChaCha key is generated once at registration. From it we
// deterministically derive the user's X25519 keypair via libsodium's
// `crypto_kdf_derive_from_key` — this means the master key is the only
// long-lived secret to escrow / unwrap; the X25519 keypair is reproducible
// from it on demand. See docs/SECURITY.md §5.1 / §5.5.

import { KEY_BYTES } from './aead.ts';
import { sodium, type Keypair } from './_sodium.ts';

// 8-byte ASCII context per libsodium's KDF API.
const CONTEXT = 'kinet-x2';
// Subkey IDs are reserved here so future derivations don't collide.
const SUBKEY_ID_X25519 = 1n;

export function generateMasterKey(): Uint8Array {
  return sodium().crypto_aead_xchacha20poly1305_ietf_keygen();
}

export function deriveX25519FromMaster(masterKey: Uint8Array): Keypair {
  if (masterKey.length !== KEY_BYTES) {
    throw new Error(`deriveX25519FromMaster: master key must be ${KEY_BYTES} bytes`);
  }
  const s = sodium();
  const seed = s.crypto_kdf_derive_from_key(
    s.crypto_box_SEEDBYTES,
    SUBKEY_ID_X25519,
    CONTEXT,
    masterKey,
  );
  return s.crypto_box_seed_keypair(seed);
}
