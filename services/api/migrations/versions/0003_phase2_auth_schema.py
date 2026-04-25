"""phase 2 auth schema

Implements docs/SECURITY.md §11.1. Adds the four new columns the auth
flow needs on the existing users table, and three new tables:

- user_devices: per-device Ed25519 public keys plus name and lifecycle
  metadata. Replaces the old users.auth_pubkey single-device column
  (dropped in 0002).
- application_pepper: dual-slot HMAC pepper for email_hash. Two rows
  ('primary', 'secondary') support rotation: writers fill primary,
  readers accept either for the rotation window.
- dpop_jti_seen: replay cache for DPoP `jti` values. A small Postgres
  table replaces a Redis dependency for Phase 2; revisit if scale
  forces it.

Byte-length CHECK constraints encode the cryptographic invariants
documented in docs/SECURITY.md §5.1: X25519 / Ed25519 public keys
are 32 bytes, the per-user password salt is 16 bytes, and the
wrapped master key is at least 72 bytes (24-byte XChaCha nonce +
≥32-byte plaintext + 16-byte Poly1305 tag).

Revision ID: 0003_phase2_auth
Revises: 0002_drop_auth_pubkey
Create Date: 2026-04-25 00:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_phase2_auth"
down_revision: str | None = "0002_drop_auth_pubkey"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ---------- users: new columns -----------------------------------------
    # Phase 1 left users with only email_hash + encrypted_profile. Phase 2
    # turns it into the auth root: the X25519 sealing key, the Argon2id
    # salt, the server-stored wrapped master key, and the deletion
    # tombstone the Phase 6 purge job will read.
    op.add_column(
        "users",
        sa.Column(
            "encryption_pubkey",
            postgresql.BYTEA(),
            sa.CheckConstraint(
                "length(encryption_pubkey) = 32",
                name="encryption_pubkey_len",
            ),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_salt",
            postgresql.BYTEA(),
            sa.CheckConstraint(
                "length(password_salt) = 16",
                name="password_salt_len",
            ),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "wrapped_master_key",
            postgresql.BYTEA(),
            sa.CheckConstraint(
                "length(wrapped_master_key) >= 72",
                name="wrapped_master_key_min_len",
            ),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ---------- user_devices -----------------------------------------------
    op.create_table(
        "user_devices",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "device_pubkey",
            postgresql.BYTEA(),
            sa.CheckConstraint(
                "length(device_pubkey) = 32",
                name="device_pubkey_len",
            ),
            nullable=False,
        ),
        sa.Column("device_name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "bootstrap_pending",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.UniqueConstraint(
            "user_id",
            "device_pubkey",
            name="uq_user_devices_user_id_device_pubkey",
        ),
    )
    op.create_index(
        "idx_user_devices_user",
        "user_devices",
        ["user_id"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )

    # ---------- application_pepper -----------------------------------------
    op.create_table(
        "application_pepper",
        sa.Column(
            "slot",
            sa.Text(),
            sa.CheckConstraint(
                "slot IN ('primary', 'secondary')",
                name="slot_values",
            ),
            primary_key=True,
        ),
        sa.Column(
            "pepper",
            postgresql.BYTEA(),
            sa.CheckConstraint(
                "length(pepper) = 32",
                name="pepper_len",
            ),
            nullable=False,
        ),
        sa.Column(
            "rotated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    # ---------- dpop_jti_seen ----------------------------------------------
    # The replay cache. A background sweep deletes rows where
    # expires_at < NOW(); the index on expires_at supports it.
    op.create_table(
        "dpop_jti_seen",
        sa.Column("jti", sa.Text(), primary_key=True),
        sa.Column(
            "seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "idx_dpop_jti_expires",
        "dpop_jti_seen",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_dpop_jti_expires", table_name="dpop_jti_seen")
    op.drop_table("dpop_jti_seen")
    op.drop_table("application_pepper")
    op.drop_index("idx_user_devices_user", table_name="user_devices")
    op.drop_table("user_devices")
    op.drop_column("users", "deletion_requested_at")
    op.drop_column("users", "wrapped_master_key")
    op.drop_column("users", "password_salt")
    op.drop_column("users", "encryption_pubkey")
