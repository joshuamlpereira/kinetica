// Sodium injection point.
//
// The mobile bundle uses `react-native-libsodium` (native, fast); tests run
// under Node and use `libsodium-wrappers`. Both implement libsodium
// semantics — same algorithms, same outputs, same constants — so we model
// the surface we depend on as one structural type and let either backend
// satisfy it.
//
// Production wires in the native backend at app startup (see
// `apps/mobile/src/crypto/setup.ts`); tests do the same at the top of
// each test file via `setupSodiumForTests()`.

export type Keypair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

export interface SodiumApi {
  ready: Promise<void>;

  randombytes_buf(length: number): Uint8Array;

  // ---- KDFs --------------------------------------------------------------
  crypto_pwhash(
    keyLength: number,
    password: string | Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
    algorithm: number,
  ): Uint8Array;
  crypto_pwhash_ALG_ARGON2ID13: number;
  crypto_pwhash_SALTBYTES: number;

  crypto_kdf_derive_from_key(
    subkeyLength: number,
    subkeyId: number | bigint,
    context: string,
    masterKey: Uint8Array,
  ): Uint8Array;

  // ---- X25519 / sealing --------------------------------------------------
  crypto_box_seed_keypair(seed: Uint8Array): Keypair;
  crypto_box_keypair(): Keypair;
  crypto_box_seal(message: Uint8Array, recipientPubkey: Uint8Array): Uint8Array;
  crypto_box_seal_open(
    ciphertext: Uint8Array,
    recipientPubkey: Uint8Array,
    recipientPrivkey: Uint8Array,
  ): Uint8Array;
  crypto_box_SEEDBYTES: number;
  crypto_box_PUBLICKEYBYTES: number;
  crypto_box_SECRETKEYBYTES: number;

  // ---- Ed25519 -----------------------------------------------------------
  crypto_sign_keypair(): Keypair;
  crypto_sign_detached(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
  crypto_sign_verify_detached(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array,
  ): boolean;
  crypto_sign_PUBLICKEYBYTES: number;
  crypto_sign_SECRETKEYBYTES: number;
  crypto_sign_BYTES: number;

  // ---- AEAD --------------------------------------------------------------
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: Uint8Array | null,
    secretNonce: null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array | null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_keygen(): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_KEYBYTES: number;
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: number;
  crypto_aead_xchacha20poly1305_ietf_ABYTES: number;
}

let _instance: SodiumApi | null = null;

export function setSodium(s: SodiumApi): void {
  _instance = s;
}

export function sodium(): SodiumApi {
  if (_instance === null) {
    throw new Error(
      'crypto: sodium not initialized — call setSodium(...) at app startup ' +
        'or setupSodiumForTests() in tests before invoking any crypto function.',
    );
  }
  return _instance;
}

// `setupSodiumForTests` (the libsodium-wrappers-sumo loader for Node tests)
// lives in `_sodium.test-setup.ts` and is excluded from the RN typecheck —
// it uses a dynamic import and must not ship in the mobile bundle.
