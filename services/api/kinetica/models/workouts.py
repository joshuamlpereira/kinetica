"""Workout tables: exercises, sessions, blocks, block-exercises, sets.

The `exercise_sets.tut_seconds` column is a Postgres STORED generated column
mirrored client-side by `apps/mobile/src/db/tut.ts`. The expression below
uses the form Postgres normalizes to (with explicit ::integer / ::numeric
casts and left-associative parentheses) so `alembic check` does not flag
drift between the model and the reflected database column.

If you change the formula, you must update both this file and
`apps/mobile/src/db/tut.ts`, and the parity test must pass.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, BYTEA, UUID
from sqlalchemy.orm import Mapped, mapped_column

from kinetica.models._enums import (
    block_type_enum,
    movement_pattern_enum,
    muscle_group_enum,
)
from kinetica.models.base import Base

# Logical form (what this expression computes):
#
#     tut_seconds = (eccentric_ds + isometric_bottom_ds
#                  + concentric_ds + isometric_top_ds) * reps / 10
#
# NULL phases coalesce to 0; the divisor 10 converts deciseconds to seconds.
# The string below is the same formula in the form Postgres normalizes it
# to internally (left-associative parens, explicit ::integer / ::numeric
# casts) — that match is what keeps `alembic check` happy. Edit the
# expression and you must edit both forms together, plus apps/mobile/src/db/tut.ts.
TUT_SECONDS_EXPR = (
    "((((((COALESCE((eccentric_ds)::integer, 0) "
    "+ COALESCE((isometric_bottom_ds)::integer, 0)) "
    "+ COALESCE((concentric_ds)::integer, 0)) "
    "+ COALESCE((isometric_top_ds)::integer, 0)))::numeric "
    "* (reps)::numeric) / 10.0)"
)


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    primary_muscle: Mapped[str] = mapped_column(muscle_group_enum, nullable=False)
    secondary_muscles: Mapped[list[str]] = mapped_column(
        ARRAY(muscle_group_enum),
        nullable=False,
        server_default=text("'{}'::muscle_group[]"),
    )
    pattern: Mapped[str] = mapped_column(movement_pattern_enum, nullable=False)
    is_unilateral: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    is_bodyweight: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
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

    __table_args__ = (
        Index(
            "idx_exercises_user",
            "user_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

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
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_encrypted: Mapped[bytes | None] = mapped_column(BYTEA, nullable=True)
    perceived_exertion: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )
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

    __table_args__ = (
        CheckConstraint(
            "perceived_exertion BETWEEN 1 AND 10",
            name="perceived_exertion_range",
        ),
        Index(
            "idx_sessions_user_date",
            "user_id",
            text("started_at DESC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class ExerciseBlock(Base):
    __tablename__ = "exercise_blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workout_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    block_type: Mapped[str] = mapped_column(block_type_enum, nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rest_seconds_between_rounds: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )
    target_rounds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
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

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "position",
            name="uq_exercise_blocks_session_id_position",
        ),
    )


class BlockExercise(Base):
    __tablename__ = "block_exercises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    block_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercise_blocks.id", ondelete="CASCADE"),
        nullable=False,
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exercises.id"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
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

    __table_args__ = (
        UniqueConstraint(
            "block_id",
            "position",
            name="uq_block_exercises_block_id_position",
        ),
    )


class ExerciseSet(Base):
    __tablename__ = "exercise_sets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    block_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("block_exercises.id", ondelete="CASCADE"),
        nullable=False,
    )
    round_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    drop_index: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default=text("0"),
    )
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    reps: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    eccentric_ds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    isometric_bottom_ds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    concentric_ds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    isometric_top_ds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # tut_seconds is a STORED generated column. The expression below is the
    # form Postgres normalizes to — keep it byte-for-byte identical to the
    # current pg_get_expr() output, otherwise alembic check will flag drift.
    # See module docstring.
    tut_seconds: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 2),
        Computed(TUT_SECONDS_EXPR, persisted=True),
    )
    rpe: Mapped[Decimal | None] = mapped_column(Numeric(3, 1), nullable=True)
    rir: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    rest_after_seconds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_warmup: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    is_failure: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
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

    __table_args__ = (
        UniqueConstraint(
            "block_exercise_id",
            "round_number",
            "drop_index",
            name="uq_exercise_sets_block_exercise_id_round_number_drop_index",
        ),
        CheckConstraint("rpe BETWEEN 1.0 AND 10.0", name="rpe_range"),
        CheckConstraint("rir BETWEEN 0 AND 10", name="rir_range"),
        Index(
            "idx_sets_block_exercise",
            "block_exercise_id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
