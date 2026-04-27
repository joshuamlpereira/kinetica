// Anonymous sealed boxes against an X25519 recipient public key.
//
// Per docs/SECURITY.md §5.4, biometric samples and aggregates are sealed to
// the user's X25519 public key with `crypto_box_seal`. The sender is
// anonymous (an ephemeral keypair generated inside libsodium); only the
// holder of the recipient's private key can open. The server stores the
// ciphertext and routing metadata but cannot decrypt.

import { sodium, type Keypair } from './_sodium.ts';

export const SEAL_OVERHEAD_BYTES = 48; // 32-byte ephemeral pubkey + 16-byte tag

export function sealForRecipient(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
): Uint8Array {
  const s = sodium();
  if (recipientPublicKey.length !== s.crypto_box_PUBLICKEYBYTES) {
    throw new Error(
      `sealForRecipient: recipient pubkey must be ${s.crypto_box_PUBLICKEYBYTES} bytes, ` +
        `got ${recipientPublicKey.length}`,
    );
  }
  return s.crypto_box_seal(plaintext, recipientPublicKey);
}

export function unseal(ciphertext: Uint8Array, recipientKeypair: Keypair): Uint8Array {
  const s = sodium();
  if (recipientKeypair.publicKey.length !== s.crypto_box_PUBLICKEYBYTES) {
    throw new Error(
      `unseal: recipient pubkey must be ${s.crypto_box_PUBLICKEYBYTES} bytes`,
    );
  }
  if (recipientKeypair.privateKey.length !== s.crypto_box_SECRETKEYBYTES) {
    throw new Error(
      `unseal: recipient privkey must be ${s.crypto_box_SECRETKEYBYTES} bytes`,
    );
  }
  // libsodium throws on mismatched recipient or tampered ciphertext —
  // propagate to the caller per the no-`try/catch: pass` rule.
  return s.crypto_box_seal_open(
    ciphertext,
    recipientKeypair.publicKey,
    recipientKeypair.privateKey,
  );
}
