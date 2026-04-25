"""Biometric tables: ambient_daily, sleep_sessions, readiness_scores.

These hold plaintext per the Phase 1 schema. Per docs/SECURITY.md §2 the
*values* in these rows are reclassified to Tier S in Phase 4 — when that
phase lands, the metric columns are replaced with `payload_ciphertext`
columns and the routing metadata stays plaintext for sync indexing. Until
then the rows match the Phase 1 shape exactly.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from kinetica.models.base import Base


class AmbientDaily(Base):
    __tablename__ = "ambient_daily"

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
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    step_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_kcal: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    distance_m: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
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
            "user_id",
            "log_date",
            "source",
            name="uq_ambient_daily_user_id_log_date_source",
        ),
    )


class SleepSession(Base):
    __tablename__ = "sleep_sessions"

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
    in_bed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    asleep_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    awake_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sleep_date: Mapped[date] = mapped_column(Date, nullable=False)
    latency_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_sleep_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    interruptions_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    rem_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deep_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    light_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    awake_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
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
            "idx_sleep_user_date",
            "user_id",
            text("sleep_date DESC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class ReadinessScore(Base):
    __tablename__ = "readiness_scores"

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
    score_date: Mapped[date] = mapped_column(Date, nullable=False)
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    sleep_component: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    load_component: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    nutrition_component: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    algorithm_version: Mapped[str] = mapped_column(Text, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
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
            "user_id",
            "score_date",
            name="uq_readiness_scores_user_id_score_date",
        ),
        CheckConstraint("score BETWEEN 0 AND 100", name="score_range"),
    )
