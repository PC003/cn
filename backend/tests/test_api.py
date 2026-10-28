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
    assert body["review_milestone"] == 3
    assert body["name"] == "StreamLens"


def test_info_endpoint_lists_planned_simulation_modules():
    res = client.get("/api/info")
    body = res.json()
    assert len(body["modules_scaffolded"]) >= 8
    assert any("lab" in m for m in body["modules_scaffolded"])
    assert any("tcp_model" in m for m in body["modules_scaffolded"])
    assert any("abr" in m for m in body["modules_scaffolded"])


def test_cors_allows_local_vite_dev_server():
    res = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_defaults_endpoint_lists_presets():
    res = client.get("/api/defaults")
    assert res.status_code == 200
    body = res.json()
    assert "mobile_4g" in body["presets"]
    assert body["config"]["transport"]["protocol"] == "tcp"


def test_simulate_endpoint_returns_measured_result():
    res = client.post("/api/simulate", json={"config": {"seed": 3, "video": {"duration_s": 40}}})
    assert res.status_code == 200
    body = res.json()
    assert len(body["segments"]) == 10
    assert 0 <= body["metrics"]["qoe"] <= 100


def test_simulate_rejects_invalid_config_with_422():
    res = client.post("/api/simulate", json={"config": {"network": {"loss_probability": 2}}})
    assert res.status_code == 422
    assert "loss_probability" in res.json()["detail"]


def test_compare_endpoint_same_seed_all_transports():
    res = client.post("/api/compare", json={"config": {"seed": 2, "video": {"duration_s": 20}}})
    assert res.status_code == 200
    assert [r["protocol"] for r in res.json()["runs"]] == ["tcp", "udp", "quic"]


def test_export_endpoint_csv_and_json():
    rows = [{"a": 1, "b": 2}, {"a": 3, "b": 4}]
    csv_res = client.post("/api/export", json={"format": "csv", "filename": "x", "rows": rows})
    assert csv_res.status_code == 200
    assert csv_res.text.startswith("a,b\n1,2")
    assert "attachment" in csv_res.headers["content-disposition"]
    json_res = client.post("/api/export", json={"format": "json", "data": {"k": 1}})
    assert json_res.json() == {"k": 1}
    assert client.post("/api/export", json={"format": "csv"}).status_code == 422
