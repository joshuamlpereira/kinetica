import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KEY_BYTES,
  unwrapMasterKey,
  verifyEd25519,
  deriveKEK,
  type Keypair,
} from '../crypto/index.ts';
import { setupSodiumForTests } from '../crypto/_sodium.test-setup.ts';
import { canonicalJson, sha256 } from './canonical.ts';
import { prepareRegistration } from './registration.ts';

function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

test('prepareRegistration produces a payload with all required fields', async () => {
  await setupSodiumForTests();
  const { payload, localKeys } = await prepareRegistration(
    'user@example.com',
    'correct horse battery staple',
    'iPhone 15 Pro',
  );

  assert.equal(payload.email, 'user@example.com');
  assert.equal(payload.device_name, 'iPhone 15 Pro');
  assert.equal(fromBase64(payload.password_salt).length, 16);
  assert.equal(fromBase64(payload.encryption_pubkey).length, 32);
  assert.equal(fromBase64(payload.device_pubkey).length, 32);
  // 24-byte XChaCha nonce + 32-byte master key + 16-byte Poly1305 tag.
  assert.equal(fromBase64(payload.wrapped_master_key).length, 72);
  assert.equal(fromBase64(payload.bootstrap_signature).length, 64);

  // localKeys consistency
  assert.equal(localKeys.masterKey.length, KEY_BYTES);
  assert.equal(localKeys.encryptionKeypair.publicKey.length, 32);
  assert.equal(localKeys.deviceKeypair.publicKey.length, 32);
});

test('the bootstrap_signature verifies against the device_pubkey over canonical-JSON SHA-256', async () => {
  await setupSodiumForTests();
  const { payload, localKeys } = await prepareRegistration(
    'a@b.co',
    'long enough passphrase',
    'iPhone',
  );
  const { bootstrap_signature, ...rest } = payload;
  const canonical = canonicalJson(rest);
  const digest = sha256(new TextEncoder().encode(canonical));
  assert.equal(
    verifyEd25519(digest, fromBase64(bootstrap_signature), localKeys.deviceKeypair.publicKey),
    true,
  );
  // And also verifies against the pubkey embedded in the payload (sanity).
  assert.equal(
    verifyEd25519(digest, fromBase64(bootstrap_signature), fromBase64(payload.device_pubkey)),
    true,
  );
});

test('a different device pubkey fails to verify the same payload', async () => {
  await setupSodiumForTests();
  const { payload } = await prepareRegistration('a@b.co', 'long passphrase', 'iPhone');
  const { bootstrap_signature, ...rest } = payload;
  const canonical = canonicalJson(rest);
  const digest = sha256(new TextEncoder().encode(canonical));
  // A fresh keypair won't match — the signature was over a different secret.
  const other: Keypair = (await import('../crypto/ed25519.ts')).generateEd25519Keypair();
  assert.equal(
    verifyEd25519(digest, fromBase64(bootstrap_signature), other.publicKey),
    false,
  );
});

test('the wrapped_master_key unwraps locally with the derived KEK', async () => {
  // This is the marquee local-first property: the server has no way to
  // unwrap the master key. The client, given the same passphrase + salt
  // it just generated, must be able to unwrap the blob it just produced.
  await setupSodiumForTests();
  const passphrase = 'cinnamon-roll-violently';
  const { payload, localKeys } = await prepareRegistration(
    'user@example.com',
    passphrase,
    'iPhone',
  );
  const salt = fromBase64(payload.password_salt);
  const kek = deriveKEK(passphrase, salt);
  const wrapped = fromBase64(payload.wrapped_master_key);
  const recovered = unwrapMasterKey(wrapped, kek);
  assert.deepEqual(recovered, localKeys.masterKey);
});

test('a wrong passphrase fails the unwrap LOCALLY (no server call)', async () => {
  await setupSodiumForTests();
  const { payload } = await prepareRegistration('a@b.co', 'real passphrase', 'iPhone');
  const salt = fromBase64(payload.password_salt);
  const wrongKek = deriveKEK('wrong passphrase', salt);
  const wrapped = fromBase64(payload.wrapped_master_key);
  assert.throws(() => unwrapMasterKey(wrapped, wrongKek));
});

test('two registrations of the same email produce different salts, masters, and devices', async () => {
  // Fresh randomness on every call: nothing should be deterministic across
  // independent registrations even with identical inputs.
  await setupSodiumForTests();
  const a = await prepareRegistration('user@example.com', 'long passphrase', 'iPhone');
  const b = await prepareRegistration('user@example.com', 'long passphrase', 'iPhone');
  assert.notEqual(a.payload.password_salt, b.payload.password_salt);
  assert.notDeepEqual(a.localKeys.masterKey, b.localKeys.masterKey);
  assert.notDeepEqual(
    a.localKeys.deviceKeypair.publicKey,
    b.localKeys.deviceKeypair.publicKey,
  );
  assert.notEqual(a.payload.bootstrap_signature, b.payload.bootstrap_signature);
});

test('prepareRegistration rejects malformed input', async () => {
  await setupSodiumForTests();
  await assert.rejects(
    () => prepareRegistration('not-an-email', 'long passphrase', 'iPhone'),
    /invalid email/,
  );
  await assert.rejects(
    () => prepareRegistration('a@b.co', 'short', 'iPhone'),
    /passphrase too short/,
  );
  await assert.rejects(
    () => prepareRegistration('a@b.co', 'long passphrase', '   '),
    /deviceName/,
  );
});

test('the email is trimmed and the device_name is trimmed', async () => {
  await setupSodiumForTests();
  const { payload } = await prepareRegistration(
    '  user@example.com  ',
    'long enough passphrase',
    '  iPhone 15  ',
  );
  assert.equal(payload.email, 'user@example.com');
  assert.equal(payload.device_name, 'iPhone 15');
});
