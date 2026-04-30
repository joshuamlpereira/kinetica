// Local persistence of the credentials needed to log back in on the same
// device:
//
//   - email                    (so login knows which account)
//   - password_salt            (Argon2id salt — required to re-derive KEK)
//   - wrapped_master_key       (the master key encrypted under KEK)
//   - device_secret_key        (Ed25519 private key for challenge signing)
//   - user_id, device_id       (returned by the server)
//
// Stored under one Keychain generic-password entry. Real production wiring
// for iCloud Keychain escrow + Secure Enclave for the device key is Phase 6
// operational work — for the Phase 2 UI we use react-native-keychain's
// default service so the demo round-trips end-to-end.

import * as Keychain from 'react-native-keychain';

import type { LocalCredentials } from './login.ts';

const SERVICE = 'app.kinetica.auth';

export type { LocalCredentials };

export async function saveCredentials(creds: LocalCredentials): Promise<void> {
  await Keychain.setGenericPassword(creds.email, JSON.stringify(creds), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadCredentials(): Promise<LocalCredentials | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE });
  // The library's runtime returns `false` for "no entry" but the
  // current types declare a UserCredentials object — guard with a
  // truthiness check that compiles either way.
  if (!result) return null;
  try {
    return JSON.parse(result.password) as LocalCredentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
