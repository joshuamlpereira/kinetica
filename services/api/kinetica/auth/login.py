"""Service-layer login per docs/SECURITY.md §5.3.2.

Two operations:

- `issue_challenge` — given an email + device pubkey, look up the user
  and the (non-revoked) device, and issue a 32-byte random nonce with
  60-second TTL. The nonce is stored alongside (user_id, device_id) so
  redemption can verify the device that originally requested it.

- `complete_login` — given email + device pubkey + nonce + signature,
  verify the device signed `nonce || expires_at_iso || device_pubkey`
  with its registered Ed25519 private key. Single-use is enforced by
  DELETE on consume — replay attempts find no row.

Constant-time-ish: every failure path (unknown email, unknown device,
revoked device, missing nonce, expired nonce, bad signature) returns
the same `LoginFailed` exception so the route maps every one to a
generic 401. Wall-time still differs across paths (the
register-409 follow-up applies here too — see TODO_FOLLOWUPS.md).
"""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from kinetica.auth.tokens import issue_access_token, issue_refresh_token
from kinetica.config import Settings
from kinetica.crypto import compute_email_hash, verify_ed25519
from kinetica.models import ApplicationPepper, AuthChallenge, User, UserDevice

CHALLENGE_TTL_SECONDS = 60
NONCE_BYTES = 32


class LoginError(Exception):
    """Base for login-flow failures."""


class PepperUnavailable(LoginError):
    pass


class ChallengeNotFound(LoginError):
    """Unknown email, unknown device, revoked device, or revoked-since-issuance.

    Deliberately one-of-many — the route maps to a single 401 to avoid
    leaking which dimension failed.
    """


class LoginFailed(LoginError):
    """Bad signature, expired nonce, or replayed nonce.

    Same opaque mapping rule as ChallengeNotFound.
    """


@dataclass(frozen=True)
class ChallengeResult:
    nonce: bytes
    expires_at: datetime


@dataclass(frozen=True)
class LoginResult:
    user_id: uuid.UUID
    device_id: uuid.UUID
    access_token: str
    refresh_token: str
    access_token_expires_at: datetime


async def _read_primary_pepper(session: AsyncSession) -> bytes:
    row = (
        await session.execute(select(ApplicationPepper).where(ApplicationPepper.slot == "primary"))
    ).scalar_one_or_none()
    if row is None:
        raise PepperUnavailable("no primary pepper present in application_pepper")
    return row.pepper


async def _resolve_user_and_device(
    session: AsyncSession,
    email: str,
    device_pubkey: bytes,
) -> tuple[User, UserDevice]:
    """Look up the (User, UserDevice) pair for an email + device pubkey.

    Raises `ChallengeNotFound` for any of the failure modes — unknown
    user, unknown device, revoked device — so callers map them all to
    the same opaque 401.
    """
    primary_pepper = await _read_primary_pepper(session)
    email_hash = compute_email_hash(email, primary_pepper)

    user = (
        await session.execute(
            select(User).where(
                User.email_hash == email_hash,
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if user is None:
        raise ChallengeNotFound("unknown email")

    device = (
        await session.execute(
            select(UserDevice).where(
                UserDevice.user_id == user.id,
                UserDevice.device_pubkey == device_pubkey,
                UserDevice.revoked_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if device is None:
        raise ChallengeNotFound("unknown or revoked device")

    return user, device


async def issue_challenge(
    email: str,
    device_pubkey: bytes,
    session: AsyncSession,
) -> ChallengeResult:
    user, device = await _resolve_user_and_device(session, email, device_pubkey)

    nonce = secrets.token_bytes(NONCE_BYTES)
    expires_at = datetime.now(tz=UTC) + timedelta(seconds=CHALLENGE_TTL_SECONDS)
    session.add(
        AuthChallenge(
            user_id=user.id,
            device_id=device.id,
            nonce=nonce,
            expires_at=expires_at,
        )
    )
    await session.commit()
    return ChallengeResult(nonce=nonce, expires_at=expires_at)


def _challenge_signing_input(nonce: bytes, expires_at: datetime, device_pubkey: bytes) -> bytes:
    """Bytes the device must sign on POST /auth/login.

    Format: `nonce || expires_at_iso_utf8 || device_pubkey`. The
    expires_at part is the canonical ISO-8601 UTC string (no
    milliseconds, no offset) — i.e. the same string the server
    returned in the challenge response. Both client and server MUST
    serialize identically; mismatched timezone formatting is the most
    likely source of signature failure.
    """
    iso = expires_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return nonce + iso.encode("utf-8") + device_pubkey


async def complete_login(
    email: str,
    device_pubkey: bytes,
    nonce: bytes,
    signature: bytes,
    session: AsyncSession,
    settings: Settings,
) -> LoginResult:
    user, device = await _resolve_user_and_device(session, email, device_pubkey)

    # Single-use enforcement: DELETE returning the row, atomic.
    deleted = (
        await session.execute(
            delete(AuthChallenge)
            .where(
                and_(
                    AuthChallenge.user_id == user.id,
                    AuthChallenge.device_id == device.id,
                    AuthChallenge.nonce == nonce,
                )
            )
            .returning(AuthChallenge.expires_at)
        )
    ).first()
    await session.commit()

    if deleted is None:
        # Unknown nonce, replayed nonce, or wrong device for this nonce.
        raise LoginFailed("challenge not found")

    expires_at: datetime = deleted[0]
    if expires_at < datetime.now(tz=UTC):
        raise LoginFailed("challenge expired")

    signing_input = _challenge_signing_input(nonce, expires_at, device_pubkey)
    if not verify_ed25519(device_pubkey, signing_input, signature):
        raise LoginFailed("signature does not verify")

    # Update last_seen_at on success.
    device.last_seen_at = datetime.now(tz=UTC)
    await session.commit()

    access_token, access_expires_at = issue_access_token(
        user.id, device.id, device_pubkey, settings
    )
    refresh_token = issue_refresh_token(settings)

    return LoginResult(
        user_id=user.id,
        device_id=device.id,
        access_token=access_token,
        refresh_token=refresh_token,
        access_token_expires_at=access_expires_at,
    )


def challenge_signing_input(nonce: bytes, expires_at: datetime, device_pubkey: bytes) -> bytes:
    """Public re-export of the signing-input rule so the client can
    compute the same bytes."""
    return _challenge_signing_input(nonce, expires_at, device_pubkey)
