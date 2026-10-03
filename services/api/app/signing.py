"""Certificate hashing and Ed25519 signatures.

The signed payload, its canonical JSON and the hash match packages/shared/src/certificates.ts
byte for byte, so phones and the admin portal verify certificates offline with the public key.
"""

import base64
import hashlib
import json
from functools import lru_cache
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey

from app.config import KEYS_DIR, settings

CERT_FORMAT_VERSION = 1
PRIVATE_KEY_FILE = KEYS_DIR / "cert_signing_ed25519.key"
# The public half, also read by the mobile build so new installs can verify offline at once.
PUBLIC_KEY_FILE = KEYS_DIR / "cert_signing_ed25519.pub"


def canonical_json(value: Any) -> str:
    """Sorted keys, no whitespace, UTF-8 (same as canonicalJson in TypeScript)."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def certificate_payload(
    *,
    cert_id: str,
    worker_id: str,
    worker_name: str,
    module_id: str,
    score: int,
    issued_on: str,
    expires_on: str,
) -> dict[str, Any]:
    return {
        "v": CERT_FORMAT_VERSION,
        "id": cert_id,
        "workerId": worker_id,
        "workerName": worker_name,
        "moduleId": module_id,
        "score": int(score),
        "issuedOn": issued_on,
        "expiresOn": expires_on,
    }


def payload_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def from_b64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def key_id_for(public_key: bytes) -> str:
    return hashlib.sha256(public_key).hexdigest()[:8]


@lru_cache(maxsize=1)
def signing_key() -> SigningKey:
    """The server's signing key: ARMT_CERT_SIGNING_KEY, else keys/ (created on first use)."""
    if settings.cert_signing_key:
        return SigningKey(bytes.fromhex(settings.cert_signing_key))
    if PRIVATE_KEY_FILE.exists():
        key = SigningKey(bytes.fromhex(PRIVATE_KEY_FILE.read_text(encoding="utf-8").strip()))
    else:
        KEYS_DIR.mkdir(parents=True, exist_ok=True)
        key = SigningKey.generate()
        PRIVATE_KEY_FILE.write_text(bytes(key).hex(), encoding="utf-8")
    public_hex = bytes(key.verify_key).hex()
    if not PUBLIC_KEY_FILE.exists() or PUBLIC_KEY_FILE.read_text(encoding="utf-8").strip() != public_hex:
        PUBLIC_KEY_FILE.write_text(public_hex, encoding="utf-8")
    return key


def public_key_hex() -> str:
    return bytes(signing_key().verify_key).hex()


def current_key_id() -> str:
    return key_id_for(bytes(signing_key().verify_key))


def signing_keys() -> list[dict[str, str]]:
    """Public keys clients trust (one today; a rotated-out key would stay listed here)."""
    return [{"keyId": current_key_id(), "algorithm": "Ed25519", "publicKey": public_key_hex()}]


def sign_hash(hash_hex: str) -> str:
    """Ed25519 signature over the 32 hash bytes, base64url."""
    return b64url(signing_key().sign(bytes.fromhex(hash_hex)).signature)


def verify_hash_signature(hash_hex: str, signature: str, public_key: str) -> bool:
    try:
        VerifyKey(bytes.fromhex(public_key)).verify(bytes.fromhex(hash_hex), from_b64url(signature))
        return True
    except (BadSignatureError, ValueError):
        return False
