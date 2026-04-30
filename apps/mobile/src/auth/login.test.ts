// UI-level (orchestration-level) parallel of the primitives-level
// `kek.test.ts` "unwrap fails with wrong passphrase BEFORE any network
// call" test. This is the layer the LoginScreen actually calls — a
// regression here would mean the screen hits the server even when the
// local unwrap should have failed.
//
// `loginWithCredentials` takes the credentials directly so this test
// doesn't need to mock the Keychain (which would transitively import
// react-native and break under node:test). Real Argon2id derivation +
// real wrap, fake fetch.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aeadEncrypt,
  deriveKEK,
  generateEd25519Keypair,
  generateMasterKey,
  generatePasswordSalt,
} from '../crypto/index.ts';
import { setupSodiumForTests } from '../crypto/_sodium.test-setup.ts';
import {
  WrongPassphraseError,
  loginWithCredentials,
  type LocalCredentials,
} from './login.ts';

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

async function buildLocalCredentials(passphrase: string): Promise<LocalCredentials> {
  await setupSodiumForTests();
  const salt = generatePasswordSalt();
  const kek = deriveKEK(passphrase, salt);
  const masterKey = generateMasterKey();
  const wrapped = aeadEncrypt(masterKey, kek);
  const device = generateEd25519Keypair();
  return {
    email: 'tester@example.com',
    password_salt_b64: toBase64(salt),
    wrapped_master_key_b64: toBase64(wrapped),
    device_pubkey_b64: toBase64(device.publicKey),
    device_secret_key_b64: toBase64(device.privateKey),
    user_id: '00000000-0000-0000-0000-000000000001',
    device_id: '00000000-0000-0000-0000-000000000002',
  };
}

test('loginWithCredentials throws WrongPassphraseError before any fetch', async () => {
  const creds = await buildLocalCredentials('the right passphrase');

  const fetchCalls: unknown[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((...args: unknown[]) => {
    fetchCalls.push(args);
    return Promise.reject(new Error('fetch must not be called on wrong passphrase'));
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(
      () => loginWithCredentials('the WRONG passphrase', creds),
      (e: Error) => e instanceof WrongPassphraseError,
    );
    assert.equal(
      fetchCalls.length,
      0,
      `fetch was called ${fetchCalls.length} time(s) on a wrong-passphrase attempt`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loginWithCredentials proceeds to /auth/challenge once unwrap succeeds', async () => {
  // Conjugate of the negative test — confirms `loginWithCredentials`
  // does hit the network once unwrap succeeds, so the negative test
  // above isn't passing because of an unrelated short-circuit.
  const creds = await buildLocalCredentials('right passphrase');

  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url: string) => {
    fetchCalls.push(url);
    return Promise.reject(new Error('stubbed fetch'));
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(() => loginWithCredentials('right passphrase', creds));
    assert.ok(
      fetchCalls.length > 0,
      'fetch should have been called once unwrap succeeded',
    );
    assert.ok(
      fetchCalls[0]!.endsWith('/auth/challenge'),
      `expected /auth/challenge, got ${fetchCalls[0]!}`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
