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
        "sku_id": "DESK-002",
        "name": "L-Shaped Corner Desk",
        "wholesale_cost": 12000.0,
        "retail_price": 22000.0,
        "stock_qty": 15,
        "category": "Desks"
    },
    {
        "sku_id": "CABLE-001",
        "name": "Under-Desk Cable Management Tray",
        "wholesale_cost": 800.0,
        "retail_price": 1500.0,
        "stock_qty": 100,
        "category": "Accessories"
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
        "sku_id": "CHAIR-002",
        "name": "Mesh Back Task Chair",
        "wholesale_cost": 2500.0,
        "retail_price": 5000.0,
        "stock_qty": 80,
        "category": "Seating"
    },
    {
        "sku_id": "CHAIR-003",
        "name": "Executive Leather High-Back Chair",
        "wholesale_cost": 7000.0,
        "retail_price": 13500.0,
        "stock_qty": 1,
        "category": "Seating"
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
        "sku_id": "MAT-001",
        "name": "Anti-Fatigue Ergonomic Standing Mat",
        "wholesale_cost": 900.0,
        "retail_price": 1800.0,
        "stock_qty": 45,
        "category": "Accessories"
    },
    {
        "sku_id": "STORE-001",
        "name": "Steel Mobile Under-Desk Pedestal Drawer",
        "wholesale_cost": 3200.0,
        "retail_price": 6000.0,
        "stock_qty": 25,
        "category": "Storage"
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
        "sku_id": "BENCH-001",
        "name": "Industrial Heavy-Duty Utility Workbench",
        "wholesale_cost": 18000.0,
        "retail_price": 32000.0,
        "stock_qty": 8,
        "category": "Industrial"
    }
]

DEFAULT_GUARDRAILS = {
    "margin_floor_pct": 20.0,
    "max_discount_pct": 15.0,
    "approval_gate_inr": 50000.0
}

class AppState:
    def __init__(self):
        self.catalog = []
        self.orders = []
        self.audit_logs = []
        self.guardrails = {}
        self.load_state()

    def load_state(self):
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r") as f:
                try:
                    data = json.load(f)
                    self.catalog = data.get("catalog", SEED_CATALOG.copy())
                    self.orders = data.get("orders", [])
                    self.audit_logs = data.get("audit_logs", [])
                    self.guardrails = data.get("guardrails", DEFAULT_GUARDRAILS.copy())
                    return
                except Exception:
                    pass
        self.reset_state()

    def save_state(self):
        data = {
            "catalog": self.catalog,
            "orders": self.orders,
            "audit_logs": self.audit_logs,
            "guardrails": self.guardrails
        }
        with open(STATE_FILE, "w") as f:
            json.dump(data, f, indent=4)

    def reset_state(self):
        self.catalog = SEED_CATALOG.copy()
        self.orders = []
        self.audit_logs = []
        self.guardrails = DEFAULT_GUARDRAILS.copy()
        self.save_state()

state = AppState()
