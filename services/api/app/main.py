from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import __version__

SERVICE_NAME = "ar-training-api"

# Dev origins: mobile (5173), admin (5174) and `vite preview` (4173). The phone reaches
# these as http://localhost:* through `adb reverse`, so the origin is still localhost.
DEV_ORIGINS = [
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 5174, 4173)
]

app = FastAPI(title="AR Mining Training API", version=__version__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    """Mirrors `HealthResponse` in packages/shared/src/api.ts."""

    status: Literal["ok"]
    service: str
    version: str
    time: str


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=SERVICE_NAME,
        version=__version__,
        time=datetime.now(UTC).isoformat(),
    )
