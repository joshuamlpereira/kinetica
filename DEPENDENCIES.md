# Dependency justifications

Every external dependency in this repository requires a one-line justification
here. If you can't justify it, write the code yourself.

## Mobile (`apps/mobile`)

- `expo` — required by Expo bare workflow tooling (prebuild, config plugins).
- `react`, `react-native` — application framework, locked by spec.
- `@react-navigation/native`, `@react-navigation/native-stack` — navigation, locked by spec.
- `react-native-screens`, `react-native-safe-area-context` — required peers of React Navigation on iOS.
- `zustand` — state management, locked by spec.
- `@nozbe/watermelondb` — local DB, locked by spec.
- `react-native-libsodium` — libsodium bindings, locked by spec.
- `react-native-keychain` — Keychain access for master key escrow and tokens.
- `zxcvbn` — passphrase strength meter (Phase 2).
- `typescript`, `@types/react`, `@types/react-native` — TS toolchain.
- `eslint`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks` — linting.

## Backend (`services/api`)

- `fastapi` — web framework, locked by spec.
- `uvicorn[standard]` — ASGI server.
- `sqlalchemy[asyncio]` — ORM, locked by spec.
- `asyncpg` — Postgres async driver, paired with SQLAlchemy async.
- `alembic` — migrations, locked by spec.
- `pydantic`, `pydantic-settings` — schemas + config, locked by spec (Pydantic v2).
- `pynacl` — libsodium bindings, locked by spec.
- `argon2-cffi` — Argon2id KDF, locked by spec.
- `structlog` — structured logging.
- `pyjwt[crypto]` — JWT for access/refresh tokens (Phase 2).
- `pytest`, `pytest-asyncio`, `httpx` — test toolchain.
- `ruff`, `mypy` — lint + type-check.
