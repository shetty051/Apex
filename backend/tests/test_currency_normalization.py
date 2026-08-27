import pytest
from buyer_agent import normalize_currency, interpret_mission
from state import SEED_CATALOG

def test_normalize_currency_units():
    # "2k" -> 2000
    assert normalize_currency("2k") == 2000.0
    assert normalize_currency("2K") == 2000.0
    
    # "38k" -> 38000
    assert normalize_currency("38k") == 38000.0
    assert normalize_currency("38.5k") == 38500.0
    
    # "1.5L" -> 150000
    assert normalize_currency("1.5L") == 150000.0
    assert normalize_currency("1.5l") == 150000.0
    assert normalize_currency("1.5 lakh") == 150000.0
    assert normalize_currency("2 lakhs") == 200000.0
    
    # "₹50,000" -> 50000
    assert normalize_currency("₹50,000") == 50000.0
    assert normalize_currency("50,000") == 50000.0
    assert normalize_currency("₹ 16,000") == 16000.0
    assert normalize_currency("50000") == 50000.0

def test_intent_extraction_with_catalog_grounding():
    # Test valid SKU match with currency normalization
    intent = interpret_mission("buy 2 Ergonomic Office Chairs (CHAIR-001) for 16k", SEED_CATALOG)
    assert intent["intent_type"] == "purchase_mandate"
    assert intent["matched_sku_id"] == "CHAIR-001"
    assert intent["quantity"] == 2
    assert intent["budget_cap_inr"] == 16000.0

    # Test lakh currency normalization
    intent_lakh = interpret_mission("buy 1 Motorized Standing Desk (DESK-001) for 1.5L", SEED_CATALOG)
    assert intent_lakh["intent_type"] == "purchase_mandate"
    assert intent_lakh["matched_sku_id"] == "DESK-001"
    assert intent_lakh["quantity"] == 1
    assert intent_lakh["budget_cap_inr"] == 150000.0

    # Test non-existent SKU -> matched_sku_id must be None or null, NOT guessed string
    intent_unmatched = interpret_mission("buy me a laser printer", SEED_CATALOG)
    assert intent_unmatched["intent_type"] == "purchase_mandate"
    assert intent_unmatched["matched_sku_id"] is None
    assert intent_unmatched["item_query_raw"] is not None
