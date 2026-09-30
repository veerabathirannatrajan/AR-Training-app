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

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client() -> Iterator[TestClient]:
    Base.metadata.drop_all(engine)
    with TestClient(app) as test_client:  # runs the lifespan: create tables + seed
        yield test_client
