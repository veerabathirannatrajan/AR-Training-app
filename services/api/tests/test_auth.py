import jwt
from fastapi.testclient import TestClient

from app.config import settings
from app.seed import DEMO_PIN

LOGIN = "/api/auth/worker/login"


def test_login_returns_profile_and_token(client: TestClient) -> None:
    response = client.post(LOGIN, json={"workerId": "11003", "pin": DEMO_PIN})

    assert response.status_code == 200
    body = response.json()
    assert body["worker"] == {
        "workerId": "11003",
        "name": "Birsa Murmu",
        "role": "Dumper operator",
        "siteId": "DHN",
        "siteName": "Dhanbad Coal Site",
        "district": "Dhanbad",
        "sector": "coal",
        "preferredLanguage": "sat",
    }
    claims = jwt.decode(body["token"], settings.jwt_secret, algorithms=["HS256"])
    assert claims["sub"] == "11003"
    assert claims["role"] == "worker"


def test_wrong_pin_and_unknown_worker_look_the_same(client: TestClient) -> None:
    wrong_pin = client.post(LOGIN, json={"workerId": "11001", "pin": "0000"})
    unknown = client.post(LOGIN, json={"workerId": "99999", "pin": DEMO_PIN})

    assert wrong_pin.status_code == unknown.status_code == 401
    assert wrong_pin.json() == unknown.json()
    assert wrong_pin.json()["detail"]["code"] == "invalid-credentials"


def test_locks_after_repeated_wrong_pins(client: TestClient) -> None:
    for _ in range(settings.max_failed_logins - 1):
        assert client.post(LOGIN, json={"workerId": "12001", "pin": "9999"}).status_code == 401

    locked = client.post(LOGIN, json={"workerId": "12001", "pin": "9999"})
    assert locked.status_code == 423
    assert locked.json()["detail"]["code"] == "locked"
    assert locked.json()["detail"]["retryAfterSeconds"] == settings.lockout_minutes * 60

    # Even the right PIN is refused while locked.
    still_locked = client.post(LOGIN, json={"workerId": "12001", "pin": DEMO_PIN})
    assert still_locked.status_code == 423
    assert 0 < still_locked.json()["detail"]["retryAfterSeconds"] <= settings.lockout_minutes * 60


def test_rejects_malformed_input_with_shared_error_shape(client: TestClient) -> None:
    response = client.post(LOGIN, json={"workerId": "11A01", "pin": "12"})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation"


def test_seeds_48_workers_across_4_sites(client: TestClient) -> None:
    logins = [
        client.post(LOGIN, json={"workerId": f"{prefix}{n:03d}", "pin": DEMO_PIN})
        for prefix in ("11", "12", "13", "14")
        for n in (1, 12)
    ]
    assert all(response.status_code == 200 for response in logins)
    sites = {response.json()["worker"]["siteId"] for response in logins}
    assert sites == {"DHN", "BKR", "RNC", "KDM"}
    assert client.post(LOGIN, json={"workerId": "11013", "pin": DEMO_PIN}).status_code == 401
