import pytest
from fastapi.testclient import TestClient
from main import app, state
from guardrail_engine import evaluate_offer, calculate_margin, check_margin_floor, check_discount_cap, check_approval_gate

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_state():
    state.reset_state()

def test_margin_floor_boundary_exact_20_percent():
    """
    (1) Margin floor enforcement:
        - Wholesale cost = ₹4,000, Retail = ₹10,000.
        - At offered price ₹5,000: Margin = (5000 - 4000) / 5000 = 20.0%. EXACTLY 20% margin -> PASS (auto_approved).
        - At offered price ₹4,993.75: Margin = 19.899% < 20.0% -> REFUSED.
    """
    sku = {
        "sku_id": "TEST-SKU",
        "wholesale_cost": 4000.0,
        "retail_price": 10000.0,
        "stock_qty": 100
    }
    guardrails = {
        "margin_floor_pct": 20.0,
        "max_discount_pct": 55.0, # High cap so discount doesn't trigger
        "approval_gate_inr": 100000.0
    }

    # Exactly 20% margin
    eval_pass = evaluate_offer(sku, 1, 5000.0, guardrails, log_event=False)
    assert eval_pass["decision"] == "auto_approved"
    assert eval_pass["margin_pct"] == 20.0

    # 19.9% margin
    eval_fail = evaluate_offer(sku, 1, 4993.75, guardrails, log_event=False)
    assert eval_fail["decision"] == "refused"
    assert "margin too low" in eval_fail["reasoning"]

def test_discount_cap_boundary_exact_15_percent():
    """
    (2) Discount cap enforcement:
        - Retail price = ₹10,000, Wholesale = ₹4,000.
        - Max discount cap = 15.0%.
        - At offered price ₹8,500: Discount = (10000 - 8500) / 10000 = 15.0%. EXACTLY 15% discount -> PASS.
        - At offered price ₹8,490: Discount = (10000 - 8490) / 10000 = 15.1% > 15.0% -> REFUSED.
    """
    sku = {
        "sku_id": "TEST-SKU",
        "wholesale_cost": 4000.0,
        "retail_price": 10000.0,
        "stock_qty": 100
    }
    guardrails = {
        "margin_floor_pct": 20.0,
        "max_discount_pct": 15.0,
        "approval_gate_inr": 100000.0
    }

    # Exactly 15% discount
    eval_pass = evaluate_offer(sku, 1, 8500.0, guardrails, log_event=False)
    assert eval_pass["decision"] == "auto_approved"

    # 15.1% discount
    eval_fail = evaluate_offer(sku, 1, 8490.0, guardrails, log_event=False)
    assert eval_fail["decision"] == "refused"
    assert "discount too high" in eval_fail["reasoning"]

def test_approval_gating_boundary_exact_50000_inr():
    """
    (3) Approval gating enforcement:
        - Approval gate = ₹50,000.
        - Order total = exactly ₹50,000.0 -> DOES NOT GATE (auto_approved).
        - Order total = ₹50,001.0 -> GATES (gated_pending_approval).
    """
    sku = {
        "sku_id": "TEST-SKU",
        "wholesale_cost": 10000.0,
        "retail_price": 30000.0,
        "stock_qty": 100
    }
    guardrails = {
        "margin_floor_pct": 20.0,
        "max_discount_pct": 25.0,
        "approval_gate_inr": 50000.0
    }

    # Exactly ₹50,000 total (2 units @ ₹25,000)
    eval_pass = evaluate_offer(sku, 2, 25000.0, guardrails, log_event=False)
    assert eval_pass["decision"] == "auto_approved"

    # Exactly ₹50,001 total (2 units @ ₹25,000.50)
    eval_gate = evaluate_offer(sku, 2, 25000.50, guardrails, log_event=False)
    assert eval_gate["decision"] == "gated_pending_approval"

def test_below_cost_offer_safe_counter_offer():
    """
    (4) Below-cost offer produces a correctly calculated safe counter-offer:
        - Wholesale = ₹4,000, Retail = ₹10,000.
        - Offered price = ₹3,500 (below wholesale cost!).
        - Margin floor = 20% (min price = ₹5,000), Discount cap = 15% (min price = ₹8,500).
        - Expect decision: refused, counter_price: ₹8,500.0.
    """
    sku = {
        "sku_id": "CHAIR-001",
        "wholesale_cost": 4000.0,
        "retail_price": 10000.0,
        "stock_qty": 50
    }
    guardrails = {
        "margin_floor_pct": 20.0,
        "max_discount_pct": 15.0,
        "approval_gate_inr": 50000.0
    }

    eval_result = evaluate_offer(sku, 1, 3500.0, guardrails, log_event=False)
    assert eval_result["decision"] == "refused"
    assert eval_result["counter_price"] == 8500.0

def test_partial_stock_scenario_with_alternative():
    """
    (5) Partial-stock scenario returns available quantity and alternative SKU suggestion.
    """
    # Set CHAIR-001 stock to 2 units
    sku = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    sku["stock_qty"] = 2

    response = client.post("/negotiate", json={
        "buyer_id": "test_agent",
        "items": [{"sku_id": "CHAIR-001", "qty": 5}],
        "proposed_price_per_unit": 8000.0
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refused"
    assert "exceeds available stock" in data["reasoning"]
    assert "suggested_alternative" in data

def test_concurrency_settlement_stockout():
    """
    (6) Concurrency Stress Test:
        - Fires 10 near-simultaneous settlement calls against a SKU with stock_qty = 1.
        - Confirms exactly 1 succeeds (captured) and 9 are rejected (insufficient stock).
        - Confirms final verified stock count is exactly 0 (never negative).
    """
    import concurrent.futures
    sku = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    sku["stock_qty"] = 1

    num_concurrent = 10

    def dispatch_settlement(caller_idx: int):
        with TestClient(app) as test_c:
            res = test_c.post("/orders/settle", json={
                "buyer_id": f"concurrency_buyer_{caller_idx}",
                "sku_id": "CHAIR-001",
                "qty": 1,
                "agreed_price_per_unit": 8000.0
            })
            return caller_idx, res.status_code, res.json()

    print(f"\n[STRESS TEST] Dispatching {num_concurrent} concurrent threads against CHAIR-001 (stock=1)...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent) as executor:
        futures = [executor.submit(dispatch_settlement, i) for i in range(num_concurrent)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    successes = [r for r in results if r[1] == 200]
    failures = [r for r in results if r[1] == 400]

    print(f"[STRESS TEST RESULTS]")
    print(f"  - Total Requests Dispatched: {len(results)}")
    print(f"  - Successful Settlements (HTTP 200 Captured): {len(successes)}")
    print(f"  - Rejected Settlements (HTTP 400 Insufficient Stock): {len(failures)}")
    if successes:
        print(f"  - Winning Order ID: {successes[0][2].get('order_id')}")
    if failures:
        print(f"  - Sample Rejection Error: {failures[0][2].get('detail')}")

    sku_final = next(item for item in state.catalog if item["sku_id"] == "CHAIR-001")
    print(f"  - Final Verified Stock: {sku_final['stock_qty']} (never negative)")

    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(failures) == num_concurrent - 1, f"Expected {num_concurrent - 1} failures, got {len(failures)}"
    assert sku_final["stock_qty"] == 0, f"Expected final stock 0, got {sku_final['stock_qty']}"
