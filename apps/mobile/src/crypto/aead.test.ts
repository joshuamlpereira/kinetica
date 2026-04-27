import assert from 'node:assert/strict';
import test from 'node:test';

import { aeadDecrypt, aeadEncrypt, KEY_BYTES, NONCE_BYTES, TAG_BYTES } from './aead.ts';
import { randomBytes } from './random.ts';
import { setupSodiumForTests } from './_sodium.test-setup.ts';

test('aead round-trips for varied plaintext sizes', async () => {
  await setupSodiumForTests();
  const key = randomBytes(KEY_BYTES);
  for (const size of [0, 1, 16, 32, 64, 128, 1024, 65536]) {
    const plaintext = randomBytes(size === 0 ? 1 : size).slice(0, size);
    const blob = aeadEncrypt(plaintext, key);
    assert.equal(blob.length, NONCE_BYTES + size + TAG_BYTES);
    const recovered = aeadDecrypt(blob, key);
    assert.deepEqual(recovered, plaintext);
  }
});

test('aead with associated data round-trips', async () => {
  await setupSodiumForTests();
  const key = randomBytes(KEY_BYTES);
  const plaintext = new TextEncoder().encode('phase-2 note');
  const ad = new TextEncoder().encode('user_id=abc123');
  const blob = aeadEncrypt(plaintext, key, ad);
  const recovered = aeadDecrypt(blob, key, ad);
  assert.deepEqual(recovered, plaintext);
});

test('aead rejects tampered ciphertext (Poly1305 tag mismatch)', async () => {
  await setupSodiumForTests();
  const key = randomBytes(KEY_BYTES);
  const blob = aeadEncrypt(new TextEncoder().encode('secret'), key);
  // Flip a byte in the ciphertext region (after the 24-byte nonce).
  blob[NONCE_BYTES + 1] ^= 0x01;
  assert.throws(() => aeadDecrypt(blob, key));
});

test('aead rejects wrong key', async () => {
  await setupSodiumForTests();
  const key = randomBytes(KEY_BYTES);
  const wrong = randomBytes(KEY_BYTES);
  const blob = aeadEncrypt(new TextEncoder().encode('secret'), key);
  assert.throws(() => aeadDecrypt(blob, wrong));
});

test('aead rejects wrong associated data', async () => {
  await setupSodiumForTests();
  const key = randomBytes(KEY_BYTES);
  const ad = new TextEncoder().encode('correct');
  const wrongAd = new TextEncoder().encode('wrong');
  const blob = aeadEncrypt(new TextEncoder().encode('secret'), key, ad);
  assert.throws(() => aeadDecrypt(blob, key, wrongAd));
});

test('aead rejects malformed key length', async () => {
  await setupSodiumForTests();
  assert.throws(() => aeadEncrypt(new Uint8Array([1, 2, 3]), new Uint8Array(31)), /key/);
  assert.throws(() => aeadDecrypt(new Uint8Array(40), new Uint8Array(31)), /key/);
});

test('aead rejects blob shorter than nonce + tag', async () => {
  await setupSodiumForTests();
  const key = randomBytes(KEY_BYTES);
  assert.throws(() => aeadDecrypt(new Uint8Array(39), key), /blob too short/);
});

test('aead nonces differ across calls (no nonce reuse)', async () => {
  await setupSodiumForTests();
  const key = randomBytes(KEY_BYTES);
  const plaintext = new TextEncoder().encode('same plaintext');
  const a = aeadEncrypt(plaintext, key);
  const b = aeadEncrypt(plaintext, key);
  // First 24 bytes of each blob is the nonce — must differ.
  assert.notDeepEqual(a.slice(0, NONCE_BYTES), b.slice(0, NONCE_BYTES));
  // The full blobs must differ as a consequence.
  assert.notDeepEqual(a, b);
});
