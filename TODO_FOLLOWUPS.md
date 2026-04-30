# Phase 2 follow-ups

Items surfaced during review that are NOT blockers for the current
turn but must be resolved before the named gate. Each entry has a
clear gate so we don't accumulate ambiguous "later" debt.

## Before any deploy tag

- **Refresh tokens are issued but not validatable.** `auth/tokens.py`
  emits opaque base64 strings on registration / login, but the
  server-side rotation + family-revocation table doesn't exist yet.
  Until the refresh-handler turn lands, do not tag a release as
  deployable; tokens are accepted but cannot be exchanged.

## Before public beta (Phase 6 audit)

- **Constant-time auth response.** Both /auth/register and the login
  endpoints have wall-time imbalances across response paths that can
  be probed for email/device existence:

  Registration — 409 (duplicate-email) skips the device insert + token
  issuance and is faster than 201 (success). An attacker who can sign
  a request times A (fresh) vs B (duplicate) and learns whether an
  email is already registered.

  Login — every failure path returns 401, but they take different
  amounts of time:
    - unknown email:        pepper-read + user-not-found (fastest)
    - unknown device:       pepper-read + user-found + device-not-found
    - revoked device:       pepper-read + user-found + device-revoked
    - bad signature:        full pipeline + DELETE + verify-fails
    - expired nonce:        full pipeline + DELETE + expiry check
    - replayed nonce:       pepper-read + user-found + DELETE-misses

  An attacker who can iterate emails times the response and learns
  which dimension failed.

  Mitigation options for both endpoints:
  1. After early-exit, perform equivalent dummy work (one fixed-cost
     SELECT + one fixed-cost INSERT + one fixed-cost token issuance,
     discarded) so every path lands within a tight window of the
     slowest (success) path.
  2. Add a sleep-to-floor: clamp every auth response to ≥ N ms where
     N is the 95th percentile of the slowest success path. Crude but
     resilient to future code changes that move the imbalance.

  We will likely combine both. Tracked here so it's not lost.

- **Healthz distinguishes pepper-not-seeded from generic unhealthy.**
  Right now `/healthz` returns `{"status": "ok"}` unconditionally.
  An operator deploying to a fresh cluster has no signal that the
  application_pepper table is empty until the first registration
  request returns 503. When the operational-readiness work lands,
  add a separate `/readyz` (or extend `/healthz`) that:
  - SELECTs `application_pepper` and reports `pepper_seeded: bool`
  - Returns 503 (not 200) if no primary pepper is present
  Distinct from liveness (`/healthz` continues to be a process
  smoke check).

- **Real-iPhone Argon2id re-pin.** `apps/mobile/src/crypto/argon2_params.ts`
  documents the pin window [150, 1200]ms median. Once a physical
  iPhone 11/12 is available, run `runArgon2idBenchmark()` from the
  app, verify the median falls in the window, and update the
  benchmark provenance block. If the on-device median is outside
  the window, change the constants and re-pin.

## Engineering hygiene

- **Test runtime budget.** The `_fresh_engine_per_test` autouse
  fixture creates a new engine per test. Cheap today (~30 tests),
  but if the suite grows past low hundreds the per-test engine
  setup becomes the bottleneck. Revisit when total runtime exceeds
  ~10s for the backend job.

- **Pepper provisioning.** The Phase 2 migration creates an empty
  `application_pepper` table; an admin script must seed the primary
  row before traffic is allowed. Phase 6 ops work needs:
  - A documented one-liner for dev (`INSERT INTO application_pepper
    (slot, pepper) VALUES ('primary', gen_random_bytes(32))`).
  - A safer wrapper for prod that refuses to overwrite an existing
    row and emits the new pepper to a configured secret store.
