# Security — Threat Model (Phase 2 baseline)

Status: living document. This is the threat model that gates Phase 2 (auth +
crypto) implementation. Code MUST NOT land that contradicts the invariants
section without an explicit edit to this file in the same PR.

The Phase 1 stub locked seven invariants (X25519 sealing for biometrics,
plaintext-on-server for workouts/nutrition, iCloud Keychain escrow with a
zero-knowledge opt-out, DPoP-bound JWTs, one-shot rotating refresh tokens,
Ed25519 device keypairs, no third-party telemetry). They are restated and
expanded here. Phase 2 review extended the model in two ways that this
revision reflects:

- **Aggregate biometrics and readiness scores are Tier S, not Tier 2.** Day-
  granularity sleep stages are medical-tier; the readiness algorithm moves
  client-side and the server only stores ciphertext for both. The schema
  rewrite that backs this lands in Phase 4 (HealthKit ingestion); the tier
  classification is locked here so Phase 4 has no wiggle room.
- **The server never receives a password, in any form, via any handshake.**
  Server authentication is Ed25519 challenge-response from a registered
  device. The passphrase is used only locally to unwrap the master key.
  This eliminates the OPAQUE-vs-SRP question entirely.

---

## 1. Purpose and scope

**In scope.** All client and server code in this repo, the data it stores,
the credentials it authenticates with, and the network path between them.

**Out of scope.** Apple's HealthKit data store itself (we trust iOS to
sandbox it), the user's iCloud Keychain (we trust Apple's escrow as much as
the user does — see §10), the user's device hardware, the host OS, and
physical security of the user. We do not attempt to defend against an
attacker with kernel access to a running, unlocked device.

This document does not cover compliance regimes (HIPAA, GDPR data-subject
flows, etc.); those are tracked separately and may impose stricter
controls than this model.

---

## 2. Assets and sensitivity tiers

Tiers determine where data may live and in what form. **Tier S** is the
ceiling; **Tier 3** is the floor. Anything not listed defaults to Tier 2.

| Tier | Definition | Examples in Kinetica |
|------|------------|----------------------|
| **S — Secret** | Compromise is catastrophic. Must never leave the device in plaintext or in any form the server can decrypt. | User's X25519 private key; user's Ed25519 device private keys; passphrase; master key; raw HealthKit samples (sleep stages, HR, etc.) before sealing; **aggregate sleep / steps / kcal / distance values**; **readiness scores and component breakdowns**. |
| **1 — Sensitive PII** | Compromise enables targeting or correlation across services. Server holds only hashed/derived form. | Email address (server stores only `email_hash`). The passphrase is Tier S; no password-equivalent data is sent over the wire to be stolen. |
| **2 — User-private structured** | Workout content, nutrition. Sensitive to the user but the product surface needs to query it. Stored plaintext server-side, protected only by auth + TLS + at-rest disk encryption. | `exercises`, `workout_sessions` (except `notes_encrypted`), all set/block/exercise rows, `foods`, `nutrition_logs`, `nutrition_targets`. |
| **2-enc — User-narrative** | Text the user wrote and explicitly considers private. Encrypted client-side. | `workout_sessions.notes_encrypted`, `users.encrypted_profile`. |
| **3 — Operational** | Server config, request logs (with PII redacted), aggregate metrics. | App logs (see §9 for redaction rules), Postgres `pg_stat_*`, `alembic_version`. |

**Biometric envelope.** Tier S includes everything HealthKit emits per
sample (timestamps, values, source provenance, anchors) **and** every
aggregate or derivative computed from it (daily totals, sleep stage
durations, readiness scores). The server gets sealed blobs plus a small
set of routing metadata: `user_id`, kind enum, period start/end (date
granularity for daily aggregates, sub-second for raw samples), and a
sync anchor opaque to the server.

**Schema implication for Phase 4.** The Phase 1 schema has plaintext
columns for `ambient_daily.step_count`, `sleep_sessions.total_sleep_seconds`,
`sleep_sessions.rem_seconds`, `sleep_sessions.deep_seconds`, etc., and
plaintext score components in `readiness_scores`. **Phase 4 replaces
these with `payload_ciphertext BYTEA` columns and drops the plaintext
metric columns.** Routing metadata (`user_id`, `log_date`, `source`,
`sleep_date`, `score_date`, `last_synced_at`) stays plaintext for sync
indexing. The Phase 4 migration is out of scope for this turn but the
classification is locked here.

---

## 3. Trust boundaries

