"""Settings, read from environment variables (prefix ARMT_) with development defaults."""

import os
import secrets
from dataclasses import dataclass
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
KEYS_DIR = API_ROOT / "keys"


def _dev_jwt_secret() -> str:
    """A per-checkout random secret, created on first run and kept out of git (keys/)."""
    path = KEYS_DIR / "jwt_secret"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    KEYS_DIR.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_urlsafe(48)
    path.write_text(secret, encoding="utf-8")
    return secret


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    worker_token_days: int
    max_failed_logins: int
    lockout_minutes: int


def load_settings() -> Settings:
    return Settings(
        database_url=os.environ.get("ARMT_DATABASE_URL", f"sqlite:///{API_ROOT / 'dev.db'}"),
        jwt_secret=os.environ.get("ARMT_JWT_SECRET") or _dev_jwt_secret(),
        worker_token_days=int(os.environ.get("ARMT_WORKER_TOKEN_DAYS", "30")),
        max_failed_logins=int(os.environ.get("ARMT_MAX_FAILED_LOGINS", "5")),
        lockout_minutes=int(os.environ.get("ARMT_LOCKOUT_MINUTES", "5")),
    )


settings = load_settings()
