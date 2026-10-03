"""Dashboard, assessments, modules and devices for the admin portal."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import (
    assessment_detail,
    assessment_rows,
    dashboard,
    load_context,
    module_detail,
    module_stats,
)
from app.db import get_db
from app.deps import current_admin
from app.errors import not_found
from app.models import Admin, Device, Worker
from app.schemas import (
    AssessmentDetail,
    AssessmentRow,
    DashboardResponse,
    DateRange,
    DeviceRow,
    ModuleDetail,
    ModuleStats,
    Page,
    SectorFilter,
)
from app.timeutil import iso

router = APIRouter(prefix="/api", tags=["analytics"], dependencies=[Depends(current_admin)])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    range: DateRange = "30d",  # noqa: A002 (query parameter name)
    sector: SectorFilter = "all",
    db: Session = Depends(get_db),
) -> DashboardResponse:
    return dashboard(db, range, sector)


@router.get("/assessments", response_model=Page[AssessmentRow])
def list_assessments(
    range: DateRange = "30d",  # noqa: A002
    sector: SectorFilter = "all",
    site: str | None = None,
    module: str | None = None,
    status: str | None = Query(default=None, pattern="^(passed|failed|certified)$"),
    type: str | None = Query(default="assessment", pattern="^(assessment|retraining|practice|all)$"),  # noqa: A002
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200, alias="pageSize"),
    db: Session = Depends(get_db),
) -> Page[AssessmentRow]:
    ctx = load_context(db, range, sector, site)
    rows = assessment_rows(
        ctx,
        module=module,
        status=status,
        attempt_type=None if type == "all" else type,
        search=search,
    )
    start = (page - 1) * page_size
    return Page[AssessmentRow](
        items=rows[start : start + page_size], total=len(rows), page=page, page_size=page_size
    )


@router.get("/assessments/{result_id}", response_model=AssessmentDetail)
def get_assessment(result_id: str, db: Session = Depends(get_db)) -> AssessmentDetail:
    detail = assessment_detail(db, result_id)
    if detail is None:
        raise not_found("That assessment was not found.")
    return detail


@router.get("/modules", response_model=list[ModuleStats])
def list_modules(
    range: DateRange = "30d",  # noqa: A002
    sector: SectorFilter = "all",
    db: Session = Depends(get_db),
) -> list[ModuleStats]:
    return module_stats(load_context(db, range, sector))


@router.get("/modules/{module_id}", response_model=ModuleDetail)
def get_module_detail(
    module_id: str,
    range: DateRange = "30d",  # noqa: A002
    sector: SectorFilter = "all",
    db: Session = Depends(get_db),
) -> ModuleDetail:
    detail = module_detail(load_context(db, range, sector), module_id)
    if detail is None:
        raise not_found(f"Module {module_id} was not found.")
    return detail


@router.get("/devices", response_model=list[DeviceRow])
def list_devices(db: Session = Depends(get_db), _admin: Admin = Depends(current_admin)) -> list[DeviceRow]:
    rows = []
    for device in db.scalars(select(Device).order_by(Device.last_sync_at.desc())):
        worker = db.get(Worker, device.last_worker_id) if device.last_worker_id else None
        rows.append(DeviceRow(
            device_id=device.id,
            app_version=device.app_version,
            last_sync_at=iso(device.last_sync_at) or "",
            last_worker_id=device.last_worker_id,
            last_worker_name=worker.name if worker else None,
            pending_count=device.pending_count,
            results_uploaded=device.results_uploaded,
        ))
    return rows
