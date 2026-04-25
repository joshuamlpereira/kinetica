import assert from 'node:assert/strict';
import test from 'node:test';

import { computeTutSeconds } from './tut.ts';

// Each case fixes inputs and asserts the value the Postgres STORED column
// would produce. The arithmetic is identical to the SQL expression in
// docs/SCHEMA.sql; if either side changes, this test must change with it.

test('all phases populated', () => {
  const tut = computeTutSeconds(
    {
      eccentric_ds: 20,
      isometric_bottom_ds: 5,
      concentric_ds: 15,
      isometric_top_ds: 2,
    },
    8,
  );
  // (20 + 5 + 15 + 2) * 8 / 10 = 33.6
  assert.equal(tut, 33.6);
});

test('some phases null', () => {
  const tut = computeTutSeconds(
    {
      eccentric_ds: 30,
      isometric_bottom_ds: null,
      concentric_ds: 10,
      isometric_top_ds: null,
    },
    5,
  );
  // (30 + 0 + 10 + 0) * 5 / 10 = 20.0
  assert.equal(tut, 20);
});

test('all phases null', () => {
  const tut = computeTutSeconds(
    {
      eccentric_ds: null,
      isometric_bottom_ds: null,
      concentric_ds: null,
      isometric_top_ds: null,
    },
    10,
  );
  // (0 + 0 + 0 + 0) * 10 / 10 = 0
  assert.equal(tut, 0);
});

test('binary-float-trap input rounds to NUMERIC(7,2) like PG would', () => {
  // 1ds * 3 reps / 10 = 0.3 — IEEE-754 cannot represent this exactly.
  // PG NUMERIC(7,2) stores 0.30; we must match that, not 0.30000000000000004.
  const tut = computeTutSeconds(
    {
      eccentric_ds: 1,
      isometric_bottom_ds: null,
      concentric_ds: null,
      isometric_top_ds: null,
    },
    3,
  );
  assert.equal(tut, 0.3);
  assert.equal(Number.isFinite(tut), true);
});

test('undefined and null are coalesced identically', () => {
  const a = computeTutSeconds(
    { eccentric_ds: 10, concentric_ds: 10 },
    4,
  );
  const b = computeTutSeconds(
    {
      eccentric_ds: 10,
      isometric_bottom_ds: null,
      concentric_ds: 10,
      isometric_top_ds: null,
    },
    4,
  );
  assert.equal(a, b);
  assert.equal(a, 8);
});
