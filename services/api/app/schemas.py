"""API models. JSON uses camelCase to match packages/shared (TypeScript)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

LanguageCode = Literal["en", "hi", "sat"]
Sector = Literal["coal", "steel", "mica"]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class HealthResponse(ApiModel):
    """Mirrors `HealthResponse` in packages/shared/src/api.ts."""

    status: Literal["ok"]
    service: str
    version: str
    time: str


class WorkerLoginRequest(ApiModel):
    worker_id: str = Field(pattern=r"^\d{5}$")
    pin: str = Field(pattern=r"^\d{4}$")


class WorkerProfile(ApiModel):
    worker_id: str
    name: str
    role: str
    site_id: str
    site_name: str
    district: str
    sector: Sector
    preferred_language: LanguageCode


class WorkerLoginResponse(ApiModel):
    token: str
    expires_at: datetime
    worker: WorkerProfile
