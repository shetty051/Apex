import os
import json
import re
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from dotenv import load_dotenv
from google import genai

load_dotenv()

def normalize_currency(text: str) -> float:
    """
    Normalizes free-text currency expressions into float INR values.
    Explicit unit rules:
      - 'k' / 'K' -> x1,000 (e.g., '2k' -> 2000.0, '38k' -> 38000.0)
      - 'l' / 'L' / 'lakh' / 'lakhs' -> x100,000 (e.g., '1.5L' -> 150000.0, '1.5 lakh' -> 150000.0)
      - plain numbers / commas / '₹' / 'rs' -> float value as-is (e.g., '₹50,000' -> 50000.0)
    """
    if not text:
        return 0.0
    
    clean = str(text).strip().replace("₹", "").replace(",", "").strip()
    
    match = re.search(r'^(\d+(?:\.\d+)?)\s*(k|K|l|L|lakh|lakhs)?$', clean, re.IGNORECASE)
    if not match:
        match = re.search(r'(\d+(?:\.\d+)?)\s*(k|K|l|L|lakh|lakhs)?', clean, re.IGNORECASE)
    if not match:
        return 0.0
        
    num_val = float(match.group(1))
    unit = (match.group(2) or "").lower()
    
    if unit == "k":
        return num_val * 1000.0
    elif unit in ["l", "lakh", "lakhs"]:
        return num_val * 100000.0
    else:
        return num_val

def extract_budget_and_qty_fallback(message: str) -> tuple[float, int]:
    budget_cap = 0.0
    suffix_match = re.search(r'\b(\d+(?:\.\d+)?\s*(?:k|K|l|L|lakh|lakhs))\b', message, re.IGNORECASE)
    if suffix_match:
        budget_cap = normalize_currency(suffix_match.group(1))
    else:
        prefix_match = re.search(r'(?:under|below|budget of|for|price|cost)?\s*(?:₹|rs\.?|inr)\s*(\d[\d,.]*)', message, re.IGNORECASE)
        if not prefix_match:
            prefix_match = re.search(r'(?:under|below|budget of)\s*(\d[\d,.]*)', message, re.IGNORECASE)
        if prefix_match:
            budget_cap = normalize_currency(prefix_match.group(1))

    msg_no_budget = message
    if suffix_match:
        msg_no_budget = message.replace(suffix_match.group(0), "")
    elif 'prefix_match' in locals() and prefix_match:
        msg_no_budget = message.replace(prefix_match.group(0), "")
        
    qty_match = re.search(r'\b(\d+)\s*(?:items|units|pcs|pieces|chairs|desks|tables|monitors|mat|pedestal|divider|workbench|laser printer|printer)?\b', msg_no_budget, re.IGNORECASE)
    qty = 1
    if qty_match:
        val = int(qty_match.group(1))
        if val > 0 and val < 1000:
            qty = val

    return budget_cap, qty

def resolve_ambiguity_with_history(message: str, catalog: List[dict], history: List[dict] = None) -> Optional[dict]:
    if not catalog:
        return None

    msg_clean = message.strip().lower()
    
    # 1. Direct SKU ID in message
    for item in catalog:
        if item["sku_id"].lower() == msg_clean or item["sku_id"].lower() in msg_clean:
            return {
                "matched_sku_id": item["sku_id"],
                "is_ambiguous": False,
                "ambiguous_candidates": None
            }

    # 2. Inspect history for candidate SKUs listed in recent assistant messages
    recent_candidates = []
    if history:
        for h in reversed(history):
            content = h.get("content", "")
            found_ids = [item["sku_id"] for item in catalog if item["sku_id"] in content]
            if len(found_ids) >= 2:
                recent_candidates = found_ids
                break

    if recent_candidates:
        cand_items = [item for item in catalog if item["sku_id"] in recent_candidates]
        
        # Ordinal choices
        ordinal_map = {
            "1": 0, "first": 0, "option 1": 0, "1st": 0,
            "2": 1, "second": 1, "option 2": 1, "2nd": 1,
            "3": 2, "third": 2, "option 3": 2, "3rd": 2
        }
        for k, idx in ordinal_map.items():
            if msg_clean == k or msg_clean.startswith(k + " ") or ("option " + k) in msg_clean:
                if idx < len(cand_items):
                    return {
                        "matched_sku_id": cand_items[idx]["sku_id"],
                        "is_ambiguous": False,
                        "ambiguous_candidates": None
                    }
                    
        # Match by name keywords
        for item in cand_items:
            name_words = [w.lower() for w in item["name"].split() if len(w) >= 3 and w.lower() not in ["chair", "desk", "table", "back", "pro", "office", "task"]]
            for w in name_words:
                if w in msg_clean:
                    return {
                        "matched_sku_id": item["sku_id"],
                        "is_ambiguous": False,
                        "ambiguous_candidates": None
                    }

    return None

