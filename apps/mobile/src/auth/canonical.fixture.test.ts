import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { setupSodiumForTests } from '../crypto/_sodium.test-setup.ts';
import { canonicalJson, sha256 } from './canonical.ts';

// The same docs/fixtures/canonical_json.json is consumed by the Python
// server at services/api/tests/test_canonical_fixture.py. Both sides
// compare their canonical bytes against the same canonical_hex and
// sha256_hex values — a hex-level assertion against a frozen vector,
// not a round-trip "signature verifies" test, so drift in either
// direction is impossible to miss.

type Vector = {
  name: string;
  input: Record<string, string>;
  canonical_hex: string;
  sha256_hex: string;
};

const FIXTURE_PATH = join(
  // __dirname-equivalent under node:test with strip-types: derive from
  // the test file's import.meta.url so the path is resolvable when
  // pnpm test is invoked from any cwd.
  new URL('.', import.meta.url).pathname,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'fixtures',
  'canonical_json.json',
);

function loadVectors(): Vector[] {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
  return raw.vectors as Vector[];
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

for (const vector of loadVectors()) {
  test(`canonical_json fixture: ${vector.name}`, async () => {
    await setupSodiumForTests();
    const canonical = canonicalJson(vector.input);
    const canonicalBytes = new TextEncoder().encode(canonical);
    const gotHex = bytesToHex(canonicalBytes);
    assert.equal(
      gotHex,
      vector.canonical_hex,
      `vector "${vector.name}": canonical bytes drifted.\n` +
        `  got:      ${gotHex}\n` +
        `  expected: ${vector.canonical_hex}\n` +
        `  decoded:  ${canonical}`,
    );
    const digest = sha256(canonicalBytes);
    assert.equal(bytesToHex(digest), vector.sha256_hex);
  });
}
