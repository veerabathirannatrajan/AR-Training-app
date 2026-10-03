"""Portal settings, admin accounts and the blockchain log."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.appsettings import get_app_settings, save_app_settings
from app.certificates import run_anchoring
from app.chain import explorer_tx_url, get_anchor
from app.db import get_db
from app.deps import current_admin
from app.errors import bad_request, conflict, not_found
from app.models import Admin, Certificate
from app.routers.auth import admin_profile
from app.schemas import (
    AdminCreateRequest,
    AdminProfile,
    AdminUpdateRequest,
    AnchorRow,
    AnchorRunResponse,
    AnchorStatus,
    ChainStatus,
    Page,
    SyncSettings,
)
from app.security import hash_password, new_salt
from app.timeutil import as_utc_or_none, iso, utcnow

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/auth/admin/me", response_model=AdminProfile)
def me(admin: Admin = Depends(current_admin)) -> AdminProfile:
    return admin_profile(admin)


@router.get("/settings", response_model=SyncSettings)
def read_settings(_admin: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> SyncSettings:
    return get_app_settings(db)


@router.put("/settings", response_model=SyncSettings)
def write_settings(
    body: SyncSettings, _admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> SyncSettings:
    if body.expiring_soon_days >= body.certificate_validity_days:
        raise bad_request("The expiry warning must be shorter than the certificate validity.")
    return save_app_settings(db, body)


@router.get("/admins", response_model=list[AdminProfile])
def list_admins(_admin: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> list[AdminProfile]:
    return [admin_profile(a) for a in db.scalars(select(Admin).order_by(Admin.id))]


@router.post("/admins", response_model=AdminProfile, status_code=201)
def create_admin(
    body: AdminCreateRequest, _admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> AdminProfile:
    email = body.email.strip().lower()
    if db.scalars(select(Admin).where(func.lower(Admin.email) == email)).first() is not None:
        raise conflict(f"{email} already has an account.")
    salt = new_salt()
    admin = Admin(
        email=email,
        name=body.name.strip(),
        password_salt=salt,
        password_hash=hash_password(body.password, salt),
        active=True,
        created_at=utcnow(),
    )
    db.add(admin)
    db.commit()
    return admin_profile(admin)


@router.patch("/admins/{admin_id}", response_model=AdminProfile)
def update_admin(
    admin_id: int,
    body: AdminUpdateRequest,
    current: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> AdminProfile:
    admin = db.get(Admin, admin_id)
    if admin is None:
        raise not_found("That admin was not found.")
    if body.active is False and admin.id == current.id:
        raise bad_request("You cannot disable your own account.")
    if body.name is not None:
        admin.name = body.name.strip()
    if body.active is not None:
        admin.active = body.active
    if body.password is not None:
        admin.password_salt = new_salt()
        admin.password_hash = hash_password(body.password, admin.password_salt)
    db.commit()
    return admin_profile(admin)


# ---- Blockchain -------------------------------------------------------------------------------


@router.get("/chain/status", response_model=ChainStatus)
def chain_status(_admin: Admin = Depends(current_admin)) -> ChainStatus:
    info = get_anchor().info()
    return ChainStatus(
        adapter=info.adapter,  # type: ignore[arg-type]
        configured=info.configured,
        network=info.network,
        chain_id=info.chain_id,
        address=info.address,
        balance=info.balance,
        explorer_url=info.explorer_url,
        message=info.message,
    )


@router.get("/chain/anchors", response_model=Page[AnchorRow])
def list_anchors(
    status: AnchorStatus | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200, alias="pageSize"),
    _admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Page[AnchorRow]:
    query = select(Certificate).where(Certificate.status == "valid")
    if status is not None:
        query = query.where(Certificate.anchor_status == status)
    certs = list(db.scalars(query.order_by(Certificate.seq.desc())))
    rows = [
        AnchorRow(
            certificate_id=cert.id,
            worker_name=cert.worker_name,
            module_id=cert.module_id,
            hash=cert.hash,
            status=cert.anchor_status,  # type: ignore[arg-type]
            tx_hash=cert.anchor_tx_hash,
            block_number=cert.anchor_block,
            explorer_url=explorer_tx_url(cert.anchor_tx_hash),
            anchored_at=iso(as_utc_or_none(cert.anchored_at)),
            error=cert.anchor_error,
            issued_on=cert.issued_on,
        )
        for cert in certs
    ]
    start = (page - 1) * page_size
    return Page[AnchorRow](
        items=rows[start : start + page_size], total=len(rows), page=page, page_size=page_size
    )


@router.post("/chain/anchor", response_model=AnchorRunResponse)
def anchor_pending(_admin: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> AnchorRunResponse:
    """Anchors every valid certificate that is not on chain yet, and refreshes pending ones."""
    return run_anchoring(db)
