import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.db import SessionLocal, init_db
from app.routers import auth
from app.schemas import HealthResponse
from app.seed import DEMO_PIN, database_is_empty, seed

SERVICE_NAME = "ar-training-api"
log = logging.getLogger("uvicorn.error")

# Dev origins: mobile (5173), admin (5174) and the installable build via `vite preview` (4173).
# The phone reaches these as http://localhost:* through `adb reverse`, so the origin is localhost.
DEV_ORIGINS = [
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 5174, 4173)
]
# The Android app (TWA) loads the deployed web app from Vercel and, during development, reaches
# this API on the laptop as http://localhost:8000 through `adb reverse`.
DEPLOYED_ORIGIN_REGEX = r"https://ar-mining-training(-[a-z0-9-]+)?\.vercel\.app"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    if os.environ.get("ARMT_SEED_DEMO", "1") != "0":
        with SessionLocal() as session:
            if database_is_empty(session):
                created = seed(session)
                log.info("Seeded %d demo workers (PIN %s).", created, DEMO_PIN)
    yield


app = FastAPI(title="AR Mining Training API", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_origin_regex=DEPLOYED_ORIGIN_REGEX,
    allow_credentials=True,
    # A public (https) page calling localhost: answer Chrome's Private Network Access preflight.
    allow_private_network=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Keep the shared error shape: {"detail": {"code", "message", "errors"}}."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "detail": {
                "code": "validation",
                "message": "Request is not valid.",
                "errors": jsonable_encoder(exc.errors()),
            }
        },
    )


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=SERVICE_NAME,
        version=__version__,
        time=datetime.now(UTC).isoformat(),
    )
