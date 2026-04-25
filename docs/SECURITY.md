# Security

This document is a stub. The full threat model lands in Phase 2.

## Invariants the codebase must enforce

- The server never receives the user's X25519 private key, in any encoding,
  in any transport, ever.
- HealthKit-derived biometric records are sealed with `crypto_box_seal` to the
  user's public key on the device and uploaded as opaque ciphertext.
- The server's per-user storage of biometrics is opaque bytes plus metadata
  (timestamps, source, kind). It cannot be decrypted server-side.
- Master key escrow uses iCloud Keychain with
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` and the Secure Enclave where
  available. Zero-knowledge mode disables escrow entirely.
- Refresh tokens are one-shot. Reuse invalidates the entire family and forces
  re-login.
- DPoP binding (RFC 9449) is required on every authenticated request. The
  device Ed25519 keypair is generated and registered at signup.

## Telemetry posture

- No third-party analytics, ads, or PII-shipping crash reporters.
- Self-hosted Sentry is the only telemetry option, and it is opt-in. Phase 1
  ships with no Sentry at all.
- Every outbound network call is documented in this file before merge.
