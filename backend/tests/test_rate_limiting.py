import time
import pytest
from fastapi.testclient import TestClient
from main import app, state

@pytest.fixture(autouse=True)
def setup_state():
    state.reset_state()

def test_negotiate_rate_limit_exceeded():
    client = TestClient(app)
    payload = {
        "buyer_id": "spammer_agent_001",
        "items": [{"sku_id": "CHAIR-001", "qty": 1}],
        "proposed_price_per_unit": 8000.0
    }

    # First 10 requests within window should succeed
    for i in range(10):
        resp = client.post("/negotiate", json=payload)
        assert resp.status_code == 200, f"Request {i+1} failed with status {resp.status_code}"

    # 11th request must fail with 429 Too Many Requests
    resp11 = client.post("/negotiate", json=payload)
    assert resp11.status_code == 429
    assert "Rate limit exceeded" in resp11.json()["detail"]
    assert "retry-after" in resp11.headers or "Retry-After" in resp11.headers
    retry_after = int(resp11.headers.get("Retry-After") or resp11.headers.get("retry-after"))
    assert retry_after > 0

def test_negotiate_rate_limit_separate_buckets():
    client = TestClient(app)
    spammer_payload = {
        "buyer_id": "spammer_agent_A",
        "items": [{"sku_id": "CHAIR-001", "qty": 1}],
        "proposed_price_per_unit": 8000.0
    }
    legit_payload = {
        "buyer_id": "legit_agent_B",
        "items": [{"sku_id": "CHAIR-001", "qty": 1}],
        "proposed_price_per_unit": 8000.0
    }

    # Max out buyer A
    for _ in range(10):
        client.post("/negotiate", json=spammer_payload)
    
    # 11th request for A fails
    assert client.post("/negotiate", json=spammer_payload).status_code == 429

    # Buyer B request succeeds independently
    resp_b = client.post("/negotiate", json=legit_payload)
    assert resp_b.status_code == 200
