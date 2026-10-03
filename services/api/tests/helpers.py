import json
import uuid
from typing import Any

from app.config import settings
from app.seed import DEMO_PIN

NOW_MS = 1_790_000_000_000  # 2026-09-22


def load_module(module_id: str) -> dict[str, Any]:
    return json.loads((settings.content_dir / f"{module_id}.json").read_text(encoding="utf-8"))


def worker_headers(client: Any, worker_id: str = "11003") -> dict[str, str]:
    response = client.post("/api/auth/worker/login", json={"workerId": worker_id, "pin": DEMO_PIN})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def make_result(
    module_id: str = "fire-explosion",
    *,
    worker_id: str = "11003",
    mistakes_per_step: int = 0,
    quiz_correct: int = 5,
    critical: str | None = None,
    attempt_type: str = "assessment",
    completed_at: int = NOW_MS,
) -> dict[str, Any]:
    """A ModuleResult as the phone uploads it."""
    module = load_module(module_id)
    steps = []
    for index, step in enumerate(module["steps"]):
        is_critical = critical is not None and index == 2
        points = 0 if is_critical else max(0, step["points"] - mistakes_per_step * 5)
        outcome = {
            "stepId": step["id"], "completed": True, "mistakes": mistakes_per_step,
            "points": points, "maxPoints": step["points"], "timeTakenMs": 8000,
            "critical": is_critical,
        }
        if is_critical:
            outcome["criticalErrorIds"] = [critical]
        steps.append(outcome)
    quiz = [
        {"questionId": question["id"], "optionId": "x", "correct": index < quiz_correct}
        for index, question in enumerate(module.get("quiz", []))
    ]
    return {
        "id": str(uuid.uuid4()),
        "sessionId": str(uuid.uuid4()),
        "workerId": worker_id,
        "moduleId": module_id,
        "moduleVersion": module["version"],
        "mode": "ar",
        "attemptType": attempt_type,
        "startedAt": completed_at - 300_000,
        "completedAt": completed_at,
        "score": sum(step["points"] for step in steps),
        "maxScore": sum(step["maxPoints"] for step in steps),
        "passed": None,
        "criticalErrors": [critical] if critical else [],
        "quiz": quiz,
        "steps": steps,
        "language": "sat",
    }


def sync_body(*results: dict[str, Any], events: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "deviceId": "device-test-0001",
        "appVersion": "0.4.0",
        "pendingCount": 0,
        "items": [
            {"result": result, "session": None, "events": events or []} for result in results
        ],
    }
