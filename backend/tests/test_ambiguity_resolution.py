import pytest
from fastapi.testclient import TestClient
from main import app
from state import state, SEED_CATALOG
from buyer_agent import interpret_mission, check_category_ambiguity, resolve_ambiguity_with_history

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_single_sku_per_category_resolves_unambiguously():
    res = client.post("/buyer/mission", json={"message": "buy a chair"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "purchase_mandate"
    assert trail["matched_sku"] == "CHAIR-001"
    assert trail["interpreted_intent"]["is_ambiguous"] is False

def test_multiple_skus_trigger_category_ambiguity():
    # Add a second chair SKU to create ambiguity
    state.catalog.append({
        "sku_id": "CHAIR-002",
        "name": "Mesh Back Task Chair",
        "wholesale_cost": 2500.0,
        "retail_price": 5000.0,
        "stock_qty": 80,
        "category": "Seating"
    })
    res = client.post("/buyer/mission", json={"message": "buy a chair"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "purchase_mandate"
    assert trail["matched_sku"] is None
    
    neg = trail["negotiation_result"]
    assert neg["status"] == "ambiguous"
    assert neg["next_action"] == "specify_sku"
    assert "CHAIR-001" in neg["candidates"]
    assert "CHAIR-002" in neg["candidates"]

def test_followup_resolution_from_history():
    history = [
        {"role": "user", "content": "buy a chair"},
        {"role": "assistant", "content": "We have 2 options matching your request:\n1) Ergonomic Office Chair Pro (CHAIR-001) - ₹8,500\n2) Mesh Back Task Chair (CHAIR-002) - ₹5,000\nPlease reply with the SKU ID or product name you prefer."}
    ]
    res = client.post("/buyer/mission", json={
        "message": "CHAIR-001",
        "history": history
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "purchase_mandate"
    assert trail["matched_sku"] == "CHAIR-001"
    assert trail["negotiation_result"]["status"] == "auto_approved"

def test_exact_sku_id_bypasses_ambiguity():
    res = client.post("/buyer/mission", json={"message": "buy 2 Ergonomic Office Chairs (CHAIR-001) under 16k"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    assert trail["intent_type"] == "purchase_mandate"
    assert trail["matched_sku"] == "CHAIR-001"
    assert trail["negotiation_result"]["status"] == "auto_approved"
