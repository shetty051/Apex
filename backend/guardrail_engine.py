def calculate_margin(offered_price: float, wholesale_cost: float) -> float:
    if offered_price <= 0:
        return -100.0
    return ((offered_price - wholesale_cost) / offered_price) * 100.0

def check_margin_floor(margin_pct: float, floor_pct: float) -> bool:
    return margin_pct >= floor_pct

def check_discount_cap(discount_pct: float, cap_pct: float) -> bool:
    return discount_pct <= cap_pct

def check_approval_gate(order_total: float, gate_inr: float) -> bool:
    return order_total > gate_inr

def evaluate_offer(sku: dict, requested_qty: int, offered_price: float, guardrails: dict) -> dict:
    wholesale_cost = sku["wholesale_cost"]
    retail_price = sku["retail_price"]
    
    order_total = requested_qty * offered_price
    margin_pct = calculate_margin(offered_price, wholesale_cost)
    
    discount_pct = ((retail_price - offered_price) / retail_price) * 100.0 if retail_price > 0 else 0.0
    
    is_margin_healthy = check_margin_floor(margin_pct, guardrails["margin_floor_pct"])
    is_discount_safe = check_discount_cap(discount_pct, guardrails["max_discount_pct"])
    requires_approval = check_approval_gate(order_total, guardrails["approval_gate_inr"])
    
    if not is_margin_healthy or not is_discount_safe:
        min_price_margin = wholesale_cost / (1.0 - (guardrails["margin_floor_pct"] / 100.0))
        min_price_discount = retail_price * (1.0 - (guardrails["max_discount_pct"] / 100.0))
        counter_price = round(max(min_price_margin, min_price_discount), 2)
        
        reason = []
        if not is_margin_healthy:
            reason.append("margin too low")
        if not is_discount_safe:
            reason.append("discount too high")
            
        return {
            "decision": "refused",
            "margin_pct": round(margin_pct, 2),
            "reasoning": f"Offer refused ({' and '.join(reason)}). Acceptable price is \u20b9{counter_price} or higher.",
            "counter_price": counter_price
        }
        
    if requires_approval:
        return {
            "decision": "gated_pending_approval",
            "margin_pct": round(margin_pct, 2),
            "reasoning": f"Order total \u20b9{order_total} exceeds the approval gate of \u20b9{guardrails['approval_gate_inr']}.",
            "counter_price": None
        }
        
    return {
        "decision": "auto_approved",
        "margin_pct": round(margin_pct, 2),
        "reasoning": "Offer meets all automatic approval criteria.",
        "counter_price": None
    }
