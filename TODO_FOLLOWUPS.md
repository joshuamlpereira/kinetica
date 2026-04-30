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

- **Constant-time registration response.** The 409 (duplicate-email)
  path is faster than 201 (success) — 201 inserts a device row and
  issues tokens, 409 short-circuits on the unique-constraint flush.
  An attacker who can sign a request can probe email-existence by
  measuring response time across A (fresh) vs B (duplicate).
  Mitigation options when this lands:
  1. After the duplicate is detected, perform an equivalent amount
     of dummy work (one fixed-cost INSERT + one fixed-cost token
     issuance, discarded) so 409 takes the same wall time as 201.
  2. Add a sleep-to-floor: clamp every register response to ≥ N ms
     where N is the 95th percentile of the success path. Crude but
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
