"""Hex-level parity test for the login signing-input format.

The challenge signing input is `nonce || expires_at_iso_utf8 ||
device_pubkey` — a binary-string-binary concatenation. That kind of
implicit framing is exactly where TS and Python could diverge silently
(reverse the order, use ASCII vs UTF-8, switch to microsecond-
precision ISO, etc.) and break signatures for real users without
failing any in-process round-trip test.

This test asserts hex equality against the frozen vectors in
`docs/fixtures/login_signing_input.json`. The TS client picks up the
same file when its login implementation lands; both sides MUST
produce identical bytes for each vector.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pytest

from kinetica.auth.login import challenge_signing_input

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = REPO_ROOT / "docs" / "fixtures" / "login_signing_input.json"


def _vectors() -> list[dict[str, str]]:
    return json.loads(FIXTURE_PATH.read_text())["vectors"]


@pytest.mark.parametrize("vector", _vectors(), ids=lambda v: v["name"])
def test_signing_input_matches_fixture_hex(vector: dict[str, str]) -> None:
    nonce = bytes.fromhex(vector["nonce_hex"])
    pubkey = bytes.fromhex(vector["device_pubkey_hex"])
    expires_at = datetime.fromisoformat(vector["expires_at_iso"].replace("Z", "+00:00"))

    si = challenge_signing_input(nonce, expires_at, pubkey)
    assert si.hex() == vector["signing_input_hex"], (
        f"vector {vector['name']!r}: signing-input bytes drifted.\n"
        f"  got:      {si.hex()}\n"
        f"  expected: {vector['signing_input_hex']}\n"
    )
    # Length sanity — a reader looking at the file should see exactly
    # 32 + len(iso) + 32 bytes; if the assertion above passes but this
    # one fails the implementation has done something exotic.
    assert len(si) == 32 + len(vector["expires_at_iso"]) + 32
