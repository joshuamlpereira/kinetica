import assert from 'node:assert/strict';
import test from 'node:test';

import { setupSodiumForTests } from './_sodium.test-setup.ts';
import { randomBytes } from './random.ts';

test('randomBytes returns the requested length', async () => {
  await setupSodiumForTests();
  for (const n of [1, 16, 24, 32, 64, 128]) {
    const out = randomBytes(n);
    assert.equal(out.length, n);
    assert.ok(out instanceof Uint8Array);
  }
});

test('randomBytes does not return the same bytes twice in a row', async () => {
  await setupSodiumForTests();
  // Probability of collision over 32 random bytes is ~2^-256 — if this ever
  // fires, the entropy source is broken, not the test.
  const a = randomBytes(32);
  const b = randomBytes(32);
  assert.notDeepEqual(a, b);
});

test('randomBytes rejects non-positive length', async () => {
  await setupSodiumForTests();
  assert.throws(() => randomBytes(0), /positive integer/);
  assert.throws(() => randomBytes(-1), /positive integer/);
  assert.throws(() => randomBytes(1.5), /positive integer/);
});
