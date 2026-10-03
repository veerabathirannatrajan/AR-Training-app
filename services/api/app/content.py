"""Training module content, read from packages/shared/content/modules (shared with the apps)."""

import json
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from app.config import settings

# Home-screen order (matches MODULE_CONTENT in packages/shared/src/modules.ts).
MODULE_ORDER = ["ar-basics", "fire-explosion", "gas-confined-space"]

LocalizedText = dict[str, Any]


@dataclass(frozen=True)
class StepInfo:
    id: str
    title: LocalizedText
    points: int
    group: str | None
    option_outcomes: dict[str, str] = field(default_factory=dict)
    option_critical: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ModuleInfo:
    id: str
    version: int
    kind: str  # tutorial | assessed
    title: LocalizedText
    summary: LocalizedText
    estimated_minutes: int
    steps: list[StepInfo]
    critical_errors: dict[str, LocalizedText]
    quiz: list[tuple[str, LocalizedText]]
    raw: dict[str, Any]

    @property
    def assessed(self) -> bool:
        return self.kind == "assessed"

    def step(self, step_id: str) -> StepInfo | None:
        return next((step for step in self.steps if step.id == step_id), None)


def _load(module_id: str) -> ModuleInfo:
    raw = json.loads((settings.content_dir / f"{module_id}.json").read_text(encoding="utf-8"))
    steps = [
        StepInfo(
            id=step["id"],
            title=step["title"],
            points=int(step["points"]),
            group=step.get("group"),
            option_outcomes={opt["id"]: opt["outcome"] for opt in step.get("options", [])},
            option_critical={
                opt["id"]: opt.get("criticalErrorId", opt["id"])
                for opt in step.get("options", [])
                if opt["outcome"] == "critical"
            },
        )
        for step in raw["steps"]
    ]
    return ModuleInfo(
        id=raw["id"],
        version=int(raw["version"]),
        kind=raw["kind"],
        title=raw["title"],
        summary=raw["summary"],
        estimated_minutes=int(raw["estimatedMinutes"]),
        steps=steps,
        critical_errors={error["id"]: error["title"] for error in raw.get("criticalErrors", [])},
        quiz=[(question["id"], question["prompt"]) for question in raw.get("quiz", [])],
        raw=raw,
    )


@lru_cache(maxsize=1)
def all_modules() -> dict[str, ModuleInfo]:
    return {module_id: _load(module_id) for module_id in MODULE_ORDER}


def get_module(module_id: str) -> ModuleInfo | None:
    return all_modules().get(module_id)


def assessed_modules() -> list[ModuleInfo]:
    return [module for module in all_modules().values() if module.assessed]


def module_title(module_id: str) -> LocalizedText:
    module = get_module(module_id)
    return module.title if module is not None else {"en": module_id, "hi": module_id}