```
   ┌─────────────────────────────────────────────────────────────┐
   │ User device (iPhone)                                        │
   │  ┌──────────────┐    ┌──────────────────────────────────┐   │
   │  │ Secure       │    │ App sandbox                      │   │
   │  │ Enclave      │←──→│  ┌────────────┐ ┌────────────┐   │   │
   │  │ + Keychain   │    │  │ HealthKit  │ │ React      │   │   │
   │  └──────────────┘    │  │ store      │ │ Native     │   │   │
   │       ▲              │  └─────┬──────┘ │ JS + WMDB  │   │   │
   │       │ unlocked     │        ▼        └─────┬──────┘   │   │
   │       │              │  ┌──────────────┐     │          │   │
   │       │              │  │ Swift bridge │←────┘          │   │
   │       │              │  │ (in-process) │                │   │
   │       │              │  └──────┬───────┘                │   │
   │       └──────────────┴─────────┼────────────────────────┘   │
   │                                ▼                            │
   └────────────────────────────────┼────────────────────────────┘
                                    │  TLS 1.3, DPoP-bound JWT
                                    ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Backend (FastAPI + Postgres)                                │
   │   API process ──→ Postgres ──→ daily encrypted backups      │
   └─────────────────────────────────────────────────────────────┘
```

**Boundaries, in order of trust drop:**

1. **Secure Enclave / Keychain ↔ App memory.** Tier S keys live in the
   Enclave (Ed25519 device key) or in iCloud Keychain
   (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, master key). The app
   reads them only in-memory, only while unlocked, and never persists
   them to JS-accessible storage.
2. **HealthKit store ↔ Swift bridge ↔ JS.** Raw samples and aggregates
   computed from them cross from HealthKit into Swift, are sealed
   there (see §5), and only the ciphertext crosses the JS bridge. The
   JS layer never sees plaintext biometrics or plaintext readiness
   scores.
3. **Device ↔ Network.** TLS 1.3 only. Certificate pinning to the
   issuing CA (not a leaf — leafs rotate). Public-key DPoP binds every
   request to the device Ed25519 key.
4. **API process ↔ Postgres.** Standard authenticated connection. The
   API can read all Tier 2 plaintext rows but cannot decrypt any Tier S
   ciphertext.
5. **Postgres ↔ Backups.** Backups are encrypted at the storage layer.
   Operational keys (backup decryption, TLS) are out of band — see §10.

---

## 4. Adversary model

We design against four capability tiers. A given threat actor may exhibit
multiple capabilities; each individual capability is what mitigations key
off of.

**A. Network adversary (passive and active).**
Capabilities: observe and modify any traffic between device and server.
Cannot break TLS 1.3 with a current cipher suite. May obtain a
fraudulent leaf certificate from a compromised CA.
Examples: hostile Wi-Fi, ISP-level interception, state-level passive
collection, compromised intermediate CA.

**B. Server compromise.**
Capabilities: read and modify everything in the API process and
Postgres at the time of compromise. May persist (root) or be
short-lived (leaked backup, SQL injection window). Includes a
malicious or coerced operator.
Examples: stolen backup tarball, SQL injection, compromised operator
laptop with prod credentials, court order on infrastructure provider.

**C. Lost / stolen device, locked.**
Capabilities: physical possession of an iPhone in a locked state. May
attempt brute-force passcode (rate-limited by Secure Enclave), forensic
acquisition, attempted exploitation of unpatched kernel bugs.
Examples: theft, lost device, border seizure.

**D. Account-takeover adversary.**
Capabilities: control of the user's email account and/or the ability
to social-engineer email-based recovery. Cannot bypass DPoP from the
device side without first registering a device of their own.
Examples: email-account compromise, SIM-swap reaching email recovery,
phishing the recovery code.

We **do not** design against:
- An attacker with code execution on a running unlocked device.
- An attacker with control of the user's Apple ID and iCloud Keychain
  (this is equivalent to the user themselves, by design).
- A nation-state with a 0-day in iOS, libsodium, or our toolchain.
  We harden against incidental supply-chain compromise (§8) but not
  bespoke targeting.

---

## 5. Cryptographic architecture

This section is normative. Code MUST match it; deviation requires this
file change first.

### 5.1 Identities and keys

