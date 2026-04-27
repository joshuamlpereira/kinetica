"""Secure random bytes for short-lived server-issued material (challenges,
recovery tokens, jti values).

Wraps `secrets` so the crypto package is the single audit surface for any
random source.
"""

from __future__ import annotations

import secrets

CHALLENGE_LEN = 32


def random_bytes(length: int) -> bytes:
    """Return `length` cryptographically random bytes."""
    if length <= 0:
        raise ValueError(f"length must be positive, got {length}")
    return secrets.token_bytes(length)


def random_challenge() -> bytes:
    """32 bytes of randomness suitable for a single-use auth challenge."""
    return secrets.token_bytes(CHALLENGE_LEN)