def check_category_ambiguity(message: str, catalog: List[dict]) -> Optional[dict]:
    if not catalog:
        return None

    msg_lower = message.strip().lower()

    # Exact SKU ID present -> NOT ambiguous
    for item in catalog:
        if item["sku_id"].lower() in msg_lower:
            return {
                "matched_sku_id": item["sku_id"],
                "is_ambiguous": False,
                "ambiguous_candidates": None
            }

    # Chair request
    if "chair" in msg_lower or "seating" in msg_lower:
        chair_skus = [item for item in catalog if "chair" in item["name"].lower() or item["category"].lower() == "seating"]
        if len(chair_skus) > 1:
            if "pro" in msg_lower or "ergonomic" in msg_lower:
                return {"matched_sku_id": "CHAIR-001", "is_ambiguous": False, "ambiguous_candidates": None}
            elif "mesh" in msg_lower or "task" in msg_lower:
                return {"matched_sku_id": "CHAIR-002", "is_ambiguous": False, "ambiguous_candidates": None}
            elif "executive" in msg_lower or "leather" in msg_lower or "high-back" in msg_lower:
                return {"matched_sku_id": "CHAIR-003", "is_ambiguous": False, "ambiguous_candidates": None}
            else:
                return {
                    "matched_sku_id": None,
                    "is_ambiguous": True,
                    "ambiguous_candidates": [item["sku_id"] for item in chair_skus]
                }
        elif len(chair_skus) == 1:
            return {"matched_sku_id": chair_skus[0]["sku_id"], "is_ambiguous": False, "ambiguous_candidates": None}

    # Desk / Table request
    if "desk" in msg_lower or "table" in msg_lower:
        if "conference" in msg_lower or "8-seater" in msg_lower or "TABLE-001" in message:
            return {"matched_sku_id": "TABLE-001", "is_ambiguous": False, "ambiguous_candidates": None}

        desk_skus = [item for item in catalog if "desk" in item["name"].lower() or item["category"].lower() == "desks"]
        if len(desk_skus) > 1:
            if "standing" in msg_lower or "motorized" in msg_lower:
                return {"matched_sku_id": "DESK-001", "is_ambiguous": False, "ambiguous_candidates": None}
            elif "corner" in msg_lower or "l-shaped" in msg_lower:
                return {"matched_sku_id": "DESK-002", "is_ambiguous": False, "ambiguous_candidates": None}
            else:
                return {
                    "matched_sku_id": None,
                    "is_ambiguous": True,
                    "ambiguous_candidates": [item["sku_id"] for item in desk_skus]
                }
        elif len(desk_skus) == 1:
            return {"matched_sku_id": desk_skus[0]["sku_id"], "is_ambiguous": False, "ambiguous_candidates": None}

    return None

class BuyerIntent(BaseModel):
    intent_type: Literal["greeting", "discovery", "purchase_mandate"] = Field(
        description="Classify incoming message: 'greeting' for hellos/hi, 'discovery' for catalog availability queries, 'purchase_mandate' for buying/ordering requests."
    )
    matched_sku_id: Optional[str] = Field(
        default=None,
        description="Exact SKU ID from the provided catalog (e.g. 'CHAIR-001'), or null if no matching SKU exists in catalog or for greeting/discovery."
    )
    item_query_raw: Optional[str] = Field(
        default=None,
        description="The raw item phrase used by the buyer, kept separate from any parsed quantity or price (e.g. 'laser printer', 'chairs')."
    )
    quantity: Optional[int] = Field(
        default=None,
        description="Pure positive integer quantity requested (e.g. 2 for '2 chairs'). Never derived from price digits."
    )
    budget_cap_inr: Optional[float] = Field(
        default=None,
        description="Normalized INR budget value (e.g. 16000.0 for '16k', 150000.0 for '1.5L', 50000.0 for '₹50,000')."
    )
    is_ambiguous: bool = Field(
        default=False,
        description="True if the request matches multiple catalog SKUs ambiguously."
    )
    ambiguous_candidates: Optional[List[str]] = Field(
        default=None,
        description="List of candidate SKU IDs if is_ambiguous is True."
    )

SYSTEM_PROMPT = """You are the ApexA2A Buyer Agent. Your job is to classify free-text buyer messages and extract purchase mandates into structured JSON based strictly on the provided catalog context.

CATALOG GROUNDING RULES:
1. `matched_sku_id`: Match requested item to an exact SKU ID from the Catalog Grounding List. If query matches a generic product category with multiple choices (e.g. 'chair' when CHAIR-001, CHAIR-002, CHAIR-003 exist), set `is_ambiguous: true` and list SKU IDs in `ambiguous_candidates`. If no matching product exists (e.g. 'laser printer'), set `matched_sku_id` to null.
2. `item_query_raw`: Extract the raw product phrase (e.g., 'laser printer', 'chairs', 'standing desk').
3. `quantity`: Extract pure positive integer requested quantity (default 1).
4. `budget_cap_inr`: Parse INR budget (e.g., 16k -> 16000.0, 1.5L -> 150000.0).

INTENT TYPES:
- `greeting`: Small talk or greetings.
- `discovery`: Questions about available products/catalog.
- `purchase_mandate`: Requests to buy or price items.
"""