| Key | Algorithm | Where generated | Where stored | Purpose |
|-----|-----------|-----------------|--------------|---------|
| **User encryption keypair** | X25519 | On first device, at signup | Private: iCloud Keychain (escrow mode) **or** rederived via wrapped_master_key + passphrase (zero-knowledge mode). Public: server, in `users.encryption_pubkey` (new column, see §11). | Sealing biometrics, aggregate biometrics, readiness scores, and Tier 2-enc fields to the user. |
| **Master symmetric key** | XChaCha20-Poly1305 256-bit | On first device, at signup | iCloud Keychain in escrow mode. Always also stored on the server as ciphertext in `users.wrapped_master_key`, wrapped under the passphrase-derived KEK. | Symmetric encryption of `encrypted_profile` and `notes_encrypted`. Wraps long-lived per-record keys when those exist. |
| **Device auth keypair** | Ed25519 | Per device, at first sign-in on that device | Private: Secure Enclave (where available; non-exportable) or Keychain `WhenUnlockedThisDeviceOnly`. Public: server, in a new `user_devices` table — see §11. | Sole authentication factor to the server: every request is DPoP-signed by this key, and registration / login / refresh / bootstrap all turn on a challenge-response signed by this key. |
| **Passphrase-derived key (KEK)** | Argon2id → 256-bit key | Derived locally on each unlock | Memory only; zeroed on lock | Wraps the master key in `users.wrapped_master_key`. **Never sent to the server in any form.** Server holds the wrapped output, not the KEK. |
| **Email lookup key (server-held pepper)** | HMAC-SHA-256 256-bit | At server provisioning | Postgres in a separate config table, `application_pepper` (NEW) — never in code, never in env vars committed to git. Dual-pepper for rotation (primary + secondary slot). | `email_hash = HMAC(pepper, lowercased(email))`. Lets the server look up users by email at registration and email-recovery without storing addresses. |

### 5.2 Construction primitives

- **AEAD for narrative fields and master-key wrapping**:
  XChaCha20-Poly1305 (libsodium `crypto_aead_xchacha20poly1305_ietf`).
  192-bit nonce, randomly generated per encryption, stored alongside
  the ciphertext.
- **Anonymous sealing for biometrics, aggregates, and readiness scores**:
  `crypto_box_seal` to the user's X25519 public key. The sender is
  anonymous (ephemeral keypair). The server cannot decrypt; only the
  holder of the user's X25519 private key can.
- **Password KDF**: Argon2id via libsodium's `crypto_pwhash`. **Parameters
  MUST be set in code as named constants and pinned by benchmarks
  committed alongside them** — current proposal `t=3, m=64MiB`
  targeting ~500ms on a 2020-era iPhone. *libsodium's `crypto_pwhash`
  does not expose Argon2's parallelism parameter (it is fixed at `p=1`
  internally), so the original proposal of `p=4` is moot in practice
  and removed here.* The Argon2id derivation is purely client-side —
  the server never sees a passphrase — so there is no server-side
  benchmark to commit; the client benchmark lives at
  `apps/mobile/src/crypto/benchmark.ts` and must be run on a real iPhone
  before constants are pinned.
- **Per-user password salt**: 16 random bytes per user, stored in
  `users.password_salt` (new column). Generated client-side at
  registration; uploaded once, never rotated except on passphrase
  change.
- **Random**: `crypto_aead_xchacha20poly1305_ietf_keygen` /
  `crypto_kx_keypair` / iOS `SecRandomCopyBytes`. Never `Math.random`.
  The server does not generate user-key material.

### 5.3 Authentication flow

**The server never receives the user's passphrase, in any form.** All
server authentication uses Ed25519 challenge-response from a registered
device. The passphrase is used purely locally to unwrap the master key.

#### 5.3.1 Registration

1. Client generates `password_salt` (16 random bytes).
2. Client derives `kek = Argon2id(passphrase, password_salt, t, m, p)`.
3. Client generates X25519 keypair, master XChaCha key, and the first
   device's Ed25519 keypair (in Secure Enclave where available).
4. Client computes
   `wrapped_master_key = aead_encrypt(master_key, random_nonce, kek)`,
   prefixed with the nonce.
5. Client posts to `POST /auth/register`:
   ```
   {
     email,                      # used once for the welcome email; not stored
     email_hash,                 # HMAC(pepper, lowercased(email))
     password_salt,              # 16 bytes
     encryption_pubkey,          # X25519, 32 bytes
     wrapped_master_key,         # nonce || ciphertext
     device_pubkey,              # Ed25519, 32 bytes
     device_name,                # user-friendly label, e.g. "iPhone 15 Pro"
     bootstrap_signature         # device_pubkey signs the SHA-256 of the rest
   }
   ```
6. Server validates `bootstrap_signature` against `device_pubkey`,
   inserts a `users` row and a `user_devices` row, returns the initial
   token pair (access + refresh, both DPoP-bound to `device_pubkey`).
