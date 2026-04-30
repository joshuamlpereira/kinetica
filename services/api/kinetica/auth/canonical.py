"""Canonical JSON serialization used for `bootstrap_signature` (and
later flows). Must produce byte-identical output to the TS client at
`apps/mobile/src/auth/canonical.ts` for any given dict — those bytes
are the exact input the device's Ed25519 key signs over (after
SHA-256), so any disagreement breaks the signature.

Format:
  - sorted keys
  - separators (',', ':') — no whitespace
  - UTF-8 encoded
  - non-ASCII characters emitted directly as their UTF-8 bytes
    (NOT escaped to `\\uXXXX`). JS's `JSON.stringify` does this by
    default; Python's `json.dumps` defaults to `ensure_ascii=True`
    which would diverge — `ensure_ascii=False` here matches the JS
    behavior. Fixture #4 in `docs/fixtures/canonical_json.json` is
    the canary for this case.

Byte fields (pubkeys, salts, ciphertext) are pre-encoded as standard
base64 strings before they reach this function, so the canonical form
is just a flat JSON object over strings.
"""

from __future__ import annotations

import hashlib
import json


def canonical_json(obj: dict[str, str]) -> bytes:
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def canonical_sha256(obj: dict[str, str]) -> bytes:
    return hashlib.sha256(canonical_json(obj)).digest()
