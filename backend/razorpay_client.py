import os
import razorpay
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and not RAZORPAY_KEY_ID.startswith("your_"):
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

def create_order(amount_inr: float, notes: dict = None) -> dict:
    if not client:
        return {"error": "Razorpay client not configured with valid keys."}
    
    data = {
        "amount": int(amount_inr * 100), # amount in paise
        "currency": "INR",
        "notes": notes or {}
    }
    try:
        order = client.order.create(data=data)
        return {"success": True, "order": order}
    except Exception as e:
        return {"success": False, "error": str(e)}

def simulate_capture(order_id: str, should_fail: bool = False) -> dict:
    if should_fail:
        return {"success": False, "status": "failed", "reason": "Simulated payment decline"}
    
    return {"success": True, "status": "captured"}
