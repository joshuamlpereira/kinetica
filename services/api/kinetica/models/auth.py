"""Operational auth tables: application_pepper and dpop_jti_seen.

These are not domain tables and do not follow the
created_at/updated_at/deleted_at convention used elsewhere — see
CONTRIBUTING.md ("Tables that don't follow the domain convention").
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Text, func
from sqlalchemy.dialects.postgresql import BYTEA
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
