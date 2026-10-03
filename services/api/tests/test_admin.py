from fastapi.testclient import TestClient

from app.seed import DEMO_PIN
from tests.helpers import make_result, sync_body, worker_headers


def login(client: TestClient) -> dict[str, str]:
    token = client.post(
        "/api/auth/admin/login", json={"email": "Admin@Test.com", "password": "admin1234"}
    ).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_login(client: TestClient) -> None:
    wrong = client.post("/api/auth/admin/login", json={"email": "admin@test.com", "password": "nope"})
    unknown = client.post("/api/auth/admin/login", json={"email": "x@test.com", "password": "nope"})
    assert wrong.status_code == unknown.status_code == 401
    headers = login(client)
    me = client.get("/api/auth/admin/me", headers=headers).json()
    assert me["email"] == "admin@test.com"
    assert client.get("/api/dashboard").status_code == 401
    # A worker token is not enough for the portal.
    assert client.get("/api/dashboard", headers=worker_headers(client)).status_code == 403


def test_dashboard_from_generated_history(history_client: TestClient) -> None:
    headers = login(history_client)
    body = history_client.get("/api/dashboard", params={"range": "all"}, headers=headers).json()
    kpis = body["kpis"]
    assert kpis["workersRegistered"] == 48
    assert 0 < kpis["certifiedWorkers"] < 48
    assert kpis["validCertificates"] >= kpis["certifiedWorkers"]
    assert 40 <= kpis["avgScore"] <= 100
    assert {site["district"] for site in body["sites"]} == {"Dhanbad", "Bokaro", "Ranchi", "Koderma"}
    assessed = {m["moduleId"]: m for m in body["modules"] if m["kind"] == "assessed"}
    assert set(assessed) == {"fire-explosion", "gas-confined-space"}
    assert all(m["passRate"] is not None and m["assessments"] > 0 for m in assessed.values())
    kinds = {insight["kind"] for insight in body["insights"]}
    assert "step-failures" in kinds
    # New workers of the last weeks have no certificate yet.
    recent = history_client.get("/api/dashboard", params={"range": "30d"}, headers=headers).json()
    assert recent["kpis"]["workersNew"] == 4

    page = history_client.get(
        "/api/assessments", params={"range": "all", "pageSize": 5}, headers=headers
    ).json()
    assert len(page["items"]) == 5 and page["total"] > 5
    first = page["items"][0]
    detail = history_client.get(f"/api/assessments/{first['resultId']}", headers=headers).json()
    assert len(detail["steps"]) > 5 and len(detail["quiz"]) == 5

    module = history_client.get(
        "/api/modules/gas-confined-space", params={"range": "all"}, headers=headers
    ).json()
    assert sum(module["scoreBuckets"]) == module["assessments"]
    assert len(module["trend"]) == 6


def test_reports(history_client: TestClient) -> None:
    headers = login(history_client)
    csv = history_client.get("/api/reports/compliance.csv", params={"range": "all"}, headers=headers)
    assert csv.headers["content-type"].startswith("text/csv")
    lines = csv.content.decode("utf-8-sig").splitlines()
    assert lines[0].startswith("Worker ID,Name,Role,Site")
    assert len(lines) == 49
    for name in ("assessments.csv", "certificates.csv"):
        response = history_client.get(f"/api/reports/{name}", params={"range": "all"}, headers=headers)
        assert response.status_code == 200
    pdf = history_client.get("/api/reports/compliance.pdf", params={"range": "all"}, headers=headers)
    assert pdf.content.startswith(b"%PDF")
    # Plain links (downloads) may pass the token in the query string.
    token = headers["Authorization"].split()[1]
    assert history_client.get("/api/reports/compliance.pdf", params={"access_token": token}).status_code == 200


def test_workers_crud_and_detail(client: TestClient) -> None:
    headers = login(client)
    client.post(
        "/api/sync", json=sync_body(make_result(worker_id="11001")), headers=worker_headers(client, "11001")
    )

    page = client.get("/api/workers", params={"site": "DHN", "pageSize": 50}, headers=headers).json()
    assert page["total"] == 12
    certified = client.get("/api/workers", params={"certification": "partial"}, headers=headers).json()
    assert [row["workerId"] for row in certified["items"]] == ["11001"]

    detail = client.get("/api/workers/11001", headers=headers).json()
    assert detail["certificateList"][0]["id"] == "CERT-0001"
    assert detail["attempts"][0]["attemptNumber"] == 1
    assert detail["mastery"][0]["moduleId"] == "fire-explosion"

    created = client.post(
        "/api/workers",
        json={"name": "Lakshmi Oraon", "role": "Helper", "siteId": "DHN", "preferredLanguage": "hi", "pin": "4321"},
        headers=headers,
    )
    assert created.status_code == 201
    new_id = created.json()["workerId"]
    assert new_id == "11013"
    assert client.post("/api/auth/worker/login", json={"workerId": new_id, "pin": "4321"}).status_code == 200

    client.patch(f"/api/workers/{new_id}", json={"active": False}, headers=headers)
    assert client.post("/api/auth/worker/login", json={"workerId": new_id, "pin": "4321"}).status_code == 403
    client.patch(f"/api/workers/{new_id}", json={"active": True, "pin": "1111"}, headers=headers)
    assert client.post("/api/auth/worker/login", json={"workerId": new_id, "pin": "1111"}).status_code == 200
    assert client.post("/api/auth/worker/login", json={"workerId": new_id, "pin": DEMO_PIN}).status_code == 401


def test_sites_settings_admins_and_chain(client: TestClient) -> None:
    headers = login(client)
    site = {"id": "JMS", "name": "Jamshedpur Steel Site", "district": "East Singhbhum", "sector": "steel",
            "latitude": 22.80, "longitude": 86.18}
    assert client.post("/api/sites", json=site, headers=headers).status_code == 201
    assert client.post("/api/sites", json=site, headers=headers).status_code == 409
    created = client.post(
        "/api/workers",
        json={"name": "Rohit Kumar", "role": "Rigger", "siteId": "JMS", "preferredLanguage": "hi", "pin": "1234"},
        headers=headers,
    ).json()
    assert created["workerId"] == "15001"

    bad = {"passMark": 70, "certificateValidityDays": 30, "expiringSoonDays": 30}
    assert client.put("/api/settings", json=bad, headers=headers).status_code == 422

    admin = client.post(
        "/api/admins", json={"email": "officer@test.com", "name": "Safety Officer", "password": "longpassword"},
        headers=headers,
    )
    assert admin.status_code == 201
    me = client.get("/api/auth/admin/me", headers=headers).json()
    assert client.patch(f"/api/admins/{me['id']}", json={"active": False}, headers=headers).status_code == 422

    status = client.get("/api/chain/status", headers=headers).json()
    assert status["adapter"] == "stub" and status["configured"] is False
    run = client.post("/api/chain/anchor", headers=headers).json()
    assert run["attempted"] == 0 and "Not anchored yet" in run["message"]
