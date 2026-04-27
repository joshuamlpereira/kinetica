import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateEd25519Keypair,
  signEd25519,
  verifyEd25519,
} from './ed25519.ts';
import { sodium } from './_sodium.ts';
import { setupSodiumForTests } from './_sodium.test-setup.ts';

test('generate -> sign -> verify round-trips', async () => {
  await setupSodiumForTests();
  const kp = generateEd25519Keypair();
  assert.equal(kp.publicKey.length, sodium().crypto_sign_PUBLICKEYBYTES);
  assert.equal(kp.privateKey.length, sodium().crypto_sign_SECRETKEYBYTES);

  for (const msg of [
    new TextEncoder().encode('phase-2 challenge'),
    new Uint8Array(0),
    sodium().randombytes_buf(1024),
  ]) {
    const sig = signEd25519(msg, kp.privateKey);
    assert.equal(sig.length, sodium().crypto_sign_BYTES);
    assert.equal(verifyEd25519(msg, sig, kp.publicKey), true);
  }
});

test('verifyEd25519 rejects tampered message', async () => {
  await setupSodiumForTests();
  const kp = generateEd25519Keypair();
  const msg = new TextEncoder().encode('original');
  const sig = signEd25519(msg, kp.privateKey);
  const tampered = new TextEncoder().encode('originaL');
  assert.equal(verifyEd25519(tampered, sig, kp.publicKey), false);
});

test('verifyEd25519 rejects wrong public key', async () => {
  await setupSodiumForTests();
  const a = generateEd25519Keypair();
  const b = generateEd25519Keypair();
  const msg = new TextEncoder().encode('phase-2');
  const sig = signEd25519(msg, a.privateKey);
  assert.equal(verifyEd25519(msg, sig, b.publicKey), false);
});

test('verifyEd25519 rejects garbage signature without throwing', async () => {
  await setupSodiumForTests();
  const kp = generateEd25519Keypair();
  const garbage = sodium().randombytes_buf(sodium().crypto_sign_BYTES);
  assert.equal(verifyEd25519(new TextEncoder().encode('msg'), garbage, kp.publicKey), false);
});

test('verifyEd25519 rejects wrong-length inputs', async () => {
  await setupSodiumForTests();
  const kp = generateEd25519Keypair();
  const goodSig = signEd25519(new Uint8Array([1]), kp.privateKey);
  assert.throws(
    () => verifyEd25519(new Uint8Array([1]), goodSig, new Uint8Array(31)),
    /pubkey/,
  );
  assert.throws(
    () => verifyEd25519(new Uint8Array([1]), new Uint8Array(63), kp.publicKey),
    /signature/,
  );
});

test('two generate calls produce distinct keypairs', async () => {
  await setupSodiumForTests();
  const a = generateEd25519Keypair();
  const b = generateEd25519Keypair();
  assert.notDeepEqual(a.publicKey, b.publicKey);
  assert.notDeepEqual(a.privateKey, b.privateKey);
});
