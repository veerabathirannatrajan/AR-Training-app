"""CSV and PDF exports for compliance reporting."""

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.analytics import assessment_rows, kpis, load_context, module_stats, site_overview, worker_rows
from app.certificates import certificate_row
from app.content import assessed_modules
from app.db import get_db
from app.deps import current_admin
from app.pdf import compliance_pdf
from app.schemas import DateRange, SectorFilter, WorkerRow
from app.timeutil import utcnow

router = APIRouter(prefix="/api/reports", tags=["reports"], dependencies=[Depends(current_admin)])

RANGE_LABELS = {"7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days",
                "365d": "Last 12 months", "all": "All time"}
STATE_LABELS = {"valid": "Valid", "expiring": "Expiring soon", "expired": "Expired",
                "revoked": "Revoked", "provisional": "Provisional"}


def _csv(name: str, header: list[str], rows: list[list[object]]) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    # BOM so Excel opens the file as UTF-8 (names may be in Devanagari).
    return Response(
        content="﻿" + buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


def _stamp() -> str:
    return utcnow().strftime("%Y%m%d")


def _module_cell(row: WorkerRow, module_id: str) -> tuple[str, str, str]:
    badge = next((b for b in row.certificates if b.module_id == module_id), None)
    if badge is None:
        return ("Not certified", "", "")
    return (STATE_LABELS[badge.state], badge.certificate_id, badge.expires_on)


@router.get("/compliance.csv")
def compliance_csv(
    range: DateRange = "30d",  # noqa: A002
    sector: SectorFilter = "all",
    site: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    """Worker certification register: one row per worker with each module's certificate."""
    ctx = load_context(db, range, sector, site)
    modules = assessed_modules()
    header = ["Worker ID", "Name", "Role", "Site", "District", "Sector", "Language", "Active"]
    for module in modules:
        name = module.title["en"]
        header += [f"{name} status", f"{name} certificate", f"{name} valid until"]
    header += ["Assessments", "Average score %", "Last activity (UTC)", "Registered (UTC)"]
    rows: list[list[object]] = []
    for row in worker_rows(ctx):
        line: list[object] = [row.worker_id, row.name, row.role, row.site_name, row.district,
                              row.sector, row.preferred_language, "yes" if row.active else "no"]
        for module in modules:
            line += list(_module_cell(row, module.id))
        line += [row.assessments, "" if row.avg_score is None else row.avg_score,
                 row.last_activity_at or "", row.created_at]
        rows.append(line)
    return _csv(f"compliance-register-{_stamp()}.csv", header, rows)


@router.get("/assessments.csv")
def assessments_csv(
    range: DateRange = "30d",  # noqa: A002
    sector: SectorFilter = "all",
    site: str | None = None,
    module: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    ctx = load_context(db, range, sector, site)
    header = ["Completed (UTC)", "Worker ID", "Worker", "Site", "Module", "Type", "Attempt",
              "Score %", "Practical %", "Quiz %", "Result", "Critical errors", "Language", "Mode",
              "Certificate"]
    rows: list[list[object]] = [
        [r.completed_at, r.worker_id, r.worker_name, r.site_name, r.module_title["en"], r.attempt_type,
         r.attempt_number or "", r.score, r.practical_percent if r.practical_percent is not None else "",
         r.quiz_percent if r.quiz_percent is not None else "",
         "Passed" if r.passed else "Failed" if r.passed is False else "Completed",
         "; ".join(r.critical_errors), r.language or "", r.mode, r.certificate_id or ""]
        for r in assessment_rows(ctx, module=module, attempt_type=None)
    ]
    return _csv(f"assessments-{_stamp()}.csv", header, rows)


@router.get("/certificates.csv")
def certificates_csv(
    sector: SectorFilter = "all",
    site: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    ctx = load_context(db, "all", sector, site)
    header = ["Certificate", "Worker ID", "Worker", "Site", "Module", "Score %", "Issued on",
              "Valid until", "Status", "SHA-256", "Signature key", "Polygon Amoy tx"]
    rows: list[list[object]] = []
    for cert in sorted(ctx.certificates, key=lambda c: c.seq):
        row = certificate_row(cert, ctx.today, ctx.settings.expiring_soon_days)
        rows.append([row.id, row.worker_id, row.worker_name, row.site_name, row.module_title["en"],
                     row.score, row.issued_on, row.expires_on, STATE_LABELS[row.state], row.hash,
                     row.key_id or "", row.anchor.tx_hash or ""])
    return _csv(f"certificates-{_stamp()}.csv", header, rows)


@router.get("/compliance.pdf")
def compliance_report_pdf(
    range: DateRange = "30d",  # noqa: A002
    sector: SectorFilter = "all",
    site: str | None = None,
    db: Session = Depends(get_db),
) -> Response:
    ctx = load_context(db, range, sector, site)
    figures = kpis(ctx)
    sites = site_overview(ctx)
    modules = [m for m in module_stats(ctx) if m.kind == "assessed"]
    assessed = assessed_modules()
    filters = RANGE_LABELS.get(range, range) + (
        "" if sector == "all" else f" · {sector.capitalize()} sector"
    ) + (f" · {sites[0].name}" if site and sites else "")
    pdf = compliance_pdf(
        filters=filters,
        generated_at=utcnow(),
        kpis=[
            ("Workers registered", str(figures.workers_registered)),
            ("Certified", f"{figures.certified_workers} ({figures.certified_percent:g}%)"),
            ("Avg. score", "–" if figures.avg_score is None else f"{figures.avg_score}%"),
            ("Assessments", str(figures.assessments)),
            ("Expiring soon", str(figures.expiring_soon)),
        ],
        sites=[
            [s.name, s.district, s.sector.capitalize(), str(s.workers), str(s.certified),
             f"{s.compliance_percent}%", "–" if s.avg_score is None else f"{s.avg_score}%"]
            for s in sites
        ],
        modules=[
            [m.title["en"], str(m.assessments), "–" if m.pass_rate is None else f"{m.pass_rate}%",
             "–" if m.avg_score is None else f"{m.avg_score}%", str(m.certified_workers)]
            for m in modules
        ],
        workers=[
            [row.worker_id, row.name, row.district,
             *[_module_cell(row, module.id)[0] for module in assessed],
             "–" if row.avg_score is None else f"{row.avg_score}%",
             (row.last_activity_at or "")[:10]]
            for row in worker_rows(ctx)
        ],
        module_columns=[module.title["en"].split(" &")[0].split(" Response")[0] for module in assessed],
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="compliance-report-{_stamp()}.pdf"'},
    )
