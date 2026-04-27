import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveKEK,
  generatePasswordSalt,
  unwrapMasterKey,
  wrapMasterKey,
} from './kek.ts';
import { generateMasterKey } from './master.ts';
import { setupSodiumForTests } from './_sodium.test-setup.ts';
import { KEK_BYTES, SALT_BYTES } from './argon2_params.ts';

// Lightweight Argon2id config for tests — production parameters are
// 64MiB / 3 iterations and would make this file painfully slow.
// Determinism + AEAD properties don't depend on cost, only on inputs.
const FAST = { opsLimit: 1, memLimit: 8 * 1024 * 1024 };

test('generatePasswordSalt returns SALT_BYTES of randomness', async () => {
  await setupSodiumForTests();
  const a = generatePasswordSalt();
  const b = generatePasswordSalt();
  assert.equal(a.length, SALT_BYTES);
  assert.equal(b.length, SALT_BYTES);
  assert.notDeepEqual(a, b);
});

test('deriveKEK is deterministic for the same passphrase + salt', async () => {
  await setupSodiumForTests();
  const salt = generatePasswordSalt();
  const a = deriveKEK('correct horse battery staple', salt, FAST);
  const b = deriveKEK('correct horse battery staple', salt, FAST);
  assert.equal(a.length, KEK_BYTES);
  assert.deepEqual(a, b);
});

test('deriveKEK differs across different passphrases', async () => {
  await setupSodiumForTests();
  const salt = generatePasswordSalt();
  const a = deriveKEK('passphrase one', salt, FAST);
  const b = deriveKEK('passphrase two', salt, FAST);
  assert.notDeepEqual(a, b);
});

test('deriveKEK differs across different salts', async () => {
  await setupSodiumForTests();
  const a = deriveKEK('same passphrase', generatePasswordSalt(), FAST);
  const b = deriveKEK('same passphrase', generatePasswordSalt(), FAST);
  assert.notDeepEqual(a, b);
});

test('deriveKEK rejects wrong-length salt and empty passphrase', async () => {
  await setupSodiumForTests();
  assert.throws(() => deriveKEK('p', new Uint8Array(15), FAST), /salt/);
  assert.throws(() => deriveKEK('', generatePasswordSalt(), FAST), /non-empty/);
});

test('wrap -> unwrap round-trips with the correct KEK', async () => {
  await setupSodiumForTests();
  const salt = generatePasswordSalt();
  const kek = deriveKEK('correct passphrase', salt, FAST);
  const masterKey = generateMasterKey();
  const wrapped = wrapMasterKey(masterKey, kek);
  // 24-byte nonce + 32-byte plaintext + 16-byte Poly1305 tag = 72 bytes.
  // This matches the docs/SECURITY.md §11.1 byte-length CHECK constraint.
  assert.equal(wrapped.length, 72);
  const recovered = unwrapMasterKey(wrapped, kek);
  assert.deepEqual(recovered, masterKey);
});

test('unwrap fails with wrong passphrase BEFORE any network call', async () => {
  // This is the canonical local-first failure mode: the user types the
  // wrong passphrase, the KEK derives correctly (Argon2id is pure
  // arithmetic), but the AEAD tag check on `wrapped_master_key` fails.
  // The throw must happen synchronously inside the local crypto call —
  // there is no opportunity for the client to make an HTTP request.
  await setupSodiumForTests();
  const salt = generatePasswordSalt();
  const goodKek = deriveKEK('the right passphrase', salt, FAST);
  const badKek = deriveKEK('the wrong passphrase', salt, FAST);
  const wrapped = wrapMasterKey(generateMasterKey(), goodKek);
  assert.throws(() => unwrapMasterKey(wrapped, badKek));
});

test('unwrap fails on tampered ciphertext', async () => {
  await setupSodiumForTests();
  const salt = generatePasswordSalt();
  const kek = deriveKEK('p', salt, FAST);
  const wrapped = wrapMasterKey(generateMasterKey(), kek);
  wrapped[40] ^= 0x01;
  assert.throws(() => unwrapMasterKey(wrapped, kek));
});