def _rule_based_classify(message: str, catalog: List[dict] = None) -> Optional[dict]:
    msg_clean = message.strip().lower()
    greetings = ["hey", "hello", "hi", "hey there", "hello there", "good morning", "good afternoon", "greetings"]
    if msg_clean in greetings or msg_clean.startswith("hey ") or msg_clean.startswith("hello "):
        return {
            "intent_type": "greeting",
            "matched_sku_id": None,
            "item_query_raw": None,
            "quantity": None,
            "budget_cap_inr": None,
            "is_ambiguous": False,
            "ambiguous_candidates": None
        }
    
    discovery_keywords = ["available items", "items for purchase", "what do you sell", "show catalog", "list products", "what items", "what products"]
    if any(k in msg_clean for k in discovery_keywords):
        return {
            "intent_type": "discovery",
            "matched_sku_id": None,
            "item_query_raw": None,
            "quantity": None,
            "budget_cap_inr": None,
            "is_ambiguous": False,
            "ambiguous_candidates": None
        }
    
    return None

def interpret_mission(message: str, catalog: List[dict] = None, history: List[dict] = None) -> dict:
    rule_result = _rule_based_classify(message, catalog)
    if rule_result and rule_result["intent_type"] in ["greeting", "discovery"]:
        return rule_result

    fallback_budget, fallback_qty = extract_budget_and_qty_fallback(message)

    # 1. Check history follow-up ambiguity resolution
    history_res = resolve_ambiguity_with_history(message, catalog, history)
    if history_res:
        words = [w for w in message.lower().split() if w not in ['buy', 'me', 'a', 'an', 'the', 'under', 'below', 'for', 'budget', 'of', 'please', 'can', 'you', 'i', 'want', 'to', 'need']]
        item_query_raw = " ".join(words) if words else message
        return {
            "intent_type": "purchase_mandate",
            "matched_sku_id": history_res["matched_sku_id"],
            "item_query_raw": item_query_raw,
            "quantity": fallback_qty,
            "budget_cap_inr": fallback_budget,
            "is_ambiguous": False,
            "ambiguous_candidates": None
        }

    # 2. Check category ambiguity for generic requests (e.g. "buy a chair", "buy a desk")
    ambig_res = check_category_ambiguity(message, catalog)
    if ambig_res:
        words = [w for w in message.lower().split() if w not in ['buy', 'me', 'a', 'an', 'the', 'under', 'below', 'for', 'budget', 'of', 'please', 'can', 'you', 'i', 'want', 'to', 'need']]
        item_query_raw = " ".join(words) if words else message
        return {
            "intent_type": "purchase_mandate",
            "matched_sku_id": ambig_res["matched_sku_id"],
            "item_query_raw": item_query_raw,
            "quantity": fallback_qty,
            "budget_cap_inr": fallback_budget,
            "is_ambiguous": ambig_res["is_ambiguous"],
            "ambiguous_candidates": ambig_res["ambiguous_candidates"]
        }

    # 3. LLM classification if configured
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and not api_key.startswith("your_"):
        client = genai.Client(api_key=api_key)
        
        catalog_context = "Catalog Grounding List:\n"
        if catalog:
            for item in catalog:
                catalog_context += f"- ID: {item['sku_id']} | Name: {item['name']}\n"
        else:
            catalog_context += "No catalog loaded.\n"

        history_context = ""
        if history:
            history_context = "Conversation History:\n"
            for h in history:
                role = h.get("role", "user")
                content = h.get("content", "")
                history_context += f"{role}: {content}\n"
        
        full_prompt = f"{catalog_context}\n{history_context}\nCurrent User Message: {message}"
        models_to_try = ['gemini-2.5-flash', 'gemini-1.5-flash']
        
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=full_prompt,
                    config=genai.types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        response_schema=BuyerIntent,
                    ),
                )
                res_dict = json.loads(response.text)
                
                if res_dict.get("matched_sku_id") and catalog:
                    valid_ids = [item["sku_id"] for item in catalog]
                    if res_dict["matched_sku_id"] not in valid_ids:
                        res_dict["matched_sku_id"] = None

                if fallback_budget > 0:
                    res_dict["budget_cap_inr"] = fallback_budget
                elif res_dict.get("budget_cap_inr"):
                    res_dict["budget_cap_inr"] = float(res_dict["budget_cap_inr"])

                if fallback_qty > 1 or not res_dict.get("quantity"):
                    res_dict["quantity"] = fallback_qty

                return res_dict
            except Exception:
                continue

    # 4. Fallback for unmatched items (e.g. laser printer)
    msg_clean = message.lower()
    words = [w for w in msg_clean.split() if w not in ['buy', 'me', 'a', 'an', 'the', 'under', 'below', 'for', 'budget', 'of', 'please', 'can', 'you', 'i', 'want', 'to', 'need']]
    item_query_raw = " ".join(words) if words else message

    return {
        "intent_type": "purchase_mandate",
        "matched_sku_id": None,
        "item_query_raw": item_query_raw,
        "quantity": fallback_qty,
        "budget_cap_inr": fallback_budget,
        "is_ambiguous": False,
        "ambiguous_candidates": None
    }
