from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from state import state, Product, Guardrails

app = FastAPI(title="ApexA2A Backend")

# Setup CORS
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str

@app.get("/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok"}

@app.get("/catalog", response_model=List[Product])
def get_catalog():
    return state.catalog

@app.get("/catalog/mcp-schema")
def get_catalog_mcp_schema():
    # Machine-readable JSON schema version with wholesale cost + bulk discount rules exposed
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "B2B Product Catalog",
        "description": "Catalog of B2B office and industrial SKUs, including cost analysis and discount structures for LLM agents.",
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "sku_id": {"type": "string"},
                "name": {"type": "string"},
                "wholesale_cost": {"type": "number", "description": "Base wholesale cost in INR."},
                "retail_price": {"type": "number", "description": "Standard retail price in INR before any discounts."},
                "stock_qty": {"type": "integer"},
                "category": {"type": "string"},
                "bulk_discount_rules": {
                    "type": "array",
                    "description": "Rules for applying volume discounts.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "min_qty": {"type": "integer"},
                            "discount_pct": {"type": "number"}
                        }
                    }
                }
            }
        },
        "data": []
    }
    
    # Enrich data with bulk discount rules
    for item in state.catalog:
        enriched_item = dict(item)
        enriched_item["bulk_discount_rules"] = [
            {"min_qty": 10, "discount_pct": 5.0},
            {"min_qty": 50, "discount_pct": 10.0}
        ]
        schema["data"].append(enriched_item)
        
    return schema

@app.get("/guardrails", response_model=Guardrails)
def get_guardrails():
    return state.guardrails

@app.put("/guardrails", response_model=Guardrails)
def update_guardrails(new_guardrails: Guardrails):
    state.guardrails = new_guardrails.model_dump()
    state.save_state()
    return state.guardrails

@app.post("/reset-demo")
def reset_demo():
    state.reset_state()
    return {"status": "Demo state reset successfully."}

class OfferRequest(BaseModel):
    sku_id: str
    requested_qty: int
    offered_price: float

@app.post("/evaluate-offer")
def api_evaluate_offer(request: OfferRequest):
    # Find the SKU
    sku = next((item for item in state.catalog if item["sku_id"] == request.sku_id), None)
    if not sku:
        return {"error": f"SKU {request.sku_id} not found."}
    
    from guardrail_engine import evaluate_offer
    return evaluate_offer(sku, request.requested_qty, request.offered_price, state.guardrails)

from fastapi import Query

@app.get("/logs")
def get_logs(type: str = Query("all", description="Filter by type: discount, gated, failure, all")):
    logs = state.audit_logs
    if type == "all":
        return logs
        
    filtered = []
    for log in logs:
        decision = log.get("decision", "")
        if type == "failure" and decision == "refused":
            filtered.append(log)
        elif type == "gated" and decision == "gated_pending_approval":
            filtered.append(log)
        elif type == "discount":
            margin_math = log.get("margin_math", {})
            if decision == "auto_approved" and margin_math.get("discount_pct", 0) > 0:
                filtered.append(log)
                
    return filtered

class CreateOrderRequest(BaseModel):
    sku_id: str
    requested_qty: int
    offered_price: float
    simulate_fail: bool = False

