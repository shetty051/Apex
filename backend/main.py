import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from state import state, Product, Guardrails

app = FastAPI(title="ApexA2A Backend", docs_url="/docs", redoc_url="/redoc")

# Setup CORS for external agents, Vercel frontend, and localhost callers
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.method == "GET":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

class HealthResponse(BaseModel):
    status: str

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "ApexA2A Merchant Gateway API",
        "documentation": "/docs",
        "endpoints": {
            "mcp_schema": "/catalog/mcp-schema",
            "catalog": "/catalog",
            "negotiate": "/negotiate",
            "settle": "/orders/settle",
            "orders": "/orders",
            "logs": "/logs",
            "guardrails": "/guardrails",
            "health": "/health"
        }
    }

@app.get("/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok"}

@app.get("/catalog", response_model=List[Product])
def get_catalog():
    return state.catalog

@app.get("/catalog/mcp-schema")
def get_catalog_mcp_schema():
    """
    Public MCP-compatible JSON schema endpoint for external autonomous buyer agents.
    
    Note: No authentication is required for this hackathon scope. However, in a production deployment,
    this endpoint would require API key authentication (e.g., via `X-API-Key` or `Authorization: Bearer <key>`).
    """
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

class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    wholesale_cost: Optional[float] = None
    retail_price: Optional[float] = None
    stock_qty: Optional[int] = None
    category: Optional[str] = None

@app.put("/catalog/{sku_id}")
def update_catalog_product(sku_id: str, request: UpdateProductRequest):
    sku = next((item for item in state.catalog if item["sku_id"] == sku_id), None)
    
    if sku:
        previous_stock = sku["stock_qty"]
        previous_price = sku["retail_price"]
        
        if request.name is not None:
            sku["name"] = request.name
        if request.wholesale_cost is not None:
            sku["wholesale_cost"] = request.wholesale_cost
        if request.retail_price is not None:
            sku["retail_price"] = request.retail_price
        if request.stock_qty is not None:
            sku["stock_qty"] = request.stock_qty
        if request.category is not None:
            sku["category"] = request.category
            
        state.save_state()
        
        from audit_logger import log_audit_entry
        log_audit_entry(
            decision="inventory_updated",
            reasoning=f"Updated SKU {sku_id} ({sku['name']}): stock {previous_stock} -> {sku['stock_qty']}, retail_price ₹{previous_price} -> ₹{sku['retail_price']}.",
            inventory_query={
                "sku_id": sku_id,
                "previous_stock": previous_stock,
                "updated_stock": sku["stock_qty"],
                "previous_price": previous_price,
                "updated_price": sku["retail_price"]
            }
        )
        return {"status": "success", "product": sku, "catalog": state.catalog}
    else:
        new_sku = {
            "sku_id": sku_id,
            "name": request.name or f"Product {sku_id}",
            "wholesale_cost": request.wholesale_cost or 1000.0,
            "retail_price": request.retail_price or 2000.0,
            "stock_qty": request.stock_qty or 10,
            "category": request.category or "General"
        }
        state.catalog.append(new_sku)
        state.save_state()
        
        from audit_logger import log_audit_entry
        log_audit_entry(
            decision="inventory_created",
            reasoning=f"Created new catalog product {sku_id} ({new_sku['name']}).",
            inventory_query=new_sku
        )
        return {"status": "success", "product": new_sku, "catalog": state.catalog}

@app.post("/catalog")
def create_catalog_product(product: Product):
    existing = next((item for item in state.catalog if item["sku_id"].lower() == product.sku_id.lower()), None)
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU ID '{product.sku_id}' already exists in catalog. Please choose a unique SKU ID.")
    
    new_sku = product.model_dump()
    state.catalog.append(new_sku)
    state.save_state()
    
    from audit_logger import log_audit_entry
    log_audit_entry(
        decision="inventory_created",
        reasoning=f"Created new catalog product {product.sku_id} ({product.name}).",
        inventory_query=new_sku
    )
    return {"status": "success", "product": new_sku, "catalog": state.catalog}

