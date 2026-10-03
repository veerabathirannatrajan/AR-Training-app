import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

# Settings are read at import time, so point the app at a throwaway database first.
_TMP = Path(tempfile.mkdtemp(prefix="armt-test-"))
os.environ["ARMT_DATABASE_URL"] = f"sqlite:///{_TMP / 'test.db'}"
os.environ["ARMT_JWT_SECRET"] = "test-secret-not-for-production-use-0123456789"
os.environ["ARMT_SEED_DEMO"] = "1"
# Generated training history is opt-in per test (see the `history_client` fixture).
os.environ["ARMT_SEED_HISTORY"] = "0"
# Fixed signing key (seed bytes 1..32), shared with packages/shared/src/certificates.test.ts.
os.environ["ARMT_CERT_SIGNING_KEY"] = bytes(range(1, 33)).hex()
os.environ.pop("ARMT_POLYGON_PRIVATE_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client() -> Iterator[TestClient]:
    Base.metadata.drop_all(engine)
    with TestClient(app) as test_client:  # runs the lifespan: create tables + seed
        yield test_client


@pytest.fixture()
def history_client() -> Iterator[TestClient]:
    """Like `client`, with the generated demo training history and certificates."""
    Base.metadata.drop_all(engine)
    os.environ["ARMT_SEED_HISTORY"] = "1"
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        os.environ["ARMT_SEED_HISTORY"] = "0"


@pytest.fixture()
def admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/admin/login", json={"email": "admin@test.com", "password": "admin1234"}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}
