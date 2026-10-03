"""Issuing, describing and anchoring certificates."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.chain import explorer_tx_url, get_anchor
from app.content import ModuleInfo, module_title
from app.db import SessionLocal
from app.models import Certificate, Worker
from app.schemas import (
    AnchorRunResponse,
    CertificateAnchor,
    CertificateOut,
    CertificateRow,
    SyncSettings,
)
from app.signing import certificate_payload, current_key_id, payload_hash, sign_hash
from app.timeutil import add_days, as_utc_or_none, days_between, ist_date, iso, utcnow


def certificate_state(cert: Certificate, today: str, expiring_soon_days: int) -> str:
    if cert.status == "revoked":
        return "revoked"
    if today > cert.expires_on:
        return "expired"
    return "expiring" if days_between(today, cert.expires_on) <= expiring_soon_days else "valid"


def is_current(cert: Certificate, today: str) -> bool:
    """Valid today: signed, not revoked, not expired."""
    return cert.status == "valid" and cert.expires_on >= today


def anchor_out(cert: Certificate) -> CertificateAnchor:
    return CertificateAnchor(
        status=cert.anchor_status,  # type: ignore[arg-type]
        network=cert.anchor_network,
        tx_hash=cert.anchor_tx_hash,
        block_number=cert.anchor_block,
        explorer_url=explorer_tx_url(cert.anchor_tx_hash),
        anchored_at=iso(as_utc_or_none(cert.anchored_at)),
        error=cert.anchor_error,
    )


def certificate_out(cert: Certificate) -> CertificateOut:
    return CertificateOut(
        id=cert.id,
        worker_id=cert.worker_id,
        worker_name=cert.worker_name,
        module_id=cert.module_id,
        score=cert.score,
        issued_on=cert.issued_on,
        expires_on=cert.expires_on,
        hash=cert.hash,
        signature=cert.signature,
        key_id=cert.key_id,
        status=cert.status,  # type: ignore[arg-type]
        module_version=cert.module_version,
        result_id=cert.result_id,
        provisional_id=cert.provisional_id,
        revoked_at=iso(as_utc_or_none(cert.revoked_at)),
        revoked_reason=cert.revoked_reason,
        anchor=anchor_out(cert),
    )


def certificate_row(cert: Certificate, today: str, expiring_soon_days: int) -> CertificateRow:
    worker = cert.worker
    return CertificateRow(
        **certificate_out(cert).model_dump(),
        state=certificate_state(cert, today, expiring_soon_days),  # type: ignore[arg-type]
        site_id=worker.site_id,
        site_name=worker.site.name,
        module_title=module_title(cert.module_id),
    )


def current_certificate(db: Session, worker_id: str, module_id: str, today: str) -> Certificate | None:
    """The worker's newest certificate for the module that is valid today."""
    return db.scalars(
        select(Certificate)
        .where(
            Certificate.worker_id == worker_id,
            Certificate.module_id == module_id,
            Certificate.status == "valid",
            Certificate.expires_on >= today,
        )
        .order_by(Certificate.expires_on.desc())
        .limit(1)
    ).first()


def issue_certificate(
    db: Session,
    *,
    worker: Worker,
    module: ModuleInfo,
    score: int,
    passed_at: datetime,
    validity_days: int,
    result_id: str | None,
    provisional_id: str | None = None,
) -> Certificate:
    seq = (db.scalar(select(func.max(Certificate.seq))) or 0) + 1
    cert_id = f"CERT-{seq:04d}"
    issued_on = ist_date(passed_at)
    expires_on = add_days(issued_on, validity_days)
    digest = payload_hash(
        certificate_payload(
            cert_id=cert_id,
            worker_id=worker.id,
            worker_name=worker.name,
            module_id=module.id,
            score=score,
            issued_on=issued_on,
            expires_on=expires_on,
        )
    )
    cert = Certificate(
        id=cert_id,
        seq=seq,
        worker_id=worker.id,
        worker_name=worker.name,
        module_id=module.id,
        module_version=module.version,
        score=score,
        issued_on=issued_on,
        expires_on=expires_on,
        result_id=result_id,
        provisional_id=provisional_id,
        hash=digest,
        signature=sign_hash(digest),
        key_id=current_key_id(),
        status="valid",
        created_at=utcnow(),
        anchor_status="not-anchored",
    )
    db.add(cert)
    db.flush()
    return cert


def certificate_for_pass(
    db: Session,
    *,
    worker: Worker,
    module: ModuleInfo,
    score: int,
    passed_at: datetime,
    result_id: str,
    app_settings: SyncSettings,
) -> Certificate:
    """A pass keeps the worker's current certificate unless it is close to expiry (renewal)."""
    today = ist_date(passed_at)
    existing = current_certificate(db, worker.id, module.id, today)
    if existing is not None and days_between(today, existing.expires_on) > app_settings.expiring_soon_days:
        return existing
    return issue_certificate(
        db,
        worker=worker,
        module=module,
        score=score,
        passed_at=passed_at,
        validity_days=app_settings.certificate_validity_days,
        result_id=result_id,
    )


def revoked_ids(db: Session) -> list[str]:
    return list(db.scalars(select(Certificate.id).where(Certificate.status == "revoked")))


# ---- Anchoring --------------------------------------------------------------------------------


def run_anchoring(db: Session, certificate_ids: list[str] | None = None) -> AnchorRunResponse:
    """Anchors valid certificates that are not anchored yet and refreshes pending ones."""
    anchor = get_anchor()
    if not anchor.configured:
        return AnchorRunResponse(
            attempted=0, anchored=0, pending=0, failed=0, message=anchor.info().message
        )

    query = select(Certificate).where(Certificate.status == "valid")
    if certificate_ids is not None:
        query = query.where(Certificate.id.in_(certificate_ids))
    certificates = list(db.scalars(query.order_by(Certificate.seq)))

    # Pending transactions first: they may have been mined since.
    for cert in (c for c in certificates if c.anchor_status == "pending"):
        receipt = anchor.verify(cert.hash, cert.anchor_tx_hash)
        cert.anchor_status = receipt.status
        cert.anchor_block = receipt.block_number
        cert.anchor_error = receipt.error
        if receipt.status == "anchored":
            cert.anchored_at = utcnow()

    to_send = [c for c in certificates if c.anchor_status in ("not-anchored", "failed")]
    receipts = anchor.anchor_many([cert.hash for cert in to_send])
    for cert, receipt in zip(to_send, receipts, strict=True):
        cert.anchor_status = receipt.status
        cert.anchor_network = receipt.network
        cert.anchor_tx_hash = receipt.tx_hash
        cert.anchor_block = receipt.block_number
        cert.anchor_error = receipt.error
    db.commit()

    statuses = [cert.anchor_status for cert in certificates]
    return AnchorRunResponse(
        attempted=len(to_send),
        anchored=statuses.count("anchored"),
        pending=statuses.count("pending"),
        failed=statuses.count("failed"),
        message=None,
    )


def anchor_in_background(certificate_ids: list[str]) -> None:
    """After a sync: anchor newly issued certificates without delaying the phone's response."""
    if not get_anchor().configured or not certificate_ids:
        return
    with SessionLocal() as db:
        run_anchoring(db, certificate_ids)
