import pytest
from fastapi.testclient import TestClient
from main import app
from state import state

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_greeting_intent():
    res = client.post("/buyer/mission", json={"message": "hey"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "greeting"
    assert trail["matched_sku"] is None
    assert trail["order_result"] is None
    assert trail["negotiation_result"]["status"] == "greeting"
    # Verify no orders created
    assert len(state.orders) == 0

def test_discovery_intent():
    res = client.post("/buyer/mission", json={"message": "what are the available items for purchase?"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "discovery"
    assert trail["matched_sku"] is None
    assert trail["order_result"] is None
    assert "available in-stock items" in trail["interpreted_intent"]["needs_confirmation_text"]
    # Verify no orders created
    assert len(state.orders) == 0

def test_nonexistent_item_purchase_mandate():
    res = client.post("/buyer/mission", json={"message": "buy me a laser printer"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "purchase_mandate"
    assert trail["matched_sku"] is None
    assert trail["order_result"] is None
    assert trail["negotiation_result"]["status"] == "unavailable"
    assert "laser printer" in trail["negotiation_result"]["reasoning"]
    assert len(trail["negotiation_result"]["suggested_alternatives"]) >= 2
    # Verify no orders created
    assert len(state.orders) == 0

def test_genuine_matched_purchase_mandate():
    res = client.post("/buyer/mission", json={"message": "buy me 2 Ergonomic Office Chairs (CHAIR-001) under 16k"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "purchase_mandate"
    assert trail["matched_sku"] == "CHAIR-001"
    assert trail["negotiation_result"]["status"] == "auto_approved"
    assert trail["order_result"] is not None
    assert trail["order_result"]["status"] == "captured"
    # Verify order created and persisted
    assert len(state.orders) == 1
    assert state.orders[0]["sku_id"] == "CHAIR-001"
