"""Pydantic models for the auth surface.

The base64 byte fields are validated for length here so the route can
trust the cryptographic invariants documented in docs/SECURITY.md §5.1
(X25519 / Ed25519 pubkeys = 32 bytes, password salt = 16 bytes,
wrapped master key ≥ 72 bytes).
"""

from __future__ import annotations

import base64
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _decode_b64(value: str) -> bytes:
    # Standard base64 (with padding) — matches the client-side `btoa`
    # output. URL-safe variants are rejected here so encoding mismatches
    # surface as 422 rather than as cryptic signature failures.
    if not isinstance(value, str):
        raise ValueError("expected base64 string")
    try:
        return base64.b64decode(value, validate=True)
    except Exception as e:
        raise ValueError(f"invalid base64: {e}") from e


def _validate_b64_exact_length(value: str, expected: int) -> str:
    decoded = _decode_b64(value)
    if len(decoded) != expected:
        raise ValueError(f"expected {expected} bytes, got {len(decoded)}")
    return value


class RegisterRequest(BaseModel):
    """The body of POST /auth/register, byte fields as standard base64.

    Field names and order are documented in docs/SECURITY.md §5.3.1 and
    are part of the canonical-JSON signing contract — do not rename.
    """

    model_config = ConfigDict(str_strip_whitespace=False)

    email: EmailStr
    password_salt: str
    encryption_pubkey: str
    wrapped_master_key: str
    device_pubkey: str
    device_name: Annotated[str, Field(min_length=1, max_length=200)]
    bootstrap_signature: str

    @field_validator("password_salt")
    @classmethod
    def _v_salt(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 16)

    @field_validator("encryption_pubkey")
    @classmethod
    def _v_enc(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 32)

    @field_validator("device_pubkey")
    @classmethod
    def _v_dev(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 32)

    @field_validator("bootstrap_signature")
    @classmethod
    def _v_sig(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 64)

    @field_validator("wrapped_master_key")
    @classmethod
    def _v_wrapped(cls, v: str) -> str:
        decoded = _decode_b64(v)
        if len(decoded) < 72:
            raise ValueError(f"wrapped_master_key must be >= 72 bytes, got {len(decoded)}")
        return v


class RegisterResponse(BaseModel):
    user_id: uuid.UUID
    device_id: uuid.UUID
    access_token: str
    refresh_token: str
    access_token_expires_at: datetime
    token_type: Literal["DPoP"] = "DPoP"  # noqa: S105 — token-type discriminator, not a secret


class ChallengeRequest(BaseModel):
    email: EmailStr
    device_pubkey: str

    @field_validator("device_pubkey")
    @classmethod
    def _v_dev(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 32)


class ChallengeResponse(BaseModel):
    nonce: str  # base64
    expires_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    device_pubkey: str
    nonce: str
    signature: str

    @field_validator("device_pubkey")
    @classmethod
    def _v_dev(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 32)

    @field_validator("nonce")
    @classmethod
    def _v_nonce(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 32)

    @field_validator("signature")
    @classmethod
    def _v_sig(cls, v: str) -> str:
        return _validate_b64_exact_length(v, 64)


class LoginResponse(BaseModel):
    user_id: uuid.UUID
    device_id: uuid.UUID
    access_token: str
    refresh_token: str
    access_token_expires_at: datetime
    token_type: Literal["DPoP"] = "DPoP"  # noqa: S105 — discriminator, not a secret
