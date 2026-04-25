# Architecture

## Principles

1. iOS-first. HealthKit only. No Android, no Health Connect.
2. Local-first. The app is fully functional offline; the server is a sync target.
3. Server is biometric-blind. HealthKit data is encrypted client-side to the
   user's X25519 public key and uploaded as ciphertext. Server stores ciphertext
   only and never holds the user's private key.
4. Workout and nutrition logs are stored plaintext server-side — they're
   structured and queryable, and biometrics are the sensitive surface.
5. iCloud Keychain escrow for the master key by default; opt-in zero-knowledge
   mode disables escrow.
6. No third-party analytics, no PII-shipping crash reporters, no ad SDKs.
7. SI units / minor units on disk; localize at the render boundary.

## Stack (locked)

- Mobile: React Native (Expo bare), TypeScript strict, Zustand, WatermelonDB,
  React Navigation. Native HealthKit bridge in Swift, written in-tree.
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2,
  uv. Postgres 15+.
- Crypto: libsodium on both ends (`react-native-libsodium`, `pynacl`).
  Argon2id for passphrase KDF (`argon2-cffi`).
- Auth: JWT (15min access, 30d one-shot rotating refresh), DPoP-bound
  (RFC 9449), Ed25519 device keypairs.

## Phase status

- Phase 1: Foundation. **In progress.**
- Phase 2: Auth and crypto.
- Phase 3: Kinematic Logger.
- Phase 4: HealthKit ingestion + Fuel.
- Phase 5: Recovery Engine + Dashboard.
- Phase 6: Sync, polish, hardening.
