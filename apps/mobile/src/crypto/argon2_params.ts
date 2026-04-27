// Argon2id parameter constants for the passphrase → KEK derivation.
//
// The threat model (docs/SECURITY.md §5.2 / §11.3) targets ~500ms on a
// 2020-era iPhone. The proposal is t=3, m=64MiB. The numbers BELOW are
// provisional and MUST be re-pinned by an actual on-device benchmark
// before they survive review — see ./benchmark.ts.
//
// Note on `p`: libsodium's `crypto_pwhash` does not expose Argon2's
// parallelism parameter; it is fixed at 1 internally. The original
// proposal in SECURITY.md §5.2 of `p=4` is therefore moot in practice
// and the doc reflects that. This is the constraint, not a workaround.

export const ARGON2ID_OPS_LIMIT = 3; // t = 3 iterations
export const ARGON2ID_MEM_LIMIT = 64 * 1024 * 1024; // m = 64 MiB
export const SALT_BYTES = 16;
export const KEK_BYTES = 32;

// Provenance: provisional. Replace with iPhone-measured numbers + a date
// before merging the auth-flow turn.
export const ARGON2_PARAMS_BENCHMARK_PINNED = false;