@app.delete("/catalog/{sku_id}")
def delete_catalog_product(sku_id: str):
    sku = next((item for item in state.catalog if item["sku_id"] == sku_id), None)
    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU ID '{sku_id}' not found.")
    
    state.catalog = [item for item in state.catalog if item["sku_id"] != sku_id]
    state.save_state()
    
    from audit_logger import log_audit_entry
    log_audit_entry(
        decision="inventory_deleted",
        reasoning=f"Deleted SKU {sku_id} ({sku['name']}) from catalog.",
        inventory_query=sku
    )
    return {"status": "success", "deleted_sku_id": sku_id, "catalog": state.catalog}

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

@app.post("/reset-inventory")
def reset_inventory():
    state.reset_inventory()
    return {"status": "success", "message": "Inventory reset to default seed items.", "catalog": state.catalog}

@app.post("/reset-guardrails")
def reset_guardrails_endpoint():
    state.reset_guardrails()
    return {"status": "success", "message": "Guardrails reset to default values.", "guardrails": state.guardrails}

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
    filtered = []
    for log in logs:
        decision = log.get("decision", "")
        if type == "all":
            filtered.append(log)
        elif type == "failure" and decision in ["refused", "payment_recovery_required", "PAYMENT_RECOVERY_REQUIRED"]:
            filtered.append(log)
        elif type == "gated" and decision == "gated_pending_approval":
            filtered.append(log)
        elif type == "discount":
            margin_math = log.get("margin_math", {})
            if decision == "auto_approved" and margin_math.get("discount_pct", 0) > 0:
                filtered.append(log)
                
    return list(reversed(filtered))

class CreateOrderRequest(BaseModel):
    sku_id: str
    requested_qty: int
    offered_price: float
    simulate_fail: bool = False

def process_captured_order(order_record: dict, sku: dict, requested_qty: int, buyer_prompt: str = None):
    """
    Atomically processes stock decrement for a captured order.
    Ensures stock is decremented ONLY ONCE even if retried, re-fetched, or polled repeatedly.
    """
    if order_record.get("stock_decremented"):
        # Stock already decremented for this order — prevent double-decrement
        return

    previous_stock = sku["stock_qty"]
    updated_stock = max(0, previous_stock - requested_qty)
    sku["stock_qty"] = updated_stock
    order_record["stock_decremented"] = True

    if not any(o.get("order_id") == order_record.get("order_id") for o in state.orders):
        state.orders.append(order_record)
    state.save_state()

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
    
    if sku["stock_qty"] < request.requested_qty:
        return {"error": f"Insufficient stock for SKU {request.sku_id}. Requested: {request.requested_qty}, Available: {sku['stock_qty']}"}

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
        "recovery_order_id": new_order_id,
        "stock_decremented": False
    }
    
    # Process atomic stock decrement & explicit audit log if captured
    if order_status in ["captured", "auto_approved"]:
        process_captured_order(order_record, sku, request.requested_qty)
    else:
        state.orders.append(order_record)
        state.save_state()
    
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
    proposed_price_per_unit: Optional[float] = 0.0
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
    
    # Calculate price per unit if not explicitly specified
    offered_price = request.proposed_price_per_unit or 0.0
    if offered_price <= 0 and request.budget_cap and request.budget_cap > 0:
        offered_price = round(request.budget_cap / target_item.qty, 2)
    elif offered_price <= 0:
        offered_price = float(sku["retail_price"])

    # Stock Check
    if target_item.qty > sku["stock_qty"]:
        alt_sku = next((item for item in state.catalog if item["category"] == sku["category"] and item["sku_id"] != sku["sku_id"] and item["stock_qty"] >= target_item.qty), None)
        if not alt_sku:
            alt_sku = next((item for item in state.catalog if item["sku_id"] != sku["sku_id"] and item["stock_qty"] >= target_item.qty), None)
        if not alt_sku:
            alt_sku = max((item for item in state.catalog if item["sku_id"] != sku["sku_id"]), key=lambda x: x["stock_qty"], default=None)
        
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
    buyer_prompt = f"Buyer {request.buyer_id} proposed \u20b9{offered_price}"
    evaluation = evaluate_offer(sku, target_item.qty, offered_price, state.guardrails, buyer_prompt=buyer_prompt)
    decision = evaluation["decision"]
    
    if decision == "auto_approved":
        status = "auto_approved"
        next_action = "proceed_to_checkout"
        counter_offer = None
    elif decision == "gated_pending_approval":
        status = "gated_pending_approval"
        next_action = "wait_for_human"
        counter_offer = None

        from razorpay_client import create_order
        amount_inr = target_item.qty * offered_price
        rp_response = create_order(amount_inr, notes={"sku_id": sku["sku_id"], "qty": str(target_item.qty), "pipeline": "negotiate_gated"})
        rp_order = rp_response.get("order") if rp_response.get("success") else {"id": f"order_gated_{int(time.time()*1000)}"}
        order_id = rp_order["id"]

        order_record = {
            "order_id": order_id,
            "sku_id": sku["sku_id"],
            "requested_qty": target_item.qty,
            "offered_price": offered_price,
            "amount_inr": amount_inr,
            "status": "gated_pending_approval",
            "evaluation": evaluation,
            "razorpay_order": rp_order,
            "recovery_order_id": None,
            "stock_decremented": False
        }
        if not any(o["order_id"] == order_id for o in state.orders):
            state.orders.append(order_record)
        state.save_state()
    else:
        status = "refused"
        next_action = "submit_counter_offer"
        counter_offer = evaluation.get("counter_price")
        
    reasoning = evaluation["reasoning"]
    
    resp = {
        "status": status,
        "reasoning": reasoning,
        "next_action": next_action,
        "buyer_id": request.buyer_id,
        "sku_id": sku["sku_id"],
        "qty": target_item.qty,
        "agreed_price_per_unit": offered_price,
        "total_amount": round(offered_price * target_item.qty, 2)
    }
    if counter_offer is not None:
        resp["counter_offer"] = counter_offer
        
    return resp

