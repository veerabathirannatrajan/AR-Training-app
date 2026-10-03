import hashlib

from fastapi.testclient import TestClient
from nacl.signing import VerifyKey

from app.models import Certificate
from app.pdf import certificate_qr_text
from app.signing import (
    b64url,
    canonical_json,
    certificate_payload,
    from_b64url,
    payload_hash,
    public_key_hex,
)
from tests.helpers import make_result, sync_body, worker_headers

# Same vector as packages/shared/src/certificates.test.ts.
TS_PUBLIC_KEY = "79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664"
TS_CANONICAL = (
    '{"expiresOn":"2027-10-03","id":"CERT-0017","issuedOn":"2026-10-03",'
    '"moduleId":"fire-explosion","score":82,"v":1,"workerId":"11003","workerName":"Birsa Murmu"}'
)
TS_HASH = "32455bf8b978ae86e923a9e64aa6bb7e5c3c1d4bb8e916611e76b1bfc1cc77c4"


def test_hash_and_key_match_the_typescript_implementation() -> None:
    payload = certificate_payload(
        cert_id="CERT-0017", worker_id="11003", worker_name="Birsa Murmu",
        module_id="fire-explosion", score=82, issued_on="2026-10-03", expires_on="2027-10-03",
    )
    assert canonical_json(payload) == TS_CANONICAL
    assert payload_hash(payload) == TS_HASH
    assert public_key_hex() == TS_PUBLIC_KEY


def test_trust_bundle_is_public(client: TestClient) -> None:
    body = client.get("/api/certificates/keys").json()
    assert body["signingKeys"] == [{
        "keyId": hashlib.sha256(bytes.fromhex(TS_PUBLIC_KEY)).hexdigest()[:8],
        "algorithm": "Ed25519",
        "publicKey": TS_PUBLIC_KEY,
    }]
    assert body["revokedCertificateIds"] == []


