// Client-side registration per docs/SECURITY.md §5.3.1.
//
// `prepareRegistration` does all of the local cryptographic work and
// returns:
//   - `payload`:    the JSON body to POST to /auth/register
//   - `localKeys`:  the master key, derived X25519 keypair, and the
//                   device's Ed25519 keypair — these MUST be written
//                   to the iOS Keychain by the caller (escrow mode
//                   syncs the master key + X25519 priv via iCloud
//                   Keychain; the Ed25519 priv stays in the Secure
//                   Enclave on this device only).
//
// The server learns the device pubkey, the X25519 pubkey, the password
// salt, and the wrapped master key. It NEVER sees the passphrase, the
// KEK, the master key, or the X25519 private key.
//
// `bootstrap_signature` proves device-key possession at registration
// time so the server cannot register a hostile device under someone
// else's payload — the request body is canonicalized as sorted-key
// JSON (no whitespace, base64 for byte fields), SHA-256-hashed, then
// signed by the device's Ed25519 private key. The same canonical form
// is used by the server to verify.

import {
  aeadEncrypt,
  deriveKEK,
  deriveX25519FromMaster,
  generateEd25519Keypair,
  generateMasterKey,
  generatePasswordSalt,
  KEY_BYTES,
  signEd25519,
  type Keypair,
} from '../crypto/index.ts';

import { canonicalJson, sha256 } from './canonical.ts';

export type RegistrationPayload = {
  email: string;
  password_salt: string; // base64
  encryption_pubkey: string; // base64, 32 bytes
  wrapped_master_key: string; // base64, ≥72 bytes (24 nonce + 32 plaintext + 16 tag)
  device_pubkey: string; // base64, 32 bytes
  device_name: string;
  bootstrap_signature: string; // base64, 64 bytes
};

export type RegistrationLocalKeys = {
  masterKey: Uint8Array;
  encryptionKeypair: Keypair; // X25519, derived from master
  deviceKeypair: Keypair; // Ed25519, random per device
};

export type PrepareRegistrationResult = {
  payload: RegistrationPayload;
  localKeys: RegistrationLocalKeys;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toBase64(bytes: Uint8Array): string {
  // `btoa(String.fromCharCode(...bytes))` is portable across Node 16+ and
  // React Native (both expose `btoa`). Our blobs are at most ~hundreds of
  // bytes so the spread does not blow the argument stack.
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export async function prepareRegistration(
  email: string,
  passphrase: string,
  deviceName: string,
): Promise<PrepareRegistrationResult> {
  const trimmedEmail = email.trim();
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    throw new Error('prepareRegistration: invalid email format');
  }
  if (passphrase.length < 8) {
    throw new Error('prepareRegistration: passphrase too short (min 8 chars)');
  }
  if (deviceName.trim().length === 0) {
    throw new Error('prepareRegistration: deviceName must be non-empty');
  }

  const passwordSalt = generatePasswordSalt();
  const kek = deriveKEK(passphrase, passwordSalt);

  const masterKey = generateMasterKey();
  if (masterKey.length !== KEY_BYTES) {
    throw new Error('prepareRegistration: generateMasterKey returned wrong length');
  }

  const encryptionKeypair = deriveX25519FromMaster(masterKey);
  const deviceKeypair = generateEd25519Keypair();

  const wrappedMasterKey = aeadEncrypt(masterKey, kek);

  const unsignedPayload = {
    email: trimmedEmail,
    password_salt: toBase64(passwordSalt),
    encryption_pubkey: toBase64(encryptionKeypair.publicKey),
    wrapped_master_key: toBase64(wrappedMasterKey),
    device_pubkey: toBase64(deviceKeypair.publicKey),
    device_name: deviceName.trim(),
  };

  const canonical = canonicalJson(unsignedPayload);
  const digest = sha256(new TextEncoder().encode(canonical));
  const signature = signEd25519(digest, deviceKeypair.privateKey);

  const payload: RegistrationPayload = {
    ...unsignedPayload,
    bootstrap_signature: toBase64(signature),
  };

  return {
    payload,
    localKeys: { masterKey, encryptionKeypair, deviceKeypair },
  };
}