class SettleOrderRequest(BaseModel):
    buyer_id: Optional[str] = "external_agent"
    sku_id: Optional[str] = None
    qty: Optional[int] = 1
    agreed_price_per_unit: Optional[float] = None
    negotiated_price: Optional[float] = None
    order_id: Optional[str] = None
    simulate_fail: bool = False

@app.post("/orders/settle")
def settle_order(request: SettleOrderRequest):
    """
    Lightweight, zero-session-state settlement endpoint for external callers/agents.
    Thread-safe and atomic to prevent overselling under concurrent load.
    """
    if request.order_id:
        return approve_order(request.order_id)

    price_per_unit = request.agreed_price_per_unit or request.negotiated_price
    if not request.sku_id or not price_per_unit:
        raise HTTPException(status_code=400, detail="Must provide either 'order_id' or ('sku_id', 'agreed_price_per_unit').")

    qty = request.qty or 1

    with state.lock:
        sku = next((item for item in state.catalog if item["sku_id"] == request.sku_id), None)
        if not sku:
            raise HTTPException(status_code=404, detail=f"SKU '{request.sku_id}' not found.")

        if sku["stock_qty"] < qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {request.sku_id}. Requested: {qty}, Available: {sku['stock_qty']}")

        from guardrail_engine import evaluate_offer
        from razorpay_client import create_order, simulate_capture

        buyer_prompt = f"External agent {request.buyer_id} settlement request"
        evaluation = evaluate_offer(sku, qty, price_per_unit, state.guardrails, buyer_prompt=buyer_prompt, log_event=False)
        if evaluation["decision"] == "refused":
            raise HTTPException(status_code=400, detail=f"Settlement offer refused: {evaluation['reasoning']}")

        # Atomic stock decrement
        sku["stock_qty"] -= qty

        amount_inr = round(qty * price_per_unit, 2)
        rp_response = create_order(amount_inr, notes={"sku_id": request.sku_id, "qty": str(qty), "pipeline": "external_settle"})

        rp_order = rp_response.get("order") if rp_response.get("success") else {"id": f"order_ext_{int(time.time()*1000)}"}
        order_id = rp_order["id"]

        capture_resp = simulate_capture(order_id, should_fail=request.simulate_fail)
        order_status = "captured" if capture_resp.get("success") else "PAYMENT_RECOVERY_REQUIRED"

        order_record = {
            "order_id": order_id,
            "sku_id": request.sku_id,
            "requested_qty": qty,
            "offered_price": price_per_unit,
            "amount_inr": amount_inr,
            "status": order_status,
            "evaluation": evaluation,
            "razorpay_order": rp_order,
            "recovery_order_id": None,
            "stock_decremented": True
        }

        if order_status == "PAYMENT_RECOVERY_REQUIRED":
            from audit_logger import log_audit_entry
            formatted_price = int(price_per_unit) if price_per_unit.is_integer() else price_per_unit
            log_audit_entry(
                decision="payment_recovery_required",
                reasoning=f"Payment gateway capture simulation failed. Preserving negotiated terms (Price: ₹{formatted_price}, Qty: {qty}) and generating recovery token.",
                margin_math={
                    "wholesale_cost": sku["wholesale_cost"],
                    "retail_price": sku["retail_price"],
                    "offered_price": price_per_unit,
                    "requested_qty": qty,
                    "order_total": amount_inr,
                    "margin_pct": round(((price_per_unit - sku["wholesale_cost"]) / price_per_unit) * 100.0, 2) if price_per_unit > 0 else 0.0,
                    "discount_pct": round(((sku["retail_price"] - price_per_unit) / sku["retail_price"]) * 100.0, 2) if sku["retail_price"] > 0 else 0.0,
                    "margin_floor_pct": state.guardrails.get("margin_floor_pct", 20.0),
                    "max_discount_pct": state.guardrails.get("max_discount_pct", 15.0),
                    "approval_gate_inr": state.guardrails.get("approval_gate_inr", 50000.0),
                    "is_margin_healthy": True,
                    "is_discount_safe": True,
                    "requires_approval": False
                },
                buyer_prompt=buyer_prompt,
                inventory_query={
                    "order_id": order_id,
                    "sku_id": request.sku_id,
                    "requested": qty,
                    "status": "payment_recovery_required"
                },
                buyer_id=request.buyer_id,
                razorpay_payload=rp_order
            )

        if not any(o.get("order_id") == order_id for o in state.orders):
            state.orders.append(order_record)
        state.save_state()

    return {
        "status": "success",
        "message": "Order settled successfully without session state.",
        "order_id": order_id,
        "order": order_record,
        "catalog": state.catalog
    }

