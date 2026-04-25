# Kinetica

iOS-first human performance and fitness tracking app. Local-first, with a
credential-blind sync backend for biometric data.

## Layout

```
apps/mobile/        React Native (Expo bare), TypeScript strict
services/api/       FastAPI + SQLAlchemy 2.0 async + Alembic
infra/              docker-compose, Postgres init
docs/               Architecture, security, API, schema
```

## Phase 1 quick start

Backend:

```
cd infra && docker compose up -d postgres
cd ../services/api && uv sync
uv run alembic upgrade head
uv run uvicorn kinetica.main:app --reload
```

Mobile (after SCHEMA.sql lands and migrations are generated):

```
pnpm install
pnpm --filter mobile prebuild
cd apps/mobile/ios && pod install && cd -
pnpm --filter mobile ios
```

The first iOS launch shows the HealthKit authorization sheet for sleep, steps,
and active energy (read-only).

## Tech stack (locked)

See `docs/ARCHITECTURE.md`. Do not substitute libraries — every dependency is
justified in `DEPENDENCIES.md` or written from scratch.