7. iCloud Keychain (escrow mode) backs up the master key + X25519
   private key on the device. In zero-knowledge mode this step is
   skipped — the only recovery path is the wrapped master key on the
   server plus the passphrase.

The password itself never crosses the wire. The server sees only what
it must to authenticate future requests (the device pubkey) and to
help the user recover (the wrapped master key, which is useless
without the passphrase).

#### 5.3.2 Login on a registered device

The phone already holds its Ed25519 private key (Secure Enclave) and
its `device_pubkey` is already in `user_devices`.

1. `POST /auth/challenge { email_hash, device_pubkey }` — server
   returns `{ nonce, expires_at }`. The challenge is single-use.
2. Client signs `nonce || expires_at || device_pubkey` with its
   Ed25519 private key.
3. `POST /auth/login { email_hash, device_pubkey, nonce, signature }`
   — server verifies, issues access + refresh.
4. Locally: prompt for passphrase → derive KEK → fetch `wrapped_master_key`
   from `users` table via authenticated request → unwrap → master key
   in memory.

Passphrase entry is required on cold start (or after configurable
inactivity timeout — Phase 5 decides the policy). The Ed25519 key in
the Enclave does not require the passphrase; it requires device
unlock.

#### 5.3.3 New-device bootstrap (existing trusted device available)

Goal: register device B without sending a password, without trusting
email recovery, and without leaking anything to a network observer.

1. Device B generates an Ed25519 keypair locally.
2. Device B displays a QR code containing
   `{ device_pubkey_B, device_name_B, ephemeral_nonce_B }`.
3. Device A scans the QR (in person, side-by-side, out of band).
4. Device A makes an authenticated request:
   `POST /auth/bootstrap/grant { device_pubkey_B, device_name_B,
   ephemeral_nonce_B, grant_signature }` where `grant_signature` is
   signed by A's Ed25519 private key.
5. Server verifies A's signature against A's registered pubkey,
   inserts B's pubkey into `user_devices` with a `bootstrap_pending`
   marker, and returns a 6-digit `bootstrap_code` valid for 5 minutes.
6. Device A displays the bootstrap_code; user types it into device B
   (or B reads a follow-up QR).
7. Device B posts `POST /auth/bootstrap/redeem { device_pubkey_B,
   bootstrap_code, redeem_signature }` where `redeem_signature` is
   B signing `bootstrap_code || ephemeral_nonce_B`.
8. Server validates: code matches, not expired, signed by the pubkey
   it was bound to, ephemeral_nonce matches what A originally signed.
   Clears `bootstrap_pending`, issues B's first token pair.
9. Master key arrives via iCloud Keychain (escrow mode) or device B
   prompts for the passphrase, fetches `wrapped_master_key`, and
   unwraps locally (zero-knowledge mode).

The QR plus bootstrap_code is two-factor by design: an attacker
needs to see both the QR (proximity / camera access on device A) and
the bootstrap code (display of device A) to register a hostile
device. Either alone is insufficient.

#### 5.3.4 Email recovery (no other device available)

Goal: get a working session on a fresh device when the user has lost
all their existing devices. This is the only path that does not
require possession of an existing trusted device.

1. Device B: `POST /auth/recover { email_hash }`.
2. Server generates a one-time recovery token, emails it to the
   address (resolved by querying which user has that `email_hash` —
   the email itself is not stored, but the original email arrived
   in the registration payload and was sent in the welcome email; see
   §10.7 for the residual risk).

   **Note on email plaintext:** the server has the email at
   registration time and at every recovery request. It uses the email
   only to address outbound mail and does not persist it. The email
   provider sees the address regardless.
3. User receives the email and enters the recovery token on device B.
4. Device B generates an Ed25519 keypair and posts
   `POST /auth/recover/redeem { email_hash, recovery_token,
   device_pubkey, device_name, redeem_signature }` where
   `redeem_signature` is over the token and pubkey.
5. Server validates the recovery token (single-use, 15-minute TTL),
   inserts the new device in `user_devices`, issues tokens.
6. Master key recovery: device B prompts for the passphrase, fetches
   `wrapped_master_key`, unwraps locally. **Without the passphrase,
   the user gets a working session and can see their plaintext
   workouts and nutrition, but cannot decrypt biometrics, readiness
   scores, or notes.** See §10.

An attacker who controls the email gets the same: a working session,
plaintext workouts and nutrition, but no Tier S decryption without
the passphrase. The wrapped master key on the server is one of the
two factors needed for offline brute force; Argon2id parameters are
the defense.

