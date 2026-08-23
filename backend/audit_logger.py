from datetime import datetime
from state import state

def log_audit_entry(
    decision: str,
    reasoning: str,
    margin_math: dict = None,
    buyer_prompt: str = None,
    inventory_query: dict = None,
    razorpay_payload: dict = None
):
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "decision": decision,
        "reasoning": reasoning,
        "margin_math": margin_math or {},
        "buyer_prompt": buyer_prompt,
        "inventory_query": inventory_query,
        "razorpay_payload": razorpay_payload
    }
    state.audit_logs.append(entry)
    state.save_state()
