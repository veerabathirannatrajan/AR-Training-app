"""Server-side copy of the assessment rules in packages/shared/src/assessment.ts.

Phones score attempts offline; on upload the API re-applies the same rules with the pass mark
in force, so a certificate is only issued for a genuine pass.
"""

from dataclasses import dataclass
from typing import Any

from app.timeutil import js_round

PRACTICAL_WEIGHT = 0.6
QUIZ_WEIGHT = 0.4


@dataclass(frozen=True)
class AttemptScore:
    practical_percent: int
    quiz_percent: int | None
    total_percent: int
    passed: bool | None
    fail_reason: str | None


def _percent(part: float, whole: float) -> int:
    return js_round(part / whole * 100) if whole > 0 else 0


def score_attempt(
    *,
    kind: str,
    attempt_type: str,
    steps: list[dict[str, Any]],
    quiz: list[dict[str, Any]],
    quiz_total: int,
    critical_errors: list[str],
    pass_mark: int,
) -> AttemptScore:
    counted = [step for step in steps if step.get("skipped") is not True]
    practical = _percent(
        sum(step["points"] for step in counted), sum(step["maxPoints"] for step in counted)
    )
    if kind == "tutorial" or attempt_type != "assessment":
        return AttemptScore(practical, None, practical, None, None)

    quiz_percent = (
        _percent(sum(1 for answer in quiz if answer.get("correct") is True), quiz_total)
        if quiz_total > 0
        else None
    )
    total = (
        practical
        if quiz_percent is None
        else js_round(practical * PRACTICAL_WEIGHT + quiz_percent * QUIZ_WEIGHT)
    )
    if critical_errors:
        return AttemptScore(practical, quiz_percent, total, False, "critical-error")
    passed = total >= pass_mark
    return AttemptScore(practical, quiz_percent, total, passed, None if passed else "below-pass-mark")


def is_clean(step: dict[str, Any]) -> bool:
    """Done right first time (same rule as stepMastery in TypeScript)."""
    return bool(step.get("completed")) and step.get("mistakes", 0) == 0 and not step.get("critical")
