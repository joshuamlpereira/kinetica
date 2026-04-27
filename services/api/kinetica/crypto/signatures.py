"""Ed25519 signature verification (server only verifies — clients sign).

The server holds no Ed25519 private key. Per-device public keys arrive in the
`user_devices` table during registration / bootstrap / recovery, and every
authenticated request thereafter carries a DPoP signature the server checks
against the registered public key.
"""

from __future__ import annotations

from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

PUBKEY_LEN = 32
SIGNATURE_LEN = 64


def verify_ed25519(pubkey: bytes, message: bytes, signature: bytes) -> bool:
    """Return True iff `signature` is a valid Ed25519 signature of `message`
    under `pubkey`.

    `BadSignatureError` is the only exception we swallow — that is the
    library's signal for "the math says no", which is exactly the False
    return we want callers to react to. Length errors and any other
    exception type propagate, in line with the no-`try/except: pass` rule
    in docs/SECURITY.md §9.
    """
    if len(pubkey) != PUBKEY_LEN:
        raise ValueError(f"pubkey must be {PUBKEY_LEN} bytes, got {len(pubkey)}")
    if len(signature) != SIGNATURE_LEN:
        raise ValueError(f"signature must be {SIGNATURE_LEN} bytes, got {len(signature)}")
    try:
        VerifyKey(pubkey).verify(message, signature)
    except BadSignatureError:
        return False
    return True
