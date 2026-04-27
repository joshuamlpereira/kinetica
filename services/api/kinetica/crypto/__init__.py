"""Server-side cryptographic primitives.

Per docs/SECURITY.md the server is biometric-blind: it never holds the
passphrase, the master key, the X25519 private key, or any device's Ed25519
private key. The server's crypto surface is therefore narrow — three
operations:

- HMAC-SHA-256 over `email.lower()` under the application pepper, with
  dual-slot support so a rotation can accept hashes from the previous
  pepper for a window (see `email_hash`).
- Ed25519 signature verification on DPoP proofs and challenge-response
  payloads (see `signatures`).
- Constant-time byte comparison and cryptographic random for short-lived
  nonces (see `compare`, `random`).

Encryption (AEAD, sealing) and password-derived key material live entirely
on the client. Adding either to this package would mean the threat model
changed; do that change in docs/SECURITY.md first.
"""

from kinetica.crypto.compare import constant_time_eq
from kinetica.crypto.email_hash import compute_email_hash, match_email_hash
from kinetica.crypto.random import random_bytes, random_challenge
from kinetica.crypto.signatures import verify_ed25519

__all__ = [
    "compute_email_hash",
    "constant_time_eq",
    "match_email_hash",
    "random_bytes",
    "random_challenge",
    "verify_ed25519",
]
