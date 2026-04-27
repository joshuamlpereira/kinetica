// Test-only sodium loader.
//
// Tests run under Node + node:test and need the sumo build (full libsodium,
// includes crypto_pwhash). Production wires `react-native-libsodium` via
// `setSodium(...)` at app startup; this file MUST NOT be imported from
// production code — it would pull the WASM/JS backend into the bundle.

import { setSodium, type SodiumApi } from './_sodium.ts';

export async function setupSodiumForTests(): Promise<void> {
  const mod = await import('libsodium-wrappers-sumo');
  const lib = (mod as { default?: SodiumApi }).default ?? (mod as unknown as SodiumApi);
  await lib.ready;
  setSodium(lib);
}
