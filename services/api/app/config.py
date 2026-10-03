"""Settings, read from environment variables (prefix ARMT_) with development defaults."""

import os
import secrets
from dataclasses import dataclass
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent.parent
KEYS_DIR = API_ROOT / "keys"
# Module content is shared with the apps (packages/shared/content) so there is one source.
CONTENT_DIR = REPO_ROOT / "packages" / "shared" / "content" / "modules"

AMOY_RPC_URL = "https://rpc-amoy.polygon.technology"


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
    admin_token_hours: int
    max_failed_logins: int
    lockout_minutes: int
    # Ed25519 seed (hex) for certificate signatures; default: keys/cert_signing_ed25519.key
    cert_signing_key: str | None
    content_dir: Path
    # Polygon Amoy anchoring is off (stub adapter) until a funded test wallet key is set.
    polygon_private_key: str | None
    polygon_rpc_url: str
    demo_admin_email: str
    demo_admin_password: str


def load_settings() -> Settings:
    return Settings(
        database_url=os.environ.get("ARMT_DATABASE_URL", f"sqlite:///{API_ROOT / 'dev.db'}"),
        jwt_secret=os.environ.get("ARMT_JWT_SECRET") or _dev_jwt_secret(),
        worker_token_days=int(os.environ.get("ARMT_WORKER_TOKEN_DAYS", "30")),
        admin_token_hours=int(os.environ.get("ARMT_ADMIN_TOKEN_HOURS", "12")),
        max_failed_logins=int(os.environ.get("ARMT_MAX_FAILED_LOGINS", "5")),
        lockout_minutes=int(os.environ.get("ARMT_LOCKOUT_MINUTES", "5")),
        cert_signing_key=os.environ.get("ARMT_CERT_SIGNING_KEY") or None,
        content_dir=Path(os.environ.get("ARMT_CONTENT_DIR", str(CONTENT_DIR))),
        polygon_private_key=os.environ.get("ARMT_POLYGON_PRIVATE_KEY") or None,
        polygon_rpc_url=os.environ.get("ARMT_POLYGON_RPC_URL", AMOY_RPC_URL),
        demo_admin_email=os.environ.get("ARMT_ADMIN_EMAIL", "admin@test.com"),
        demo_admin_password=os.environ.get("ARMT_ADMIN_PASSWORD", "admin1234"),
    )


settings = load_settings()
