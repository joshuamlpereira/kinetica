"""Operational auth tables: application_pepper, dpop_jti_seen,
auth_challenges.

These are not domain tables and do not follow the
created_at/updated_at/deleted_at convention used elsewhere — see
CONTRIBUTING.md ("Tables that don't follow the domain convention").
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import BYTEA, UUID
from sqlalchemy.orm import Mapped, mapped_column

from kinetica.models.base import Base


class ApplicationPepper(Base):
    """Dual-slot HMAC pepper for `email_hash`.

    Always exactly two rows ('primary', 'secondary'). Writers insert into
    `primary`; readers accept either during a rotation window. The CHECK
    constraint pins the byte length at 32 (HMAC-SHA-256 key size).
    """

    __tablename__ = "application_pepper"

    slot: Mapped[str] = mapped_column(Text, primary_key=True)
    pepper: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    rotated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "slot IN ('primary', 'secondary')",
            name="slot_values",
        ),
        CheckConstraint(
            "length(pepper) = 32",
            name="pepper_len",
        ),
    )


class DpopJtiSeen(Base):
    """Replay cache for DPoP `jti` values.

    Rows live for the access-token lifetime. A background sweep deletes rows
    where `expires_at < NOW()`; the index supports it.
    """

    __tablename__ = "dpop_jti_seen"

    jti: Mapped[str] = mapped_column(Text, primary_key=True)
    seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    __table_args__ = (Index("idx_dpop_jti_expires", "expires_at"),)


class AuthChallenge(Base):
    """Single-use challenge nonce for the Ed25519 challenge-response login.

    Issued by POST /auth/challenge, deleted on successful POST /auth/login.
    Replay attempts after a successful redemption hit "row not found" → 401.
    Expired-but-unused rows are swept by a background job (TTL on
    `expires_at`); the index supports the sweep.
    """

    __tablename__ = "auth_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_devices.id", ondelete="CASCADE"),
        nullable=False,
    )
    nonce: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "nonce", name="uq_auth_challenges_user_id_nonce"),
        CheckConstraint("length(nonce) = 32", name="nonce_len"),
        Index("idx_auth_challenges_expires", "expires_at"),
    )
