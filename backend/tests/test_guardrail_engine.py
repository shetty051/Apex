import pytest
from guardrail_engine import evaluate_offer, calculate_margin

# Mock data
mock_guardrails = {
    "margin_floor_pct": 20.0,
    "max_discount_pct": 15.0,
    "approval_gate_inr": 50000.0
}

mock_sku = {
    "sku_id": "TEST-001",
    "name": "Test Item",
    "wholesale_cost": 4000.0,
    "retail_price": 8000.0,
    "stock_qty": 50,
    "category": "Test"
}

def test_margin_breach():
    # Cost is 4000, 20% margin floor means min price is 5000
    # Let's offer 4500. Margin will be (4500 - 4000)/4500 = 11.11% < 20%
    result = evaluate_offer(mock_sku, 1, 4500.0, mock_guardrails)
    assert result["decision"] == "refused"
    assert "margin too low" in result["reasoning"]
    assert result["counter_price"] == 6800.0 # 8000 * 0.85 = 6800. Wait! max(5000, 6800) = 6800!

def test_discount_breach():
    # Cost is 4000. Retail is 8000. Max discount is 15%, so min price is 6800.
    # Let's offer 6000. Margin is (6000-4000)/6000 = 33.3% > 20% (margin healthy)
    # But discount is 25% > 15%. (discount breach)
    result = evaluate_offer(mock_sku, 1, 6000.0, mock_guardrails)
    assert result["decision"] == "refused"
    assert "discount too high" in result["reasoning"]
    assert result["counter_price"] == 6800.0

def test_order_over_approval_gate():
    # Offer 7000. Margin is (7000-4000)/7000 = 42.8% (healthy)
    # Discount is 12.5% (healthy).
    # Qty is 10. Total = 70000 > 50000 (gate breach)
    result = evaluate_offer(mock_sku, 10, 7000.0, mock_guardrails)
    assert result["decision"] == "gated_pending_approval"
    assert result["counter_price"] is None

def test_healthy_auto_approved():
    # Offer 7000. Qty 5. Total = 35000 < 50000.
    result = evaluate_offer(mock_sku, 5, 7000.0, mock_guardrails)
    assert result["decision"] == "auto_approved"
    assert result["counter_price"] is None