#### 5.3.5 Per-request authorization

Every authenticated HTTP request includes:

- `Authorization: DPoP <jwt>` (15-minute access token).
- `DPoP` header per RFC 9449: a JWS over `{htm, htu, iat, jti, ath,
  cnf}` signed by the device Ed25519 private key. `ath` is the
  SHA-256 of the access token; `cnf` is the JWK of the device pubkey.

The server validates token signature, expiry, DPoP signature,
`htm`/`htu` match, `jti` not seen in a short replay window, `ath`
matches the access token in the Authorization header, and the
device's `cnf.jwk` matches a non-revoked row in `user_devices`.

#### 5.3.6 Refresh

Refresh tokens are 30-day, **one-shot, rotating, and family-bound**.
On `POST /auth/refresh`, the server invalidates the presented refresh
token and issues a new access+refresh pair. **If a previously-
invalidated refresh token is presented, the entire family is revoked
and the user is forced to re-login on every device.**

Refresh-family revocation has **two recovery surfaces**:
- An email is sent to the user describing the revocation (security
  signal).
- All devices show "Your session was reset for security. Sign in to
  continue." on next foreground (UX recovery — neutral language;
  not a breach claim).

The DoS surface (an attacker who steals one refresh token can lock
the user out of every device) is accepted because the alternative
(silently letting the attacker keep access) is worse, and recovery
is straightforward: log in with passphrase + device.

### 5.4 Encryption flows

**Biometric sample, aggregate, or readiness score (Tier S → server).**
```
on the device, at write time:
  plaintext = canonicalize(record)        # stable byte order
  ciphertext = crypto_box_seal(plaintext, user_X25519_pubkey)
  upload({ user_id, kind, period_start, period_end, ciphertext, anchor })
```
For raw HealthKit samples this happens in the Swift bridge; the JS
bridge never sees plaintext. For aggregates and readiness scores
computed in JS, sealing happens in JS before the row is queued for
sync.

**Workout-session note (Tier 2-enc → server).**
```
nonce = randombytes(24)
ciphertext = aead_xchacha20poly1305_encrypt(plaintext, nonce, master_key)
notes_encrypted = nonce || ciphertext
```
Decryption mirrored client-side. The master key never leaves the
device in plaintext.

**Profile blob.** Same as the note flow.

### 5.5 Key recovery

| Mode | Loss of one device | Loss of all devices, passphrase known | Loss of all devices, passphrase forgotten |
|------|--------------------|---------------------------------------|-------------------------------------------|
| **Escrow (default)** | iCloud Keychain syncs keys to next device. No passphrase needed for biometrics. | iCloud Keychain restore on the new device (if available); else email recovery + passphrase to unwrap `wrapped_master_key`. | iCloud Keychain restore on the new device. Passphrase used only for the offline-recovery fallback; if Apple ID also lost, total loss. |
| **Zero-knowledge (opt-in)** | Existing device bootstraps the new one; passphrase unwraps server-stored `wrapped_master_key`. | Email recovery → register new device → enter passphrase → unwrap. | **Total loss of Tier S data.** Account itself can be recovered (workouts and nutrition survive plaintext); biometrics, readiness, notes, profile are gone. UI must make this unmistakable at opt-in. |

Across both modes, **the server has no way to decrypt Tier S data on
its own** — `wrapped_master_key` is useless without the passphrase,
and Argon2id parameters make offline brute force expensive (§5.2).

---

## 6. Threats and mitigations

Threats are grouped by adversary capability (§4). Mitigations marked
**implemented in Phase 2** must ship before Phase 2 closes;
**deferred** items are tracked but not blocking.

### A. Network adversary

| Threat | Asset | Mitigation |
|---|---|---|
| Passive interception of biometric upload | Tier S | Sealed ciphertext, useless without the X25519 private key |
| TLS strip / downgrade | All | TLS 1.3 enforced server-side; ATS-strict on iOS |
| Fraudulent leaf cert via compromised CA | All | Pin to issuing CA in iOS; rotation via app update (deferred — Phase 6 with full pinning UX) |
| Replay of authenticated requests | Tier 2 mutations | DPoP `jti` + short-window cache; 15-minute access token expiry |
| Token theft over network | Tier 2 + auth | DPoP binds tokens to device Ed25519 private key; bearer-only theft is not enough to act |
| Observation of registration / login payloads | Auth | No password material crosses the wire; observing the handshake yields only public keys and a wrapped blob already useless without the passphrase |

