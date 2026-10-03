"""Compliance analytics for the admin portal, computed from results and certificates.

The data set is small (hundreds of workers, thousands of results), so everything is computed in
memory per request from one query per table; no pre-aggregation is needed.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import mean

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.appsettings import get_app_settings
from app.certificates import certificate_out, certificate_state, is_current
from app.content import MODULE_ORDER, all_modules, assessed_modules, get_module, module_title
from app.models import Certificate, Device, Result, Site, Worker
from app.schemas import (
    AssessmentDetail,
    AssessmentQuizAnswer,
    AssessmentRow,
    AssessmentStep,
    CriticalErrorStat,
    DashboardResponse,
    Insight,
    Kpis,
    ModuleDetail,
    ModuleMastery,
    ModuleStats,
    QuizStat,
    SiteOverview,
    StepMasteryRow,
    StepStat,
    SyncOverview,
    SyncSettings,
    TrendPoint,
    WorkerCertificateBadge,
    WorkerDetail,
    WorkerRow,
)
from app.scoring import is_clean
from app.timeutil import as_utc, as_utc_or_none, days_between, iso, ist_today, js_round, utcnow

RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90, "365d": 365, "all": None}


def _pct(part: float, whole: float) -> int:
    return js_round(part / whole * 100) if whole > 0 else 0


def _avg(values: list[int]) -> int | None:
    return js_round(mean(values)) if values else None


@dataclass
class Context:
    now: datetime
    today: str
    since: datetime | None
    range: str
    sector: str
    settings: SyncSettings
    sites: list[Site]
    workers: dict[str, Worker]
    results_all: list[Result]
    certificates: list[Certificate]

    @property
    def results(self) -> list[Result]:
        """Results in the selected period."""
        if self.since is None:
            return self.results_all
        return [r for r in self.results_all if as_utc(r.completed_at) >= self.since]

    def assessments(self, results: list[Result] | None = None) -> list[Result]:
        return [r for r in (results if results is not None else self.results)
                if r.attempt_type == "assessment"]

    def current_certs(self) -> list[Certificate]:
        return [c for c in self.certificates if is_current(c, self.today)]


def load_context(db: Session, range_: str = "30d", sector: str = "all", site: str | None = None) -> Context:
    now = utcnow()
    days = RANGE_DAYS.get(range_, 30)
    sites = list(db.scalars(select(Site).order_by(Site.id)))
    if sector != "all":
        sites = [s for s in sites if s.sector == sector]
    if site:
        sites = [s for s in sites if s.id == site]
    site_ids = {s.id for s in sites}
    workers = {
        w.id: w
        for w in db.scalars(select(Worker).options(joinedload(Worker.site)))
        if w.site_id in site_ids
    }
    results = [
        r for r in db.scalars(select(Result).order_by(Result.completed_at)) if r.worker_id in workers
    ]
    certificates = [
        c for c in db.scalars(select(Certificate).order_by(Certificate.seq)) if c.worker_id in workers
    ]
    return Context(
        now=now,
        today=ist_today(),
        since=None if days is None else now - timedelta(days=days),
        range=range_,
        sector=sector,
        settings=get_app_settings(db),
        sites=sites,
        workers=workers,
        results_all=results,
        certificates=certificates,
    )


# ---- Building blocks ---------------------------------------------------------------------------


def attempt_numbers(results: list[Result]) -> dict[str, int]:
    """n-th assessment of the module by the worker, for every assessment result."""
    counters: dict[tuple[str, str], int] = defaultdict(int)
    numbers: dict[str, int] = {}
    for result in sorted(results, key=lambda r: as_utc(r.completed_at)):
        if result.attempt_type != "assessment":
            continue
        key = (result.worker_id, result.module_id)
        counters[key] += 1
        numbers[result.id] = counters[key]
    return numbers


def assessment_row(result: Result, worker: Worker, attempt_number: int) -> AssessmentRow:
    return AssessmentRow(
        result_id=result.id,
        worker_id=worker.id,
        worker_name=worker.name,
        site_id=worker.site_id,
        site_name=worker.site.name,
        district=worker.site.district,
        module_id=result.module_id,
        module_title=module_title(result.module_id),
        attempt_type=result.attempt_type,  # type: ignore[arg-type]
        attempt_number=attempt_number,
        score=result.total_percent,
        practical_percent=result.practical_percent,
        quiz_percent=result.quiz_percent,
        passed=result.passed,
        fail_reason=result.fail_reason,  # type: ignore[arg-type]
        critical_errors=list(result.critical_errors or []),
        language=result.language,  # type: ignore[arg-type]
        mode=result.mode,  # type: ignore[arg-type]
        started_at=iso(result.started_at) or "",
        completed_at=iso(result.completed_at) or "",
        certificate_id=result.certificate_id,
    )


def step_stats(ctx: Context, module_id: str, results: list[Result] | None = None) -> list[StepStat]:
    module = get_module(module_id)
    if module is None:
        return []
    source = [
        r for r in (results if results is not None else ctx.results)
        if r.module_id == module_id and r.attempt_type in ("assessment", "retraining", "practice")
    ]
    attempts: dict[str, int] = defaultdict(int)
    clean: dict[str, int] = defaultdict(int)
    mistakes: dict[str, int] = defaultdict(int)
    critical: dict[str, int] = defaultdict(int)
    workers: dict[str, set[str]] = defaultdict(set)
    struggling: dict[str, set[str]] = defaultdict(set)
    for result in source:
        for step in result.steps or []:
            if step.get("skipped") is True:
                continue
            step_id = step["stepId"]
            attempts[step_id] += 1
            workers[step_id].add(result.worker_id)
            mistakes[step_id] += int(step.get("mistakes", 0))
            if step.get("critical"):
                critical[step_id] += 1
            if is_clean(step):
                clean[step_id] += 1
            else:
                struggling[step_id].add(result.worker_id)
    return [
        StepStat(
            module_id=module_id,
            step_id=step.id,
            title=step.title,
            attempts=attempts[step.id],
            workers=len(workers[step.id]),
            workers_with_mistakes=len(struggling[step.id]),
            clean_rate=_pct(clean[step.id], attempts[step.id]) if attempts[step.id] else 100,
            avg_mistakes=round(mistakes[step.id] / attempts[step.id], 2) if attempts[step.id] else 0.0,
            critical_count=critical[step.id],
        )
        for step in module.steps
    ]


def critical_stats(ctx: Context, module_id: str | None = None) -> list[CriticalErrorStat]:
    counts: dict[tuple[str, str], int] = defaultdict(int)
    workers: dict[tuple[str, str], set[str]] = defaultdict(set)
    for result in ctx.results:
        if module_id is not None and result.module_id != module_id:
            continue
        for error_id in result.critical_errors or []:
            key = (result.module_id, error_id)
            counts[key] += 1
            workers[key].add(result.worker_id)
    stats = []
    for (mod_id, error_id), count in counts.items():
        module = get_module(mod_id)
        title = (module.critical_errors.get(error_id) if module else None) or {"en": error_id, "hi": error_id}
        stats.append(CriticalErrorStat(module_id=mod_id, error_id=error_id, title=title, count=count,
                                       workers=len(workers[(mod_id, error_id)])))
    return sorted(stats, key=lambda s: (-s.count, s.error_id))


def module_stats(ctx: Context) -> list[ModuleStats]:
    current = ctx.current_certs()
    stats = []
    for module_id in MODULE_ORDER:
        module = get_module(module_id)
        if module is None:
            continue
        mine = [r for r in ctx.results if r.module_id == module_id]
        counted = [r for r in mine if r.attempt_type == ("assessment" if module.assessed else "practice")]
        durations = [
            int((as_utc(r.completed_at) - as_utc(r.started_at)).total_seconds()) for r in counted
        ]
        stats.append(
            ModuleStats(
                module_id=module_id,
                title=module.title,
                kind=module.kind,  # type: ignore[arg-type]
                version=module.version,
                assessments=len(counted),
                workers_attempted=len({r.worker_id for r in counted}),
                pass_rate=_pct(sum(1 for r in counted if r.passed), len(counted))
                if module.assessed and counted
                else None,
                avg_score=_avg([r.total_percent for r in counted]),
                certified_workers=len({c.worker_id for c in current if c.module_id == module_id}),
                avg_duration_seconds=_avg(durations),
            )
        )
    return stats


def kpis(ctx: Context) -> Kpis:
    active = [w for w in ctx.workers.values() if w.active]
    current = ctx.current_certs()
    certified = {c.worker_id for c in current if ctx.workers[c.worker_id].active}
    assessments = ctx.assessments()
    return Kpis(
        workers_registered=len(active),
        workers_new=len([w for w in active if ctx.since is None or as_utc(w.created_at) >= ctx.since]),
        certified_workers=len(certified),
        certified_percent=round(len(certified) / len(active) * 100, 1) if active else 0.0,
        valid_certificates=len(current),
        anchored_certificates=sum(1 for c in current if c.anchor_status == "anchored"),
        avg_score=_avg([r.total_percent for r in assessments]),
        assessments=len(assessments),
        pass_rate=_pct(sum(1 for r in assessments if r.passed), len(assessments)) if assessments else None,
        expiring_soon=sum(
            1 for c in current if days_between(ctx.today, c.expires_on) <= ctx.settings.expiring_soon_days
        ),
    )


def site_overview(ctx: Context) -> list[SiteOverview]:
    certified = {c.worker_id for c in ctx.current_certs()}
    assessments = ctx.assessments()
    overview = []
    for site in ctx.sites:
        workers = [w for w in ctx.workers.values() if w.site_id == site.id and w.active]
        ids = {w.id for w in workers}
        scores = [r.total_percent for r in assessments if r.worker_id in ids]
        site_certified = len(ids & certified)
        overview.append(
            SiteOverview(
                id=site.id,
                name=site.name,
                district=site.district,
                sector=site.sector,  # type: ignore[arg-type]
                latitude=site.latitude,
                longitude=site.longitude,
                workers=len(workers),
                certified=site_certified,
                compliance_percent=_pct(site_certified, len(workers)),
                avg_score=_avg(scores),
                assessments=len(scores),
            )
        )
    return overview


def common_mistakes(ctx: Context, limit: int = 5) -> list[StepStat]:
    stats = [
        stat
        for module in assessed_modules()
        for stat in step_stats(ctx, module.id, ctx.assessments())
        if stat.workers >= 5 and stat.workers_with_mistakes > 0
    ]
    # Smoothed share, so 3 of 3 workers does not outrank 19 of 33.
    stats.sort(key=lambda s: (-(s.workers_with_mistakes / (s.workers + 3)), -s.workers_with_mistakes))
    return stats[:limit]


def sync_overview(db: Session, ctx: Context) -> SyncOverview:
    devices = list(db.scalars(select(Device)))
    last = max((as_utc(d.last_sync_at) for d in devices), default=None)
    return SyncOverview(
        results_synced=len(ctx.results),
        pending_on_devices=sum(d.pending_count for d in devices),
        devices=len(devices),
        last_sync_at=iso(last),
    )


def insights(ctx: Context, mistakes: list[StepStat], sites: list[SiteOverview],
             figures: Kpis, sync: SyncOverview) -> list[Insight]:
    found: list[Insight] = []
    for stat in mistakes[:2]:
        if stat.workers_with_mistakes < 2:
            continue
        ratio = stat.workers_with_mistakes / stat.workers
        found.append(Insight(
            id=f"step:{stat.module_id}:{stat.step_id}",
            kind="step-failures",
            tone="critical" if ratio >= 0.4 else "warn",
            params={"failed": stat.workers_with_mistakes, "workers": stat.workers},
            labels={"module": module_title(stat.module_id), "step": stat.title},
        ))
    critical = critical_stats(ctx)
    if critical:
        top = critical[0]
        found.append(Insight(
            id=f"critical:{top.module_id}:{top.error_id}",
            kind="critical-errors",
            tone="critical",
            params={"count": top.count, "workers": top.workers},
            labels={"error": top.title, "module": module_title(top.module_id)},
        ))
    certified = {c.worker_id for c in ctx.current_certs()}
    new_uncertified = [
        w for w in ctx.workers.values()
        if w.active and w.id not in certified and (ctx.since is None or as_utc(w.created_at) >= ctx.since)
    ]
    if new_uncertified:
        found.append(Insight(
            id="not-certified",
            kind="not-certified",
            tone="warn" if len(new_uncertified) > 3 else "info",
            params={"count": len(new_uncertified), "scope": "all" if ctx.since is None else "new"},
            labels={},
        ))
    if figures.expiring_soon > 0:
        found.append(Insight(
            id="expiring",
            kind="expiring",
            tone="warn",
            params={"count": figures.expiring_soon, "days": ctx.settings.expiring_soon_days},
            labels={},
        ))
    staffed = [s for s in sites if s.workers > 0]
    if len(staffed) > 1:
        lowest = min(staffed, key=lambda s: s.compliance_percent)
        if lowest.compliance_percent < 70:
            found.append(Insight(
                id=f"site:{lowest.id}",
                kind="low-site",
                tone="warn",
                params={"site": lowest.district, "percent": lowest.compliance_percent},
                labels={},
            ))
    if sync.pending_on_devices > 0:
        found.append(Insight(
            id="pending-sync",
            kind="pending-sync",
            tone="info",
            params={"count": sync.pending_on_devices},
            labels={},
        ))
    if not found:
        found.append(Insight(id="all-good", kind="all-good", tone="ok", params={}, labels={}))
    return found


def dashboard(db: Session, range_: str, sector: str) -> DashboardResponse:
    ctx = load_context(db, range_, sector)
    figures = kpis(ctx)
    sites = site_overview(ctx)
    mistakes = common_mistakes(ctx)
    sync = sync_overview(db, ctx)
    return DashboardResponse(
        range=range_,  # type: ignore[arg-type]
        sector=sector,  # type: ignore[arg-type]
        kpis=figures,
        sites=sites,
        modules=module_stats(ctx),
        insights=insights(ctx, mistakes, sites, figures, sync),
        common_mistakes=mistakes,
        critical_errors=critical_stats(ctx)[:5],
        sync=sync,
        settings=ctx.settings,
    )


# ---- Assessments ------------------------------------------------------------------------------


def assessment_rows(
    ctx: Context,
    *,
    module: str | None = None,
    status: str | None = None,
    attempt_type: str | None = "assessment",
    search: str | None = None,
) -> list[AssessmentRow]:
    numbers = attempt_numbers(ctx.results_all)
    needle = (search or "").strip().lower()
    rows = []
    for result in reversed(ctx.results):
        if attempt_type and result.attempt_type != attempt_type:
            continue
        if module and result.module_id != module:
            continue
        if status == "certified" and result.certificate_id is None:
            continue
        if status == "passed" and result.passed is not True:
            continue
        if status == "failed" and result.passed is not False:
            continue
        worker = ctx.workers[result.worker_id]
        if needle and needle not in worker.name.lower() and needle not in worker.id:
            continue
        rows.append(assessment_row(result, worker, numbers.get(result.id, 0)))
    return rows


def assessment_detail(db: Session, result_id: str) -> AssessmentDetail | None:
    result = db.get(Result, result_id)
    if result is None:
        return None
    worker = db.get(Worker, result.worker_id)
    assert worker is not None
    others = list(db.scalars(select(Result).where(Result.worker_id == worker.id)))
    row = assessment_row(result, worker, attempt_numbers(others).get(result.id, 0))
    module = get_module(result.module_id)
    steps = []
    for step in result.steps or []:
        info = module.step(step["stepId"]) if module else None
        steps.append(AssessmentStep(
            step_id=step["stepId"],
            title=info.title if info else {"en": step["stepId"], "hi": step["stepId"]},
            completed=bool(step.get("completed")),
            skipped=bool(step.get("skipped")),
            mistakes=int(step.get("mistakes", 0)),
            points=int(step.get("points", 0)),
            max_points=int(step.get("maxPoints", 0)),
            time_taken_ms=int(step.get("timeTakenMs", 0)),
            critical=bool(step.get("critical")),
            critical_errors=[
                (module.critical_errors.get(error_id) if module else None) or {"en": error_id, "hi": error_id}
                for error_id in step.get("criticalErrorIds", []) or []
            ],
        ))
    prompts = dict(module.quiz) if module else {}
    quiz = [
        AssessmentQuizAnswer(
            question_id=answer["questionId"],
            prompt=prompts.get(answer["questionId"], {"en": answer["questionId"], "hi": answer["questionId"]}),
            correct=bool(answer.get("correct")),
        )
        for answer in result.quiz or []
    ]
    return AssessmentDetail(**row.model_dump(), steps=steps, quiz=quiz)


# ---- Modules ----------------------------------------------------------------------------------


def module_detail(ctx: Context, module_id: str) -> ModuleDetail | None:
    module = get_module(module_id)
    if module is None:
        return None
    base = next(stat for stat in module_stats(ctx) if stat.module_id == module_id)
    counted_type = "assessment" if module.assessed else "practice"
    mine = [r for r in ctx.results if r.module_id == module_id and r.attempt_type == counted_type]
    buckets = [0] * 10
    for result in mine:
        buckets[min(9, result.total_percent // 10)] += 1
    answered: dict[str, int] = defaultdict(int)
    correct: dict[str, int] = defaultdict(int)
    for result in mine:
        for answer in result.quiz or []:
            answered[answer["questionId"]] += 1
            correct[answer["questionId"]] += 1 if answer.get("correct") else 0
    quiz = [
        QuizStat(question_id=qid, prompt=prompt, answered=answered[qid],
                 correct_rate=_pct(correct[qid], answered[qid]) if answered[qid] else None)
        for qid, prompt in module.quiz
    ]
    # Monthly trend over the last 6 months (all time, not just the selected period).
    months: list[str] = []
    cursor = ctx.now.replace(day=1)
    for _ in range(6):
        months.insert(0, cursor.strftime("%Y-%m"))
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    by_month: dict[str, list[Result]] = defaultdict(list)
    for result in ctx.results_all:
        if result.module_id == module_id and result.attempt_type == counted_type:
            by_month[as_utc(result.completed_at).strftime("%Y-%m")].append(result)
    trend = [
        TrendPoint(
            month=month,
            assessments=len(by_month[month]),
            pass_rate=_pct(sum(1 for r in by_month[month] if r.passed), len(by_month[month]))
            if by_month[month] and module.assessed else None,
            avg_score=_avg([r.total_percent for r in by_month[month]]),
        )
        for month in months
    ]
    return ModuleDetail(
        **base.model_dump(),
        summary=module.summary,
        estimated_minutes=module.estimated_minutes,
        steps=step_stats(ctx, module_id, mine),
        critical_errors=critical_stats(ctx, module_id),
        quiz=quiz,
        score_buckets=buckets,
        trend=trend,
    )


# ---- Workers ----------------------------------------------------------------------------------


def worker_rows(ctx: Context) -> list[WorkerRow]:
    by_worker_results: dict[str, list[Result]] = defaultdict(list)
    for result in ctx.results_all:
        by_worker_results[result.worker_id].append(result)
    by_worker_certs: dict[str, list[Certificate]] = defaultdict(list)
    for cert in ctx.certificates:
        by_worker_certs[cert.worker_id].append(cert)
    assessed = [m.id for m in assessed_modules()]
    rows = []
    for worker in sorted(ctx.workers.values(), key=lambda w: w.id):
        results = by_worker_results[worker.id]
        certs = by_worker_certs[worker.id]
        badges = []
        for module_id in assessed:
            latest = max((c for c in certs if c.module_id == module_id),
                         key=lambda c: (c.status == "valid", c.expires_on), default=None)
            if latest is not None:
                badges.append(WorkerCertificateBadge(
                    module_id=module_id,
                    certificate_id=latest.id,
                    state=certificate_state(latest, ctx.today, ctx.settings.expiring_soon_days),  # type: ignore[arg-type]
                    expires_on=latest.expires_on,
                ))
        live = [b for b in badges if b.state in ("valid", "expiring")]
        if any(b.state == "expiring" for b in live):
            certification = "expiring"
        elif live and len(live) == len(assessed):
            certification = "certified"
        elif live:
            certification = "partial"
        else:
            certification = "not-certified"
        assessments = [r for r in results if r.attempt_type == "assessment"]
        last = max((as_utc(r.completed_at) for r in results), default=None)
        rows.append(WorkerRow(
            worker_id=worker.id,
            name=worker.name,
            role=worker.role,
            site_id=worker.site_id,
            site_name=worker.site.name,
            district=worker.site.district,
            sector=worker.site.sector,  # type: ignore[arg-type]
            preferred_language=worker.preferred_language,  # type: ignore[arg-type]
            active=worker.active,
            created_at=iso(worker.created_at) or "",
            last_activity_at=iso(last),
            assessments=len(assessments),
            avg_score=_avg([r.total_percent for r in assessments]),
            modules_certified=len(live),
            modules_total=len(assessed),
            certificates=badges,
            certification=certification,  # type: ignore[arg-type]
        ))
    return rows


def worker_detail(db: Session, worker_id: str) -> WorkerDetail | None:
    worker = db.get(Worker, worker_id)
    if worker is None:
        return None
    ctx = load_context(db, "all", "all", worker.site_id)
    ctx.workers = {worker.id: worker}
    ctx.results_all = [r for r in ctx.results_all if r.worker_id == worker.id]
    ctx.certificates = [c for c in ctx.certificates if c.worker_id == worker.id]
    row = worker_rows(ctx)[0]
    numbers = attempt_numbers(ctx.results_all)
    attempts = [assessment_row(r, worker, numbers.get(r.id, 0)) for r in reversed(ctx.results_all)]
    mastery = []
    for module in all_modules().values():
        stats = step_stats(ctx, module.id, ctx.results_all)
        if all(stat.attempts == 0 for stat in stats):
            continue
        mastery.append(ModuleMastery(
            module_id=module.id,
            title=module.title,
            steps=[
                StepMasteryRow(
                    step_id=stat.step_id,
                    title=stat.title,
                    attempts=stat.attempts,
                    clean=js_round(stat.clean_rate * stat.attempts / 100),
                    mastery=stat.clean_rate,
                )
                for stat in stats
                if stat.attempts > 0
            ],
        ))
    return WorkerDetail(
        **row.model_dump(),
        locked_until=iso(as_utc_or_none(worker.locked_until)),
        attempts=attempts,
        certificate_list=[certificate_out(c) for c in sorted(ctx.certificates, key=lambda c: -c.seq)],
        mastery=mastery,
    )


def next_worker_id(db: Session, site_id: str) -> str:
    """Worker IDs are 5 digits: a 2-digit site prefix (11 = first site) and a 3-digit number."""
    site_prefixes: dict[str, str] = {}
    for worker in db.scalars(select(Worker)):
        site_prefixes.setdefault(worker.site_id, worker.id[:2])
    prefix = site_prefixes.get(site_id)
    if prefix is None:
        prefix = str(max((int(p) for p in site_prefixes.values()), default=10) + 1)
    highest = db.scalar(select(func.max(Worker.id)).where(Worker.id.like(f"{prefix}%")))
    number = int(highest[2:]) + 1 if highest else 1
    if number > 999:
        raise ValueError("This site has no free worker IDs left.")
    return f"{prefix}{number:03d}"
