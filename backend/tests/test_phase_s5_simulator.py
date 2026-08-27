import pytest
from fastapi.testclient import TestClient
from main import app
from state import state

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_preset_scenario_a_structured_auto_approve():
    # Scenario A: 2 Ergonomic Chairs under 16k (unit price 8000)
    res = client.post("/negotiate", json={
        "buyer_id": "simulator_buyer",
        "items": [{"sku_id": "CHAIR-001", "qty": 2}],
        "proposed_price_per_unit": 8000.0,
        "budget_cap": 16000.0
    })
    assert res.status_code == 200
    assert res.json()["status"] == "auto_approved"

def test_preset_scenario_b_structured_gated_approval():
    # Scenario B: 2 Modular Conference Tables under 76k (unit price 38000)
    res = client.post("/negotiate", json={
        "buyer_id": "simulator_buyer",
        "items": [{"sku_id": "TABLE-001", "qty": 2}],
        "proposed_price_per_unit": 38000.0,
        "budget_cap": 76000.0
    })
    assert res.status_code == 200
    assert res.json()["status"] == "gated_pending_approval"

def test_preset_scenario_c_structured_refused_margin_breach():
    # Scenario C: 2 Ergonomic Chairs under 2k (unit price 1000)
    res = client.post("/negotiate", json={
        "buyer_id": "simulator_buyer",
        "items": [{"sku_id": "CHAIR-001", "qty": 2}],
        "proposed_price_per_unit": 1000.0,
        "budget_cap": 2000.0
    })
    assert res.status_code == 200
    assert res.json()["status"] == "refused"
    assert "counter_offer" in res.json()

def test_custom_structured_harness_dispatch():
    # Custom input test on DESK-001 (Retail 28000, Wholesale 15000): 2 units @ 25000 = 50,000 Total
    res = client.post("/negotiate", json={
        "buyer_id": "simulator_custom_buyer",
        "items": [{"sku_id": "DESK-001", "qty": 2}],
        "proposed_price_per_unit": 25000.0,
        "budget_cap": 50000.0
    })
    assert res.status_code == 200
    # Margin = (25000 - 15000)/25000 = 40% >= 20%; Discount = (28000-25000)/28000 = 10.7% <= 15%; Total 50,000 <= 50,000 gate
    assert res.json()["status"] == "auto_approved"
