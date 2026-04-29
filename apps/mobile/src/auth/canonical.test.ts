import assert from 'node:assert/strict';
import test from 'node:test';

import { setupSodiumForTests } from '../crypto/_sodium.test-setup.ts';
import { canonicalJson, sha256 } from './canonical.ts';

test('canonicalJson sorts keys lexicographically', () => {
  const out = canonicalJson({ b: '2', a: '1', c: '3' });
  assert.equal(out, '{"a":"1","b":"2","c":"3"}');
});

test('canonicalJson uses no whitespace', () => {
  const out = canonicalJson({ a: '1', b: '2' });
  assert.ok(!/\s/.test(out));
});

test('canonicalJson is byte-identical regardless of insertion order', () => {
  const a = canonicalJson({ z: '1', a: '2', m: '3' });
  const b = canonicalJson({ a: '2', m: '3', z: '1' });
  const c = canonicalJson({ m: '3', a: '2', z: '1' });
  assert.equal(a, b);
  assert.equal(b, c);
});

test('canonicalJson escapes string values via JSON.stringify', () => {
  const out = canonicalJson({ a: 'has "quotes" and \\backslashes' });
  assert.equal(out, '{"a":"has \\"quotes\\" and \\\\backslashes"}');
});

test('sha256 matches NIST test vector for "abc"', async () => {
  await setupSodiumForTests();
  const h = sha256(new TextEncoder().encode('abc'));
  assert.equal(h.length, 32);
  // NIST FIPS 180-4: SHA-256("abc") =
  //   ba7816bf 8f01cfea 414140de 5dae2223
  //   b00361a3 96177a9c b410ff61 f20015ad
  const hex = Array.from(h)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  assert.equal(
    hex,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
