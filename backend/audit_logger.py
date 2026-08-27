from datetime import datetime, timezone
from state import state

def log_audit_entry(
    decision: str,
    reasoning: str,
    margin_math: dict = None,
    buyer_prompt: str = None,
    inventory_query: dict = None,
    buyer_id: str = None,
    razorpay_payload: dict = None
):
    b_id = buyer_id
    if not b_id and buyer_prompt:
        if "Buyer " in buyer_prompt:
            b_id = buyer_prompt.split("Buyer ")[1].split()[0]
        elif "External buyer " in buyer_prompt:
            b_id = buyer_prompt.split("External buyer ")[1].split()[0]
        elif "External agent " in buyer_prompt:
            b_id = buyer_prompt.split("External agent ")[1].split()[0]
    if not b_id:
        b_id = "external_agent"

    event_type = "negotiation"
    if "approved" in decision.lower() and "merchant" in decision.lower():
        event_type = "order_approval"
    elif "rejected" in decision.lower() and "merchant" in decision.lower():
        event_type = "order_rejection"
    elif "inventory" in decision.lower() or "guardrail" in decision.lower():
        event_type = "system_action"
    elif "captured" in decision.lower() or "settled" in decision.lower():
        event_type = "order_settlement"

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "buyer_id": b_id,
        "decision": decision,
        "reasoning": reasoning,
        "margin_math": margin_math or {},
        "buyer_prompt": buyer_prompt,
        "inventory_query": inventory_query,
        "razorpay_payload": razorpay_payload
    }
    state.audit_logs.append(entry)
    state.save_state()
