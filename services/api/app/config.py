"""Settings, read from environment variables (prefix ARMT_) with development defaults."""

import os
import secrets
from dataclasses import dataclass
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent.parent
KEYS_DIR = API_ROOT / "keys"
# Module content is shared with the apps (packages/shared/content) so there is one source. The
# hosted deployment has no repo around it, so `npm run deploy:api` bundles a copy next to app/.
REPO_CONTENT_DIR = REPO_ROOT / "packages" / "shared" / "content" / "modules"
BUNDLED_CONTENT_DIR = API_ROOT / "content" / "modules"

AMOY_RPC_URL = "https://rpc-amoy.polygon.technology"

# Set by Vercel on every build and function invocation (the hosted API).
HOSTED = os.environ.get("VERCEL") == "1"


def _dev_jwt_secret() -> str:
    """A per-checkout random secret, created on first run and kept out of git (keys/)."""
    if HOSTED:
        # The hosted file system is read-only and per-instance: a generated secret would differ
        # between instances and log every worker out on each cold start.
        raise RuntimeError("ARMT_JWT_SECRET must be set for the hosted API (npm run deploy:api).")
    path = KEYS_DIR / "jwt_secret"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    KEYS_DIR.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_urlsafe(48)
    path.write_text(secret, encoding="utf-8")
    return secret


def database_url() -> str:
    """ARMT_DATABASE_URL, else DATABASE_URL (set by the Neon integration on Vercel), else SQLite.

    Postgres URLs are pointed at the psycopg 3 driver, whatever scheme the provider uses.
    """
    url = os.environ.get("ARMT_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        return f"sqlite:///{API_ROOT / 'dev.db'}"
    for scheme in ("postgres://", "postgresql://"):
        if url.startswith(scheme):
            return "postgresql+psycopg://" + url[len(scheme):]
    return url


def content_dir() -> Path:
    if os.environ.get("ARMT_CONTENT_DIR"):
        return Path(os.environ["ARMT_CONTENT_DIR"])
    return REPO_CONTENT_DIR if REPO_CONTENT_DIR.is_dir() else BUNDLED_CONTENT_DIR


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
        database_url=database_url(),
        jwt_secret=os.environ.get("ARMT_JWT_SECRET") or _dev_jwt_secret(),
        worker_token_days=int(os.environ.get("ARMT_WORKER_TOKEN_DAYS", "30")),
        admin_token_hours=int(os.environ.get("ARMT_ADMIN_TOKEN_HOURS", "12")),
        max_failed_logins=int(os.environ.get("ARMT_MAX_FAILED_LOGINS", "5")),
        lockout_minutes=int(os.environ.get("ARMT_LOCKOUT_MINUTES", "5")),
        cert_signing_key=os.environ.get("ARMT_CERT_SIGNING_KEY") or None,
        content_dir=content_dir(),
        polygon_private_key=os.environ.get("ARMT_POLYGON_PRIVATE_KEY") or None,
        polygon_rpc_url=os.environ.get("ARMT_POLYGON_RPC_URL", AMOY_RPC_URL),
        demo_admin_email=os.environ.get("ARMT_ADMIN_EMAIL", "admin@test.com"),
        demo_admin_password=os.environ.get("ARMT_ADMIN_PASSWORD", "admin1234"),
    )


settings = load_settings()
