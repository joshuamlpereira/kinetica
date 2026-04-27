// Argon2id KEK derivation benchmark.
//
// Runs `deriveKEK` N times against the configured parameters and reports
// median + p95 wall-clock duration. Intended to be invoked from within the
// running app on a real device (Settings → Diagnostics → "Benchmark KEK"
// in a future UI) so the parameters can be pinned against the actual
// 2020-era iPhone target laid out in docs/SECURITY.md §11.3.
//
// Running this in the iOS simulator gives Mac-host CPU timings, NOT iPhone
// timings — see `runArgon2idBenchmark`'s `provenance` return field.

import { deriveKEK, generatePasswordSalt, type Argon2idParams } from './kek.ts';
import { ARGON2ID_MEM_LIMIT, ARGON2ID_OPS_LIMIT } from './argon2_params.ts';

export type BenchmarkResult = {
  iterations: number;
  params: Argon2idParams;
  durations_ms: number[];
  median_ms: number;
  p95_ms: number;
  provenance: 'iphone-device' | 'ios-simulator' | 'node-host' | 'unknown';
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

export async function runArgon2idBenchmark(
  iterations: number = 5,
  params: Argon2idParams = { opsLimit: ARGON2ID_OPS_LIMIT, memLimit: ARGON2ID_MEM_LIMIT },
  provenance: BenchmarkResult['provenance'] = 'unknown',
): Promise<BenchmarkResult> {
  if (iterations < 1) throw new Error('runArgon2idBenchmark: iterations must be >= 1');
  const passphrase = 'benchmark-passphrase-do-not-reuse';
  const salt = generatePasswordSalt();
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    deriveKEK(passphrase, salt, params);
    durations.push(performance.now() - t0);
  }
  return {
    iterations,
    params,
    durations_ms: durations,
    median_ms: median(durations),
    p95_ms: percentile(durations, 95),
    provenance,
  };
}
