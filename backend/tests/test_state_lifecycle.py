import pytest
import os
import json
from state import state, AppState, SEED_CATALOG, DEFAULT_GUARDRAILS, STATE_FILE

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_startup_clean_defaults():
    # Instantiate AppState as if server started
    app_state = AppState()
    assert len(app_state.orders) == 0
    assert len(app_state.audit_logs) == 0
    assert len(app_state.catalog) == len(SEED_CATALOG)
    assert app_state.guardrails["margin_floor_pct"] == 20.0
    assert app_state.guardrails["max_discount_pct"] == 15.0
    assert app_state.guardrails["approval_gate_inr"] == 50000.0

def test_active_session_persistence_and_stock_decrement():
    app_state = AppState()
    initial_stock = app_state.catalog[0]["stock_qty"]
    
    # Mutate state during active session
    app_state.catalog[0]["stock_qty"] -= 2
    app_state.orders.append({
        "order_id": "order_test_123",
        "sku_id": app_state.catalog[0]["sku_id"],
        "requested_qty": 2,
        "amount_inr": 17000.0,
        "status": "captured"
    })
    app_state.audit_logs.append({
        "timestamp": "2026-08-24T18:00:00Z",
        "decision": "captured",
        "reasoning": "Test order created"
    })
    app_state.save_state()

    # Verify mutations are persisted in state.json
    assert os.path.exists(STATE_FILE)
    with open(STATE_FILE, "r") as f:
        data = json.load(f)
    assert len(data["orders"]) == 1
    assert data["orders"][0]["order_id"] == "order_test_123"
    assert data["catalog"][0]["stock_qty"] == initial_stock - 2

def test_reset_state_wipes_to_defaults():
    app_state = AppState()
    # Add dirty state
    app_state.orders.append({"order_id": "dirty_1"})
    app_state.save_state()

    # Reset
    app_state.reset_state()
    assert len(app_state.orders) == 0
    assert len(app_state.audit_logs) == 0
    assert len(app_state.catalog) == len(SEED_CATALOG)
    assert app_state.catalog[0]["stock_qty"] == SEED_CATALOG[0]["stock_qty"]

    # Verify state.json is clean
    with open(STATE_FILE, "r") as f:
        data = json.load(f)
    assert len(data["orders"]) == 0

def test_reset_demo_endpoint():
    from fastapi.testclient import TestClient
    from main import app, state
    state.reset_state()
    client = TestClient(app)

    # Create order via endpoint
    order_res = client.post("/orders", json={
        "sku_id": "CHAIR-001",
        "requested_qty": 1,
        "offered_price": 8000.0
    })
    assert order_res.status_code == 200
    assert "order" in order_res.json(), f"Order creation failed: {order_res.json()}"
    assert len(client.get("/orders").json()) == 1

    # Call reset-demo
    reset_res = client.post("/reset-demo")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "Demo state reset successfully."

    # Verify orders and logs are clean
    assert len(client.get("/orders").json()) == 0
    assert len(client.get("/logs").json()) == 0
    assert client.get("/catalog").json()[0]["stock_qty"] == 50