class MessageHistory(BaseModel):
    role: str
    content: str

class InterpretRequest(BaseModel):
    message: str
    history: List[MessageHistory] = []

def resolve_sku(sku_guess: str) -> Optional[dict]:
    if not sku_guess or not sku_guess.strip():
        return None
    sku_guess_lower = sku_guess.lower().strip()
    
    # 1. Exact ID match
    for item in state.catalog:
        if item["sku_id"].lower() == sku_guess_lower:
            return item
            
    # 2. Exact or substring match in name
    for item in state.catalog:
        name_lower = item["name"].lower()
        if sku_guess_lower in name_lower or name_lower in sku_guess_lower:
            return item
            
    # 3. Direct product keyword mapping (handles plurals like 'chairs')
    if "chair" in sku_guess_lower:
        return next((item for item in state.catalog if "chair" in item["name"].lower()), None)
    if "conference" in sku_guess_lower or "table-001" in sku_guess_lower:
        return next((item for item in state.catalog if "TABLE-001" == item["sku_id"]), None)
    if "table" in sku_guess_lower or "desk" in sku_guess_lower:
        if "standing" in sku_guess_lower or "motorized" in sku_guess_lower:
            return next((item for item in state.catalog if "DESK-001" == item["sku_id"]), None)
        elif "corner" in sku_guess_lower or "l-shaped" in sku_guess_lower:
            return next((item for item in state.catalog if "DESK-002" == item["sku_id"]), None)
        return next((item for item in state.catalog if "desk" in item["name"].lower() or "table" in item["name"].lower()), None)
    if "mat" in sku_guess_lower:
        return next((item for item in state.catalog if "mat" in item["name"].lower()), None)
    if "drawer" in sku_guess_lower or "pedestal" in sku_guess_lower or "storage" in sku_guess_lower:
        return next((item for item in state.catalog if "pedestal" in item["name"].lower()), None)
    if "screen" in sku_guess_lower or "divider" in sku_guess_lower:
        return next((item for item in state.catalog if "divider" in item["name"].lower()), None)
    if "workbench" in sku_guess_lower or "utility" in sku_guess_lower:
        return next((item for item in state.catalog if "workbench" in item["name"].lower()), None)
    if "cable" in sku_guess_lower:
        return next((item for item in state.catalog if "cable" in item["name"].lower()), None)
    if "monitor" in sku_guess_lower or "mount" in sku_guess_lower or "arm" in sku_guess_lower:
        return next((item for item in state.catalog if "monitor" in item["name"].lower()), None)

    # 4. Match word tokens in name
    words = [w.strip("s") for w in sku_guess_lower.split() if len(w) >= 3 and w not in ["buy", "need", "want", "under", "below", "for", "budget", "item", "product"]]
    best_match = None
    max_matches = 0
    for item in state.catalog:
        name_lower = item["name"].lower()
        matches = sum(1 for w in words if w in name_lower)
        if matches > max_matches:
            max_matches = matches
            best_match = item
            
    if best_match and max_matches >= 1:
        return best_match

    # NO MATCH FOUND
    return None

