import pytest
from fastapi.testclient import TestClient
from main import app, state

@pytest.fixture(autouse=True)
def reset_state():
    state.reset_state()

def test_get_catalog_mcp_schema():
    client = TestClient(app)
    response = client.get("/catalog/mcp-schema")
    assert response.status_code == 200
    data = response.json()
    assert "$schema" in data
    assert "title" in data
    assert "data" in data
    assert len(data["data"]) > 0
    first_item = data["data"][0]
    assert "sku_id" in first_item
    assert "wholesale_cost" in first_item
    assert "bulk_discount_rules" in first_item

def test_post_negotiate_mandate_schema():
    client = TestClient(app)
    payload = {
        "buyer_id": "external_agent_007",
        "items": [{"sku_id": "CHAIR-001", "qty": 2}],
        "proposed_price_per_unit": 8000.0,
        "budget_cap": 16000.0
    }
    response = client.post("/negotiate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["auto_approved", "gated_pending_approval", "refused"]
    assert "next_action" in data

def test_post_orders_settle_stateless():
    client = TestClient(app)
    # First negotiate
    neg_payload = {
        "buyer_id": "external_agent_007",
        "items": [{"sku_id": "CHAIR-001", "qty": 1}],
        "proposed_price_per_unit": 8500.0
    }
    neg_resp = client.post("/negotiate", json=neg_payload)
    assert neg_resp.status_code == 200
    neg_data = neg_resp.json()
    assert neg_data["status"] == "auto_approved"

    # Now settle directly over HTTP without any session state
    settle_payload = {
        "buyer_id": "external_agent_007",
        "sku_id": "CHAIR-001",
        "qty": 1,
        "agreed_price_per_unit": 8500.0
    }
    settle_resp = client.post("/orders/settle", json=settle_payload)
    assert settle_resp.status_code == 200
    settle_data = settle_resp.json()
    assert settle_data["status"] == "success"
    assert settle_data["order"]["status"] == "captured"
    assert settle_data["order"]["sku_id"] == "CHAIR-001"

def test_cors_preflight():
    client = TestClient(app)
    headers = {
        "Origin": "http://localhost:5000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    }
    response = client.options("/negotiate", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5000"
