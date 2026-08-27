import pytest
from fastapi.testclient import TestClient
from main import app, process_captured_order
from state import state

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_idempotent_stock_decrement_on_order_capture():
    # Fetch initial stock for CHAIR-001
    sku = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    initial_stock = sku["stock_qty"]
    assert initial_stock == 50

    order_record = {
        "order_id": "order_idempotent_1",
        "sku_id": "CHAIR-001",
        "requested_qty": 2,
        "amount_inr": 17000.0,
        "status": "captured",
        "stock_decremented": False
    }

    # First call: decrements stock from 50 to 48
    process_captured_order(order_record, sku, 2)
    assert sku["stock_qty"] == 48
    assert order_record["stock_decremented"] is True

    # Second & Third calls (simulating retries / re-fetches): MUST NOT double decrement
    process_captured_order(order_record, sku, 2)
    process_captured_order(order_record, sku, 2)
    assert sku["stock_qty"] == 48

def test_anti_caching_response_headers_on_get_endpoints():
    get_endpoints = ["/catalog", "/guardrails", "/orders", "/logs", "/catalog/mcp-schema"]
    for ep in get_endpoints:
        res = client.get(ep)
        assert res.status_code == 200
        headers = res.headers
        assert "no-store" in headers.get("cache-control", "")
        assert "no-cache" in headers.get("cache-control", "")
        assert headers.get("pragma") == "no-cache"
