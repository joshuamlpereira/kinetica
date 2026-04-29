// Canonical JSON serialization + SHA-256 used to build the input to
// `bootstrap_signature` (and to other request signatures introduced by
// later flows). Both client and server MUST produce byte-identical
// output for a given object — the signing input is whatever bytes this
// function emits, full stop.
//
// Format: sorted-key JSON with `(',', ':')` separators, UTF-8 encoded.
// All byte fields are pre-encoded as base64 strings before they reach
// here, so the canonical form is just standard JSON over a flat string
// dict. Server-side, `json.dumps(obj, sort_keys=True, separators=(",", ":"))`
// produces the matching output (see `services/api/kinetica/auth/canonical.py`).

import { sodium } from '../crypto/index.ts';

export function canonicalJson(obj: Record<string, string>): string {
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

export function sha256(message: Uint8Array): Uint8Array {
  return sodium().crypto_hash_sha256(message);
}
