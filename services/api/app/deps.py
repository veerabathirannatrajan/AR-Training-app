"""Auth dependencies: worker tokens (phones) and admin tokens (portal)."""

import jwt
from fastapi import Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import api_error
from app.models import Admin, Worker

bearer = HTTPBearer(auto_error=False)


def _claims(credentials: HTTPAuthorizationCredentials | None, token: str | None) -> dict:
    raw = credentials.credentials if credentials is not None else token
    if not raw:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthorized", "Sign in first.")
    try:
        return jwt.decode(raw, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as error:
        raise api_error(
            status.HTTP_401_UNAUTHORIZED, "unauthorized", "Your session has expired. Sign in again."
        ) from error
    except jwt.InvalidTokenError as error:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthorized", "Sign in first.") from error


def current_worker(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Worker:
    claims = _claims(credentials, None)
    if claims.get("role") != "worker":
        raise api_error(status.HTTP_403_FORBIDDEN, "forbidden", "A worker login is needed.")
    worker = db.get(Worker, str(claims.get("sub")))
    if worker is None or not worker.active:
        raise api_error(status.HTTP_403_FORBIDDEN, "inactive", "This worker ID is not active.")
    return worker


def current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    # File downloads opened as plain links can pass the token in the query string.
    access_token: str | None = Query(default=None, include_in_schema=False),
    db: Session = Depends(get_db),
) -> Admin:
    claims = _claims(credentials, access_token)
    if claims.get("role") != "admin":
        raise api_error(status.HTTP_403_FORBIDDEN, "forbidden", "An admin login is needed.")
    try:
        admin = db.get(Admin, int(claims.get("sub", "0")))
    except ValueError:
        admin = None
    if admin is None or not admin.active:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "unauthorized", "Sign in first.")
    return admin
