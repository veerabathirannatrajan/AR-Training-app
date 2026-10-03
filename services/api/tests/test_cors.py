from fastapi.testclient import TestClient

PREFLIGHT = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
}


def test_deployed_app_may_call_the_local_api(client: TestClient) -> None:
    origin = "https://ar-mining-training.vercel.app"
    response = client.options(
        "/api/auth/worker/login",
        headers={
            **PREFLIGHT,
            "Origin": origin,
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-private-network"] == "true"


def test_other_sites_are_not_allowed(client: TestClient) -> None:
    response = client.options(
        "/api/auth/worker/login",
        headers={**PREFLIGHT, "Origin": "https://ar-mining-training.vercel.app.example.com"},
    )
    assert "access-control-allow-origin" not in response.headers


def test_portal_can_read_export_file_names(client: TestClient) -> None:
    response = client.get(
        "/api/certificates/keys", headers={"Origin": "http://localhost"}
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost"
    assert "content-disposition" in response.headers["access-control-expose-headers"].lower()
