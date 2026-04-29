"""Canonical JSON serialization used for `bootstrap_signature` (and
later flows). Must produce byte-identical output to the TS client at
`apps/mobile/src/auth/canonical.ts` for any given dict — those bytes
are the exact input the device's Ed25519 key signs over (after
SHA-256), so any disagreement breaks the signature.

Format: sorted keys, no whitespace, UTF-8 encoded, byte fields already
pre-encoded as base64 strings before they reach this function so the
canonical form is just a flat JSON object over strings.
"""

from __future__ import annotations

import hashlib
import json


def canonical_json(obj: dict[str, str]) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def canonical_sha256(obj: dict[str, str]) -> bytes:
    return hashlib.sha256(canonical_json(obj)).digest()
