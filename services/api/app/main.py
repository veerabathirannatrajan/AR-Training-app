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
from app.config import settings
from app.db import SessionLocal, init_db
from app.demo_history import seed_history
from app.routers import analytics, auth, certificates, reports, sync, workers
from app.routers import settings as settings_router
from app.schemas import HealthResponse
from app.seed import DEMO_PIN, database_is_empty, seed, seed_admin
from app.signing import signing_key

SERVICE_NAME = "ar-training-api"
log = logging.getLogger("uvicorn.error")

# Dev origins: mobile (5173), admin portal (5174) and their production builds served by
# `vite preview` (4173, 4174). The phone reaches these as http://localhost:* via `adb reverse`.
DEV_ORIGINS = [
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (5173, 5174, 4173, 4174)
]
# The admin Android app (Capacitor) serves the portal from inside the APK at http://localhost.
NATIVE_APP_ORIGINS = ["http://localhost", "https://localhost"]
# The Android app (TWA) loads the deployed web app from Vercel and, during development, reaches
# this API on the laptop as http://localhost:8000 through `adb reverse`.
DEPLOYED_ORIGIN_REGEX = r"https://ar-mining-training(-[a-z0-9-]+)?\.vercel\.app"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    signing_key()  # create the certificate signing key on first start
    with SessionLocal() as session:
        if seed_admin(session):
            log.info("Created portal admin %s (password from ARMT_ADMIN_PASSWORD, default in README).",
                     settings.demo_admin_email)
        if os.environ.get("ARMT_SEED_DEMO", "1") != "0":
            if database_is_empty(session):
                created = seed(session)
                log.info("Seeded %d demo workers (PIN %s).", created, DEMO_PIN)
            if os.environ.get("ARMT_SEED_HISTORY", "1") != "0":
                results = seed_history(session)
                if results:
                    log.info("Seeded %d demo training results with certificates.", results)
    yield


app = FastAPI(title="AR Mining Training API", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS + NATIVE_APP_ORIGINS,
    allow_origin_regex=DEPLOYED_ORIGIN_REGEX,
    allow_credentials=True,
    # A public (https) page calling localhost: answer Chrome's Private Network Access preflight.
    allow_private_network=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the portal read the export file name (CSV / PDF downloads).
    expose_headers=["Content-Disposition"],
)
app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(certificates.router)
app.include_router(certificates.public)
app.include_router(analytics.router)
app.include_router(workers.router)
app.include_router(reports.router)
app.include_router(settings_router.router)


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
