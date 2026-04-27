import assert from 'node:assert/strict';
import test from 'node:test';

import { sealForRecipient, SEAL_OVERHEAD_BYTES, unseal } from './sealing.ts';
import { sodium } from './_sodium.ts';
import { setupSodiumForTests } from './_sodium.test-setup.ts';

test('seal -> unseal round-trips for varied sizes', async () => {
  await setupSodiumForTests();
  const recipient = sodium().crypto_box_keypair();
  const sizes = [1, 32, 256, 4096];
  for (const size of sizes) {
    const plaintext = sodium().randombytes_buf(size);
    const ciphertext = sealForRecipient(plaintext, recipient.publicKey);
    assert.equal(ciphertext.length, plaintext.length + SEAL_OVERHEAD_BYTES);
    const recovered = unseal(ciphertext, recipient);
    assert.deepEqual(recovered, plaintext);
  }
});

test('sealing produces different ciphertext on each call (anonymous sender)', async () => {
  await setupSodiumForTests();
  const recipient = sodium().crypto_box_keypair();
  const plaintext = new TextEncoder().encode('biometric sample');
  const a = sealForRecipient(plaintext, recipient.publicKey);
  const b = sealForRecipient(plaintext, recipient.publicKey);
  assert.notDeepEqual(a, b);
});

test('unseal rejects ciphertext sealed for a different recipient', async () => {
  await setupSodiumForTests();
  const alice = sodium().crypto_box_keypair();
  const eve = sodium().crypto_box_keypair();
  const plaintext = new TextEncoder().encode('for alice only');
  const sealed = sealForRecipient(plaintext, alice.publicKey);
  assert.throws(() => unseal(sealed, eve));
});

test('unseal rejects tampered ciphertext', async () => {
  await setupSodiumForTests();
  const recipient = sodium().crypto_box_keypair();
  const plaintext = new TextEncoder().encode('intact');
  const sealed = sealForRecipient(plaintext, recipient.publicKey);
  // Flip a byte somewhere in the middle.
  sealed[Math.floor(sealed.length / 2)] ^= 0x80;
  assert.throws(() => unseal(sealed, recipient));
});

test('seal rejects wrong-length recipient pubkey', async () => {
  await setupSodiumForTests();
  assert.throws(
    () => sealForRecipient(new Uint8Array([1]), new Uint8Array(31)),
    /recipient pubkey/,
  );
});
