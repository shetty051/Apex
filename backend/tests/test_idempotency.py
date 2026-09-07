import pytest
from fastapi.testclient import TestClient
from main import app, state

@pytest.fixture(autouse=True)
def setup_state():
    state.reset_state()

def test_duplicate_settlement_request_same_idempotency_key():
    client = TestClient(app)
    
    # Get initial stock of CHAIR-001
    sku = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    initial_stock = sku["stock_qty"]
    
    payload = {
        "buyer_id": "test_agent_dup",
        "sku_id": "CHAIR-001",
        "qty": 2,
        "agreed_price_per_unit": 7500.0,
        "idempotency_key": "idempotent-key-001"
    }

    # First settlement request
    resp1 = client.post("/orders/settle", json=payload)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "success"
    order_id1 = data1["order_id"]

    # Check intermediate stock (should be decremented once: initial - 2)
    sku_after_first = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    assert sku_after_first["stock_qty"] == initial_stock - 2

    # Second settlement request with identical payload & idempotency_key
    resp2 = client.post("/orders/settle", json=payload)
    assert resp2.status_code == 200
    data2 = resp2.json()

    # 1. Responses must be completely identical
    assert data1 == data2

    # 2. Razorpay order_id must match original order_id
    assert data2["order_id"] == order_id1
    assert data2["order"]["razorpay_order"]["id"] == data1["order"]["razorpay_order"]["id"]

    # 3. Stock must be decremented EXACTLY ONCE (still initial - 2, NOT initial - 4)
    sku_after_second = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    assert sku_after_second["stock_qty"] == initial_stock - 2

    # 4. Exactly one order record exists in state.orders for this order_id
    matching_orders = [o for o in state.orders if o["order_id"] == order_id1]
    assert len(matching_orders) == 1

def test_distinct_settlement_requests_different_idempotency_keys():
    client = TestClient(app)
    
    sku = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    initial_stock = sku["stock_qty"]

    payload_a = {
        "buyer_id": "test_agent_a",
        "sku_id": "CHAIR-001",
        "qty": 1,
        "agreed_price_per_unit": 7500.0,
        "idempotency_key": "idempotent-key-AAA"
    }
    payload_b = {
        "buyer_id": "test_agent_b",
        "sku_id": "CHAIR-001",
        "qty": 1,
        "agreed_price_per_unit": 7500.0,
        "idempotency_key": "idempotent-key-BBB"
    }

    resp_a = client.post("/orders/settle", json=payload_a)
    assert resp_a.status_code == 200
    data_a = resp_a.json()

    resp_b = client.post("/orders/settle", json=payload_b)
    assert resp_b.status_code == 200
    data_b = resp_b.json()

    # Distinct requests process normally with separate order IDs
    assert data_a["order_id"] != data_b["order_id"]

    # Stock is decremented twice (initial - 2)
    sku_final = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    assert sku_final["stock_qty"] == initial_stock - 2
