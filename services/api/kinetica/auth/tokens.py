"""Access-token issuance and opaque refresh-token generation.

Access tokens are HS256 JWTs with a `cnf.jwk` claim binding the token
to the device's Ed25519 public key per RFC 9449 (DPoP). The DPoP
verification middleware lands in the next phase-2 turn; this module
only issues. Verifiers will read `cnf.jwk` to enforce that the
incoming DPoP signature was made by the same key.

Refresh tokens are 256-bit opaque random strings (URL-safe base64,
unpadded). The server-side rotation / family-revocation table that
makes them one-shot lands in the refresh-handler turn — for now
registration / login emit them without persisting state. Clients
store them; they will be tracked once the table exists. Documented
gap, not a permanent design.
"""

from __future__ import annotations

import base64
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt

from kinetica.config import Settings


def _b64url_nopad(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def device_pubkey_to_jwk(pubkey: bytes) -> dict[str, str]:
    """Render an Ed25519 public key as a JWK per RFC 8037."""
    if len(pubkey) != 32:
        raise ValueError(f"Ed25519 pubkey must be 32 bytes, got {len(pubkey)}")
    return {
        "kty": "OKP",
        "crv": "Ed25519",
        "x": _b64url_nopad(pubkey),
    }


def issue_access_token(
    user_id: uuid.UUID,
    device_id: uuid.UUID,
    device_pubkey: bytes,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> tuple[str, datetime]:
    """Sign an access JWT bound to the device's Ed25519 public key.

    Returns (token, expires_at). The `cnf.jwk` claim carries the device
    pubkey so DPoP verification can confirm the same key signed the
    request's DPoP header.
    """
    issued_at = now or datetime.now(tz=UTC)
    expires_at = issued_at + timedelta(seconds=settings.access_token_ttl_seconds)
    claims = {
        "sub": str(user_id),
        "did": str(device_id),
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "cnf": {"jwk": device_pubkey_to_jwk(device_pubkey)},
    }
    encoded = jwt.encode(claims, settings.jwt_secret, algorithm="HS256")
    # PyJWT 2.x returns str; the typeshed stubs lag and still type it as
    # bytes. Normalize either case to str for the response body.
    token: str = encoded.decode("ascii") if isinstance(encoded, bytes) else encoded
    return token, expires_at


def issue_refresh_token(settings: Settings) -> str:
    """Generate an opaque refresh token (URL-safe base64, unpadded).

    The server-side tracking table that makes these one-shot lands in
    the refresh turn; for now this is a bare random string.
    """
    return _b64url_nopad(secrets.token_bytes(settings.refresh_token_bytes))
