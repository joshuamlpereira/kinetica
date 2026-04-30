"""Service-layer registration logic per docs/SECURITY.md §5.3.1.

Compose order, all in one transaction:

1. Verify `bootstrap_signature` against the device pubkey, over the
   SHA-256 of the canonical-JSON form of the rest of the body — this
   is local, no DB. We intentionally fail garbage requests before
   touching Postgres so an attacker without a valid signature cannot
   probe DB / pepper state by timing the response. Client-side
   counterpart at `apps/mobile/src/auth/canonical.ts`.
2. Resolve the application primary pepper from `application_pepper`.
   If no row is present, registration is impossible — it's an
   operational error (the table is seeded out-of-band before traffic
   is allowed).
3. Compute `email_hash` under the primary pepper.
4. Insert the `users` row (rejecting duplicates via the unique
   constraint on `email_hash`).
5. Insert the corresponding `user_devices` row.
6. Issue an access JWT (DPoP-bound to the device pubkey) and an
   opaque refresh token.

Any constraint violation (duplicate email, byte-length CHECK miss)
surfaces as a 409 / 422 to the caller.

KNOWN GAP — duplicate-email response timing. The 409 path skips the
device-row insert + token issuance and so finishes faster than a
fresh-email 201 with the same valid signature. A timing-capable
attacker who can sign a request can use this to probe email-existence.
Tracked as a follow-up — see TODO_FOLLOWUPS.md "Constant-time
registration response". Not blocking on the login flow.
"""

from __future__ import annotations

import base64
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from kinetica.auth.canonical import canonical_sha256
from kinetica.auth.tokens import issue_access_token, issue_refresh_token
from kinetica.config import Settings
from kinetica.crypto import compute_email_hash, verify_ed25519
from kinetica.models import ApplicationPepper, User, UserDevice
from kinetica.schemas.auth import RegisterRequest


class RegistrationError(Exception):
    """Base class for registration failures the route maps to HTTP."""


class PepperUnavailable(RegistrationError):
    pass


class InvalidBootstrapSignature(RegistrationError):
    pass


class EmailAlreadyRegistered(RegistrationError):
    pass


@dataclass(frozen=True)
class RegistrationResult:
    user_id: uuid.UUID
    device_id: uuid.UUID
    access_token: str
    refresh_token: str
    access_token_expires_at: datetime


async def register_user(
    request: RegisterRequest,
    session: AsyncSession,
    settings: Settings,
) -> RegistrationResult:
    # 1. Local-only check first — never touch the DB on a request whose
    #    bootstrap signature doesn't verify against the supplied device
    #    pubkey. This means an attacker without a valid signature cannot
    #    probe pepper state, schema state, or DB connectivity by timing.
    if not _verify_bootstrap_signature(request):
        raise InvalidBootstrapSignature("bootstrap_signature does not verify")

    # 2. Pepper read (DB lookup #1).
    primary_pepper = await _read_primary_pepper(session)

    # 3. Compute the lookup key.
    email_hash = compute_email_hash(request.email, primary_pepper)

    user = User(
        email_hash=email_hash,
        encryption_pubkey=base64.b64decode(request.encryption_pubkey),
        password_salt=base64.b64decode(request.password_salt),
        wrapped_master_key=base64.b64decode(request.wrapped_master_key),
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as e:
        await session.rollback()
        raise EmailAlreadyRegistered("email already registered") from e

    device = UserDevice(
        user_id=user.id,
        device_pubkey=base64.b64decode(request.device_pubkey),
        device_name=request.device_name,
    )
    session.add(device)
    await session.flush()

    await session.commit()

    access_token, expires_at = issue_access_token(
        user.id,
        device.id,
        base64.b64decode(request.device_pubkey),
        settings,
    )
    refresh_token = issue_refresh_token(settings)

    return RegistrationResult(
        user_id=user.id,
        device_id=device.id,
        access_token=access_token,
        refresh_token=refresh_token,
        access_token_expires_at=expires_at,
    )


async def _read_primary_pepper(session: AsyncSession) -> bytes:
    row = (
        await session.execute(select(ApplicationPepper).where(ApplicationPepper.slot == "primary"))
    ).scalar_one_or_none()
    if row is None:
        raise PepperUnavailable("no primary pepper present in application_pepper")
    return row.pepper


def _verify_bootstrap_signature(request: RegisterRequest) -> bool:
    body_without_sig = {
        "email": request.email,
        "password_salt": request.password_salt,
        "encryption_pubkey": request.encryption_pubkey,
        "wrapped_master_key": request.wrapped_master_key,
        "device_pubkey": request.device_pubkey,
        "device_name": request.device_name,
    }
    digest = canonical_sha256(body_without_sig)
    return verify_ed25519(
        base64.b64decode(request.device_pubkey),
        digest,
        base64.b64decode(request.bootstrap_signature),
    )
