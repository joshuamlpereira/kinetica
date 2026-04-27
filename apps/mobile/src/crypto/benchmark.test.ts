import assert from 'node:assert/strict';
import test from 'node:test';

import { runArgon2idBenchmark } from './benchmark.ts';
import { setupSodiumForTests } from './_sodium.test-setup.ts';

test('benchmark returns shape we expect; smoke only — Node host is not an iPhone', async () => {
  await setupSodiumForTests();
  // Use cheap parameters so this test stays under a second on any host.
  const r = await runArgon2idBenchmark(
    3,
    { opsLimit: 1, memLimit: 8 * 1024 * 1024 },
    'node-host',
  );
  assert.equal(r.iterations, 3);
  assert.equal(r.durations_ms.length, 3);
  assert.ok(r.median_ms > 0);
  assert.ok(r.p95_ms >= r.median_ms);
  assert.equal(r.provenance, 'node-host');
});

test('benchmark rejects iterations < 1', async () => {
  await setupSodiumForTests();
  await assert.rejects(() => runArgon2idBenchmark(0));
});
