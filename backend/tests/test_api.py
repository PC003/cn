from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_reports_ok():
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "service" in body


def test_info_endpoint_reports_current_review_milestone():
    res = client.get("/api/info")
    assert res.status_code == 200
    body = res.json()
    assert body["review_milestone"] == 1
    assert body["name"] == "Netflix Streaming Transport Lab"


def test_info_endpoint_lists_planned_simulation_modules():
    res = client.get("/api/info")
    body = res.json()
    assert len(body["modules_scaffolded"]) >= 8
    assert any("tcp_model" in m for m in body["modules_scaffolded"])
    assert any("abr" in m for m in body["modules_scaffolded"])


def test_cors_allows_local_vite_dev_server():
    res = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
