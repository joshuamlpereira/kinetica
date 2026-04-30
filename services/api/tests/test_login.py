"""End-to-end login test against a live Postgres + the FastAPI app.

Each test registers a fresh user via /auth/register so the device
keypair, email, and DB rows are all in a known state. Then exercises
/auth/challenge → /auth/login.
"""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import AsyncClient
from nacl.signing import SigningKey
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from kinetica.auth.login import challenge_signing_input
from kinetica.config import get_settings
from kinetica.models import ApplicationPepper, AuthChallenge, User, UserDevice


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _build_register_payload(
    *, email: str, device_signing_key: SigningKey | None = None
) -> tuple[dict[str, str], SigningKey]:
    sk = device_signing_key or SigningKey.generate()
    body_without_sig = {
        "email": email,
        "password_salt": _b64(secrets.token_bytes(16)),
        "encryption_pubkey": _b64(secrets.token_bytes(32)),
        "wrapped_master_key": _b64(secrets.token_bytes(72)),
        "device_pubkey": _b64(sk.verify_key.encode()),
        "device_name": "iPhone",
    }
    canonical = json.dumps(
        body_without_sig, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    digest = hashlib.sha256(canonical).digest()
    sig = sk.sign(digest).signature
    return {**body_without_sig, "bootstrap_signature": _b64(sig)}, sk


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(get_settings().database_url, future=True, poolclass=NullPool)
    sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    async with sessionmaker() as session:
        yield session


@pytest.fixture
async def primary_pepper(db_session: AsyncSession) -> AsyncIterator[bytes]:
    pepper = secrets.token_bytes(32)
    existing = (
        await db_session.execute(
            select(ApplicationPepper).where(ApplicationPepper.slot == "primary")
        )
    ).scalar_one_or_none()
    if existing is None:
        db_session.add(ApplicationPepper(slot="primary", pepper=pepper))
    else:
        existing.pepper = pepper
    await db_session.commit()
    yield pepper


@pytest.fixture
async def cleanup_users(db_session: AsyncSession) -> AsyncIterator[None]:
    yield
    await db_session.execute(delete(AuthChallenge))
    await db_session.execute(delete(UserDevice))
    await db_session.execute(delete(User))
    await db_session.commit()


async def _register(client: AsyncClient, email: str) -> tuple[SigningKey, dict[str, str]]:
    """Register a fresh user and return (signing_key, response_body)."""
    payload, sk = _build_register_payload(email=email)
    r = await client.post("/auth/register", json=payload)
    assert r.status_code == 201, r.text
    return sk, r.json()


def _parse_iso(s: str) -> datetime:
    # Both `2026-04-29T18:00:00Z` and Python's `2026-04-29T18:00:00+00:00`
    # parse correctly here. The signing-input format is the `Z` form; the
    # JSON response is the `+00:00` form (Pydantic default). The test parses
    # whichever the response gave us, then re-formats to the signing form.
    if s.endswith("Z"):
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    return datetime.fromisoformat(s)


def _signing_iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


async def test_login_happy_path_returns_tokens_bound_to_device_pubkey(
    client: AsyncClient,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    sk, _ = await _register(client, "alice@example.com")
    device_pubkey = sk.verify_key.encode()

    # Challenge.
    r1 = await client.post(
        "/auth/challenge",
        json={"email": "alice@example.com", "device_pubkey": _b64(device_pubkey)},
    )
    assert r1.status_code == 200, r1.text
    nonce = base64.b64decode(r1.json()["nonce"])
    expires_at = _parse_iso(r1.json()["expires_at"])
    assert len(nonce) == 32

    # Sign the challenge.
    signing_input = challenge_signing_input(nonce, expires_at, device_pubkey)
    signature = sk.sign(signing_input).signature

    r2 = await client.post(
        "/auth/login",
        json={
            "email": "alice@example.com",
            "device_pubkey": _b64(device_pubkey),
            "nonce": _b64(nonce),
            "signature": _b64(signature),
        },
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["token_type"] == "DPoP"
    user_id = uuid.UUID(body["user_id"])
    device_id = uuid.UUID(body["device_id"])

    # Access token's cnf.jkt is the JWK Thumbprint (RFC 7638) of the
    # device pubkey, not the full JWK. The DPoP middleware verifies
    # that the proof header's JWK thumbprints to the same value.
    settings = get_settings()
    decoded = jwt.decode(body["access_token"], settings.jwt_secret, algorithms=["HS256"])
    assert decoded["sub"] == str(user_id)
    assert decoded["did"] == str(device_id)
    from kinetica.auth.tokens import device_pubkey_thumbprint

    assert decoded["cnf"] == {"jkt": device_pubkey_thumbprint(device_pubkey)}


async def test_login_with_unknown_email_returns_401(
    client: AsyncClient,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    r = await client.post(
        "/auth/challenge",
        json={
            "email": "noone@example.com",
            "device_pubkey": _b64(secrets.token_bytes(32)),
        },
    )
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid credentials"


async def test_challenge_with_unregistered_device_returns_401(
    client: AsyncClient,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    await _register(client, "bob@example.com")
    rogue_pubkey = SigningKey.generate().verify_key.encode()
    r = await client.post(
        "/auth/challenge",
        json={"email": "bob@example.com", "device_pubkey": _b64(rogue_pubkey)},
    )
    assert r.status_code == 401


async def test_login_with_wrong_signature_returns_401(
    client: AsyncClient,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    sk, _ = await _register(client, "carol@example.com")
    device_pubkey = sk.verify_key.encode()
    r1 = await client.post(
        "/auth/challenge",
        json={"email": "carol@example.com", "device_pubkey": _b64(device_pubkey)},
    )
    nonce = base64.b64decode(r1.json()["nonce"])

    bad_sig = secrets.token_bytes(64)
    r2 = await client.post(
        "/auth/login",
        json={
            "email": "carol@example.com",
            "device_pubkey": _b64(device_pubkey),
            "nonce": _b64(nonce),
            "signature": _b64(bad_sig),
        },
    )
    assert r2.status_code == 401


async def test_replay_of_consumed_challenge_returns_401(
    client: AsyncClient,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    sk, _ = await _register(client, "dave@example.com")
    device_pubkey = sk.verify_key.encode()
    r1 = await client.post(
        "/auth/challenge",
        json={"email": "dave@example.com", "device_pubkey": _b64(device_pubkey)},
    )
    nonce = base64.b64decode(r1.json()["nonce"])
    expires_at = _parse_iso(r1.json()["expires_at"])
    signing_input = challenge_signing_input(nonce, expires_at, device_pubkey)
    signature = sk.sign(signing_input).signature

    body = {
        "email": "dave@example.com",
        "device_pubkey": _b64(device_pubkey),
        "nonce": _b64(nonce),
        "signature": _b64(signature),
    }
    r2 = await client.post("/auth/login", json=body)
    assert r2.status_code == 200

    # Replay with the SAME nonce + signature must fail.
    r3 = await client.post("/auth/login", json=body)
    assert r3.status_code == 401


async def test_expired_challenge_returns_401(
    client: AsyncClient,
    db_session: AsyncSession,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    sk, _ = await _register(client, "eve@example.com")
    device_pubkey = sk.verify_key.encode()
    r1 = await client.post(
        "/auth/challenge",
        json={"email": "eve@example.com", "device_pubkey": _b64(device_pubkey)},
    )
    nonce = base64.b64decode(r1.json()["nonce"])

    # Backdate the challenge so the row is stored as expired.
    past = datetime.now(tz=UTC) - timedelta(seconds=1)
    await db_session.execute(
        update(AuthChallenge).where(AuthChallenge.nonce == nonce).values(expires_at=past)
    )
    await db_session.commit()

    # Sign over the *original* expires_at the server returned (the client
    # didn't know we backdated). The server now reads the backdated value
    # and rejects on expiry — even though the signature would otherwise
    # verify against the original expires_at.
    expires_at = _parse_iso(r1.json()["expires_at"])
    signing_input = challenge_signing_input(nonce, expires_at, device_pubkey)
    signature = sk.sign(signing_input).signature

    r2 = await client.post(
        "/auth/login",
        json={
            "email": "eve@example.com",
            "device_pubkey": _b64(device_pubkey),
            "nonce": _b64(nonce),
            "signature": _b64(signature),
        },
    )
    assert r2.status_code == 401


async def test_login_with_revoked_device_returns_401(
    client: AsyncClient,
    db_session: AsyncSession,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    sk, _ = await _register(client, "frank@example.com")
    device_pubkey = sk.verify_key.encode()

    # Revoke the device after registration.
    await db_session.execute(
        update(UserDevice)
        .where(UserDevice.device_pubkey == device_pubkey)
        .values(revoked_at=datetime.now(tz=UTC))
    )
    await db_session.commit()

    r = await client.post(
        "/auth/challenge",
        json={"email": "frank@example.com", "device_pubkey": _b64(device_pubkey)},
    )
    assert r.status_code == 401


async def test_login_signing_input_format_is_stable(
    client: AsyncClient,
    primary_pepper: bytes,
    cleanup_users: None,
) -> None:
    """The signing input is `nonce || expires_at_iso_z || device_pubkey`.

    expires_at MUST be the seconds-precision UTC ISO string with a
    trailing 'Z'. This test reconstructs that exact string from the
    response body, signs it, and confirms the server accepts it. If
    the server's serialization ever drifts (microseconds, +00:00 vs
    Z, etc.), this test fails — same drift class the canonical-JSON
    fixture catches for registration.
    """
    sk, _ = await _register(client, "gina@example.com")
    device_pubkey = sk.verify_key.encode()
    r1 = await client.post(
        "/auth/challenge",
        json={"email": "gina@example.com", "device_pubkey": _b64(device_pubkey)},
    )
    nonce = base64.b64decode(r1.json()["nonce"])
    expires_at = _parse_iso(r1.json()["expires_at"])

    iso = _signing_iso(expires_at)
    assert iso.endswith("Z")
    assert "." not in iso  # no microseconds

    signing_input = nonce + iso.encode("utf-8") + device_pubkey
    signature = sk.sign(signing_input).signature

    r2 = await client.post(
        "/auth/login",
        json={
            "email": "gina@example.com",
            "device_pubkey": _b64(device_pubkey),
            "nonce": _b64(nonce),
            "signature": _b64(signature),
        },
    )
    assert r2.status_code == 200