def test_passing_assessment_gets_a_signed_certificate(client: TestClient) -> None:
    headers = worker_headers(client)
    result = make_result(quiz_correct=4)
    response = client.post("/api/sync", json=sync_body(result), headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["results"] == [{
        "resultId": result["id"], "status": "accepted", "reason": None, "passed": True,
        "failReason": None, "certificateId": "CERT-0001",
    }]
    [cert] = body["certificates"]
    assert cert["id"] == "CERT-0001"
    assert cert["workerName"] == "Birsa Murmu"
    assert cert["status"] == "valid"
    assert cert["anchor"]["status"] == "not-anchored"
    # 60% practical + 40% quiz, recomputed on the server.
    practical = round(sum(s["points"] for s in result["steps"]) / sum(s["maxPoints"] for s in result["steps"]) * 100)
    assert cert["score"] == int(practical * 0.6 + 80 * 0.4 + 0.5)
    payload = certificate_payload(
        cert_id=cert["id"], worker_id=cert["workerId"], worker_name=cert["workerName"],
        module_id=cert["moduleId"], score=cert["score"], issued_on=cert["issuedOn"],
        expires_on=cert["expiresOn"],
    )
    assert payload_hash(payload) == cert["hash"]
    VerifyKey(bytes.fromhex(TS_PUBLIC_KEY)).verify(
        bytes.fromhex(cert["hash"]), from_b64url(cert["signature"])
    )
    assert body["settings"] == {"passMark": 70, "certificateValidityDays": 365, "expiringSoonDays": 30}


def test_sync_is_idempotent_and_keeps_the_current_certificate(client: TestClient) -> None:
    headers = worker_headers(client)
    first = make_result()
    client.post("/api/sync", json=sync_body(first), headers=headers)
    again = client.post("/api/sync", json=sync_body(first), headers=headers).json()
    assert again["results"][0]["status"] == "duplicate"
    assert again["results"][0]["certificateId"] == "CERT-0001"
    # Passing again while the certificate is still valid keeps it (no duplicate certificates).
    second = make_result(completed_at=first["completedAt"] + 86_400_000)
    body = client.post("/api/sync", json=sync_body(second), headers=headers).json()
    assert body["results"][0]["certificateId"] == "CERT-0001"
    assert [cert["id"] for cert in body["certificates"]] == ["CERT-0001"]


def test_critical_error_and_low_score_fail_without_certificate(client: TestClient) -> None:
    headers = worker_headers(client)
    critical = make_result(critical="water-on-electrical")
    low = make_result(mistakes_per_step=2, quiz_correct=1)
    body = client.post("/api/sync", json=sync_body(critical, low), headers=headers).json()
    outcome = {r["resultId"]: r for r in body["results"]}
    assert outcome[critical["id"]]["passed"] is False
    assert outcome[critical["id"]]["failReason"] == "critical-error"
    assert outcome[low["id"]]["failReason"] == "below-pass-mark"
    assert body["certificates"] == []


def test_server_applies_the_pass_mark_in_force(client: TestClient, admin_headers: dict[str, str]) -> None:
    update = {"passMark": 95, "certificateValidityDays": 365, "expiringSoonDays": 30}
    assert client.put("/api/settings", json=update, headers=admin_headers).status_code == 200
    headers = worker_headers(client)
    body = client.post("/api/sync", json=sync_body(make_result(quiz_correct=4)), headers=headers).json()
    assert body["results"][0]["passed"] is False
    assert body["settings"]["passMark"] == 95


def test_rejects_results_for_another_worker_or_unknown_steps(client: TestClient) -> None:
    headers = worker_headers(client, "11003")
    other = make_result(worker_id="11004")
    bogus = make_result()
    bogus["steps"][0]["stepId"] = "made-up"
    body = client.post("/api/sync", json=sync_body(other, bogus), headers=headers).json()
    reasons = {r["resultId"]: r["reason"] for r in body["results"]}
    assert reasons[other["id"]] == "worker-mismatch"
    assert reasons[bogus["id"]] == "unknown-step:made-up"


def test_sync_needs_a_worker_token(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.post("/api/sync", json=sync_body()).status_code == 401
    assert client.post("/api/sync", json=sync_body(), headers=admin_headers).status_code == 403


def test_verify_revoke_and_pdf(client: TestClient, admin_headers: dict[str, str]) -> None:
    headers = worker_headers(client)
    client.post("/api/sync", json=sync_body(make_result()), headers=headers)

    verified = client.get("/api/verify/cert-0001").json()
    assert verified["verdict"] == "valid"
    assert verified["checks"] == {"hashMatches": True, "signatureValid": True, "expired": False, "revoked": False}
    assert verified["certificate"]["siteName"] == "Dhanbad Coal Site"
    assert client.get("/api/verify/CERT-9999").json()["verdict"] == "not-found"

    pdf = client.get("/api/certificates/CERT-0001/pdf", headers=admin_headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")

    revoked = client.post(
        "/api/certificates/CERT-0001/revoke", json={"reason": "Issued in error"}, headers=admin_headers
    )
    assert revoked.json()["state"] == "revoked"
    assert client.get("/api/verify/CERT-0001").json()["verdict"] == "revoked"
    assert client.get("/api/certificates/keys").json()["revokedCertificateIds"] == ["CERT-0001"]
    pulled = client.post("/api/sync", json=sync_body(), headers=headers).json()
    assert pulled["revokedCertificateIds"] == ["CERT-0001"]


def test_qr_text_matches_the_app_format(client: TestClient) -> None:
    from app.db import SessionLocal

    client.post("/api/sync", json=sync_body(make_result()), headers=worker_headers(client))
    with SessionLocal() as db:
        cert = db.get(Certificate, "CERT-0001")
        assert cert is not None
        text = certificate_qr_text(cert)
    prefix, fields = text.split("#c=")
    assert prefix == "https://ar-mining-training.vercel.app/"
    parts = fields.split("~")
    assert parts[:5] == ["1", "CERT-0001", "11003", "Birsa%20Murmu", "fire-explosion"]
    assert parts[9] == b64url(bytes.fromhex(cert.hash))
    assert parts[10] == cert.signature
