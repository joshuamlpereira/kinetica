import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveX25519FromMaster, generateMasterKey } from './master.ts';
import { sealForRecipient, unseal } from './sealing.ts';
import { sodium } from './_sodium.ts';
import { setupSodiumForTests } from './_sodium.test-setup.ts';

test('generateMasterKey returns a 32-byte XChaCha key', async () => {
  await setupSodiumForTests();
  const k = generateMasterKey();
  assert.equal(k.length, sodium().crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  assert.notDeepEqual(k, generateMasterKey());
});

test('deriveX25519FromMaster is deterministic', async () => {
  await setupSodiumForTests();
  const master = generateMasterKey();
  const a = deriveX25519FromMaster(master);
  const b = deriveX25519FromMaster(master);
  assert.deepEqual(a.publicKey, b.publicKey);
  assert.deepEqual(a.privateKey, b.privateKey);
});

test('deriveX25519FromMaster produces distinct keys for distinct masters', async () => {
  await setupSodiumForTests();
  const a = deriveX25519FromMaster(generateMasterKey());
  const b = deriveX25519FromMaster(generateMasterKey());
  assert.notDeepEqual(a.publicKey, b.publicKey);
  assert.notDeepEqual(a.privateKey, b.privateKey);
});

test('derived X25519 keypair seals and unseals correctly', async () => {
  await setupSodiumForTests();
  const master = generateMasterKey();
  const kp = deriveX25519FromMaster(master);
  const plaintext = new TextEncoder().encode('readiness score = 78');
  const sealed = sealForRecipient(plaintext, kp.publicKey);
  const recovered = unseal(sealed, kp);
  assert.deepEqual(recovered, plaintext);
});

test('a re-derived keypair (after the master is restored) opens earlier ciphertext', async () => {
  // This exercises the recovery path: a user restores their master key
  // from iCloud Keychain or by unwrapping wrapped_master_key on a new
  // device, re-derives the X25519 keypair, and must still be able to
  // open ciphertext sealed weeks earlier to the same logical pubkey.
  await setupSodiumForTests();
  const master = generateMasterKey();
  const kpAtSealTime = deriveX25519FromMaster(master);
  const sealed = sealForRecipient(
    new TextEncoder().encode('phase-4 biometric'),
    kpAtSealTime.publicKey,
  );

  // Pretend time passes and we lose the keypair; only `master` survives.
  const reDerived = deriveX25519FromMaster(master);
  const recovered = unseal(sealed, reDerived);
  assert.deepEqual(recovered, new TextEncoder().encode('phase-4 biometric'));
});

test('deriveX25519FromMaster rejects wrong-length master', async () => {
  await setupSodiumForTests();
  assert.throws(() => deriveX25519FromMaster(new Uint8Array(31)), /master key/);
});
