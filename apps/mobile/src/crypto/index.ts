// Public surface of the client-side crypto module.
//
// Wiring at app startup (call once, before any other crypto API):
//
//   import sodium from 'react-native-libsodium';
//   await sodium.ready;
//   setSodium(sodium);
//
// In tests, `setupSodiumForTests()` does the same with the sumo build.

// `setupSodiumForTests` is intentionally NOT re-exported here — it's
// test-only and lives in `./_sodium.test-setup.ts` to keep the dynamic
// import out of the production bundle.
export { setSodium, type Keypair, type SodiumApi } from './_sodium.ts';
export { randomBytes } from './random.ts';
export {
  aeadDecrypt,
  aeadEncrypt,
  KEY_BYTES,
  NONCE_BYTES,
  TAG_BYTES,
} from './aead.ts';
export { sealForRecipient, SEAL_OVERHEAD_BYTES, unseal } from './sealing.ts';
export {
  generateEd25519Keypair,
  signEd25519,
  verifyEd25519,
} from './ed25519.ts';
export {
  ARGON2ID_MEM_LIMIT,
  ARGON2ID_OPS_LIMIT,
  ARGON2_PARAMS_BENCHMARK_PINNED,
  KEK_BYTES,
  SALT_BYTES,
} from './argon2_params.ts';
export {
  DEFAULT_ARGON2ID_PARAMS,
  deriveKEK,
  generatePasswordSalt,
  unwrapMasterKey,
  wrapMasterKey,
  type Argon2idParams,
} from './kek.ts';
export { deriveX25519FromMaster, generateMasterKey } from './master.ts';
export { runArgon2idBenchmark, type BenchmarkResult } from './benchmark.ts';
export { initAppCrypto } from './setup.ts';