### B. Server compromise

| Threat | Asset | Mitigation |
|---|---|---|
| Read sealed biometrics, aggregates, readiness scores | Tier S | `crypto_box_seal` — server has no decryption key |
| Read encrypted notes / profile | Tier 2-enc | XChaCha20-Poly1305 under master key — server never holds master key |
| Read workout / nutrition rows | Tier 2 | **Accepted residual risk.** Documented in §10. |
| Read `wrapped_master_key` from `users` table | Tier S indirectly | Useless without the passphrase. Argon2id parameters set the cost of offline brute force; per-user 16-byte salt prevents shared-rainbow-table attacks |
| Forge requests as user | All | DPoP keys are in user devices' Secure Enclaves; server cannot mint a valid DPoP signature |
| Issue tokens to the attacker themselves via direct DB writes | All | Possible at compromise. Mitigated by short access TTL + refresh family revocation visible to legitimate user on next login |
| Read email addresses | Tier 1 | Only `email_hash = HMAC(pepper, email)` is stored. Pepper is in a separate config table that, if also leaked, reduces email lookup to offline search of a known address — still not a full directory dump |
| Pre-image attack on `email_hash` | Tier 1 | HMAC-SHA-256 with secret key; brute force requires the pepper |

### C. Lost / stolen device, locked

| Threat | Asset | Mitigation |
|---|---|---|
| Extract master key from disk | Tier S | iOS class `WhenUnlockedThisDeviceOnly` keychain entry — unreadable until passcode unlock |
| Extract Ed25519 device key | Tier S | Secure Enclave (non-exportable) where available; Keychain `WhenUnlockedThisDeviceOnly` otherwise |
| Brute-force passcode | All | Secure Enclave hardware rate limit + iOS auto-wipe-after-N policy (user-configurable) |
| Resurrect session via remembered tokens | Tier 2 | Tokens become unusable when the keychain is locked; refresh fails on relock |

### D. Account-takeover adversary

| Threat | Asset | Mitigation |
|---|---|---|
| Credential stuffing | All | **Not applicable.** No password is sent to the server, so there is no password to stuff. The attacker would need to compromise the email account to begin recovery |
| Email-account compromise → register hostile device | Tier 2 | Attacker can complete `recover/redeem` and register their own Ed25519 device. They get tokens and read Tier 2 plaintext (workouts, nutrition). They get the wrapped master key, useful only for offline brute force against the passphrase |
| Email-account compromise → decrypt Tier S | Tier S | Requires the passphrase. Argon2id with benchmarked parameters is the only barrier. **A weak passphrase is the user's vulnerability**; the UI enforces a zxcvbn floor at registration |
| Phishing the recovery code | Auth | 15-minute TTL, single-use, must be redeemed by a key signing the same payload — phishable only if the attacker also captures the device-side keypair generation, which means they're already on the device |
| Brute-force `wrapped_master_key` offline | Tier S | Requires server compromise OR a successful login by the attacker. Argon2id parameters are the defense. Per-user random salt prevents amortized cracking across leaked databases |

---

## 7. Data lifecycle and at-rest

- **In transit**: §4-A covers it — TLS 1.3, DPoP, sealed payloads.
- **At rest on device**: WatermelonDB → SQLite. The whole DB lives in
  the app sandbox (iOS file protection class C — `Complete`, i.e.
  unreadable while locked) by default. Tier S blobs in the WMDB are
  ciphertext anyway.
- **At rest on server**: Postgres on disk-encrypted volumes
  (operational requirement — not a code mitigation). Backup encryption
  keys live outside the app process. Tier S is double-protected: it's
  also ciphertext at the application layer.
- **Soft deletes**: `deleted_at` timestamps tombstone rows. **Tombstones
  for Tier S are useless to an attacker** (already ciphertext). For
  Tier 2, soft deletes mean the data is recoverable from backups
  forever; users who request hard deletion go through the deletion
  flow described below.
- **Account deletion**: a `users.deletion_requested_at` column tombstones
  the account. After 30 days of grace (during which any login restores
  the account), a Phase 6 background job hard-deletes all rows
  belonging to the user across every table. Anonymization is **not**
  offered, because Tier 2 row joins reconstruct the user.

---

## 8. Supply chain and operational

- **Dependencies**: lockfiles (`pnpm-lock.yaml`, `uv.lock`,
  `Podfile.lock`) committed and pinned. Renovate / Dependabot bumps
  through PR with CI gates. No unpinned `latest` tags anywhere.
