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

