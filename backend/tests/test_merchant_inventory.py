import pytest
from fastapi.testclient import TestClient
from main import app
from state import state

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_app_state():
    state.reset_state()

def test_put_catalog_sku_inline_edit():
    # Update CHAIR-001 stock from 50 to 55 and retail_price to 9000
    res = client.put("/catalog/CHAIR-001", json={
        "stock_qty": 55,
        "retail_price": 9000.0
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["product"]["stock_qty"] == 55
    assert data["product"]["retail_price"] == 9000.0

    # Verify state catalog and audit log
    chair = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    assert chair["stock_qty"] == 55
    assert chair["retail_price"] == 9000.0
    
    last_log = state.audit_logs[-1]
    assert last_log["decision"] == "inventory_updated"
    assert "CHAIR-001" in last_log["reasoning"]

def test_post_catalog_duplicate_sku_rejected():
    # Attempting to create duplicate SKU CHAIR-001 should return 400 Bad Request
    res = client.post("/catalog", json={
        "sku_id": "CHAIR-001",
        "name": "Duplicate Chair Pro",
        "wholesale_cost": 4000.0,
        "retail_price": 8500.0,
        "stock_qty": 10,
        "category": "Seating"
    })
    assert res.status_code == 400
    assert "already exists in catalog" in res.json()["detail"]

def test_delete_catalog_sku():
    # Delete CHAIR-001
    res = client.delete("/catalog/CHAIR-001")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert res.json()["deleted_sku_id"] == "CHAIR-001"
    assert len(client.get("/catalog").json()) == 5

    # Verify MCP schema reflects deletion immediately
    schema_res = client.get("/catalog/mcp-schema")
    assert schema_res.status_code == 200
    schema_skus = [item["sku_id"] for item in schema_res.json()["data"]]
    assert "CHAIR-001" not in schema_skus

def test_reset_inventory_and_reset_guardrails_decoupled():
    # Mutate inventory and guardrails
    client.delete("/catalog/CHAIR-001")
    client.put("/guardrails", json={
        "margin_floor_pct": 30.0,
        "max_discount_pct": 10.0,
        "approval_gate_inr": 100000.0
    })

    # Reset inventory only -> guardrails must remain mutated
    res_inv = client.post("/reset-inventory")
    assert res_inv.status_code == 200
    assert len(client.get("/catalog").json()) == 6
    assert client.get("/guardrails").json()["margin_floor_pct"] == 30.0

    # Reset guardrails only -> inventory must remain 6 items
    res_guard = client.post("/reset-guardrails")
    assert res_guard.status_code == 200
    assert client.get("/guardrails").json()["margin_floor_pct"] == 20.0
    assert len(client.get("/catalog").json()) == 6
