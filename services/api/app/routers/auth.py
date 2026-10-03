import math
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import api_error
from app.models import Admin, Worker
from app.schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminProfile,
    WorkerLoginRequest,
    WorkerLoginResponse,
    WorkerProfile,
)
from app.security import (
    create_admin_token,
    create_worker_token,
    hash_password,
    hash_pin,
    new_salt,
    verify_password,
    verify_pin,
)
from app.timeutil import as_utc_or_none, iso

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Hashing a PIN for unknown IDs too keeps response times equal, so IDs can't be probed.
_UNKNOWN_WORKER_SALT = new_salt()


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


def admin_profile(admin: Admin) -> AdminProfile:
    return AdminProfile(
        id=admin.id,
        email=admin.email,
        name=admin.name,
        active=admin.active,
        created_at=iso(admin.created_at) or "",
        last_login_at=iso(as_utc_or_none(admin.last_login_at)),
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

    locked_until = as_utc_or_none(worker.locked_until)
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


_UNKNOWN_ADMIN_SALT = new_salt()


@router.post("/admin/login", response_model=AdminLoginResponse)
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)) -> AdminLoginResponse:
    invalid = api_error(
        status.HTTP_401_UNAUTHORIZED, "invalid-credentials", "Email or password is incorrect."
    )
    admin = db.scalars(
        select(Admin).where(func.lower(Admin.email) == body.email.strip().lower())
    ).first()
    if admin is None:
        hash_password(body.password, _UNKNOWN_ADMIN_SALT)
        raise invalid
    if not verify_password(body.password, admin.password_salt, admin.password_hash):
        raise invalid
    if not admin.active:
        raise api_error(status.HTTP_403_FORBIDDEN, "inactive", "This admin account is disabled.")

    now = datetime.now(UTC)
    admin.last_login_at = now
    db.commit()
    token, expires_at = create_admin_token(admin.id, now)
    return AdminLoginResponse(
        token=token, expires_at=iso(expires_at) or "", admin=admin_profile(admin)
    )
