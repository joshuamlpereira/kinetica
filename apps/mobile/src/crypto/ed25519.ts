// Ed25519 device-key operations.
//
// Each device generates one Ed25519 keypair at first sign-in (registration
// or new-device bootstrap). The private key lives in the iOS Secure Enclave
// where available, or Keychain `WhenUnlockedThisDeviceOnly` otherwise. The
// public key is registered server-side in `user_devices.device_pubkey`.
// Every authenticated request thereafter carries a DPoP signature this key
// produces.

import { sodium, type Keypair } from './_sodium.ts';

export function generateEd25519Keypair(): Keypair {
  return sodium().crypto_sign_keypair();
}

export function signEd25519(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  const s = sodium();
  if (privateKey.length !== s.crypto_sign_SECRETKEYBYTES) {
    throw new Error(
      `signEd25519: privkey must be ${s.crypto_sign_SECRETKEYBYTES} bytes, ` +
        `got ${privateKey.length}`,
    );
  }
  return s.crypto_sign_detached(message, privateKey);
}

export function verifyEd25519(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  const s = sodium();
  if (publicKey.length !== s.crypto_sign_PUBLICKEYBYTES) {
    throw new Error(
      `verifyEd25519: pubkey must be ${s.crypto_sign_PUBLICKEYBYTES} bytes, ` +
        `got ${publicKey.length}`,
    );
  }
  if (signature.length !== s.crypto_sign_BYTES) {
    throw new Error(
      `verifyEd25519: signature must be ${s.crypto_sign_BYTES} bytes, ` +
        `got ${signature.length}`,
    );
  }
  return s.crypto_sign_verify_detached(signature, message, publicKey);
}
