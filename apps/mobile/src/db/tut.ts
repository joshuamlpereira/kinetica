// Time-Under-Tension calculation.
//
// MUST stay byte-for-byte equivalent to the Postgres STORED column defined
// in docs/SCHEMA.sql / migrations/versions/0001_initial_schema.py:
//
//   tut_seconds NUMERIC(7,2) GENERATED ALWAYS AS (
//       (COALESCE(eccentric_ds, 0)
//      + COALESCE(isometric_bottom_ds, 0)
//      + COALESCE(concentric_ds, 0)
//      + COALESCE(isometric_top_ds, 0))::NUMERIC * reps / 10.0
//   ) STORED
//
// Phase durations are stored as deciseconds (ds). Result is rounded to 2 dp
// to match NUMERIC(7,2) and quantize away binary-float drift before it can
// disagree with the server.

export type TutPhases = {
  eccentric_ds?: number | null;
  isometric_bottom_ds?: number | null;
  concentric_ds?: number | null;
  isometric_top_ds?: number | null;
};

const coalesce = (n: number | null | undefined): number => (n == null ? 0 : n);

export function computeTutSeconds(phases: TutPhases, reps: number): number {
  const totalDs =
    coalesce(phases.eccentric_ds) +
    coalesce(phases.isometric_bottom_ds) +
    coalesce(phases.concentric_ds) +
    coalesce(phases.isometric_top_ds);

  const seconds = (totalDs * reps) / 10;
  return Math.round(seconds * 100) / 100;
}
