// Production sodium wiring.
//
// Mobile bundle path: import the native bindings (`react-native-libsodium`)
// and register them as the SodiumApi. The package's API mirrors
// libsodium-wrappers exactly (per its own README), so the structural
// SodiumApi type from `_sodium.ts` is satisfied with no shim.
//
// Call this once at app startup, before any crypto API is invoked. It is
// safe to call multiple times — the second call replaces the registration
// with the same object — but tests still need their own setup path
// (`_sodium.test-setup.ts`); do not import this from a test.

import * as rnSodium from 'react-native-libsodium';

import { setSodium, type SodiumApi } from './_sodium.ts';

export async function initAppCrypto(): Promise<void> {
  // react-native-libsodium exposes a `ready` promise just like the JS variant.
  // Awaiting it is required even on native because internal lookup tables
  // are populated asynchronously on first access.
  const lib = rnSodium as unknown as SodiumApi;
  await lib.ready;
  setSodium(lib);
}
