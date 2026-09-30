import math
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Worker
from app.schemas import WorkerLoginRequest, WorkerLoginResponse, WorkerProfile
from app.security import create_worker_token, hash_pin, new_salt, verify_pin

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Hashing a PIN for unknown IDs too keeps response times equal, so IDs can't be probed.
_UNKNOWN_WORKER_SALT = new_salt()


def api_error(
    status_code: int, code: str, message: str, retry_after_seconds: int | None = None
) -> HTTPException:
    """Error body shape shared with the clients: {"detail": {"code", "message", ...}}."""
    detail: dict[str, object] = {"code": code, "message": message}
    headers = None
    if retry_after_seconds is not None:
        detail["retryAfterSeconds"] = retry_after_seconds
        headers = {"Retry-After": str(retry_after_seconds)}
    return HTTPException(status_code=status_code, detail=detail, headers=headers)


def _as_utc(value: datetime | None) -> datetime | None:
    # SQLite returns naive datetimes even for timezone-aware columns.
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def worker_profile(worker: Worker) -> WorkerProfile:
    return WorkerProfile(
        worker_id=worker.id,
        name=worker.name,
        role=worker.role,
        site_id=worker.site_id,
        site_name=worker.site.name,
        district=worker.site.district,
        sector=worker.site.sector,  # type: ignore[arg-type]
        preferred_language=worker.preferred_language,  # type: ignore[arg-type]
    )


@router.post("/worker/login", response_model=WorkerLoginResponse)
def worker_login(body: WorkerLoginRequest, db: Session = Depends(get_db)) -> WorkerLoginResponse:
    now = datetime.now(UTC)
    invalid = api_error(
        status.HTTP_401_UNAUTHORIZED, "invalid-credentials", "Worker ID or PIN is incorrect."
    )

    worker = db.get(Worker, body.worker_id)
    if worker is None:
        hash_pin(body.pin, _UNKNOWN_WORKER_SALT)
        raise invalid

    locked_until = _as_utc(worker.locked_until)
    if locked_until is not None and locked_until > now:
        raise api_error(
            status.HTTP_423_LOCKED,
            "locked",
            "Too many wrong PINs. Try again later.",
            math.ceil((locked_until - now).total_seconds()),
        )

    if not verify_pin(body.pin, worker.pin_salt, worker.pin_hash):
        worker.failed_logins += 1
        if worker.failed_logins >= settings.max_failed_logins:
            worker.failed_logins = 0
            worker.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            db.commit()
            raise api_error(
                status.HTTP_423_LOCKED,
                "locked",
                "Too many wrong PINs. Try again later.",
                settings.lockout_minutes * 60,
            )
        db.commit()
        raise invalid

    # Only reveal the account state to someone who knows the PIN.
    if not worker.active:
        raise api_error(status.HTTP_403_FORBIDDEN, "inactive", "This worker ID is not active.")

    worker.failed_logins = 0
    worker.locked_until = None
    db.commit()

    token, expires_at = create_worker_token(worker.id, now)
    return WorkerLoginResponse(token=token, expires_at=expires_at, worker=worker_profile(worker))
