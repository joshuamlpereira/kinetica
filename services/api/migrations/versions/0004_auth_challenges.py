"""auth_challenges

Single-use challenge nonces for the Ed25519 challenge-response login
flow per docs/SECURITY.md §5.3.2. The server issues a 32-byte nonce
on POST /auth/challenge, the client signs it on the device, and the
matching row is deleted on POST /auth/login. Replay attempts fail
with "challenge not found" — there is no audit row by design; if
forensics is needed later, switch from DELETE-on-consume to a
consumed_at column and a sweep job.

Revision ID: 0004_auth_challenges
Revises: 0003_phase2_auth
Create Date: 2026-04-29 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_auth_challenges"
down_revision: str | None = "0003_phase2_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "auth_challenges",
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
            "device_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_devices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "nonce",
            postgresql.BYTEA(),
            sa.CheckConstraint("length(nonce) = 32", name="nonce_len"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("user_id", "nonce", name="uq_auth_challenges_user_id_nonce"),
    )
    op.create_index(
        "idx_auth_challenges_expires",
        "auth_challenges",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_auth_challenges_expires", table_name="auth_challenges")
    op.drop_table("auth_challenges")