- **CI**: GitHub Actions runs on dedicated runners. Secrets scoped per
  environment; no production secret has ever touched a PR run.
- **Cryptographic libraries**: libsodium, via `react-native-libsodium`
  (mobile) and `pynacl` (server). Argon2 via `argon2-cffi`. We do not
  implement primitives; we wire them. PRs touching `crypto/` directories
  require explicit reviewer approval.
- **Logging**: structured JSON logs (`structlog`). PII redaction list
  (locked): no email addresses, no `email_hash`, no Authorization
  header value, no DPoP header value, no JWT body (claims included),
  no Postgres rows from any table other than `alembic_version` /
  `pg_stat_*`. The redaction unit test enforces this.
- **Telemetry**: per the stub. Phase 1 ships none. Self-hosted Sentry
  is the only future option, opt-in, with PII scrubbing identical to
  the log policy.

---

## 9. Defensive coding rules

These are enforced in review and by lint/test where possible:

1. **No plaintext Tier S over the JS bridge.** Lint rule (Phase 2)
   flags `bridge.<anything>` calls returning sample types from
   `health/types.ts`.
2. **Constant-time comparisons** for all secret material:
   `nacl.utils.constant_time_compare` server-side; `sodium.memcmp`
   client-side.
3. **No `==` on bytes** in Python crypto paths. Mypy plugin or grep gate.
4. **No logging of variables named `password`, `passphrase`, `key`,
   `secret`, `token`, `nonce`, `auth`, `pubkey`, `wrapped_master_key`**
   unless wrapped in a `@redacted` decorator that emits only their
   type and length.
5. **No `try/except: pass` in crypto code.** Failures must propagate.
6. **Migrations that drop encrypted columns require a one-page
   migration rationale committed alongside them.**

---

## 10. Residual risk explicitly accepted

Each of these is a known reduction from theoretical maximum security,
chosen because the mitigation cost outweighs the threat probability for
the product Kinetica is aiming to be.

1. **Workout and nutrition rows are plaintext server-side.** A server
   breach exposes them. The product needs server-side queries
   (leaderboards in future, support-driven debugging, server-side
   sync indexing) and end-to-end encryption of structured rows would
   either kill those features or push enormous crypto complexity to
   the client. We accept the leak in exchange for a working product.
   Aggregate biometrics and readiness scores were originally in this
   category and have been promoted out of it (now Tier S).
2. **iCloud Keychain in escrow mode places trust in Apple.** Apple
   can, under legal compulsion, return the contents of an iCloud
   Keychain that is not protected by Advanced Data Protection. Users
   who require this defense must enable Advanced Data Protection on
   their Apple ID AND/OR use Kinetica's zero-knowledge mode. The UI
   surfaces this.
3. **Loss of passphrase in zero-knowledge mode is total loss of Tier
   S data.** No recovery exists. Workouts and nutrition (Tier 2)
   survive because the account itself can still be recovered via
   email; biometrics, readiness, notes, and profile are gone. The
   UI must make this unmistakable at opt-in time.
4. **Refresh token reuse triggers full-family revocation, including
   for the legitimate user's other devices.** A determined attacker
   who steals one refresh token can deny service to the legitimate
   user. We prefer the false-positive logout over silent token theft;
   this trade-off is non-negotiable. Recovery UX is smoothed (§5.3.6):
   neutral "session reset for security" language, never a breach
   claim, with a one-tap re-login.
5. **Email-account compromise yields a working session and Tier 2
   plaintext.** Email recovery is the only path that works without
   an existing trusted device, and an attacker with email control
   completes it. Tier S remains protected by the passphrase. The UX
   should encourage users to keep at least two devices registered so
   bootstrap (§5.3.3) is available and email recovery is rarely
   needed; this is a soft mitigation.
6. **A weak passphrase is the user's vulnerability for Tier S under
   server compromise + email control.** zxcvbn floor at registration
   is a partial defense; we cannot enforce strength after the fact.
   Phase 2 must commit to a minimum zxcvbn score (recommendation: 3).
7. **The email address is briefly seen by the server at registration
   and at every recovery request.** The server does not persist it,
   but logs at the SMTP relay are out of scope. Users who treat their
   email address as Tier 1 must accept that this is the boundary.

---

## 11. Resolved Phase 2 decisions

Each decision below is locked. Code lands behind these.

