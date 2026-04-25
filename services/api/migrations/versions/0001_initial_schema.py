"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-24 23:35:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


MUSCLE_GROUP = postgresql.ENUM(
    "chest",
    "back",
    "quads",
    "hamstrings",
    "glutes",
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "calves",
    "core",
    "traps",
    "lats",
    name="muscle_group",
    create_type=False,
)
MOVEMENT_PATTERN = postgresql.ENUM(
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "squat",
    "hinge",
    "lunge",
    "carry",
    "rotation",
    "isolation",
    name="movement_pattern",
    create_type=False,
)
BLOCK_TYPE = postgresql.ENUM(
    "single",
    "superset",
    "giant",
    "circuit",
    name="block_type",
    create_type=False,
)
MEAL_SLOT = postgresql.ENUM(
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "pre_workout",
    "post_workout",
    name="meal_slot",
    create_type=False,
)


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    bind = op.get_bind()
    MUSCLE_GROUP.create(bind, checkfirst=True)
    MOVEMENT_PATTERN.create(bind, checkfirst=True)
    BLOCK_TYPE.create(bind, checkfirst=True)
    MEAL_SLOT.create(bind, checkfirst=True)

    # ---------- users -------------------------------------------------------
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email_hash", postgresql.BYTEA(), nullable=False),
        sa.Column("auth_pubkey", postgresql.BYTEA(), nullable=False),
        sa.Column("encrypted_profile", postgresql.BYTEA(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email_hash", name="uq_users_email_hash"),
    )

    # ---------- exercises ---------------------------------------------------
    op.create_table(
        "exercises",
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
            nullable=True,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("primary_muscle", MUSCLE_GROUP, nullable=False),
        sa.Column(
            "secondary_muscles",
            postgresql.ARRAY(MUSCLE_GROUP),
            nullable=False,
            server_default=sa.text("'{}'::muscle_group[]"),
        ),
        sa.Column("pattern", MOVEMENT_PATTERN, nullable=False),
        sa.Column(
            "is_unilateral",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_bodyweight",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_exercises_user",
        "exercises",
        ["user_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ---------- workout_sessions -------------------------------------------
    op.create_table(
        "workout_sessions",
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
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("notes_encrypted", postgresql.BYTEA(), nullable=True),
        sa.Column(
            "perceived_exertion",
            sa.SmallInteger(),
            sa.CheckConstraint(
                "perceived_exertion BETWEEN 1 AND 10",
                name="perceived_exertion_range",
            ),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_sessions_user_date",
        "workout_sessions",
        ["user_id", sa.text("started_at DESC")],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ---------- exercise_blocks --------------------------------------------
    op.create_table(
        "exercise_blocks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workout_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("block_type", BLOCK_TYPE, nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("rest_seconds_between_rounds", sa.SmallInteger(), nullable=True),
        sa.Column("target_rounds", sa.SmallInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "session_id",
            "position",
            name="uq_exercise_blocks_session_id_position",
        ),
    )

    # ---------- block_exercises --------------------------------------------
    op.create_table(
        "block_exercises",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "block_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("exercise_blocks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("exercises.id"),
            nullable=False,
        ),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "block_id",
            "position",
            name="uq_block_exercises_block_id_position",
        ),
    )

    # ---------- exercise_sets ----------------------------------------------
    # tut_seconds is a STORED generated column; sa.Computed(..., persisted=True)
    # emits `GENERATED ALWAYS AS (...) STORED`. The expression matches
    # docs/SCHEMA.sql exactly so the parity test against the TS implementation
    # has a single source of truth.
    op.create_table(
        "exercise_sets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "block_exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("block_exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("round_number", sa.SmallInteger(), nullable=False),
        sa.Column(
            "drop_index",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("weight_kg", sa.Numeric(6, 2), nullable=True),
        sa.Column("reps", sa.SmallInteger(), nullable=False),
        sa.Column("eccentric_ds", sa.SmallInteger(), nullable=True),
        sa.Column("isometric_bottom_ds", sa.SmallInteger(), nullable=True),
        sa.Column("concentric_ds", sa.SmallInteger(), nullable=True),
        sa.Column("isometric_top_ds", sa.SmallInteger(), nullable=True),
        sa.Column(
            "tut_seconds",
            sa.Numeric(7, 2),
            sa.Computed(
                "(COALESCE(eccentric_ds, 0)"
                " + COALESCE(isometric_bottom_ds, 0)"
                " + COALESCE(concentric_ds, 0)"
                " + COALESCE(isometric_top_ds, 0))::NUMERIC * reps / 10.0",
                persisted=True,
            ),
        ),
        sa.Column(
            "rpe",
            sa.Numeric(3, 1),
            sa.CheckConstraint(
                "rpe BETWEEN 1.0 AND 10.0",
                name="rpe_range",
            ),
            nullable=True,
        ),
        sa.Column(
            "rir",
            sa.SmallInteger(),
            sa.CheckConstraint(
                "rir BETWEEN 0 AND 10",
                name="rir_range",
            ),
            nullable=True,
        ),
        sa.Column("rest_after_seconds", sa.SmallInteger(), nullable=True),
        sa.Column(
            "is_warmup",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_failure",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "block_exercise_id",
            "round_number",
            "drop_index",
            name="uq_exercise_sets_block_exercise_id_round_number_drop_index",
        ),
    )
    op.create_index(
        "idx_sets_block_exercise",
        "exercise_sets",
        ["block_exercise_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ---------- foods -------------------------------------------------------
    op.create_table(
        "foods",
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
            nullable=True,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("brand", sa.Text(), nullable=True),
        sa.Column("serving_grams", sa.Numeric(7, 2), nullable=False),
        sa.Column("kcal_per_serving", sa.Numeric(7, 2), nullable=False),
        sa.Column("protein_g", sa.Numeric(6, 2), nullable=False),
        sa.Column("carbs_g", sa.Numeric(6, 2), nullable=False),
        sa.Column("fat_g", sa.Numeric(6, 2), nullable=False),
        sa.Column("fiber_g", sa.Numeric(6, 2), nullable=True),
        sa.Column("barcode", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_foods_barcode",
        "foods",
        ["barcode"],
        postgresql_where=sa.text("barcode IS NOT NULL"),
    )
    op.create_index("idx_foods_user_name", "foods", ["user_id", "name"])

    # ---------- nutrition_logs ---------------------------------------------
    op.create_table(
        "nutrition_logs",
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
            "food_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("foods.id"),
            nullable=False,
        ),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("meal_slot", MEAL_SLOT, nullable=True),
        sa.Column(
            "servings",
            sa.Numeric(5, 2),
            nullable=False,
            server_default=sa.text("1.0"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_nutrition_user_date",
        "nutrition_logs",
        ["user_id", "log_date"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ---------- nutrition_targets ------------------------------------------
    op.create_table(
        "nutrition_targets",
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
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("kcal_target", sa.SmallInteger(), nullable=True),
        sa.Column("protein_g_target", sa.SmallInteger(), nullable=False),
        sa.Column("carbs_g_target", sa.SmallInteger(), nullable=True),
        sa.Column("fat_g_target", sa.SmallInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "user_id",
            "effective_from",
            name="uq_nutrition_targets_user_id_effective_from",
        ),
    )

    # ---------- ambient_daily ----------------------------------------------
    op.create_table(
        "ambient_daily",
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
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("step_count", sa.Integer(), nullable=True),
        sa.Column("active_kcal", sa.Numeric(7, 2), nullable=True),
        sa.Column("distance_m", sa.Numeric(8, 2), nullable=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column(
            "last_synced_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "user_id",
            "log_date",
            "source",
            name="uq_ambient_daily_user_id_log_date_source",
        ),
    )

    # ---------- sleep_sessions ---------------------------------------------
    op.create_table(
        "sleep_sessions",
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
        sa.Column("in_bed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("asleep_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("awake_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sleep_date", sa.Date(), nullable=False),
        sa.Column("latency_seconds", sa.Integer(), nullable=True),
        sa.Column("total_sleep_seconds", sa.Integer(), nullable=False),
        sa.Column("interruptions_count", sa.SmallInteger(), nullable=True),
        sa.Column("rem_seconds", sa.Integer(), nullable=True),
        sa.Column("deep_seconds", sa.Integer(), nullable=True),
        sa.Column("light_seconds", sa.Integer(), nullable=True),
        sa.Column("awake_seconds", sa.Integer(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_sleep_user_date",
        "sleep_sessions",
        ["user_id", sa.text("sleep_date DESC")],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ---------- readiness_scores -------------------------------------------
    op.create_table(
        "readiness_scores",
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
        sa.Column("score_date", sa.Date(), nullable=False),
        sa.Column(
            "score",
            sa.SmallInteger(),
            sa.CheckConstraint(
                "score BETWEEN 0 AND 100",
                name="score_range",
            ),
            nullable=False,
        ),
        sa.Column("sleep_component", sa.SmallInteger(), nullable=True),
        sa.Column("load_component", sa.SmallInteger(), nullable=True),
        sa.Column("nutrition_component", sa.SmallInteger(), nullable=True),
        sa.Column("algorithm_version", sa.Text(), nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "user_id",
            "score_date",
            name="uq_readiness_scores_user_id_score_date",
        ),
    )

    # ---------- health_provider_links --------------------------------------
    op.create_table(
        "health_provider_links",
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
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column(
            "granted_scopes",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_anchor", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "user_id",
            "provider",
            name="uq_health_provider_links_user_id_provider",
        ),
    )


def downgrade() -> None:
    op.drop_table("health_provider_links")
    op.drop_table("readiness_scores")
    op.drop_index("idx_sleep_user_date", table_name="sleep_sessions")
    op.drop_table("sleep_sessions")
    op.drop_table("ambient_daily")
    op.drop_table("nutrition_targets")
    op.drop_index("idx_nutrition_user_date", table_name="nutrition_logs")
    op.drop_table("nutrition_logs")
    op.drop_index("idx_foods_user_name", table_name="foods")
    op.drop_index("idx_foods_barcode", table_name="foods")
    op.drop_table("foods")
    op.drop_index("idx_sets_block_exercise", table_name="exercise_sets")
    op.drop_table("exercise_sets")
    op.drop_table("block_exercises")
    op.drop_table("exercise_blocks")
    op.drop_index("idx_sessions_user_date", table_name="workout_sessions")
    op.drop_table("workout_sessions")
    op.drop_index("idx_exercises_user", table_name="exercises")
    op.drop_table("exercises")
    op.drop_table("users")

    bind = op.get_bind()
    MEAL_SLOT.drop(bind, checkfirst=True)
    BLOCK_TYPE.drop(bind, checkfirst=True)
    MOVEMENT_PATTERN.drop(bind, checkfirst=True)
    MUSCLE_GROUP.drop(bind, checkfirst=True)
