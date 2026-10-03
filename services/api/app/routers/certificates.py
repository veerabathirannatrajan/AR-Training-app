from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.appsettings import get_app_settings
from app.certificates import certificate_row, certificate_state, revoked_ids, run_anchoring
from app.db import get_db
from app.deps import current_admin
from app.errors import bad_request, not_found
from app.models import Admin, Certificate, Worker
from app.pdf import certificate_pdf
from app.schemas import (
    AnchorRunResponse,
    CertificateRow,
    CertificateState,
    Page,
    RevokeRequest,
    SigningKeyOut,
    TrustBundle,
    VerificationChecks,
    VerifyResponse,
)
from app.signing import payload_hash, signing_keys, verify_hash_signature
from app.signing import certificate_payload as signed_payload
from app.timeutil import ist_today, iso, utcnow

router = APIRouter(prefix="/api/certificates", tags=["certificates"])
public = APIRouter(tags=["verify"])


def _load(db: Session, cert_id: str) -> Certificate:
    cert = db.scalars(
        select(Certificate)
        .options(joinedload(Certificate.worker).joinedload(Worker.site))
        .where(Certificate.id == cert_id.strip().upper())
    ).first()
    if cert is None:
        raise not_found(f"Certificate {cert_id} was not found.")
    return cert


@router.get("/keys", response_model=TrustBundle)
def trust_bundle(db: Session = Depends(get_db)) -> TrustBundle:
    """Public keys and revoked ids, so apps can verify certificate QR codes offline."""
    return TrustBundle(
        signing_keys=[SigningKeyOut.model_validate(key) for key in signing_keys()],
        revoked_certificate_ids=revoked_ids(db),
        server_time=iso(utcnow()) or "",
    )


@router.get("", response_model=Page[CertificateRow])
def list_certificates(
    state: CertificateState | None = None,
    module: str | None = None,
    site: str | None = None,
    sector: str | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200, alias="pageSize"),
    _admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Page[CertificateRow]:
    app_settings = get_app_settings(db)
    today = ist_today()
    query = (
        select(Certificate)
        .join(Worker)
        .options(joinedload(Certificate.worker).joinedload(Worker.site))
        .order_by(Certificate.seq.desc())
    )
    if module:
        query = query.where(Certificate.module_id == module)
    if site:
        query = query.where(Worker.site_id == site)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(
                Certificate.id.ilike(like),
                Certificate.worker_name.ilike(like),
                Certificate.worker_id.ilike(like),
            )
        )
    rows = [
        certificate_row(cert, today, app_settings.expiring_soon_days)
        for cert in db.scalars(query).unique()
        if (sector in (None, "", "all") or cert.worker.site.sector == sector)
    ]
    if state is not None:
        rows = [row for row in rows if row.state == state]
    start = (page - 1) * page_size
    return Page[CertificateRow](
        items=rows[start : start + page_size], total=len(rows), page=page, page_size=page_size
    )


@router.get("/{cert_id}", response_model=CertificateRow)
def get_certificate(
    cert_id: str, _admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> CertificateRow:
    app_settings = get_app_settings(db)
    return certificate_row(_load(db, cert_id), ist_today(), app_settings.expiring_soon_days)


@router.post("/{cert_id}/revoke", response_model=CertificateRow)
def revoke_certificate(
    cert_id: str,
    body: RevokeRequest,
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> CertificateRow:
    cert = _load(db, cert_id)
    if cert.status == "revoked":
        raise bad_request(f"{cert.id} is already revoked.")
    cert.status = "revoked"
    cert.revoked_at = utcnow()
    cert.revoked_reason = body.reason.strip()
    cert.revoked_by = admin.email
    db.commit()
    app_settings = get_app_settings(db)
    return certificate_row(cert, ist_today(), app_settings.expiring_soon_days)


@router.post("/{cert_id}/anchor", response_model=AnchorRunResponse)
def anchor_certificate(
    cert_id: str, _admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> AnchorRunResponse:
    cert = _load(db, cert_id)
    return run_anchoring(db, [cert.id])


@router.get("/{cert_id}/pdf", response_class=Response)
def download_certificate(
    cert_id: str, _admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> Response:
    cert = _load(db, cert_id)
    app_settings = get_app_settings(db)
    state = certificate_state(cert, ist_today(), app_settings.expiring_soon_days)
    return Response(
        content=certificate_pdf(cert, state),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{cert.id}.pdf"'},
    )


def verify_stored(cert: Certificate, today: str, expiring_soon_days: int) -> VerifyResponse:
    """Server-side check of a stored certificate: hash, signature, expiry, revocation."""
    digest = payload_hash(
        signed_payload(
            cert_id=cert.id,
            worker_id=cert.worker_id,
            worker_name=cert.worker_name,
            module_id=cert.module_id,
            score=cert.score,
            issued_on=cert.issued_on,
            expires_on=cert.expires_on,
        )
    )
    key = next((key for key in signing_keys() if key["keyId"] == cert.key_id), None)
    hash_matches = digest == cert.hash
    signature_valid = (
        verify_hash_signature(cert.hash, cert.signature, key["publicKey"]) if key else None
    )
    expired = today > cert.expires_on
    revoked = cert.status == "revoked"
    if not hash_matches or signature_valid is False:
        verdict = "invalid"
    elif signature_valid is None:
        verdict = "unknown-key"
    elif revoked:
        verdict = "revoked"
    elif expired:
        verdict = "expired"
    else:
        verdict = "valid"
    return VerifyResponse(
        verdict=verdict,  # type: ignore[arg-type]
        certificate=certificate_row(cert, today, expiring_soon_days),
        checks=VerificationChecks(
            hash_matches=hash_matches,
            signature_valid=signature_valid,
            expired=expired,
            revoked=revoked,
        ),
        checked_at=iso(utcnow()) or "",
    )


@public.get("/api/verify/{cert_id}", response_model=VerifyResponse)
def verify_certificate(cert_id: str, db: Session = Depends(get_db)) -> VerifyResponse:
    """Public certificate check by id (the portal and apps also verify QR codes offline)."""
    cert = db.scalars(
        select(Certificate)
        .options(joinedload(Certificate.worker).joinedload(Worker.site))
        .where(Certificate.id == cert_id.strip().upper())
    ).first()
    if cert is None:
        return VerifyResponse(
            verdict="not-found", certificate=None, checks=None, checked_at=iso(utcnow()) or ""
        )
    app_settings = get_app_settings(db)
    return verify_stored(cert, ist_today(), app_settings.expiring_soon_days)
