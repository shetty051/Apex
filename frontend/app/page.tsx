"use client";

import React, { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

interface CatalogItem {
  sku_id: string;
  name: string;
  wholesale_cost?: number;
  wholesale?: number;
  retail_price?: number;
  retail?: number;
  stock_qty?: number;
  stock?: number;
  category: string;
}

interface OrderItem {
  order_id: string;
  sku_id: string;
  requested_qty?: number;
  qty?: number;
  offered_price?: number;
  amount_inr?: number;
  amount?: number;
  status: string;
  evaluation?: { decision?: string };
  decision?: string;
  razorpay_order?: Record<string, unknown>;
  recovery_order_id?: string | null;
}

interface LogItem {
  timestamp?: string;
  decision?: string;
  reasoning?: string;
  order_id?: string;
  margin_math?: {
    wholesale_cost?: number;
    retail_price?: number;
    offered_price?: number;
    requested_qty?: number;
    order_total?: number;
    margin_pct?: number;
    discount_pct?: number;
    margin_floor_pct?: number;
    max_discount_pct?: number;
    approval_gate_inr?: number;
    is_margin_healthy?: boolean;
    is_discount_safe?: boolean;
    requires_approval?: boolean;
  };
  buyer_prompt?: string;
  inventory_query?: {
    order_id?: string;
    sku_id?: string;
    requested?: number;
    available?: number;
    status?: string;
    purchased_qty?: number;
  };
}

export default function MerchantHub() {
  // Onboarding State
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [mcpSchema, setMcpSchema] = useState<Record<string, unknown> | null>(null);
  const [launchStatus, setLaunchStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Hub State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "orders" | "logs" | "settings">("home");

  // Live state from backend
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [guardrails, setGuardrails] = useState({ margin_floor_pct: 20, max_discount_pct: 15, approval_gate_inr: 50000 });
  const [logFilter, setLogFilter] = useState<"all" | "discount" | "gated" | "failure">("all");

  // Modals & Drawers
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);

  // Dedicated Isolated Local State for Sliders / Inputs
  const [marginFloor, setMarginFloor] = useState<number>(20);
  const [maxDiscount, setMaxDiscount] = useState<number>(15);
  const [approvalGate, setApprovalGate] = useState<number>(50000);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Phase S3 Inventory Matrix CRUD State
  const CATEGORIES = ["Seating", "Desks", "Meeting Room", "Accessories", "General"];
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; wholesale_cost: number; retail_price: number; stock_qty: number; category: string }>({
    name: "", wholesale_cost: 0, retail_price: 0, stock_qty: 0, category: "Seating"
  });
  const [isAddSkuModalOpen, setIsAddSkuModalOpen] = useState(false);
  const [addSkuError, setAddSkuError] = useState<string | null>(null);
  const [addSkuForm, setAddSkuForm] = useState<{ sku_id: string; name: string; wholesale_cost: number; retail_price: number; stock_qty: number; category: string }>({
    sku_id: "", name: "", wholesale_cost: 0, retail_price: 0, stock_qty: 0, category: "Seating"
  });

  const hasLoadedInitial = useRef(false);

  // Check localStorage on mount
  useEffect(() => {
    const onboarded = localStorage.getItem("apex_onboarding_complete");
    if (onboarded === "true") {
      setIsOnboarded(true);
    }
  }, []);

  // Fetch data periodically with strict anti-caching options and timestamp cache buster
  const fetchData = React.useCallback(async () => {
    try {
      const t = Date.now();
      const fetchOpts: RequestInit = {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" }
      };
      const [catRes, guardRes, ordRes, logsRes, schemaRes] = await Promise.all([
        fetch(`${API_BASE}/catalog?_t=${t}`, fetchOpts).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/guardrails?_t=${t}`, fetchOpts).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/orders?_t=${t}`, fetchOpts).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/logs?type=${logFilter}&_t=${t}`, fetchOpts).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/catalog/mcp-schema?_t=${t}`, fetchOpts).then(r => r.ok ? r.json() : null)
      ]);

      if (Array.isArray(catRes)) setCatalog(catRes);
      if (guardRes) {
        setGuardrails(guardRes);
        if (!hasLoadedInitial.current) {
          setMarginFloor(guardRes.margin_floor_pct ?? 20);
          setMaxDiscount(guardRes.max_discount_pct ?? 15);
          setApprovalGate(guardRes.approval_gate_inr ?? 50000);
          hasLoadedInitial.current = true;
        }
      }
      if (Array.isArray(ordRes)) setOrders(ordRes);
      if (Array.isArray(logsRes)) setLogs(logsRes);
      if (schemaRes) setMcpSchema(schemaRes);
    } catch (_e) {
      console.error("Error fetching live backend data:", _e);
    }
  }, [logFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Phase R5 Handlers
  const handleStartEditSku = (item: CatalogItem) => {
    setEditingSkuId(item.sku_id);
    setEditForm({
      name: item.name ?? "",
      wholesale_cost: item.wholesale_cost ?? 0,
      retail_price: item.retail_price ?? 0,
      stock_qty: item.stock_qty ?? 0,
      category: item.category ?? ""
    });
  };

  const handleSaveSkuInline = async (skuId: string) => {
    try {
      const res = await fetch(`${API_BASE}/catalog/${skuId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditingSkuId(null);
        await fetchData();
      }
    } catch {
      console.error("Failed to update SKU.");
    }
  };

  const handleCreateNewSku = async () => {
    setAddSkuError(null);
    const skuId = addSkuForm.sku_id.trim();
    const name = addSkuForm.name.trim();

    if (!skuId || !name || addSkuForm.wholesale_cost <= 0 || addSkuForm.retail_price <= 0) {
      setAddSkuError("Please fill out all product fields with valid non-null values.");
      return;
    }

    // Client-side duplicate SKU ID check
    const exists = catalog.some(item => item.sku_id.toLowerCase() === skuId.toLowerCase());
    if (exists) {
      setAddSkuError(`SKU ID '${skuId}' already exists in catalog. Please choose a unique SKU ID.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addSkuForm,
          sku_id: skuId,
          name: name
        })
      });
      if (res.ok) {
        setIsAddSkuModalOpen(false);
        setAddSkuForm({ sku_id: "", name: "", wholesale_cost: 0, retail_price: 0, stock_qty: 0, category: "Seating" });
        setAddSkuError(null);
        await fetchData();
      } else {
        const errData = await res.json();
        setAddSkuError(errData.detail || "Failed to create SKU.");
      }
    } catch {
      setAddSkuError("Error communicating with server to create SKU.");
    }
  };

  const handleDeleteSku = async (skuId: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete SKU '${skuId}' from the catalog?`);
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/catalog/${skuId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      console.error("Failed to delete SKU.");
    }
  };

  const handleResetInventory = async () => {
    const confirmed = window.confirm("Are you sure you want to reset the inventory catalog to default seed items? (Guardrails and logs will not be touched)");
    if (!confirmed) return;
    try {
      await fetch(`${API_BASE}/reset-inventory`, { method: "POST" });
      await fetchData();
    } catch {
      alert("Failed to reset inventory.");
    }
  };

  const handleResetGuardrailsOnly = async () => {
    const confirmed = window.confirm("Are you sure you want to reset guardrails to default values (20% margin floor, 15% max discount, ₹50,000 approval gate)? (Inventory and logs will not be touched)");
    if (!confirmed) return;
    try {
      const res = await fetch(`${API_BASE}/reset-guardrails`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        const g = updated.guardrails || updated;
        setGuardrails(g);
        setMarginFloor(20);
        setMaxDiscount(15);
        setApprovalGate(50000);
        setSaveStatus("Guardrail settings reset to default values!");
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch {
      setSaveStatus("Failed to reset guardrail settings.");
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/approve`, { method: "POST" });
      if (res.ok) {
        setSelectedLog(null);
        setSelectedOrder(null);
        await fetchData();
      } else {
        alert("Failed to approve order.");
      }
    } catch {
      alert("Error approving order.");
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/reject`, { method: "POST" });
      if (res.ok) {
        setSelectedLog(null);
        setSelectedOrder(null);
        await fetchData();
      } else {
        alert("Failed to reject order.");
      }
    } catch {
      alert("Error rejecting order.");
    }
  };

  // Launch Gateway connection test
  const handleLaunchGateway = async () => {
    setLaunchStatus("testing");
    setLaunchError(null);
    try {
      // 1. Save Guardrails with isolated local state
      const payload = {
        margin_floor_pct: marginFloor,
        max_discount_pct: maxDiscount,
        approval_gate_inr: approvalGate
      };
      const guardRes = await fetch(`${API_BASE}/guardrails`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!guardRes.ok) throw new Error("Failed to update guardrail parameters.");

      // 2. Health Test & Catalog Test
      const healthRes = await fetch(`${API_BASE}/health`);
      const catRes = await fetch(`${API_BASE}/catalog`);
      if (!healthRes.ok || !catRes.ok) throw new Error("Gateway connection test failed. Server returned non-200 status.");

      setLaunchStatus("success");
      setTimeout(() => {
        localStorage.setItem("apex_onboarding_complete", "true");
        setIsOnboarded(true);
        setLaunchStatus("idle");
      }, 1200);
    } catch (e: unknown) {
      setLaunchStatus("error");
      const msg = e instanceof Error ? e.message : "Failed to connect to backend on http://localhost:8000.";
      setLaunchError(msg);
    }
  };

  // Save Guardrails in Hub
  const handleSaveGuardrails = async () => {
    try {
      const payload = {
        margin_floor_pct: marginFloor,
        max_discount_pct: maxDiscount,
        approval_gate_inr: approvalGate
      };
      const res = await fetch(`${API_BASE}/guardrails`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        setGuardrails(updated);
        setSaveStatus("Guardrails updated successfully!");
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch {
      setSaveStatus("Failed to update guardrails.");
    }
  };

  // Compute live metrics
  const totalRevenue = orders
    .filter(o => o.status === "captured" || o.status === "auto_approved")
    .reduce((acc, curr) => acc + (curr.amount_inr || 0), 0);

  const transactionsConverted = orders.filter(o => o.status === "captured").length;
  const nearMissDealsSaved = logs.filter(l => l.decision === "refused" && l.reasoning?.includes("Acceptable price")).length;

  const marginPcts = logs
    .map(l => l.margin_math?.margin_pct)
    .filter((m): m is number => typeof m === "number" && !isNaN(m));
  
  const avgMarginPreserved = marginPcts.length > 0
    ? (marginPcts.reduce((a, b) => a + b, 0) / marginPcts.length).toFixed(1)
    : "0.0";

  // Revenue trend data for Recharts
  const chartData = orders.map((o, idx) => ({
    name: `Order #${idx + 1}`,
    amount: o.amount_inr || 0,
    sku: o.sku_id
  }));



  // Re-run Wizard: Calls backend reset AND lands frontend on Step 1
  const handleResetOnboarding = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to re run the wizard? Doing this will reset everything to default and you will lose your progress"
    );
    if (!confirmed) return;

    try {
      await fetch(`${API_BASE}/reset-demo`, { method: "POST" });
    } catch (e) {
      console.error("Failed to call backend reset during Re-run Wizard:", e);
    }
    localStorage.removeItem("apex_onboarding_complete");
    localStorage.removeItem("apex_simulator_history");
    localStorage.removeItem("apex_simulator_handshakes");
    hasLoadedInitial.current = false;
    setMarginFloor(20);
    setMaxDiscount(15);
    setApprovalGate(50000);
    setIsOnboarded(false);
    setWizardStep(1);
    fetchData();
  };

  // ==================== ONBOARDING WIZARD VIEW ====================
  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col justify-between p-6">
        {/* Wizard Header */}
        <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0C8CE9] flex items-center justify-center font-bold text-white shadow-sm text-sm">
              A
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900 block leading-none">
                Apex Workspace Solutions
              </span>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                Autonomous B2B Equipment Merchant Node Setup
              </span>
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    wizardStep === step
                      ? "bg-[#0C8CE9] text-white shadow-sm"
                      : wizardStep > step
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {wizardStep > step ? "✓" : step}
                </div>
                {step < 3 && <div className="w-8 h-0.5 bg-slate-200"></div>}
              </div>
            ))}
          </div>
        </header>

        {/* Wizard Content Step Pages */}
        <main className="max-w-5xl mx-auto w-full my-8 flex-1 flex flex-col justify-center">
          {/* STEP 1: Intro / Domain Context */}
          {wizardStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6 max-w-3xl mx-auto">
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 bg-blue-50 text-[#0C8CE9] font-semibold text-xs rounded-full border border-blue-200">
                  Step 1 of 3: Demo Admin Portal
                </span>
                <h1 className="text-2xl font-bold text-slate-900">
                  Welcome to Apex Workspace Solutions
                </h1>
                <p className="text-slate-600 text-sm leading-relaxed text-justify">
                  Apex Workspace Solutions is an autonomous Agent-to-Agent (A2A) e-commerce platform specializing in commercial seating, modular conference tables, ergonomic accessories, and storage hardware. This portal allows autonomous AI buyer agents to inspect real-time catalog schemas, negotiate volume pricing against deterministic guardrails, and execute automated Razorpay transaction settlements.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-b border-slate-100 py-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="text-xl font-bold text-slate-900">6 SKUs</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">Seeded B2B Catalog</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="text-xl font-bold text-slate-900">20% Margin</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">Deterministic Floor</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="text-xl font-bold text-slate-900">Razorpay</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">Test Mode Capture</div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setWizardStep(2)}
                  className="bg-[#0C8CE9] hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
                >
                  Proceed to Schema Inspection →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Dual Catalog View (Cards vs MCP Schema JSON) */}
          {wizardStep === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <span className="inline-block px-3 py-1 bg-blue-50 text-[#0C8CE9] font-semibold text-xs rounded-full border border-blue-200 mb-1">
                    Step 2 of 3: Dual Schema View
                  </span>
                  <h2 className="text-xl font-bold text-slate-900">Human Catalog vs Machine MCP Schema</h2>
                  <p className="text-xs text-slate-500">Compare what humans see versus what autonomous AI Buyer Agents inspect live</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Human Catalog Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Human Store Catalog ({catalog.length} Items)
                    </h3>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {catalog.map(item => (
                      <div key={item.sku_id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center">
                        <div>
                          <span className="font-mono text-xs font-bold text-[#0C8CE9]">{item.sku_id}</span>
                          <h4 className="font-semibold text-slate-900 text-sm mt-0.5">{item.name}</h4>
                          <span className="text-xs text-slate-500">{item.category} • Stock: {item.stock_qty ?? item.stock ?? 0}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 block">₹{(item.retail_price || item.retail || 0).toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-slate-400">Cost: ₹{(item.wholesale_cost || item.wholesale || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Machine-Readable MCP Schema JSON */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0C8CE9]"></span>
                      Machine-Readable MCP Schema (/catalog/mcp-schema)
                    </h3>
                  </div>
                  <div className="bg-[#0B1E36] text-blue-300 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-96 border border-slate-800">
                    <pre>{JSON.stringify(mcpSchema || { schema: "mcp_v1_b2b_catalog", agent_rules: "margin_floor_pct=20, max_discount_pct=15", items: catalog }, null, 2)}</pre>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setWizardStep(1)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-5 rounded-xl text-sm transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="bg-[#0C8CE9] hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-xl text-sm transition-all shadow-sm"
                >
                  Configure Guardrails Engine →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Guardrail Config & Launch Gateway */}
          {wizardStep === 3 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6 max-w-3xl mx-auto">
              <div className="space-y-2 border-b border-slate-100 pb-4">
                <span className="inline-block px-3 py-1 bg-blue-50 text-[#0C8CE9] font-semibold text-xs rounded-full border border-blue-200">
                  Step 3 of 3: Guardrails & Gateway Launch
                </span>
                <h2 className="text-2xl font-bold text-slate-900">Set Deterministic Guardrails</h2>
                <p className="text-slate-600 text-sm">Isolated local controls pre-filled from backend. Adjust parameters cleanly before activating.</p>
              </div>

              {launchError && (
                <div className="p-4 bg-rose-50 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200 flex items-center gap-3">
                  <span className="text-rose-500 font-bold text-base">⚠</span>
                  <div>
                    <div className="font-bold">Connection Test Failed</div>
                    <div>{launchError}</div>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Margin Floor (%):</label>
                    <span className="font-mono text-sm font-bold text-[#0C8CE9]">{marginFloor}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={marginFloor}
                    onChange={(e) => setMarginFloor(Number(e.target.value))}
                    className="w-full accent-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Offers resulting in a gross margin below this threshold will be refused.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Max Discount Cap (%):</label>
                    <span className="font-mono text-sm font-bold text-[#0C8CE9]">{maxDiscount}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(Number(e.target.value))}
                    className="w-full accent-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Maximum allowable discount relative to retail price.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Approval Gate Threshold (INR):</label>
                  <input
                    type="number"
                    value={approvalGate}
                    onChange={(e) => setApprovalGate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Order totals exceeding this amount require human approval.</p>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setWizardStep(2)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-5 rounded-xl text-sm transition-all"
                >
                  ← Back
                </button>
                
                <button
                  onClick={handleLaunchGateway}
                  disabled={launchStatus === "testing" || launchStatus === "success"}
                  className={`font-semibold py-3 px-8 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 ${
                    launchStatus === "success"
                      ? "bg-emerald-500 text-white"
                      : "bg-[#0C8CE9] hover:bg-blue-600 text-white"
                  }`}
                >
                  {launchStatus === "testing" ? (
                    <span>Testing Connection...</span>
                  ) : launchStatus === "success" ? (
                    <span>✓ Gateway Active! Launching...</span>
                  ) : (
                    <span>Finish & Launch Gateway 🚀</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </main>

        <footer className="max-w-5xl mx-auto w-full text-center text-xs text-slate-400 py-4">
          ApexA2A Protocol Node • Powered by Razorpay & FastAPI
        </footer>
      </div>
    );
  }

  // ==================== MERCHANT HUB MAIN DASHBOARD ====================
  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar - Signature Razorpay Deep Navy (#0B1E36) */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-[#0B1E36] transition-all duration-300 flex flex-col justify-between z-20 shadow-md`}
      >
        <div>
          {/* Logo & Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800/60">
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0C8CE9] flex items-center justify-center font-bold text-white shadow-sm text-sm">
                  A
                </div>
                <div>
                  <span className="font-bold text-base tracking-tight text-white block leading-none">
                    Apex Workspace
                  </span>
                  <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider block mt-1">
                    Merchant Hub
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 mx-auto rounded-lg bg-[#0C8CE9] flex items-center justify-center font-bold text-white text-sm shadow-sm">
                A
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {[
              { id: "home", label: "Dashboard & Catalog", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
              { id: "orders", label: "Live Orders", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
              { id: "logs", label: "Audit Logs", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
              { id: "settings", label: "Guardrails & State", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "home" | "orders" | "logs" | "settings")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[#0D94FB] text-white font-semibold shadow-sm"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
                title={!sidebarOpen ? tab.label : undefined}
              >
                <svg className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Launch Simulator Button */}
        <div className="p-3 border-t border-slate-800/60">
          <a
            href="/simulator"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#0C8CE9] hover:bg-blue-600 text-white font-medium rounded-lg py-2.5 px-3 shadow-sm text-sm transition-all"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {sidebarOpen && <span>Launch Buyer Simulator</span>}
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-slate-900 capitalize">
              {activeTab === "home" ? "Dashboard & Catalog" : activeTab === "orders" ? "Live Orders" : activeTab === "logs" ? "Audit Trail & Logs" : "Guardrails Engine Settings"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetOnboarding}
              className="text-xs font-semibold text-slate-500 hover:text-[#0C8CE9] px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200"
            >
              ↺ Re-run Wizard
            </button>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Polling (2.5s)
            </span>
          </div>
        </header>

        {/* View Contents */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "home" && (
            <div className="space-y-6">
              {/* Stat Cards - Live Backend Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="w-1 h-full bg-[#0C8CE9] absolute left-0 top-0"></div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Revenue</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">₹{totalRevenue.toLocaleString('en-IN')}</div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    Live Converted Orders
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="w-1 h-full bg-emerald-500 absolute left-0 top-0"></div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Converted Orders</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">{transactionsConverted}</div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Captured Status
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="w-1 h-full bg-amber-500 absolute left-0 top-0"></div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Near-Miss Deals Saved</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">{nearMissDealsSaved}</div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    Counter-Offers Issued
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="w-1 h-full bg-indigo-500 absolute left-0 top-0"></div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Margin Preserved</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">{avgMarginPreserved}%</div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Guardrail Floor ≥ {guardrails.margin_floor_pct}%
                  </div>
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-slate-900 text-base">Revenue & Deal Volume Trend</h2>
                  <span className="text-xs text-slate-500 font-medium">Real-time Transaction Stream</span>
                </div>
                {chartData.length === 0 ? (
                  <div className="h-64 w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 space-y-1">
                    <div className="font-semibold text-sm text-slate-600">No Real-time Transaction Stream</div>
                    <p className="text-xs max-w-sm">Dispatch a buyer mission in the simulator to generate live order transactions.</p>
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0C8CE9" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#0C8CE9" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Tooltip formatter={(value: any) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, 'Amount']} />
                        <Area type="monotone" dataKey="amount" stroke="#0C8CE9" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Live Catalog Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Live Seed Inventory ({catalog.length} SKUs)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Automated pricing guardrails applied to active catalog</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">State Synced</span>
                </div>
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">SKU ID</th>
                      <th className="px-5 py-3.5">Product Name</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Wholesale</th>
                      <th className="px-5 py-3.5">Retail</th>
                      <th className="px-5 py-3.5">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {catalog.map((item) => (
                      <tr key={item.sku_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">{item.sku_id}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{item.name}</td>
                        <td className="px-5 py-4 text-slate-500 text-xs font-medium">{item.category}</td>
                        <td className="px-5 py-4 text-slate-500 font-mono text-xs">₹{(item.wholesale_cost || item.wholesale || 0).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-4 text-slate-900 font-mono text-xs font-bold">₹{(item.retail_price || item.retail || 0).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            (item.stock_qty ?? item.stock ?? 0) <= 5 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {item.stock_qty ?? item.stock ?? 0} in stock {(item.stock_qty ?? item.stock ?? 0) <= 5 ? '(Low)' : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-white flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Live Orders & Transactions ({orders.length})</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time Razorpay order creation and capture records</p>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Click order to inspect Razorpay payload</span>
                </div>
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Order ID</th>
                      <th className="px-5 py-3.5">SKU ID</th>
                      <th className="px-5 py-3.5">Qty</th>
                      <th className="px-5 py-3.5">Total Amount</th>
                      <th className="px-5 py-3.5">Evaluation</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                          No live orders recorded yet. Run a mission in the Buyer Simulator to generate orders!
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => (
                        <tr key={ord.order_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs font-semibold text-[#0C8CE9]">{ord.order_id}</td>
                          <td className="px-5 py-4 font-bold text-slate-900">{ord.sku_id}</td>
                          <td className="px-5 py-4 text-slate-600 font-medium">{ord.requested_qty || ord.qty}</td>
                          <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">₹{(ord.amount_inr || ord.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {ord.evaluation?.decision || ord.decision || "auto_approved"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              ord.status === 'captured'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {ord.status === "gated_pending_approval" && (
                                <>
                                  <button
                                    onClick={() => handleApproveOrder(ord.order_id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md shadow-xs transition-colors"
                                  >
                                    Approve Order
                                  </button>
                                  <button
                                    onClick={() => handleRejectOrder(ord.order_id)}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-md shadow-xs transition-colors"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedOrder(ord)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-md transition-colors"
                              >
                                Inspect JSON
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Audit Trail Stream ({logs.length})</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Structured logging stream for all negotiation and order events</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { id: "all", label: "All" },
                      { id: "discount", label: "Discounts" },
                      { id: "gated", label: "Gated" },
                      { id: "failure", label: "Failures" }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setLogFilter(f.id as "all" | "discount" | "gated" | "failure")}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                          logFilter === f.id
                            ? "bg-[#0B1E36] text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      No logs found for filter &apos;{logFilter}&apos;.
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col gap-2 cursor-pointer" onClick={() => setSelectedLog(log)}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-slate-400 font-medium">{log.timestamp}</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            log.decision === 'auto_approved' || log.decision === 'captured'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {log.decision}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800">{log.reasoning}</p>
                        {log.margin_math && Object.keys(log.margin_math).length > 0 && (
                          <div className="text-xs font-mono text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-wrap gap-4">
                            {log.margin_math.offered_price && <span>Offered: ₹{log.margin_math.offered_price}</span>}
                            {log.margin_math.margin_pct !== undefined && <span>Margin: {log.margin_math.margin_pct}%</span>}
                            {log.margin_math.order_total && <span>Total: ₹{log.margin_math.order_total}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6 max-w-3xl">
              {/* Guardrails Configuration */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg border-b border-slate-200 pb-3">Deterministic Guardrail Engine</h2>
                  <p className="text-xs text-slate-500 mt-2">Configure mathematical pricing thresholds for auto-approvals and gating</p>
                </div>
                
                {saveStatus && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200">
                    {saveStatus}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Margin Floor (%):</label>
                    <span className="font-mono text-sm font-bold text-[#0C8CE9]">{marginFloor}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={marginFloor}
                    onChange={(e) => setMarginFloor(Number(e.target.value))}
                    className="w-full accent-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Offers resulting in a gross margin below this threshold will be refused.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Max Discount Cap (%):</label>
                    <span className="font-mono text-sm font-bold text-[#0C8CE9]">{maxDiscount}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(Number(e.target.value))}
                    className="w-full accent-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Maximum allowable discount relative to retail price.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Approval Gate Threshold (INR):</label>
                  <input
                    type="number"
                    value={approvalGate}
                    onChange={(e) => setApprovalGate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Order totals exceeding this amount require human approval.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveGuardrails}
                    className="bg-[#0C8CE9] hover:bg-blue-600 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-all shadow-sm"
                  >
                    Save Guardrail Settings
                  </button>
                  
                  <button
                    onClick={handleResetGuardrailsOnly}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-medium py-2.5 px-5 rounded-lg text-sm transition-all"
                  >
                    Reset Guardrails
                  </button>

                  <button
                    onClick={handleResetOnboarding}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium py-2.5 px-5 rounded-lg text-sm transition-all ml-auto"
                  >
                    Re-run Wizard
                  </button>
                </div>
              </div>

              {/* Phase S3: Inventory Matrix CRUD Section */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Inventory Matrix</h2>
                    <p className="text-xs text-slate-500">Live catalog CRUD management & pricing. Updates sync immediately to GET /catalog/mcp-schema.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetInventory}
                      className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold py-2 px-3 rounded-lg transition-all"
                    >
                      Reset SKUs
                    </button>
                    <button
                      onClick={() => {
                        setAddSkuError(null);
                        setAddSkuForm({ sku_id: "", name: "", wholesale_cost: 0, retail_price: 0, stock_qty: 0, category: "Seating" });
                        setIsAddSkuModalOpen(true);
                      }}
                      className="text-xs bg-[#0C8CE9] hover:bg-blue-600 text-white font-bold py-2 px-3.5 rounded-lg shadow-sm transition-all"
                    >
                      + Add New SKU
                    </button>
                  </div>
                </div>

                {/* CRUD Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                        <th className="p-3">SKU ID</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Wholesale Cost</th>
                        <th className="p-3">Retail Price</th>
                        <th className="p-3">Stock Qty</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {catalog.map((item) => {
                        const isEditing = editingSkuId === item.sku_id;
                        return (
                          <tr key={item.sku_id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-bold text-slate-900">{item.sku_id}</td>
                            <td className="p-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.name}
                                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="w-full bg-white border border-slate-200 p-1.5 rounded text-xs text-slate-900"
                                />
                              ) : (
                                <span className="font-sans text-slate-800">{item.name}</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isEditing ? (
                                <select
                                  value={editForm.category}
                                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                  className="w-full bg-white border border-slate-200 p-1.5 rounded text-xs text-slate-900"
                                >
                                  {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">{item.category}</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.wholesale_cost}
                                  onChange={(e) => setEditForm({ ...editForm, wholesale_cost: Number(e.target.value) })}
                                  className="w-24 bg-white border border-slate-200 p-1.5 rounded text-xs text-slate-900"
                                />
                              ) : (
                                `₹${item.wholesale_cost?.toLocaleString('en-IN')}`
                              )}
                            </td>
                            <td className="p-3 font-bold text-[#0C8CE9]">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.retail_price}
                                  onChange={(e) => setEditForm({ ...editForm, retail_price: Number(e.target.value) })}
                                  className="w-24 bg-white border border-slate-200 p-1.5 rounded text-xs text-slate-900"
                                />
                              ) : (
                                `₹${item.retail_price?.toLocaleString('en-IN')}`
                              )}
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.stock_qty}
                                  onChange={(e) => setEditForm({ ...editForm, stock_qty: Number(e.target.value) })}
                                  className="w-20 bg-white border border-slate-200 p-1.5 rounded text-xs text-slate-900"
                                />
                              ) : (
                                <span className={`px-2 py-0.5 rounded ${(item.stock_qty ?? 0) > 10 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {item.stock_qty ?? 0} units
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => handleSaveSkuInline(item.sku_id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingSkuId(null)}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-medium px-2 py-1 rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleStartEditSku(item)}
                                    className="text-xs text-[#0C8CE9] hover:underline font-semibold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSku(item.sku_id)}
                                    className="text-xs text-rose-600 hover:underline font-semibold"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Order Inspection Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Razorpay Order Payload</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <div className="bg-[#0B1E36] text-blue-300 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96">
              <pre>{JSON.stringify(selectedOrder, null, 2)}</pre>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setSelectedOrder(null)} className="bg-slate-900 text-white text-xs font-semibold py-2 px-4 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Expandable Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <span>Audit Event Inspector</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                    selectedLog.decision === 'auto_approved' || selectedLog.decision === 'captured' || selectedLog.decision === 'order_approved_by_merchant'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : selectedLog.decision === 'gated_pending_approval'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {selectedLog.decision}
                  </span>
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedLog.timestamp}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider block mb-1">Reasoning & Status:</span>
                <p className="font-medium text-slate-900 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">{selectedLog.reasoning}</p>
              </div>

              {selectedLog.buyer_prompt && (
                <div>
                  <span className="text-slate-500 font-semibold uppercase tracking-wider block mb-1">Buyer Prompt / Intent:</span>
                  <p className="text-slate-800 italic bg-blue-50/50 p-3 rounded-xl border border-blue-200/60 font-mono text-xs">&quot;{selectedLog.buyer_prompt}&quot;</p>
                </div>
              )}

              {/* Mathematical Trace Grid */}
              {selectedLog.margin_math && (
                <div className="space-y-2">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider block">Mathematical Trace:</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Wholesale Cost</span>
                      <span className="text-slate-900 font-bold text-sm">₹{selectedLog.margin_math.wholesale_cost?.toLocaleString('en-IN') || "N/A"}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Retail Price</span>
                      <span className="text-slate-900 font-bold text-sm">₹{selectedLog.margin_math.retail_price?.toLocaleString('en-IN') || "N/A"}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Offered Price</span>
                      <span className="text-[#0C8CE9] font-bold text-sm">₹{selectedLog.margin_math.offered_price?.toLocaleString('en-IN') || "N/A"}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Calculated Margin</span>
                      <span className={`font-bold text-sm ${selectedLog.margin_math.is_margin_healthy === false ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {selectedLog.margin_math.margin_pct}%
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Floor: {selectedLog.margin_math.margin_floor_pct || marginFloor}%</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Discount Cap Compliance</span>
                      <span className={`font-bold text-sm ${selectedLog.margin_math.is_discount_safe === false ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {selectedLog.margin_math.discount_pct}% {selectedLog.margin_math.is_discount_safe === false ? '(Exceeded)' : '(Safe)'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Cap: {selectedLog.margin_math.max_discount_pct || maxDiscount}%</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Gating Evaluation</span>
                      <span className={`font-bold text-sm ${selectedLog.margin_math.requires_approval ? 'text-amber-600' : 'text-emerald-600'}`}>
                        ₹{(selectedLog.margin_math.order_total || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {selectedLog.margin_math.requires_approval ? `Exceeds Gate (₹${(selectedLog.margin_math.approval_gate_inr || approvalGate).toLocaleString('en-IN')})` : 'Under Gate'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Collapsible Technical Raw JSON */}
              <details className="mt-2 text-xs text-slate-500">
                <summary className="cursor-pointer font-semibold text-slate-600 hover:text-[#0C8CE9] transition-colors">
                  Inspect Raw Event Metadata JSON
                </summary>
                <div className="bg-[#0B1E36] text-blue-300 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-48 mt-2 border border-slate-800">
                  <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
                </div>
              </details>
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {(() => {
                const targetOrderId = selectedLog.inventory_query?.order_id || selectedLog.order_id;
                if (selectedLog.decision === "gated_pending_approval" && targetOrderId) {
                  return (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveOrder(targetOrderId)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm transition-colors"
                      >
                        Approve Order ✓
                      </button>
                      <button
                        onClick={() => handleRejectOrder(targetOrderId)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm transition-colors"
                      >
                        Reject ✕
                      </button>
                    </div>
                  );
                }
                return <div></div>;
              })()}
              <button onClick={() => setSelectedLog(null)} className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-5 rounded-xl text-xs transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New SKU Modal */}
      {isAddSkuModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Add New Catalog SKU</h3>
                <p className="text-xs text-slate-500 mt-0.5">All fields required. Duplicate SKU IDs will be rejected.</p>
              </div>
              <button
                onClick={() => {
                  setIsAddSkuModalOpen(false);
                  setAddSkuError(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {addSkuError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200 flex items-start gap-2">
                <span className="text-rose-500 font-bold text-sm">⚠</span>
                <div>{addSkuError}</div>
              </div>
            )}

            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">SKU ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. CHAIR-099"
                    value={addSkuForm.sku_id}
                    onChange={(e) => setAddSkuForm({ ...addSkuForm, sku_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Category *</label>
                  <select
                    value={addSkuForm.category}
                    onChange={(e) => setAddSkuForm({ ...addSkuForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Product Name *</label>
                <input
                  type="text"
                  placeholder="Product Name"
                  value={addSkuForm.name}
                  onChange={(e) => setAddSkuForm({ ...addSkuForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Wholesale (₹) *</label>
                  <input
                    type="number"
                    value={addSkuForm.wholesale_cost || ""}
                    onChange={(e) => setAddSkuForm({ ...addSkuForm, wholesale_cost: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Retail (₹) *</label>
                  <input
                    type="number"
                    value={addSkuForm.retail_price || ""}
                    onChange={(e) => setAddSkuForm({ ...addSkuForm, retail_price: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Stock Qty *</label>
                  <input
                    type="number"
                    value={addSkuForm.stock_qty || ""}
                    onChange={(e) => setAddSkuForm({ ...addSkuForm, stock_qty: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsAddSkuModalOpen(false);
                  setAddSkuError(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewSku}
                className="bg-[#0C8CE9] hover:bg-blue-600 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors shadow-sm"
              >
                Create SKU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
