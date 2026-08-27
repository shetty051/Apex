import pytest
from fastapi.testclient import TestClient
from main import app
from state import state

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_logs_reverse_chronological_sort():
    # Make two mutations that log audit entries
    client.delete("/catalog/CHAIR-001")
    client.post("/reset-inventory")

    res = client.get("/logs")
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) >= 2
    # Newest entry should be first (inventory_reset)
    first_log = logs[0]
    second_log = logs[1]
    assert first_log["decision"] == "inventory_reset"
    assert second_log["decision"] == "inventory_deleted"

def test_single_log_emission_deduplication():
    initial_log_count = len(state.audit_logs)
    
    # Run a negotiation that triggers gated_pending_approval (2 tables @ 38000 = 76000 > gate 50000; 9.5% discount <= 15% cap)
    res = client.post("/negotiate", json={
        "buyer_id": "test_buyer",
        "items": [{"sku_id": "TABLE-001", "qty": 2}],
        "proposed_price_per_unit": 38000.0
    })
    assert res.status_code == 200
    assert res.json()["status"] == "gated_pending_approval"

    # Exactly ONE new log entry should have been emitted (not two)
    new_log_count = len(state.audit_logs)
    assert new_log_count == initial_log_count + 1

    last_log = state.audit_logs[-1]
    assert last_log["decision"] == "gated_pending_approval"
    assert "margin_math" in last_log
    assert last_log["margin_math"]["requires_approval"] is True

def test_approve_gated_order():
    # Trigger gated order (10 chairs @ 7650 = 76500 > 50000 gate)
    res = client.post("/negotiate", json={
        "buyer_id": "test_buyer",
        "items": [{"sku_id": "CHAIR-001", "qty": 10}],
        "proposed_price_per_unit": 7650.0
    })
    assert res.status_code == 200
    assert res.json()["status"] == "gated_pending_approval"

    # Find the created gated order in state
    gated_order = next(o for o in state.orders if o["status"] == "gated_pending_approval")
    order_id = gated_order["order_id"]
    initial_stock = next(s["stock_qty"] for s in state.catalog if s["sku_id"] == "CHAIR-001")

    # Approve order
    approve_res = client.post(f"/orders/{order_id}/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "success"
    assert approve_res.json()["order"]["status"] == "captured"

    # Verify stock decremented by 10
    updated_stock = next(s["stock_qty"] for s in state.catalog if s["sku_id"] == "CHAIR-001")
    assert updated_stock == initial_stock - 10

    # Verify approval audit log entry
    last_log = state.audit_logs[-1]
    assert last_log["decision"] == "order_approved_by_merchant"
    assert order_id in last_log["reasoning"]

def test_reject_gated_order():
    # Trigger gated order (3 desks @ 25000 = 75000 > 50000 gate)
    res = client.post("/negotiate", json={
        "buyer_id": "test_buyer",
        "items": [{"sku_id": "DESK-001", "qty": 3}],
        "proposed_price_per_unit": 25000.0
    })
    assert res.status_code == 200
    assert res.json()["status"] == "gated_pending_approval"
    
    gated_order = next(o for o in state.orders if o["status"] == "gated_pending_approval")
    order_id = gated_order["order_id"]
    initial_stock = next(s["stock_qty"] for s in state.catalog if s["sku_id"] == "DESK-001")

    # Reject order
    reject_res = client.post(f"/orders/{order_id}/reject")
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "success"
    assert reject_res.json()["order"]["status"] == "rejected"

    # Stock should remain untouched
    current_stock = next(s["stock_qty"] for s in state.catalog if s["sku_id"] == "DESK-001")
    assert current_stock == initial_stock

    # Verify rejection audit log entry
    last_log = state.audit_logs[-1]
    assert last_log["decision"] == "order_rejected_by_merchant"
    assert order_id in last_log["reasoning"]
