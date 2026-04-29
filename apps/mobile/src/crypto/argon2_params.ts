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
// closest accessible substitute, but it is NOT a slowdown of the A14 —
// the simulator runs on host CPU, which is FASTER than the A14 at
// these parameters, and there is no CPU throttle option. The local
// M-series Mac and the macos-14 CI runner are both Apple Silicon and
// produce statistically identical numbers.
//
// Calibration: Argon2id on A14 runs roughly 5-10× SLOWER than on
// M-series at the same parameters. So a simulator measurement of
// ~100-150ms median projects to ~500-1000ms on real A14 — i.e. the
// "500ms on iPhone 12" target corresponds to a simulator reading in
// the 100-150ms band, not 500ms. Constants pinned at "simulator hits
// 500ms" would translate to multi-second login on real devices and
// are wrong; this pin avoids that trap.
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
// Projection to iPhone 12 (A14 Bionic) at 5× / 7× / 10× factors:
//   5×:  median ≈ 543ms      — at target
//   7×:  median ≈ 760ms      — top of acceptable band
//   10×: median ≈ 1085ms     — slow login but acceptable on devices
//                              that hit this end of the projection
//
// Re-measurement on a real iPhone 11/12 is required before public
// release and is tracked as a Phase 6 audit item. If the on-device
// median is outside [400, 1200]ms, change the values below and re-pin.

export const ARGON2ID_OPS_LIMIT = 5; // t = 5 iterations
export const ARGON2ID_MEM_LIMIT = 64 * 1024 * 1024; // m = 64 MiB
export const SALT_BYTES = 16;
export const KEK_BYTES = 32;

export const ARGON2_PARAMS_BENCHMARK_PINNED = true;