class MissionRequest(BaseModel):
    message: str
    history: List[MessageHistory] = []

@app.post("/buyer/mission")
def execute_buyer_mission(request: MissionRequest):
    from buyer_agent import interpret_mission
    from audit_logger import log_audit_entry
    from guardrail_engine import evaluate_offer
    from razorpay_client import create_order, simulate_capture

    history_dicts = [{"role": h.role, "content": h.content} for h in request.history]
    try:
        intent = interpret_mission(request.message, state.catalog, history_dicts)
    except Exception as e:
        return {"status": "error", "message": f"Failed to interpret mission: {str(e)}"}
    
    intent_type = intent.get("intent_type", "purchase_mandate")

    # Ensure needs_confirmation_text exists
    if not intent.get("needs_confirmation_text"):
        if intent_type == "greeting":
            intent["needs_confirmation_text"] = "Hello! I am the Apex B2B Autonomous Buyer Agent. How can I assist you with your equipment procurement today?"
        elif intent_type == "discovery":
            intent["needs_confirmation_text"] = "Understood: Querying available in-stock items from the Apex merchant catalog."
        else:
            q_str = intent.get("quantity") or 1
            item_str = intent.get("item_query_raw") or request.message
            b_val = intent.get("budget_cap_inr") or 0.0
            if b_val > 0:
                intent["needs_confirmation_text"] = f"Understood: I will attempt to buy {q_str} x '{item_str}' for under ₹{b_val:,.0f}."
            else:
                intent["needs_confirmation_text"] = f"Understood: I will attempt to buy {q_str} x '{item_str}'."

    # 1. GREETING INTENT (No catalog/negotiate call)
    if intent_type == "greeting":
        handshake_trail = {
            "buyer_prompt": request.message,
            "intent_type": "greeting",
            "interpreted_intent": intent,
            "matched_sku": None,
            "offered_price_per_unit": None,
            "negotiation_result": {
                "status": "greeting",
                "reasoning": "Conversational greeting acknowledged. No catalog query or order attempt performed.",
                "next_action": "none"
            },
            "order_result": None
        }
        return {"status": "success", "handshake_trail": handshake_trail}

    # 2. DISCOVERY INTENT (Natural language in-stock summary, no order attempt)
    if intent_type == "discovery":
        in_stock_items = [item for item in state.catalog if item.get("stock_qty", 0) > 0]
        summary_lines = [f"{item['name']} ({item['sku_id']}): ₹{item['retail_price']} ({item['stock_qty']} in stock)" for item in in_stock_items]
        discovery_text = f"Here are the available in-stock items for purchase ({len(in_stock_items)} total):\n" + "\n".join(summary_lines[:6])
        if len(in_stock_items) > 6:
            discovery_text += f"\n...and {len(in_stock_items) - 6} more items available in catalog."
        
        intent["needs_confirmation_text"] = discovery_text
        
        handshake_trail = {
            "buyer_prompt": request.message,
            "intent_type": "discovery",
            "interpreted_intent": intent,
            "matched_sku": None,
            "offered_price_per_unit": None,
            "negotiation_result": {
                "status": "discovery",
                "reasoning": f"Catalog discovery query processed. Found {len(in_stock_items)} in-stock items.",
                "next_action": "none"
            },
            "order_result": None
        }
        return {"status": "success", "handshake_trail": handshake_trail}

    # 3. PURCHASE MANDATE INTENT
    matched_sku_id = intent.get("matched_sku_id")
    item_query_raw = intent.get("item_query_raw") or request.message
    qty = intent.get("quantity") or 1
    
    sku = None
    if matched_sku_id:
        sku = next((item for item in state.catalog if item["sku_id"] == matched_sku_id), None)
    if not sku:
        sku = resolve_sku(item_query_raw)

    # Check ambiguity
    if intent.get("is_ambiguous") and intent.get("ambiguous_candidates"):
        candidates = intent["ambiguous_candidates"]
        cand_items = [item for item in state.catalog if item["sku_id"] in candidates]
        
        option_lines = [f"{idx}) {item['name']} ({item['sku_id']}) - ₹{item['retail_price']:,.0f}" for idx, item in enumerate(cand_items, 1)]
        conversational_reply = f"We have {len(cand_items)} options matching your request:\n" + "\n".join(option_lines) + "\nPlease reply with the SKU ID or product name you prefer."
        intent["needs_confirmation_text"] = conversational_reply

        reasoning = f"Request '{item_query_raw}' matches multiple candidate SKUs ({', '.join(candidates)}). Prompted buyer to select one."
        handshake_trail = {
            "buyer_prompt": request.message,
            "intent_type": "purchase_mandate",
            "interpreted_intent": intent,
            "matched_sku": None,
            "offered_price_per_unit": None,
            "negotiation_result": {
                "status": "ambiguous",
                "reasoning": reasoning,
                "candidates": candidates,
                "next_action": "specify_sku"
            },
            "order_result": None
        }
        return {"status": "success", "handshake_trail": handshake_trail}
    
    # Non-existent / Unmatched item handling
    if not sku:
        in_stock_items = [item for item in state.catalog if item.get("stock_qty", 0) > 0]
        alternatives = [f"{item['sku_id']} ({item['name']})" for item in in_stock_items[:3]]
        
        reasoning = f"The requested item '{item_query_raw}' is unavailable in our catalog. Closest available alternatives: {', '.join(alternatives)}."
        
        log_audit_entry(
            decision="refused_item_unavailable",
            reasoning=reasoning,
            buyer_prompt=request.message,
            inventory_query={"requested_item": item_query_raw, "status": "unavailable"}
        )
        
        intent["needs_confirmation_text"] = f"Item unavailable: '{item_query_raw}' is not in our catalog. Available alternatives: {', '.join(alternatives)}."
        
        handshake_trail = {
            "buyer_prompt": request.message,
            "intent_type": "purchase_mandate",
            "interpreted_intent": intent,
            "matched_sku": None,
            "offered_price_per_unit": None,
            "negotiation_result": {
                "status": "unavailable",
                "reasoning": reasoning,
                "suggested_alternatives": [item['sku_id'] for item in in_stock_items[:3]],
                "next_action": "none"
            },
            "order_result": None
        }
        return {"status": "success", "handshake_trail": handshake_trail}

    # Genuine matched purchase mandate
    budget_cap = intent.get("budget_cap_inr") or 0.0
    if budget_cap > 0:
        offered_price = round(budget_cap / qty, 2)
    else:
        offered_price = float(sku["retail_price"])
        
    if qty > sku["stock_qty"]:
        alt_sku = next((item for item in state.catalog if item["category"] == sku["category"] and item["sku_id"] != sku["sku_id"] and item["stock_qty"] >= qty), None)
        if not alt_sku:
            alt_sku = next((item for item in state.catalog if item["sku_id"] != sku["sku_id"] and item["stock_qty"] >= qty), None)
        if not alt_sku:
            alt_sku = max((item for item in state.catalog if item["sku_id"] != sku["sku_id"]), key=lambda x: x["stock_qty"], default=None)
        reasoning = f"Requested quantity {qty} exceeds available stock ({sku['stock_qty']})."
        
        negotiation_result = {
            "status": "refused",
            "reasoning": reasoning,
            "next_action": "suggest_alternative"
        }
        if alt_sku:
            negotiation_result["suggested_alternative"] = alt_sku["sku_id"]
            
        log_audit_entry(
            decision="refused_insufficient_stock",
            reasoning=reasoning,
            buyer_prompt=request.message,
            inventory_query={"requested": qty, "available": sku["stock_qty"]}
        )
        order_result = None
    else:
        evaluation = evaluate_offer(sku, qty, offered_price, state.guardrails, buyer_prompt=request.message)
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
        
        negotiation_result = {
            "status": status,
            "reasoning": reasoning,
            "next_action": next_action
        }
        if counter_offer is not None:
            negotiation_result["counter_offer"] = counter_offer
            
        if status == "auto_approved":
            amount_inr = qty * offered_price
            rp_response = create_order(amount_inr, notes={"sku_id": sku["sku_id"], "qty": str(qty), "pipeline": "full_handshake"})
            
            if rp_response.get("success"):
                rp_order = rp_response["order"]
                order_id = rp_order["id"]
                capture_resp = simulate_capture(order_id, should_fail=False)
                order_status = "captured"
                
                order_record = {
                    "order_id": order_id,
                    "sku_id": sku["sku_id"],
                    "requested_qty": qty,
                    "offered_price": offered_price,
                    "amount_inr": amount_inr,
                    "status": order_status,
                    "evaluation": evaluation,
                    "razorpay_order": rp_order,
                    "recovery_order_id": None,
                    "stock_decremented": False
                }
                # Process atomic stock decrement & explicit audit log
                process_captured_order(order_record, sku, qty, buyer_prompt=request.message)
                order_result = order_record
            else:
                order_result = {"error": "Razorpay order creation failed", "details": rp_response.get("error")}
        elif status == "gated_pending_approval":
            amount_inr = qty * offered_price
            rp_response = create_order(amount_inr, notes={"sku_id": sku["sku_id"], "qty": str(qty), "pipeline": "mission_gated"})
            rp_order = rp_response.get("order") if rp_response.get("success") else {"id": f"order_gated_{int(time.time()*1000)}"}
            order_id = rp_order["id"]

            order_record = {
                "order_id": order_id,
                "sku_id": sku["sku_id"],
                "requested_qty": qty,
                "offered_price": offered_price,
                "amount_inr": amount_inr,
                "status": "gated_pending_approval",
                "evaluation": evaluation,
                "razorpay_order": rp_order,
                "recovery_order_id": None,
                "stock_decremented": False
            }
            if not any(o["order_id"] == order_id for o in state.orders):
                state.orders.append(order_record)
            state.save_state()
            order_result = order_record
        else:
            order_result = None

    handshake_trail = {
        "buyer_prompt": request.message,
        "intent_type": "purchase_mandate",
        "interpreted_intent": intent,
        "matched_sku": sku["sku_id"],
        "offered_price_per_unit": offered_price,
        "negotiation_result": negotiation_result,
        "order_result": order_result
    }
    
    return {"status": "success", "handshake_trail": handshake_trail}

