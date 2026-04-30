"""Hex-level canonical-JSON parity test against the shared fixtures.

The same `docs/fixtures/canonical_json.json` is consumed by the TS
client at `apps/mobile/src/auth/canonical.fixture.test.ts`. Both
sides compare their canonical bytes against the same `canonical_hex`
and `sha256_hex` values — drift in either direction breaks the
fixture and surfaces here OR in the TS test, never silently in
production.

The user's review caught this gap explicitly: a "round-trip
signature verifies" test would silently pass if both sides drifted
in the same direction (e.g., both started escaping non-ASCII), even
though neither matched what users in the field were signing.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from kinetica.auth.canonical import canonical_json

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = REPO_ROOT / "docs" / "fixtures" / "canonical_json.json"


def _vectors() -> list[dict[str, object]]:
    return json.loads(FIXTURE_PATH.read_text())["vectors"]


@pytest.mark.parametrize("vector", _vectors(), ids=lambda v: v["name"])
def test_canonical_json_matches_fixture_hex(vector: dict[str, object]) -> None:
    canonical = canonical_json(vector["input"])  # type: ignore[arg-type]
    assert canonical.hex() == vector["canonical_hex"], (
        f"vector {vector['name']!r}: canonical bytes drifted.\n"
        f"  got:      {canonical.hex()}\n"
        f"  expected: {vector['canonical_hex']}\n"
        f"  decoded:  {canonical!r}"
    )
    digest = hashlib.sha256(canonical).hexdigest()
    assert digest == vector["sha256_hex"]
