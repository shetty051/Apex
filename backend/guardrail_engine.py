from audit_logger import log_audit_entry

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

def evaluate_offer(sku: dict, requested_qty: int, offered_price: float, guardrails: dict, buyer_prompt: str = None, order_id: str = None, log_event: bool = True) -> dict:
    wholesale_cost = sku["wholesale_cost"]
    retail_price = sku["retail_price"]
    
    order_total = requested_qty * offered_price
    margin_pct = calculate_margin(offered_price, wholesale_cost)
    
    discount_pct = ((retail_price - offered_price) / retail_price) * 100.0 if retail_price > 0 else 0.0
    
    is_margin_healthy = check_margin_floor(margin_pct, guardrails["margin_floor_pct"])
    is_discount_safe = check_discount_cap(discount_pct, guardrails["max_discount_pct"])
    requires_approval = check_approval_gate(order_total, guardrails["approval_gate_inr"])
    
    margin_math = {
        "wholesale_cost": wholesale_cost,
        "retail_price": retail_price,
        "offered_price": offered_price,
        "requested_qty": requested_qty,
        "order_total": order_total,
        "margin_pct": round(margin_pct, 2),
        "discount_pct": round(discount_pct, 2),
        "margin_floor_pct": guardrails["margin_floor_pct"],
        "max_discount_pct": guardrails["max_discount_pct"],
        "approval_gate_inr": guardrails["approval_gate_inr"],
        "is_margin_healthy": is_margin_healthy,
        "is_discount_safe": is_discount_safe,
        "requires_approval": requires_approval
    }
    
    inventory_query = {
        "sku_id": sku.get("sku_id"),
        "requested": requested_qty,
        "available": sku.get("stock_qty")
    }
    if order_id:
        inventory_query["order_id"] = order_id
    
    if not is_margin_healthy or not is_discount_safe:
        min_price_margin = wholesale_cost / (1.0 - (guardrails["margin_floor_pct"] / 100.0))
        min_price_discount = retail_price * (1.0 - (guardrails["max_discount_pct"] / 100.0))
        counter_price = round(max(min_price_margin, min_price_discount), 2)
        
        reason = []
        if not is_margin_healthy:
            reason.append("margin too low")
        if not is_discount_safe:
            reason.append("discount too high")
            
        decision = "refused"
        reasoning = f"Offer refused ({' and '.join(reason)}). Acceptable price is \u20b9{counter_price} or higher."
        if log_event:
            log_audit_entry(decision, reasoning, margin_math, buyer_prompt=buyer_prompt, inventory_query=inventory_query)
        return {
            "decision": decision,
            "margin_pct": round(margin_pct, 2),
            "reasoning": reasoning,
            "counter_price": counter_price
        }
        
    if requires_approval:
        decision = "gated_pending_approval"
        reasoning = f"Order total \u20b9{order_total} exceeds the approval gate of \u20b9{guardrails['approval_gate_inr']}."
        if log_event:
            log_audit_entry(decision, reasoning, margin_math, buyer_prompt=buyer_prompt, inventory_query=inventory_query)
        return {
            "decision": decision,
            "margin_pct": round(margin_pct, 2),
            "reasoning": reasoning,
            "counter_price": None
        }
        
    decision = "auto_approved"
    reasoning = "Offer meets all automatic approval criteria."
    if log_event:
        log_audit_entry(decision, reasoning, margin_math, buyer_prompt=buyer_prompt, inventory_query=inventory_query)
    return {
        "decision": decision,
        "margin_pct": round(margin_pct, 2),
        "reasoning": reasoning,
        "counter_price": None
    }
