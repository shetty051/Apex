import json
import os
from pydantic import BaseModel

STATE_FILE = "state.json"

class Product(BaseModel):
    sku_id: str
    name: str
    wholesale_cost: float
    retail_price: float
    stock_qty: int
    category: str

class Guardrails(BaseModel):
    margin_floor_pct: float
    max_discount_pct: float
    approval_gate_inr: float

SEED_CATALOG = [
    {
        "sku_id": "CHAIR-001",
        "name": "Ergonomic Office Chair Pro",
        "wholesale_cost": 4000.0,
        "retail_price": 8500.0,
        "stock_qty": 50,
        "category": "Seating"
    },
    {
        "sku_id": "DESK-001",
        "name": "Motorized Standing Desk",
        "wholesale_cost": 15000.0,
        "retail_price": 28000.0,
        "stock_qty": 20,
        "category": "Desks"
    },
    {
        "sku_id": "TABLE-001",
        "name": "Modular 8-Seater Conference Table",
        "wholesale_cost": 24000.0,
        "retail_price": 42000.0,
        "stock_qty": 6,
        "category": "Meeting Room"
    },
    {
        "sku_id": "MON-001",
        "name": "Dual Monitor Arm Mount",
        "wholesale_cost": 2500.0,
        "retail_price": 5000.0,
        "stock_qty": 35,
        "category": "Accessories"
    },
    {
        "sku_id": "PANEL-001",
        "name": "Acoustic Privacy Desk Divider Screen",
        "wholesale_cost": 1800.0,
        "retail_price": 3600.0,
        "stock_qty": 30,
        "category": "Accessories"
    },
    {
        "sku_id": "MAT-001",
        "name": "Anti-Fatigue Ergonomic Standing Mat",
        "wholesale_cost": 900.0,
        "retail_price": 1800.0,
        "stock_qty": 45,
        "category": "Accessories"
    }
]

DEFAULT_GUARDRAILS = {
    "margin_floor_pct": 20.0,
    "max_discount_pct": 15.0,
    "approval_gate_inr": 50000.0
}

import threading

class AppState:
    """
    Manages application state with thread-safe atomic mutations.
    """
    def __init__(self):
        self.lock = threading.Lock()
        self.catalog = []
        self.orders = []
        self.audit_logs = []
        self.guardrails = {}
        # Server startup ALWAYS wipes stale state and initializes clean defaults
        self.reset_state()

    def atomic_decrement_stock(self, sku_id: str, requested_qty: int) -> tuple[bool, int, int]:
        """
        Atomically checks and decrements stock for a given SKU ID using a thread lock.
        Returns (success, previous_stock, updated_stock).
        """
        with self.lock:
            sku = next((item for item in self.catalog if item["sku_id"] == sku_id), None)
            if not sku:
                return False, 0, 0
            previous_stock = sku["stock_qty"]
            if previous_stock < requested_qty:
                return False, previous_stock, previous_stock
            
            updated_stock = previous_stock - requested_qty
            sku["stock_qty"] = updated_stock
            self.save_state()
            return True, previous_stock, updated_stock

    # --- SESSION PERSISTENCE (Runtime Keep) ---
    def save_state(self):
        """Persist in-memory session state to state.json for browser refresh survival during runtime."""
        data = {
            "catalog": self.catalog,
            "orders": self.orders,
            "audit_logs": self.audit_logs,
            "guardrails": self.guardrails
        }
        with open(STATE_FILE, "w") as f:
            json.dump(data, f, indent=4)

    def load_state(self):
        """Loads state from disk if present (used within active session reloads if needed)."""
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r") as f:
                try:
                    data = json.load(f)
                    self.catalog = data.get("catalog", [dict(item) for item in SEED_CATALOG])
                    self.orders = data.get("orders", [])
                    self.audit_logs = data.get("audit_logs", [])
                    self.guardrails = data.get("guardrails", DEFAULT_GUARDRAILS.copy())
                    return
                except Exception:
                    pass
        self.reset_state()

    # --- STARTUP & RESET LIFECYCLE (Wipe & Re-init) ---
    def reset_state(self):
        """Wipes all session state and re-initializes clean seed defaults on disk and in memory."""
        # Deep copy seed catalog so individual SKU mutations (e.g. stock_qty decrements) do not affect SEED_CATALOG
        self.catalog = [dict(item) for item in SEED_CATALOG]
        self.orders = []
        self.audit_logs = []
        self.guardrails = DEFAULT_GUARDRAILS.copy()
        self.save_state()

    def reset_inventory(self):
        """Resets catalog to clean 6 seed items without touching orders, logs, or guardrails."""
        self.catalog = [dict(item) for item in SEED_CATALOG]
        self.save_state()
        from audit_logger import log_audit_entry
        log_audit_entry(
            decision="inventory_reset",
            reasoning="Inventory catalog reset to default 6 seed items.",
            inventory_query={"catalog_count": len(self.catalog)}
        )

    def reset_guardrails(self):
        """Resets guardrails to defaults without touching catalog, orders, or logs."""
        self.guardrails = DEFAULT_GUARDRAILS.copy()
        self.save_state()
        from audit_logger import log_audit_entry
        log_audit_entry(
            decision="guardrails_reset",
            reasoning="Guardrails reset to default values (20% margin floor, 15% max discount, ₹50,000 approval gate).",
            margin_math=self.guardrails
        )

state = AppState()