1. **Schema additions for keys.** The Phase 1 `users.auth_pubkey`
   column is **dropped**. Per-device Ed25519 keys live in a new
   `user_devices` table:
   ```
   user_devices(
       id UUID PK,
       user_id UUID FK -> users(id) ON DELETE CASCADE,
       device_pubkey BYTEA NOT NULL,        -- Ed25519, 32 bytes
       device_name TEXT NOT NULL,           -- user-friendly label
       created_at TIMESTAMPTZ NOT NULL,
       last_seen_at TIMESTAMPTZ,
       revoked_at TIMESTAMPTZ,
       bootstrap_pending BOOLEAN NOT NULL DEFAULT FALSE,
       UNIQUE (user_id, device_pubkey)
   )
   ```
   The `users` table gains:
   ```
   encryption_pubkey       BYTEA NOT NULL  -- X25519, 32 bytes
   password_salt           BYTEA NOT NULL  -- 16 bytes
   wrapped_master_key      BYTEA NOT NULL  -- nonce || ciphertext
   deletion_requested_at   TIMESTAMPTZ
   ```
   Phase 2's first Alembic migration applies all of the above as one
   revision.

2. **Server-side password handshake**: **none.** Server authentication
   is Ed25519 challenge-response from the device key (§5.3). The
   passphrase is used only locally to unwrap the master key. The
   OPAQUE-vs-SRP question is moot.

3. **Argon2id parameters**: target ~500ms on a 2020-era iPhone.
   Proposal `t=3, m=64MiB` (parallelism is fixed at 1 by libsodium's
   `crypto_pwhash`; see §5.2). **Final values pinned by an iPhone
   benchmark before the auth flow ships.** Provisional constants
   live in `apps/mobile/src/crypto/argon2_params.ts`; the benchmark
   harness is at `apps/mobile/src/crypto/benchmark.ts`. Argon2id is
   purely client-side — there is no server-side benchmark.

4. **Refresh-family revocation surface**: email **and** silent re-auth
   on next foreground (§5.3.6). Neutral UX language ("Your session
   was reset for security. Sign in to continue."), not a breach claim.

5. **Login rate limit**: per-account 5 attempts in 15 minutes triggers
   a 1-hour exponential lockout; per-IP 30 attempts per minute
   triggers a 10-minute block. Final numbers in
   `services/api/kinetica/auth/limits.py`. Applies to challenge-
   issuance and login endpoints.

6. **Pepper rotation**: dual-pepper read with a primary/secondary slot,
   rotate by writing primary and accepting secondary for a window. The
   `application_pepper` table is created in the same Phase 2 migration;
   rotation tooling lands as a Phase 2 admin script.

7. **DPoP `jti` cache backend**: Postgres advisory locks + a small
   `dpop_jti_seen` table for the replay window. No Redis dependency
   added in Phase 2. Revisited at scale.

8. **Account deletion**: hard delete with 30-day grace.
   `users.deletion_requested_at` column lands in the Phase 2 migration.
   The actual purge job is deferred to Phase 6.

9. **Passphrase strength**: minimum zxcvbn score 3 at registration and
   passphrase change. Enforced client-side (the server never sees the
   passphrase to validate), with a documented assumption that a
   user who patches the client can degrade their own security.

### Phase 2 implementation order (locked)

1. **Schema migration.** Drop `users.auth_pubkey`. Add `users.encryption_pubkey`,
   `users.password_salt`, `users.wrapped_master_key`,
   `users.deletion_requested_at`. Create `user_devices`. Create
   `application_pepper`. Create `dpop_jti_seen`. One Alembic revision,
   reviewed against this document.
2. **Crypto primitives.** Wrappers around libsodium / pynacl: AEAD
   encrypt/decrypt, sealed-box encrypt/decrypt, Ed25519 sign/verify,
   Argon2id derivation with the benchmarked parameters, HMAC for
   email_hash (server-side), constant-time compare. Tests including
   the cross-platform parity tests for AEAD round-trips and sealed-box
   open.
3. **Auth flow.** Endpoints for register, challenge, login, refresh,
   bootstrap (grant + redeem), recover (request + redeem). DPoP
   middleware. Rate limiter. Welcome / recovery / session-reset email
   templates. Client-side state machine for the same flows.

Each of the three lands as one or more PRs; ordering is strict
because each layer depends on the previous.

---

## 12. What this document is not

- It is not a checklist of OWASP categories. It is the model that drives
  the controls; mapping to OWASP is downstream.
- It is not a substitute for an independent review. **Phase 6 includes
  a third-party crypto audit before public beta or App Store submission.**
  Personal use before that gate is on the user.
- It is not stable. Every Phase from 2 onward will edit this file. The
  edit must precede the code change it justifies.
