// Argon2id parameter constants for the passphrase → KEK derivation.
//
// Target (docs/SECURITY.md §5.2 / §11.3): ~500ms on a 2020-era iPhone
// (iPhone 11 / 12, A13–A14 Bionic).
//
// Note on `p`: libsodium's `crypto_pwhash` does not expose Argon2's
// parallelism parameter; it is fixed at 1 internally. The original
// SECURITY.md proposal of `p=4` is therefore moot in practice and the
// doc reflects that. This is the constraint, not a workaround.
//
// ====== BENCHMARK PROVENANCE ======
//
// Pinned on a known-imperfect substrate. No physical iPhone 11/12 was
// available at pin time. The iOS simulator on Apple Silicon is the
// closest accessible substitute; the simulator runs on host CPU
// without throttling, so it is FASTER than the A14, not slower.
//
// Calibration: M-series Mac to A14 is ~1.5–2× slowdown for compute-
// bound work, slightly more for memory-bound Argon2id (memory
// bandwidth on A14 is below M-series). Reference Geekbench 6 single-
// thread scores: M3/M4 ~3000–3700, A14 ~2100; ratio 1.5–1.8×. Pure
// CPU work scales with that ratio; Argon2id at 64 MiB pushes it to
// the ~1.5–2× upper end. Older "A-series 5–10× slower than M-series"
// claims circulating online predate Apple's silicon convergence and
// are wrong for this generation.
//
// Substrate:           iOS simulator on M-series Mac host (Apple Silicon)
// Pinned date:         2026-04-29
// Pinned by:           bench harness in apps/mobile/src/crypto/benchmark.ts
//                      (5 iterations of `runArgon2idBenchmark`)
// Iterations:          5
// Median observed:     108.5ms
// p95 observed:        113.9ms
// Provenance tag:      'ios-simulator'
//
// Projection to iPhone 12 (A14) at 1.5× / 2× factors:
//   1.5×: median ≈ 163ms
//   2×:   median ≈ 217ms
//
// Both projections come in under the 500ms spec target. That is the
// acceptable miss: with t=5, m=64MiB the security floor is strong
// (cracking cost is dominated by memory anyway), and faster-than-
// target login is fine. The spec target is an upper-bound budget,
// not a goal to hit.
//
// Re-pin window for an on-device measurement: [150, 1200]ms median.
// - Below 150ms: constants drifted too weak; bump t or m.
// - Above 1200ms: login UX degrades too far; reduce t.
// - In-window: leave the pin alone.
// Re-measurement on a real iPhone 11/12 is tracked as a Phase 6 audit
// item.

export const ARGON2ID_OPS_LIMIT = 5; // t = 5 iterations
export const ARGON2ID_MEM_LIMIT = 64 * 1024 * 1024; // m = 64 MiB
export const SALT_BYTES = 16;
export const KEK_BYTES = 32;

export const ARGON2_PARAMS_BENCHMARK_PINNED = true;
