"""HMAC-SHA-256 over the user's email under the application pepper.

The pepper lives in the `application_pepper` table and is rotated by writing
a new value into the 'primary' slot while leaving the previous value in
'secondary'. During the rotation window readers must accept hashes computed
under either slot — `match_email_hash` enforces that, in constant time
across the two peppers so a timing observer cannot tell which slot a given
email row was hashed under.
"""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Iterable

PEPPER_LEN = 32


def compute_email_hash(email: str, pepper: bytes) -> bytes:
    """Return HMAC-SHA-256(pepper, email.lower())."""
    if len(pepper) != PEPPER_LEN:
        raise ValueError(f"pepper must be {PEPPER_LEN} bytes, got {len(pepper)}")
    msg = email.strip().lower().encode("utf-8")
    return hmac.new(pepper, msg, hashlib.sha256).digest()


def match_email_hash(
    email: str,
    expected_hash: bytes,
    peppers: Iterable[bytes],
) -> bool:
    """Constant-time check whether `expected_hash` matches HMAC(pepper, email)
    under any of the provided peppers.

    All peppers are evaluated even after a match so the per-call running time
    does not leak which slot was used. Callers should pass the primary and
    secondary pepper in the order they read them; the order is irrelevant
    cryptographically but reading the primary first is the steady-state
    pattern.
    """
    matched = False
    for pepper in peppers:
        candidate = compute_email_hash(email, pepper)
        # `compare_digest` is itself constant-time over equal-length inputs;
        # always run it, do not short-circuit on `matched`.
        if hmac.compare_digest(candidate, expected_hash):
            matched = True
    return matched
