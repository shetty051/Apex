import os
import json
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from dotenv import load_dotenv

load_dotenv()

class IntentItem(BaseModel):
    sku_guess: str = Field(description="The guessed product category or name based on the user's intent.")
    qty: int = Field(description="The requested quantity.")

class BuyerIntent(BaseModel):
    items: List[IntentItem]
    budget_cap_inr: float = Field(description="The maximum budget in INR parsed from the user message.")
    needs_confirmation_text: str = Field(description="A natural language one-liner starting with 'Understood: ' confirming the quantity and budget.")

SYSTEM_PROMPT = """You are the ApexA2A Buyer Agent. Your job is to parse a free-text mission from a human buyer into a structured intent.
The buyer might use shorthands, typos, or slang (e.g. 'chaisr' -> chairs, '2k' -> 2000).
Translate shorthand currency properly (e.g. 2k -> 2000, 50k -> 50000).
If the buyer doesn't specify a budget or quantity, infer it from the history if provided, otherwise default to 1 for qty.

Generate a `needs_confirmation_text` that is a one-liner starting with "Understood: " (e.g. "Understood: I will attempt to buy 2 chairs for under ₹2,000.").
The user may provide conversation history. If they say "instead of those chairs, buy tables for the same price and quantity", you must inherit the quantity and budget from the history.
"""

def interpret_mission(message: str, history: List[dict] = None) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.startswith("your_"):
        raise ValueError("GEMINI_API_KEY not configured in .env")
    
    client = genai.Client(api_key=api_key)
    
    history_context = ""
    if history:
        history_context = "Conversation History:\n"
        for h in history:
            role = h.get("role", "user")
            content = h.get("content", "")
            history_context += f"{role}: {content}\n"
    
    full_prompt = f"{history_context}\nCurrent User Message: {message}"
    
    response = client.models.generate_content(
        model='gemini-3.6-flash',
        contents=full_prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=BuyerIntent,
        ),
    )
    
    return json.loads(response.text)
