"""Workers and sites (admin portal)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import load_context, next_worker_id, worker_detail, worker_rows
from app.db import get_db
from app.deps import current_admin
from app.errors import bad_request, conflict, not_found
from app.models import Site, Worker
from app.schemas import (
    Page,
    SectorFilter,
    SiteCreateRequest,
    SiteOut,
    SiteUpdateRequest,
    WorkerCreateRequest,
    WorkerDetail,
    WorkerRow,
    WorkerUpdateRequest,
)
from app.security import hash_pin, new_salt
from app.timeutil import utcnow

router = APIRouter(prefix="/api", tags=["workers"], dependencies=[Depends(current_admin)])


@router.get("/workers", response_model=Page[WorkerRow])
def list_workers(
    sector: SectorFilter = "all",
    site: str | None = None,
    certification: str | None = Query(
        default=None, pattern="^(certified|partial|expiring|not-certified)$"
    ),
    active: bool | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200, alias="pageSize"),
    db: Session = Depends(get_db),
) -> Page[WorkerRow]:
    rows = worker_rows(load_context(db, "all", sector, site))
    needle = (search or "").strip().lower()
    rows = [
        row
        for row in rows
        if (certification is None or row.certification == certification)
        and (active is None or row.active == active)
        and (not needle or needle in row.name.lower() or needle in row.worker_id or needle in row.role.lower())
    ]
    start = (page - 1) * page_size
    return Page[WorkerRow](
        items=rows[start : start + page_size], total=len(rows), page=page, page_size=page_size
    )


@router.get("/workers/{worker_id}", response_model=WorkerDetail)
def get_worker(worker_id: str, db: Session = Depends(get_db)) -> WorkerDetail:
    detail = worker_detail(db, worker_id)
    if detail is None:
        raise not_found(f"Worker {worker_id} was not found.")
    return detail


@router.post("/workers", response_model=WorkerDetail, status_code=201)
def create_worker(body: WorkerCreateRequest, db: Session = Depends(get_db)) -> WorkerDetail:
    if db.get(Site, body.site_id) is None:
        raise bad_request(f"Site {body.site_id} does not exist.")
    try:
        worker_id = next_worker_id(db, body.site_id)
    except ValueError as error:
        raise conflict(str(error)) from error
    salt = new_salt()
    db.add(Worker(
        id=worker_id,
        name=body.name.strip(),
        role=body.role.strip(),
        site_id=body.site_id,
        preferred_language=body.preferred_language,
        pin_salt=salt,
        pin_hash=hash_pin(body.pin, salt),
        active=True,
        failed_logins=0,
        created_at=utcnow(),
    ))
    db.commit()
    detail = worker_detail(db, worker_id)
    assert detail is not None
    return detail


@router.patch("/workers/{worker_id}", response_model=WorkerDetail)
def update_worker(worker_id: str, body: WorkerUpdateRequest, db: Session = Depends(get_db)) -> WorkerDetail:
    worker = db.get(Worker, worker_id)
    if worker is None:
        raise not_found(f"Worker {worker_id} was not found.")
    if body.site_id is not None and db.get(Site, body.site_id) is None:
        raise bad_request(f"Site {body.site_id} does not exist.")
    for field in ("name", "role", "site_id", "preferred_language", "active"):
        value = getattr(body, field)
        if value is not None:
            setattr(worker, field, value.strip() if isinstance(value, str) else value)
    if body.pin is not None:
        worker.pin_salt = new_salt()
        worker.pin_hash = hash_pin(body.pin, worker.pin_salt)
        worker.failed_logins = 0
        worker.locked_until = None
    db.commit()
    detail = worker_detail(db, worker_id)
    assert detail is not None
    return detail


# ---- Sites ------------------------------------------------------------------------------------


def _site_out(db: Session, site: Site) -> SiteOut:
    count = len(list(db.scalars(select(Worker.id).where(Worker.site_id == site.id))))
    return SiteOut(
        id=site.id, name=site.name, district=site.district, sector=site.sector,  # type: ignore[arg-type]
        latitude=site.latitude, longitude=site.longitude, workers=count,
    )


@router.get("/sites", response_model=list[SiteOut])
def list_sites(db: Session = Depends(get_db)) -> list[SiteOut]:
    return [_site_out(db, site) for site in db.scalars(select(Site).order_by(Site.id))]


@router.post("/sites", response_model=SiteOut, status_code=201)
def create_site(body: SiteCreateRequest, db: Session = Depends(get_db)) -> SiteOut:
    if db.get(Site, body.id) is not None:
        raise conflict(f"Site {body.id} already exists.")
    site = Site(**body.model_dump())
    db.add(site)
    db.commit()
    return _site_out(db, site)


@router.patch("/sites/{site_id}", response_model=SiteOut)
def update_site(site_id: str, body: SiteUpdateRequest, db: Session = Depends(get_db)) -> SiteOut:
    site = db.get(Site, site_id)
    if site is None:
        raise not_found(f"Site {site_id} was not found.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(site, field, value)
    db.commit()
    return _site_out(db, site)
