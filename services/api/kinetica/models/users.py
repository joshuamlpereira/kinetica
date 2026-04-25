"""Auth root tables: users and user_devices.

The `users` row is the cryptographic anchor: it carries the X25519 sealing
public key, the per-user Argon2id salt, and the master key wrapped under
the passphrase-derived KEK. Per-device Ed25519 keys live in `user_devices`.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
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


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    email_hash: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    encryption_pubkey: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    password_salt: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    wrapped_master_key: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    encrypted_profile: Mapped[bytes | None] = mapped_column(BYTEA, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    deletion_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint("email_hash", name="uq_users_email_hash"),
        CheckConstraint(
            "length(encryption_pubkey) = 32",
            name="encryption_pubkey_len",
        ),
        CheckConstraint(
            "length(password_salt) = 16",
            name="password_salt_len",
        ),
        CheckConstraint(
            "length(wrapped_master_key) >= 72",
            name="wrapped_master_key_min_len",
        ),
    )


class UserDevice(Base):
    __tablename__ = "user_devices"

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
    device_pubkey: Mapped[bytes] = mapped_column(BYTEA, nullable=False)
    device_name: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    bootstrap_pending: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "device_pubkey",
            name="uq_user_devices_user_id_device_pubkey",
        ),
        CheckConstraint(
            "length(device_pubkey) = 32",
            name="device_pubkey_len",
        ),
        Index(
            "idx_user_devices_user",
            "user_id",
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )
