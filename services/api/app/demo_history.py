"""Generated demo training history, so the admin portal has a year of realistic data to show.

Deterministic (fixed random seed) and built from the real module content: each demo worker
gets a skill level; attempts are simulated step by step with the app's scoring rules (mistake
penalties, slow-step penalty, critical errors, 60/40 practical/quiz). Failed assessments are
followed by retraining and another attempt, passes get real signed certificates, and some
certificates are renewed near expiry. The Gas Leak module is treated as launched 50 days ago.
Results are marked `source="demo-seed"`; real uploads from phones are `source="device"`.
"""

import random
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.appsettings import get_app_settings
from app.certificates import certificate_for_pass
from app.content import ModuleInfo, all_modules
from app.models import Result, Worker
from app.scoring import score_attempt
from app.timeutil import utcnow

SEED = 2026
MISTAKE_PENALTY = 5
SLOW_PENALTY_RATIO = 0.2
GAS_LAUNCH_DAYS_AGO = 50

# Chance of a mistake on each step for an average worker (harder steps are higher).
DIFFICULTY: dict[str, dict[str, float]] = {
    "fire-explosion": {
        "raise-alarm": 0.05, "identify-fire": 0.2, "choose-extinguisher": 0.22, "pass-pull": 0.05,
        "pass-aim": 0.16, "pass-squeeze": 0.08, "pass-sweep": 0.28, "crouch-smoke": 0.24,
        "move-exit": 0.08, "choose-exit": 0.16, "reach-assembly": 0.05, "stay-out": 0.12,
    },
    "gas-confined-space": {
        "identify-zones": 0.2, "stop-sparks": 0.14, "go-upwind": 0.2, "call-control": 0.06,
        "test-oxygen": 0.2, "test-flammable": 0.16, "test-toxic": 0.12, "ventilate": 0.08,
        "sign-permit": 0.1, "dress-entrant": 0.3, "assign-attendant": 0.12, "comms-check": 0.06,
        "emergency-response": 0.2, "winch-rescue": 0.08,
    },
}


def _uuid(rng: random.Random) -> str:
    return str(uuid.UUID(int=rng.getrandbits(128), version=4))


def _simulate_steps(
    rng: random.Random, module: ModuleInfo, skill: float, only: set[str] | None
) -> tuple[list[dict[str, Any]], list[str], int]:
    """Step outcomes, critical error ids and the practical time in ms."""
    steps: list[dict[str, Any]] = []
    critical_errors: list[str] = []
    total_ms = 0
    difficulty = DIFFICULTY.get(module.id, {})
    for step in module.steps:
        if only is not None and step.id not in only:
            steps.append({"stepId": step.id, "completed": True, "skipped": True, "mistakes": 0,
                          "points": 0, "maxPoints": 0, "timeTakenMs": 0, "critical": False})
            continue
        chance = min(0.9, difficulty.get(step.id, 0.08) * (2.3 - 1.6 * skill) * 1.35)
        mistakes = 0
        while mistakes < 3 and rng.random() < chance:
            mistakes += 1
            chance *= 0.6
        critical_ids: list[str] = []
        if step.option_critical and rng.random() < 0.04 * (1.7 - skill):
            critical_ids = [rng.choice(sorted(set(step.option_critical.values())))]
        time_ms = rng.randint(4_000, 26_000) + mistakes * 4_500
        slow = rng.random() < 0.1 + 0.15 * (1 - skill)
        points = 0 if critical_ids else max(
            0,
            step.points - mistakes * MISTAKE_PENALTY
            - (int(step.points * SLOW_PENALTY_RATIO + 0.5) if slow else 0),
        )
        outcome: dict[str, Any] = {
            "stepId": step.id, "completed": True, "mistakes": mistakes + len(critical_ids),
            "points": points, "maxPoints": step.points, "timeTakenMs": time_ms,
            "critical": bool(critical_ids),
        }
        if critical_ids:
            outcome["criticalErrorIds"] = critical_ids
            critical_errors += critical_ids
        steps.append(outcome)
        total_ms += time_ms
    return steps, list(dict.fromkeys(critical_errors)), total_ms


def _simulate_quiz(rng: random.Random, module: ModuleInfo, skill: float) -> list[dict[str, Any]]:
    answers = []
    for question in module.raw.get("quiz", []):
        options = question["options"]
        right = next(option["id"] for option in options if option["correct"])
        wrong = [option["id"] for option in options if not option["correct"]]
        correct = rng.random() < 0.25 + 0.62 * skill
        answers.append({
            "questionId": question["id"],
            "optionId": right if correct or not wrong else rng.choice(wrong),
            "correct": correct or not wrong,
        })
    return answers


def _retrain_ids(steps: list[dict[str, Any]]) -> set[str]:
    return {
        step["stepId"] for step in steps
        if step.get("skipped") is not True
        and (step["critical"] or step["mistakes"] > 0 or step["points"] < step["maxPoints"])
    }


class _Plan:
    """Simulated results for one worker, before they are written in time order."""

    def __init__(self, rng: random.Random, worker: Worker, now: datetime, pass_mark: int) -> None:
        self.rng = rng
        self.worker = worker
        self.now = now
        self.pass_mark = pass_mark
        self.results: list[dict[str, Any]] = []

    def add(self, module: ModuleInfo, attempt_type: str, at: datetime, skill: float,
            only: set[str] | None = None) -> dict[str, Any] | None:
        if at > self.now - timedelta(hours=2):
            return None
        steps, critical, practical_ms = _simulate_steps(self.rng, module, skill, only)
        quiz = _simulate_quiz(self.rng, module, skill) if attempt_type == "assessment" else []
        score = score_attempt(
            kind=module.kind, attempt_type=attempt_type, steps=steps, quiz=quiz,
            quiz_total=len(module.quiz), critical_errors=critical, pass_mark=self.pass_mark,
        )
        duration = practical_ms + (len(quiz) * self.rng.randint(9_000, 18_000)) + 25_000
        entry = {
            "module": module, "attempt_type": attempt_type, "completed_at": at,
            "started_at": at - timedelta(milliseconds=duration), "steps": steps, "quiz": quiz,
            "critical": critical, "score": score,
            "mode": "ar" if self.rng.random() < 0.72 else "fallback3d",
        }
        self.results.append(entry)
        return entry

    def assessed(self, module: ModuleInfo, start: datetime, skill: float) -> datetime | None:
        """Up to 3 assessments with retraining in between. Returns the pass time, if any."""
        at = start
        # Some workers have not come back for another attempt yet.
        for _ in range(self.rng.choice([1, 2, 3, 3])):
            entry = self.add(module, "assessment", at, skill)
            if entry is None:
                return None
            if entry["score"].passed:
                return at
            retrain_at = at + timedelta(hours=self.rng.randint(20, 60))
            self.add(module, "retraining", retrain_at, skill + 0.05, _retrain_ids(entry["steps"]))
            skill = min(0.99, skill + 0.09)
            at = retrain_at + timedelta(days=self.rng.randint(2, 12), hours=self.rng.randint(0, 8))
        return None


def seed_history(session: Session, now: datetime | None = None) -> int:
    """Adds the demo history if the database has no results yet. Returns results created."""
    if session.scalars(select(Result.id).limit(1)).first() is not None:
        return 0
    from app.seed import SITES, WORKERS_PER_SITE  # avoid a circular import

    rng = random.Random(SEED)
    now = now or utcnow()
    modules = all_modules()
    basics, fire, gas = modules["ar-basics"], modules["fire-explosion"], modules["gas-confined-space"]
    app_settings = get_app_settings(session)
    demo_ids = {
        f"{prefix}{n:03d}" for *_, prefix in SITES for n in range(1, WORKERS_PER_SITE + 1)
    }
    gas_launch = now - timedelta(days=GAS_LAUNCH_DAYS_AGO)

    plans: list[_Plan] = []
    for worker in session.scalars(select(Worker).order_by(Worker.id)):
        if worker.id not in demo_ids:
            continue
        plan = _Plan(rng, worker, now, app_settings.pass_mark)
        plans.append(plan)
        skill = rng.uniform(0.42, 0.96)
        # The 10th worker of each site joined in the last few weeks and is not certified yet.
        if worker.id.endswith("010"):
            worker.created_at = now - timedelta(days=rng.randint(4, 24), hours=rng.randint(0, 20))
            if rng.random() < 0.6:
                plan.add(basics, "practice", worker.created_at + timedelta(days=1), skill)
            continue
        recent = rng.random() < 0.35
        worker.created_at = now - timedelta(
            days=rng.randint(38, 120) if recent else rng.randint(121, 430), hours=rng.randint(0, 23)
        )
        onboarding = worker.created_at + timedelta(days=rng.randint(1, 5), hours=rng.randint(1, 8))
        plan.add(basics, "practice", onboarding, skill)

        fire_pass = None
        if rng.random() < 0.85:
            fire_start = onboarding + timedelta(days=rng.randint(2, 30), hours=rng.randint(0, 9))
            fire_pass = plan.assessed(fire, fire_start, skill)
        if fire_pass is not None and rng.random() < 0.55:
            # Renewal shortly before the certificate expires.
            renew_at = fire_pass + timedelta(days=rng.randint(338, 362))
            plan.assessed(fire, renew_at, min(0.99, skill + 0.1))
        if rng.random() < 0.72:
            earliest = max(onboarding, gas_launch)
            gas_start = earliest + timedelta(days=rng.randint(1, 42), hours=rng.randint(0, 9))
            plan.assessed(gas, gas_start, skill - 0.04)

    entries = sorted(
        ((plan, entry) for plan in plans for entry in plan.results),
        key=lambda pair: pair[1]["completed_at"],
    )
    for plan, entry in entries:
        module: ModuleInfo = entry["module"]
        score = entry["score"]
        result = Result(
            id=_uuid(rng),
            session_id=_uuid(rng),
            worker_id=plan.worker.id,
            module_id=module.id,
            module_version=module.version,
            attempt_type=entry["attempt_type"],
            mode=entry["mode"],
            language=plan.worker.preferred_language,
            started_at=entry["started_at"],
            completed_at=entry["completed_at"],
            score=sum(step["points"] for step in entry["steps"]),
            max_score=sum(step["maxPoints"] for step in entry["steps"]),
            total_percent=score.total_percent,
            practical_percent=score.practical_percent,
            quiz_percent=score.quiz_percent,
            passed=score.passed,
            fail_reason=score.fail_reason,
            pass_mark=app_settings.pass_mark if score.passed is not None else None,
            critical_errors=entry["critical"],
            steps=entry["steps"],
            quiz=entry["quiz"],
            received_at=entry["completed_at"] + timedelta(minutes=rng.randint(1, 600)),
            source="demo-seed",
        )
        session.add(result)
        if entry["attempt_type"] == "assessment" and score.passed:
            certificate = certificate_for_pass(
                session,
                worker=plan.worker,
                module=module,
                score=score.total_percent,
                passed_at=entry["completed_at"],
                result_id=result.id,
                app_settings=app_settings,
            )
            result.certificate_id = certificate.id
    session.commit()
    return len(entries)
