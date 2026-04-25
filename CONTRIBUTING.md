# Contributing

This file collects the conventions that aren't obvious from reading the code:
how the schema flows from models to migrations to docs, where the project
deviates from its own patterns on purpose, and the small set of guard rails
CI enforces.

## Schema workflow

**Models are the source of truth.** Every schema change starts in
`services/api/kinetica/models/`. From there:

1. **Edit the SQLAlchemy 2.0 model.** Use `Mapped[T]` typing throughout;
   no untyped `Column(...)`. Constraints and indexes go in
   `__table_args__`. CHECK / UNIQUE constraint names use the unprefixed
   suffix only — the naming convention in `models/base.py` adds the
   `ck_<table>_` / `uq_<table>_` prefix automatically.

2. **Generate the migration.**
   ```
   cd services/api
   uv run alembic revision --autogenerate -m "<short summary>"
   ```
   Inspect the generated file. Autogen handles the common cases but a few
   constructs need hand-editing — see "What autogen can't express" below.

3. **Regenerate `docs/SCHEMA.sql`.**
   ```
   uv run python scripts/render_schema.py > ../../docs/SCHEMA.sql
   ```
   This produces the final-state DDL by compiling `Base.metadata` directly,
   not by replaying migration history. Commit the regenerated file in the
   same PR as the model change.

4. **Verify both gates locally.**
   ```
   uv run alembic upgrade head                                  # apply
   uv run alembic check                                         # gate 1
   uv run python scripts/render_schema.py --check               # gate 2
   ```
   Both must report clean before pushing.

CI runs both gates in the `schema drift (models vs DB, models vs docs)`
job. Gate 1 catches "you forgot to write a migration"; gate 2 catches
"you forgot to regenerate the docs."

### What autogen can't express

These are the constructs Alembic's `--autogenerate` either drops or
misrenders. When you touch one of them, regenerate carefully and review
the migration by hand.

- **`sa.Computed(..., persisted=True)`** (Postgres `GENERATED ALWAYS AS
  ... STORED`). Autogen will produce a `Computed` column, but only if
  the model's expression matches the form Postgres normalizes to. Any
  textual mismatch shows up as drift. The canonical example is
  `exercise_sets.tut_seconds` — see the docstring at the top of
  `models/workouts.py` and the inline comment on the column for the
  preserved form.
- **Partial indexes** (`postgresql_where=text("...")`). Autogen handles
  these, but the predicate must be reflected back from the DB exactly,
  so wrap any column reference in the predicate the way Postgres does
  (`deleted_at IS NULL` is fine; case-insensitive function names may
  not be).
- **Cross-revision DROP/ADD column patterns.** When a column is
  dropped in one revision and a new one added in another (the Phase 2
  drop of `users.auth_pubkey` is the canonical case), the drop and the
  add live in separate revisions on purpose. Don't merge them — the
  separation lets a downgrade roll back the new state without
  resurrecting the discarded one.
- **CHECK on byte length for cryptographic columns** (e.g.
  `length(encryption_pubkey) = 32`). Autogen captures these correctly,
  but if you add a new key column without the CHECK, the CI gate will
  not flag it. Cryptographic invariants belong at the schema layer —
  see `docs/SECURITY.md` §5.1 for the byte-length table.

### Tables that don't follow the domain convention

Phase 1 domain tables all carry the
`created_at` / `updated_at` / `deleted_at` triad. Phase 2 introduced
three tables that deliberately deviate:

| Table | Convention | Reason |
|-------|-----------|--------|
| `user_devices` | `created_at`, `last_seen_at`, `revoked_at` (no `updated_at`, no `deleted_at`) | Device revocation is a security-relevant lifecycle event distinct from soft delete; queries for revoked devices need to find them, not have them filtered out by `WHERE deleted_at IS NULL`. |
| `application_pepper` | `rotated_at` only (no `created_at`, no `updated_at`, no `deleted_at`) | A 2-row singleton; `rotated_at` is the only meaningful timestamp. |
| `dpop_jti_seen` | `seen_at`, `expires_at` (no triad) | Ephemeral replay cache, not domain data; rows are deleted on a TTL sweep, not soft-deleted. |

When adding new tables: domain tables get the triad. Auth and
operational tables follow the pattern that fits their lifecycle and
add a row to the table above.

## Cryptographic code

See `docs/SECURITY.md`. The summary applies to every PR that touches
auth, sealing, or key handling:

- Constant-time comparisons for secret material.
- No `try/except: pass` in crypto paths — failures must propagate.
- No logging of variables named `password`, `passphrase`, `key`,
  `secret`, `token`, `nonce`, `auth`, `pubkey`, `wrapped_master_key`.
- Migrations that drop encrypted columns require a one-page
  rationale committed alongside.

## Commits

Conventional commits, scoped by phase: `<type>(phase-N): <summary>`.
Group commits logically rather than dropping one giant change. The
typical Phase 2 PR has a separate commit for each of: schema model
changes, the migration, regenerated `docs/SCHEMA.sql`, and any
operational scripts.