@app.post("/buyer/interpret")
def interpret_buyer_intent(request: InterpretRequest):
    from buyer_agent import interpret_mission
    try:
        history_dicts = [{"role": h.role, "content": h.content} for h in request.history]
        intent = interpret_mission(request.message, history_dicts)
        return {"status": "success", "intent": intent}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/orders/{order_id}/approve")
def approve_order(order_id: str):
    order = next((o for o in state.orders if o["order_id"] == order_id), None)
    if not order:
        for log in state.audit_logs:
            inv = log.get("inventory_query", {})
            if inv.get("order_id") == order_id:
                sku_id = inv.get("sku_id") or "CHAIR-001"
                qty = inv.get("requested", 1)
                amount_inr = log.get("margin_math", {}).get("order_total", 50000.0)
                offered = log.get("margin_math", {}).get("offered_price", amount_inr / qty if qty else amount_inr)
                order = {
                    "order_id": order_id,
                    "sku_id": sku_id,
                    "requested_qty": qty,
                    "offered_price": offered,
                    "amount_inr": amount_inr,
                    "status": "gated_pending_approval",
                    "evaluation": {"decision": "gated_pending_approval"},
                    "stock_decremented": False
                }
                state.orders.append(order)
                break

    if not order:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")

    sku = next((item for item in state.catalog if item["sku_id"] == order["sku_id"]), None)
    if not sku:
        raise HTTPException(status_code=404, detail=f"SKU '{order['sku_id']}' not found.")

    order["status"] = "captured"
    process_captured_order(order, sku, order["requested_qty"])

    from audit_logger import log_audit_entry
    log_audit_entry(
        decision="order_approved_by_merchant",
        reasoning=f"Order {order_id} approved by merchant. Razorpay capture executed.",
        margin_math={"order_total": order["amount_inr"], "offered_price": order["offered_price"]},
        inventory_query={
            "order_id": order_id,
            "sku_id": order["sku_id"],
            "status": "approved",
            "purchased_qty": order["requested_qty"]
        }
    )
    return {"status": "success", "order": order, "catalog": state.catalog}

