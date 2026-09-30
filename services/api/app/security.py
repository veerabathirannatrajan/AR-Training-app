import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings

PIN_HASH_ITERATIONS = 200_000


def new_salt() -> str:
    return secrets.token_hex(16)


def hash_pin(pin: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), PIN_HASH_ITERATIONS)
    return digest.hex()


def verify_pin(pin: str, salt: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_pin(pin, salt), expected_hash)


def create_worker_token(worker_id: str, now: datetime | None = None) -> tuple[str, datetime]:
    issued_at = now or datetime.now(UTC)
    expires_at = issued_at + timedelta(days=settings.worker_token_days)
    token = jwt.encode(
        {"sub": worker_id, "role": "worker", "iat": issued_at, "exp": expires_at},
        settings.jwt_secret,
        algorithm="HS256",
    )
    return token, expires_at
