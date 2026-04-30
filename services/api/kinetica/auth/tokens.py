"""Access-token issuance, JWK thumbprint, and opaque refresh tokens.

Access tokens are HS256 JWTs with a `cnf.jkt` claim per RFC 9449 (DPoP).
`jkt` is the JWK Thumbprint (RFC 7638) of the device's Ed25519 public
key. The DPoP middleware reads the JWK out of the proof header,
recomputes its thumbprint, and compares — so the access token alone
never carries the full pubkey on the wire.

Refresh tokens are 256-bit opaque random strings (URL-safe base64,
unpadded). The server-side rotation / family-revocation table that
makes them one-shot lands in the refresh-handler turn — for now
registration / login emit them without persisting state. Clients
store them; they will be tracked once the table exists. Documented
gap in TODO_FOLLOWUPS.md.
"""

from __future__ import annotations

import base64
import hashlib
import json
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


def jwk_thumbprint(jwk: dict[str, str]) -> str:
    """RFC 7638 JWK Thumbprint of an OKP/Ed25519 JWK.

    Required members in canonical order (per RFC 8037 §2): `crv`, `kty`,
    `x`. Hash with SHA-256, encode base64url-no-padding. The resulting
    string is what goes in `cnf.jkt`.
    """
    canonical = json.dumps(
        {"crv": jwk["crv"], "kty": jwk["kty"], "x": jwk["x"]},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return _b64url_nopad(hashlib.sha256(canonical).digest())


def device_pubkey_thumbprint(pubkey: bytes) -> str:
    return jwk_thumbprint(device_pubkey_to_jwk(pubkey))


def issue_access_token(
    user_id: uuid.UUID,
    device_id: uuid.UUID,
    device_pubkey: bytes,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> tuple[str, datetime]:
    """Sign an access JWT bound to the device's Ed25519 public key.

    Returns (token, expires_at). The `cnf.jkt` claim carries the JWK
    Thumbprint of the device pubkey so the DPoP middleware can verify
    that the proof header carries a key that hashes to the same value.
    """
    issued_at = now or datetime.now(tz=UTC)
    expires_at = issued_at + timedelta(seconds=settings.access_token_ttl_seconds)
    claims = {
        "sub": str(user_id),
        "did": str(device_id),
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "cnf": {"jkt": device_pubkey_thumbprint(device_pubkey)},
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
