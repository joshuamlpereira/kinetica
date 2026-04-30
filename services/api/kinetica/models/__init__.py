"""SQLAlchemy 2.0 models — the canonical schema source of truth.

`docs/SCHEMA.sql` is regenerated from these via `scripts/render_schema.py`.
Migrations are produced by `alembic revision --autogenerate` and hand-edited
where autogen cannot express the construct (see CONTRIBUTING.md).

Importing every model module here is what populates `Base.metadata` for
alembic — do not lazy-load.
"""

from kinetica.models.auth import ApplicationPepper, AuthChallenge, DpopJtiSeen
from kinetica.models.base import Base
from kinetica.models.biometrics import AmbientDaily, ReadinessScore, SleepSession
from kinetica.models.integrations import HealthProviderLink
from kinetica.models.nutrition import Food, NutritionLog, NutritionTarget
from kinetica.models.users import User, UserDevice
from kinetica.models.workouts import (
    BlockExercise,
    Exercise,
    ExerciseBlock,
    ExerciseSet,
    WorkoutSession,
)

__all__ = [
    "AmbientDaily",
    "ApplicationPepper",
    "AuthChallenge",
    "Base",
    "BlockExercise",
    "DpopJtiSeen",
    "Exercise",
    "ExerciseBlock",
    "ExerciseSet",
    "Food",
    "HealthProviderLink",
    "NutritionLog",
    "NutritionTarget",
    "ReadinessScore",
    "SleepSession",
    "User",
    "UserDevice",
    "WorkoutSession",
]
