"""drop users.auth_pubkey

Phase 1 declared a single users.auth_pubkey column. Phase 2 moves all
device authentication keys into a per-device user_devices table (see
docs/SECURITY.md §11.1), so the original column is now redundant.

Per the Phase 2 plan, this drop is a separate Alembic revision from the
Phase 2 column additions: dropping a column is destructive and cannot
be reversed without re-encoding the original keys, so it lives on its
own so the additions can be rolled back independently.

Revision ID: 0002_drop_auth_pubkey
Revises: 0001_initial
Create Date: 2026-04-25 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_drop_auth_pubkey"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("users", "auth_pubkey")


def downgrade() -> None:
    # Rebuild as nullable: the column was originally NOT NULL, but at the
    # time of any downgrade we have no way to repopulate the discarded
    # public keys, so re-creating it as NOT NULL would fail against any
    # existing rows. The downgrade is best-effort schema reversal.
    op.add_column(
        "users",
        sa.Column("auth_pubkey", postgresql.BYTEA(), nullable=True),
    )