@app.post("/orders")
def create_new_order(request: CreateOrderRequest):
    sku = next((item for item in state.catalog if item["sku_id"] == request.sku_id), None)
    if not sku:
        return {"error": f"SKU {request.sku_id} not found."}
    
    from guardrail_engine import evaluate_offer
    from razorpay_client import create_order, simulate_capture
    
    evaluation = evaluate_offer(sku, request.requested_qty, request.offered_price, state.guardrails)
    decision = evaluation["decision"]
    
    if decision == "refused":
        return {"error": "Offer refused.", "evaluation": evaluation}
    
    amount_inr = request.requested_qty * request.offered_price
    rp_response = create_order(amount_inr, notes={"sku_id": request.sku_id, "qty": str(request.requested_qty)})
    
    if not rp_response.get("success"):
        return {"error": "Failed to create Razorpay order.", "details": rp_response.get("error")}
        
    rp_order = rp_response["order"]
    order_id = rp_order["id"]
    
    capture_resp = simulate_capture(order_id, should_fail=request.simulate_fail)
    
    if not capture_resp["success"]:
        order_status = "PAYMENT_RECOVERY_REQUIRED"
        fresh_rp = create_order(amount_inr, notes={"retry_for": order_id})
        new_order_id = fresh_rp["order"]["id"] if fresh_rp.get("success") else None
    else:
        order_status = decision if decision == "gated_pending_approval" else "captured"
        new_order_id = None
        
    order_record = {
        "order_id": order_id,
        "sku_id": request.sku_id,
        "requested_qty": request.requested_qty,
        "offered_price": request.offered_price,
        "amount_inr": amount_inr,
        "status": order_status,
        "evaluation": evaluation,
        "razorpay_order": rp_order,
        "recovery_order_id": new_order_id
    }
    
    state.orders.append(order_record)
    state.save_state()
    
    from audit_logger import log_audit_entry
    log_audit_entry(
        decision=order_status,
        reasoning=f"Order created and transitioned to {order_status}",
        margin_math={"order_total": amount_inr},
        razorpay_payload=rp_order
    )
    
    return {"status": "success", "order": order_record}

@app.get("/orders")
def get_orders():
    return state.orders

from typing import Optional

class NegotiateItem(BaseModel):
    sku_id: str
    qty: int

class NegotiateRequest(BaseModel):
    buyer_id: str
    items: List[NegotiateItem]
    proposed_price_per_unit: float
    budget_cap: Optional[float] = None

@app.post("/negotiate")
def negotiate_offer(request: NegotiateRequest):
    from guardrail_engine import evaluate_offer
    from audit_logger import log_audit_entry

    if not request.items:
        return {"error": "No items provided."}
    
    target_item = request.items[0]
    sku = next((item for item in state.catalog if item["sku_id"] == target_item.sku_id), None)
    
    if not sku:
        return {"error": f"SKU {target_item.sku_id} not found."}
    
    # Stock Check
    if target_item.qty > sku["stock_qty"]:
        alt_sku = next((item for item in state.catalog if item["category"] == sku["category"] and item["sku_id"] != sku["sku_id"] and item["stock_qty"] >= target_item.qty), None)
        
        reasoning = f"Requested quantity {target_item.qty} exceeds available stock ({sku['stock_qty']})."
        next_action = "suggest_alternative"
        
        log_audit_entry(
            decision="refused_insufficient_stock",
            reasoning=reasoning,
            buyer_prompt=f"Buyer {request.buyer_id} requested {target_item.qty} of {sku['sku_id']}",
            inventory_query={"requested": target_item.qty, "available": sku["stock_qty"]}
        )
        
        response = {
            "status": "refused",
            "reasoning": reasoning,
            "next_action": next_action
        }
        if alt_sku:
            response["suggested_alternative"] = alt_sku["sku_id"]
            
        return response
        
    # Evaluate Offer
    evaluation = evaluate_offer(sku, target_item.qty, request.proposed_price_per_unit, state.guardrails)
    decision = evaluation["decision"]
    
    if decision == "auto_approved":
        status = "auto_approved"
        next_action = "proceed_to_checkout"
        counter_offer = None
    elif decision == "gated_pending_approval":
        status = "gated_pending_approval"
        next_action = "wait_for_human"
        counter_offer = None
    else:
        status = "refused"
        next_action = "submit_counter_offer"
        counter_offer = evaluation.get("counter_price")
        
    reasoning = evaluation["reasoning"]
    
    log_audit_entry(
        decision=status,
        reasoning=f"Negotiation Gateway: {reasoning}",
        buyer_prompt=f"Buyer {request.buyer_id} proposed \u20b9{request.proposed_price_per_unit}",
        inventory_query={"requested": target_item.qty, "available": sku["stock_qty"]}
    )
    
    resp = {
        "status": status,
        "reasoning": reasoning,
        "next_action": next_action
    }
    if counter_offer is not None:
        resp["counter_offer"] = counter_offer
        
    return resp




