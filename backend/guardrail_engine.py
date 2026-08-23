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

def evaluate_offer(
    sku: dict, 
    requested_qty: int, 
    offered_price: float, 
    guardrails: dict,
    buyer_prompt: str = None,
    inventory_query: dict = None
) -> dict:
    wholesale_cost = sku["wholesale_cost"]
    retail_price = sku["retail_price"]
    sku_name = sku.get("name", sku["sku_id"])
    
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
        "discount_pct": round(discount_pct, 2)
    }
    
    # Detailed step-by-step breakdown
    step1 = f"1. Input Details: SKU {sku['sku_id']} ({sku_name}), Qty: {requested_qty}, Offered: \u20b9{offered_price} (Retail: \u20b9{retail_price}, Wholesale: \u20b9{wholesale_cost})."
    step2 = f"2. Discount Evaluation: Calculated Discount = {round(discount_pct, 2)}% vs Max Cap = {guardrails['max_discount_pct']}% -> {'PASSED' if is_discount_safe else 'FAILED'}."
    step3 = f"3. Margin Formula Evaluation: (\u20b9{offered_price} - \u20b9{wholesale_cost}) / \u20b9{offered_price} = {round(margin_pct, 2)}% vs Margin Floor = {guardrails['margin_floor_pct']}% -> {'PASSED' if is_margin_healthy else 'FAILED'}."
    step4 = f"4. Gating Threshold Check: Order Total \u20b9{order_total} vs Approval Gate \u20b9{guardrails['approval_gate_inr']} -> {'GATED (REQUIRES APPROVAL)' if requires_approval else 'PASSED'}."
    
    detailed_trace = f"{step1}\n{step2}\n{step3}\n{step4}"
    
    inv_query = inventory_query or {"sku_id": sku["sku_id"], "qty": requested_qty}
    
    if not is_margin_healthy or not is_discount_safe:
        min_price_margin = wholesale_cost / (1.0 - (guardrails["margin_floor_pct"] / 100.0))
        min_price_discount = retail_price * (1.0 - (guardrails["max_discount_pct"] / 100.0))
        counter_price = round(max(min_price_margin, min_price_discount), 2)
        
        reason = []
        if not is_margin_healthy:
            reason.append(f"margin too low ({round(margin_pct, 2)}% < {guardrails['margin_floor_pct']}% floor)")
        if not is_discount_safe:
            reason.append(f"discount too high ({round(discount_pct, 2)}% > {guardrails['max_discount_pct']}% cap)")
            
        decision = "refused"
        full_reasoning = f"DECISION: REFUSED ({' and '.join(reason)}).\n{detailed_trace}\nCounter-Offer Price: \u20b9{counter_price} or higher required."
        log_audit_entry(decision, full_reasoning, margin_math, buyer_prompt=buyer_prompt, inventory_query=inv_query)
        return {
            "decision": decision,
            "margin_pct": round(margin_pct, 2),
            "reasoning": full_reasoning,
            "counter_price": counter_price
        }
        
    if requires_approval:
        decision = "gated_pending_approval"
        full_reasoning = f"DECISION: GATED PENDING APPROVAL (Order total \u20b9{order_total} > \u20b9{guardrails['approval_gate_inr']} gate).\n{detailed_trace}"
        log_audit_entry(decision, full_reasoning, margin_math, buyer_prompt=buyer_prompt, inventory_query=inv_query)
        return {
            "decision": decision,
            "margin_pct": round(margin_pct, 2),
            "reasoning": full_reasoning,
            "counter_price": None
        }
        
    decision = "auto_approved"
    full_reasoning = f"DECISION: AUTO APPROVED (Meets all margin, discount, and gating thresholds).\n{detailed_trace}"
    log_audit_entry(decision, full_reasoning, margin_math, buyer_prompt=buyer_prompt, inventory_query=inv_query)
    return {
        "decision": decision,
        "margin_pct": round(margin_pct, 2),
        "reasoning": full_reasoning,
        "counter_price": None
    }
