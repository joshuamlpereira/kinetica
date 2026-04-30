// Client-side login orchestration per docs/SECURITY.md §5.3.2.
//
// Two functions:
//
// - `loginWithCredentials(passphrase, creds)` — pure orchestration. No
//   keychain import, no react-native dependency. This is what the
//   tests exercise to prove the marquee invariant: a wrong passphrase
//   throws WrongPassphraseError BEFORE any fetch is issued.
//
// - `login(passphrase)` — thin wrapper that loads credentials from the
//   native Keychain (via storage.ts) and hands them to the
//   orchestration. The screens call this; tests don't.
//
// Splitting the two is what makes the orchestration testable under
// node:test without dragging in react-native's Flow-typed entrypoint.

import { postChallenge, postLogin } from './api.ts';

import {
  deriveKEK,
  signEd25519,
  unwrapMasterKey,
  type Keypair,
} from '../crypto/index.ts';

export type LocalCredentials = {
  email: string;
  password_salt_b64: string;
  wrapped_master_key_b64: string;
  device_pubkey_b64: string;
  device_secret_key_b64: string;
  user_id: string;
  device_id: string;
};

export class WrongPassphraseError extends Error {
  constructor() {
    super('Incorrect passphrase');
    this.name = 'WrongPassphraseError';
  }
}

export class NoLocalAccountError extends Error {
  constructor() {
    super('No locally stored account on this device');
    this.name = 'NoLocalAccountError';
  }
}

export type LoginResult = {
  user_id: string;
  device_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  master_key: Uint8Array;
};

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function buildSigningInput(
  nonce: Uint8Array,
  expiresAtIso: string,
  devicePubkey: Uint8Array,
): Uint8Array {
  const isoBytes = new TextEncoder().encode(expiresAtIso);
  const out = new Uint8Array(nonce.length + isoBytes.length + devicePubkey.length);
  out.set(nonce, 0);
  out.set(isoBytes, nonce.length);
  out.set(devicePubkey, nonce.length + isoBytes.length);
  return out;
}

function isoToServingForm(iso: string): string {
  // Server emits expires_at with offset (`...+00:00`); the signing form
  // is seconds-precision UTC with a trailing 'Z'. Both refer to the
  // same instant; we re-format here so the bytes the device signs match
  // what the server signs over.
  const d = new Date(iso);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
  );
}

export async function loginWithCredentials(
  passphrase: string,
  creds: LocalCredentials,
): Promise<LoginResult> {
  const salt = fromBase64(creds.password_salt_b64);
  const wrapped = fromBase64(creds.wrapped_master_key_b64);
  const devicePubkey = fromBase64(creds.device_pubkey_b64);
  const deviceSecretKey = fromBase64(creds.device_secret_key_b64);

  // STEP 1 — local-only unwrap. Wrong passphrase throws here, before any
  // fetch. The UI catches WrongPassphraseError and shows the dim-red
  // "Incorrect passphrase" line without ever touching the network.
  const kek = deriveKEK(passphrase, salt);
  let masterKey: Uint8Array;
  try {
    masterKey = unwrapMasterKey(wrapped, kek);
  } catch {
    throw new WrongPassphraseError();
  }

  // STEP 2 — challenge / response over the network with the device key.
  const challenge = await postChallenge(creds.email, creds.device_pubkey_b64);
  const signingInput = buildSigningInput(
    fromBase64(challenge.nonce),
    isoToServingForm(challenge.expires_at),
    devicePubkey,
  );
  const deviceKeypair: Keypair = { publicKey: devicePubkey, privateKey: deviceSecretKey };
  const signature = signEd25519(signingInput, deviceKeypair.privateKey);
  const tokens = await postLogin({
    email: creds.email,
    device_pubkey: creds.device_pubkey_b64,
    nonce: challenge.nonce,
    signature: toBase64(signature),
  });

  return {
    user_id: tokens.user_id,
    device_id: tokens.device_id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    access_token_expires_at: tokens.access_token_expires_at,
    master_key: masterKey,
  };
}

// `login` is the screen-facing entry point. It pulls credentials from
// the native Keychain (which transitively imports react-native and so
// can't be used under node:test) and hands them to `loginWithCredentials`.
// The storage import is dynamic so the test file can import this module
// without pulling in react-native-keychain.
export async function login(passphrase: string): Promise<LoginResult> {
  const { loadCredentials } = await import('./storage.ts');
  const creds = await loadCredentials();
  if (creds === null) throw new NoLocalAccountError();
  return loginWithCredentials(passphrase, creds);
}
