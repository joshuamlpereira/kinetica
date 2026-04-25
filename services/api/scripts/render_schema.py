#!/usr/bin/env python3
"""Render docs/SCHEMA.sql from the SQLAlchemy models.

Models are the source of truth (see CONTRIBUTING.md). This script compiles
`Base.metadata` directly into Postgres DDL so the resulting file shows the
*final* schema state, not the cumulative migration history. ENUM type
definitions and the `pgcrypto` extension are emitted explicitly because
they live outside `Table.create()`'s normal DDL path.

Usage:
    cd services/api
    uv run python scripts/render_schema.py            # write to stdout
    uv run python scripts/render_schema.py --check    # exit 1 if drift
"""

from __future__ import annotations

import argparse
import difflib
import sys
from pathlib import Path

from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.schema import CreateIndex, CreateTable

from kinetica.models import Base

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO_ROOT / "docs" / "SCHEMA.sql"
HEADER = """-- ============================================================
-- KINETICA — Core Schema (regenerated artifact)
--
-- DO NOT EDIT BY HAND. This file is regenerated from the SQLAlchemy
-- models in services/api/kinetica/models/ via:
--
--     cd services/api
--     uv run python scripts/render_schema.py > docs/SCHEMA.sql
--
-- The CI `schema-doc-drift` gate diffs the regenerated output against this
-- committed file and fails if they disagree.
-- ============================================================
"""


def _collect_enums() -> dict[str, PgEnum]:
    """Walk the metadata and dedupe ENUM types by name."""
    found: dict[str, PgEnum] = {}
    for table in Base.metadata.sorted_tables:
        for column in table.columns:
            col_type = column.type
            if isinstance(col_type, PgEnum):
                # PgEnum.name is typed Optional[str] but every enum we declare names itself.
                found.setdefault(col_type.name, col_type)  # type: ignore[arg-type]
            elif isinstance(col_type, ARRAY) and isinstance(col_type.item_type, PgEnum):
                # Same Optional[str] gap on the array's item_type.
                found.setdefault(col_type.item_type.name, col_type.item_type)  # type: ignore[arg-type]
    return found


def render() -> str:
    # SQLAlchemy stubs don't annotate the dialect() factory; the return is a real PGDialect.
    dialect = postgresql.dialect()  # type: ignore[no-untyped-call]
    out: list[str] = [HEADER, ""]

    out.append('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')
    out.append("")

    for name, enum_t in _collect_enums().items():
        values = ", ".join(f"'{v}'" for v in enum_t.enums)
        out.append(f"CREATE TYPE {name} AS ENUM ({values});")
    out.append("")

    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=dialect)).strip()
        out.append(ddl + ";")
        out.append("")
        for idx in sorted(table.indexes, key=lambda i: i.name or ""):
            idx_ddl = str(CreateIndex(idx).compile(dialect=dialect)).strip()
            out.append(idx_ddl + ";")
        if table.indexes:
            out.append("")

    body = "\n".join(out).rstrip() + "\n"
    return body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if the rendered output differs from the committed file.",
    )
    args = parser.parse_args()

    rendered = render()

    if args.check:
        committed = SCHEMA_PATH.read_text() if SCHEMA_PATH.exists() else ""
        if rendered == committed:
            print(f"{SCHEMA_PATH.relative_to(REPO_ROOT)}: in sync with models.")
            return 0
        diff = difflib.unified_diff(
            committed.splitlines(keepends=True),
            rendered.splitlines(keepends=True),
            fromfile=f"a/{SCHEMA_PATH.relative_to(REPO_ROOT)}",
            tofile="b/<rendered>",
        )
        sys.stderr.write(
            f"ERROR: {SCHEMA_PATH.relative_to(REPO_ROOT)} is out of date.\n"
            f"Regenerate with:\n"
            f"    cd services/api && uv run python scripts/render_schema.py "
            f"> {SCHEMA_PATH.relative_to(REPO_ROOT)}\n\n"
        )
        sys.stderr.writelines(diff)
        return 1

    sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
