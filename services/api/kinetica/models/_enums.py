"""Postgres ENUM types reused across the schema.

Declared at module scope so a single Enum object backs every column that uses
it; that is what alembic autogenerate compares against the database.

`create_type=False` means SQLAlchemy will not emit `CREATE TYPE` when a table
referencing the enum is created via `Table.create()` — the migration is
responsible for the type's lifecycle. Autogen still detects new/removed
enum values regardless of this flag.
"""

from sqlalchemy.dialects import postgresql

muscle_group_enum = postgresql.ENUM(
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

movement_pattern_enum = postgresql.ENUM(
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

block_type_enum = postgresql.ENUM(
    "single",
    "superset",
    "giant",
    "circuit",
    name="block_type",
    create_type=False,
)

meal_slot_enum = postgresql.ENUM(
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "pre_workout",
    "post_workout",
    name="meal_slot",
    create_type=False,
)