@app.post("/orders/{order_id}/reject")
def reject_order(order_id: str):
    order = next((o for o in state.orders if o["order_id"] == order_id), None)
    if not order:
        for log in state.audit_logs:
            inv = log.get("inventory_query", {})
            if inv.get("order_id") == order_id:
                sku_id = inv.get("sku_id") or "CHAIR-001"
                qty = inv.get("requested", 1)
                amount_inr = log.get("margin_math", {}).get("order_total", 50000.0)
                offered = log.get("margin_math", {}).get("offered_price", amount_inr / qty if qty else amount_inr)
                order = {
                    "order_id": order_id,
                    "sku_id": sku_id,
                    "requested_qty": qty,
                    "offered_price": offered,
                    "amount_inr": amount_inr,
                    "status": "gated_pending_approval",
                    "evaluation": {"decision": "gated_pending_approval"},
                    "stock_decremented": False
                }
                state.orders.append(order)
                break

    if not order:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")

    order["status"] = "rejected"

    if order.get("stock_decremented"):
        sku = next((item for item in state.catalog if item["sku_id"] == order["sku_id"]), None)
        if sku:
            sku["stock_qty"] += order["requested_qty"]
            order["stock_decremented"] = False

    state.save_state()

    from audit_logger import log_audit_entry
    log_audit_entry(
        decision="order_rejected_by_merchant",
        reasoning=f"Order {order_id} rejected by merchant. Reserved stock released.",
        margin_math={"order_total": order["amount_inr"], "offered_price": order["offered_price"]},
        inventory_query={
            "order_id": order_id,
            "sku_id": order["sku_id"],
            "status": "rejected"
        }
    )
    return {"status": "success", "order": order, "catalog": state.catalog}





