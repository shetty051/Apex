import pytest
from fastapi.testclient import TestClient
from main import app
from state import state

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_scenario_a_bulk_optimal_auto_approved():
    res = client.post("/buyer/mission", json={"message": "Buy 2 Ergonomic Office Chairs under 16k"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    
    assert trail["matched_sku"] == "CHAIR-001"
    assert trail["interpreted_intent"]["quantity"] == 2
    assert trail["interpreted_intent"]["budget_cap_inr"] == 16000.0
    
    neg = trail["negotiation_result"]
    assert neg["status"] == "auto_approved"
    assert neg["next_action"] == "proceed_to_checkout"
    
    order = trail["order_result"]
    assert order["status"] == "captured"
    assert order["amount_inr"] == 16000.0
    assert order["stock_decremented"] is True

def test_scenario_b_high_value_bundle_gated_approval():
    res = client.post("/buyer/mission", json={"message": "Buy 2 Modular 8-Seater Conference Tables under 76k"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    
    assert trail["matched_sku"] == "TABLE-001"
    assert trail["interpreted_intent"]["quantity"] == 2
    assert trail["interpreted_intent"]["budget_cap_inr"] == 76000.0
    
    neg = trail["negotiation_result"]
    assert neg["status"] == "gated_pending_approval"
    assert neg["next_action"] == "wait_for_human"
    assert "exceeds the approval gate of ₹50000.0" in neg["reasoning"] or "exceeds" in neg["reasoning"]
    assert trail["order_result"]["status"] == "gated_pending_approval"

def test_scenario_c_margin_breach_refused_counter_offer():
    res = client.post("/buyer/mission", json={"message": "Buy 2 Ergonomic Office Chairs under 2k"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    
    assert trail["matched_sku"] == "CHAIR-001"
    assert trail["interpreted_intent"]["quantity"] == 2
    assert trail["interpreted_intent"]["budget_cap_inr"] == 2000.0
    
    neg = trail["negotiation_result"]
    assert neg["status"] == "refused"
    assert neg["next_action"] == "submit_counter_offer"
    assert neg["counter_offer"] == 7225.0
    assert trail["order_result"] is None

def test_scenario_d_partial_stock_insufficient_stock_refused():
    res = client.post("/buyer/mission", json={"message": "Buy 10 Modular 8-Seater Conference Tables under 300k"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    trail = data["handshake_trail"]
    
    assert trail["matched_sku"] == "TABLE-001"
    assert trail["interpreted_intent"]["quantity"] == 10
    assert trail["interpreted_intent"]["budget_cap_inr"] == 300000.0
    
    neg = trail["negotiation_result"]
    assert neg["status"] == "refused"
    assert neg["next_action"] == "suggest_alternative"
    assert "exceeds available stock" in neg["reasoning"]
    assert neg["suggested_alternative"] is not None
    assert trail["order_result"] is None
