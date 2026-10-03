"""Phone ↔ API sync: push queued results, pull certificates, keys, revocations and settings."""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.appsettings import get_app_settings
from app.certificates import (
    anchor_in_background,
    certificate_for_pass,
    certificate_out,
    revoked_ids,
)
from app.content import get_module
from app.db import get_db
from app.deps import current_worker
from app.models import Certificate, Device, Result, TrainingEventRecord, Worker
from app.schemas import (
    SigningKeyOut,
    SyncedResult,
    SyncItem,
    SyncRequest,
    SyncResponse,
    SyncSettings,
)
from app.scoring import score_attempt
from app.signing import signing_keys
from app.timeutil import from_ms, iso, utcnow

router = APIRouter(prefix="/api/sync", tags=["sync"])
log = logging.getLogger("uvicorn.error")


def _reject(result_id: str, reason: str) -> SyncedResult:
    return SyncedResult(
        result_id=result_id, status="rejected", reason=reason, passed=None, fail_reason=None,
        certificate_id=None,
    )


def _stored(result: Result, status: str) -> SyncedResult:
    return SyncedResult(
        result_id=result.id,
        status=status,  # type: ignore[arg-type]
        reason=None,
        passed=result.passed,
        fail_reason=result.fail_reason,  # type: ignore[arg-type]
        certificate_id=result.certificate_id,
    )


def _validate(item: SyncItem, worker: Worker) -> str | None:
    """Why an uploaded result can't be accepted, or None."""
    result = item.result
    if result.worker_id != worker.id:
        return "worker-mismatch"
    module = get_module(result.module_id)
    if module is None:
        return "unknown-module"
    known_steps = {step.id: step for step in module.steps}
    for step in result.steps:
        content_step = known_steps.get(step.step_id)
        if content_step is None:
            return f"unknown-step:{step.step_id}"
        if step.points > step.max_points or step.max_points > content_step.points:
            return f"bad-points:{step.step_id}"
    if result.completed_at < result.started_at:
        return "bad-times"
    if module.kind == "tutorial" and result.attempt_type not in (None, "practice"):
        return "bad-attempt-type"
    return None


def _store(
    db: Session, item: SyncItem, worker: Worker, device_id: str, app_settings: SyncSettings
) -> tuple[Result, Certificate | None]:
    incoming = item.result
    module = get_module(incoming.module_id)
    assert module is not None  # checked in _validate
    attempt_type = incoming.attempt_type or ("practice" if module.kind == "tutorial" else "assessment")
    steps = [step.model_dump(by_alias=True, exclude_none=True) for step in incoming.steps]
    quiz = [answer.model_dump(by_alias=True) for answer in incoming.quiz or []]
    critical = list(dict.fromkeys(incoming.critical_errors or []))
    # Re-apply the assessment rules with the pass mark in force.
    score = score_attempt(
        kind=module.kind,
        attempt_type=attempt_type,
        steps=steps,
        quiz=quiz,
        quiz_total=len(module.quiz),
        critical_errors=critical,
        pass_mark=app_settings.pass_mark,
    )
    completed_at = from_ms(incoming.completed_at)
    result = Result(
        id=incoming.id,
        session_id=incoming.session_id,
        worker_id=worker.id,
        module_id=module.id,
        module_version=incoming.module_version,
        attempt_type=attempt_type,
        mode=incoming.mode,
        language=incoming.language or worker.preferred_language,
        started_at=from_ms(incoming.started_at),
        completed_at=completed_at,
        score=incoming.score,
        max_score=incoming.max_score,
        total_percent=score.total_percent,
        practical_percent=score.practical_percent,
        quiz_percent=score.quiz_percent,
        passed=score.passed,
        fail_reason=score.fail_reason,
        pass_mark=app_settings.pass_mark if score.passed is not None else None,
        critical_errors=critical,
        steps=steps,
        quiz=quiz,
        device_id=device_id,
        received_at=utcnow(),
        source="device",
    )
    db.add(result)

    certificate = None
    if attempt_type == "assessment" and score.passed is True:
        certificate = certificate_for_pass(
            db,
            worker=worker,
            module=module,
            score=score.total_percent,
            passed_at=completed_at,
            result_id=result.id,
            app_settings=app_settings,
        )
        result.certificate_id = certificate.id

    known_events = set(
        db.scalars(
            select(TrainingEventRecord.id).where(
                TrainingEventRecord.id.in_([event.id for event in item.events])
            )
        )
    )
    for event in item.events:
        if event.id in known_events or event.worker_id != worker.id:
            continue
        db.add(
            TrainingEventRecord(
                id=event.id,
                session_id=event.session_id,
                worker_id=worker.id,
                module_id=event.module_id,
                step_id=event.step_id,
                action=event.action,
                correct=event.correct,
                critical=event.critical,
                timestamp=from_ms(event.timestamp),
                time_taken_ms=max(0, event.time_taken_ms),
                detail=event.detail,
            )
        )
    return result, certificate


@router.post("", response_model=SyncResponse)
def sync(
    body: SyncRequest,
    background: BackgroundTasks,
    worker: Worker = Depends(current_worker),
    db: Session = Depends(get_db),
) -> SyncResponse:
    app_settings = get_app_settings(db)
    outcomes: list[SyncedResult] = []
    issued: list[str] = []
    accepted = 0

    for item in sorted(body.items, key=lambda entry: entry.result.completed_at):
        existing = db.get(Result, item.result.id)
        if existing is not None:
            outcomes.append(
                _stored(existing, "duplicate")
                if existing.worker_id == worker.id
                else _reject(item.result.id, "worker-mismatch")
            )
            continue
        reason = _validate(item, worker)
        if reason is not None:
            log.warning("Rejected result %s from %s: %s", item.result.id, worker.id, reason)
            outcomes.append(_reject(item.result.id, reason))
            continue
        result, certificate = _store(db, item, worker, body.device_id, app_settings)
        db.flush()
        accepted += 1
        if certificate is not None and certificate.result_id == result.id:
            issued.append(certificate.id)
        outcomes.append(_stored(result, "accepted"))

    device = db.get(Device, body.device_id)
    if device is None:
        device = Device(id=body.device_id, results_uploaded=0)
        db.add(device)
    device.app_version = body.app_version
    device.last_sync_at = utcnow()
    device.last_worker_id = worker.id
    device.pending_count = body.pending_count
    device.results_uploaded = (device.results_uploaded or 0) + accepted
    db.commit()

    if issued:
        background.add_task(anchor_in_background, issued)

    certificates = db.scalars(
        select(Certificate).where(Certificate.worker_id == worker.id).order_by(Certificate.seq)
    )
    return SyncResponse(
        results=outcomes,
        certificates=[certificate_out(cert) for cert in certificates],
        revoked_certificate_ids=revoked_ids(db),
        signing_keys=[SigningKeyOut.model_validate(key) for key in signing_keys()],
        settings=app_settings,
        server_time=iso(utcnow()) or "",
    )
