"""Tests for kinetica.crypto.

The properties exercised here (HMAC determinism + constant-time matching
across rotated peppers; Ed25519 round-trip + tamper rejection) match the
client-side parity tests in `apps/mobile/src/crypto/`. If you change one
side, change the other.
"""

from __future__ import annotations

import secrets

import pytest
from nacl.signing import SigningKey

from kinetica.crypto import (
    compute_email_hash,
    constant_time_eq,
    match_email_hash,
    random_bytes,
    random_challenge,
    verify_ed25519,
)

# ----- email_hash --------------------------------------------------------


def test_compute_email_hash_is_deterministic() -> None:
    pepper = bytes(range(32))
    a = compute_email_hash("alice@example.com", pepper)
    b = compute_email_hash("alice@example.com", pepper)
    assert a == b
    assert len(a) == 32


def test_compute_email_hash_lowercases_and_strips() -> None:
    pepper = bytes(range(32))
    canonical = compute_email_hash("alice@example.com", pepper)
    assert compute_email_hash("Alice@Example.com", pepper) == canonical
    assert compute_email_hash("  alice@example.com  ", pepper) == canonical
    assert compute_email_hash("ALICE@EXAMPLE.COM", pepper) == canonical


def test_compute_email_hash_differs_across_peppers() -> None:
    p1 = secrets.token_bytes(32)
    p2 = secrets.token_bytes(32)
    assert p1 != p2
    assert compute_email_hash("alice@example.com", p1) != compute_email_hash(
        "alice@example.com", p2
    )


def test_compute_email_hash_rejects_wrong_length_pepper() -> None:
    with pytest.raises(ValueError, match="pepper must be 32 bytes"):
        compute_email_hash("alice@example.com", b"too-short")
    with pytest.raises(ValueError, match="pepper must be 32 bytes"):
        compute_email_hash("alice@example.com", b"x" * 33)


def test_match_email_hash_accepts_primary_or_secondary() -> None:
    primary = secrets.token_bytes(32)
    secondary = secrets.token_bytes(32)

    hashed_under_primary = compute_email_hash("user@kinetica.app", primary)
    hashed_under_secondary = compute_email_hash("user@kinetica.app", secondary)

    # The two-pepper rotation contract: a hash stored under either slot
    # must be recognized.
    assert match_email_hash("user@kinetica.app", hashed_under_primary, [primary, secondary])
    assert match_email_hash("user@kinetica.app", hashed_under_secondary, [primary, secondary])


def test_match_email_hash_rejects_unknown_pepper() -> None:
    primary = secrets.token_bytes(32)
    secondary = secrets.token_bytes(32)
    stranger = secrets.token_bytes(32)
    hashed_under_stranger = compute_email_hash("user@kinetica.app", stranger)
    assert not match_email_hash("user@kinetica.app", hashed_under_stranger, [primary, secondary])


def test_match_email_hash_does_not_short_circuit_on_first_match() -> None:
    # Smoke test for the constant-time iteration pattern: even when the first
    # pepper matches, the second pepper must still be evaluated. We can't
    # observe timing reliably in a unit test, so we instead assert the function
    # accepts a generator that has been fully drained.
    primary = secrets.token_bytes(32)
    secondary = secrets.token_bytes(32)
    target = compute_email_hash("user@kinetica.app", primary)

    consumed: list[bytes] = []

    def peppers() -> object:
        for p in (primary, secondary):
            consumed.append(p)
            yield p

    assert match_email_hash("user@kinetica.app", target, peppers())  # type: ignore[arg-type]
    assert consumed == [primary, secondary]


# ----- signatures --------------------------------------------------------


def test_verify_ed25519_round_trips() -> None:
    sk = SigningKey.generate()
    pk = sk.verify_key.encode()
    msg = b"phase-2 challenge: " + secrets.token_bytes(32)
    sig = sk.sign(msg).signature
    assert verify_ed25519(pk, msg, sig)


def test_verify_ed25519_rejects_tampered_message() -> None:
    sk = SigningKey.generate()
    pk = sk.verify_key.encode()
    msg = b"original"
    sig = sk.sign(msg).signature
    assert not verify_ed25519(pk, b"tampered", sig)


def test_verify_ed25519_rejects_wrong_pubkey() -> None:
    sk1 = SigningKey.generate()
    sk2 = SigningKey.generate()
    msg = b"phase-2 challenge"
    sig = sk1.sign(msg).signature
    assert not verify_ed25519(sk2.verify_key.encode(), msg, sig)


def test_verify_ed25519_rejects_garbage_signature() -> None:
    sk = SigningKey.generate()
    pk = sk.verify_key.encode()
    bogus = secrets.token_bytes(64)
    assert not verify_ed25519(pk, b"any message", bogus)


def test_verify_ed25519_rejects_wrong_length_inputs() -> None:
    with pytest.raises(ValueError, match="pubkey must be 32 bytes"):
        verify_ed25519(b"short", b"msg", b"x" * 64)
    with pytest.raises(ValueError, match="signature must be 64 bytes"):
        verify_ed25519(b"x" * 32, b"msg", b"short-sig")


# ----- random ------------------------------------------------------------


def test_random_bytes_length_and_uniqueness() -> None:
    a = random_bytes(16)
    b = random_bytes(16)
    assert len(a) == 16
    assert len(b) == 16
    assert a != b  # collision probability ~2^-128


def test_random_bytes_rejects_nonpositive() -> None:
    with pytest.raises(ValueError):
        random_bytes(0)
    with pytest.raises(ValueError):
        random_bytes(-1)


def test_random_challenge_is_32_bytes() -> None:
    c = random_challenge()
    assert len(c) == 32
    # Two consecutive challenges must differ — sanity check on the source.
    assert c != random_challenge()


# ----- compare -----------------------------------------------------------


def test_constant_time_eq_matches_equal_bytes() -> None:
    assert constant_time_eq(b"hello", b"hello")
    assert constant_time_eq(b"", b"")


def test_constant_time_eq_rejects_different_bytes() -> None:
    assert not constant_time_eq(b"hello", b"world")
    assert not constant_time_eq(b"hello", b"hellO")
    assert not constant_time_eq(b"hello", b"hello!")
