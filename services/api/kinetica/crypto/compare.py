"""Constant-time byte comparison."""

from __future__ import annotations

import hmac


def constant_time_eq(a: bytes, b: bytes) -> bool:
    """Return True iff `a` and `b` are byte-equal, in constant time.

    `hmac.compare_digest` is constant-time over equal-length inputs and
    bails early only when lengths differ — which is acceptable for our
    use because lengths come from fixed-size cryptographic outputs (HMACs,
    signatures, hashes) where the length is not itself secret.
    """
    return hmac.compare_digest(a, b)
