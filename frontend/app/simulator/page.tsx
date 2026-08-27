"use client";

import React, { useState, useEffect } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

interface HistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface HandshakeStep {
  id: string;
  timestamp: string;
  prompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trail?: any;
  error?: string;
}

interface CatalogItem {
  sku_id: string;
  name: string;
  category: string;
  wholesale_cost: number;
  retail_price: number;
  stock_qty: number;
}

export default function BuyerSimulatorPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [handshakes, setHandshakes] = useState<HandshakeStep[]>([]);
  const [loading, setLoading] = useState(false);

  // Structured Custom Input Modal State
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ sku_id: "", qty: 1, budget_inr: 10000 });
  const [customSimulateFail, setCustomSimulateFail] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Fetch live catalog on mount
  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await fetch(`${API_BASE}/catalog/mcp-schema`);
      if (res.ok) {
        const schemaData = await res.json();
        const data: CatalogItem[] = schemaData.data || [];
        setCatalog(data);
        if (data.length > 0 && !customForm.sku_id) {
          setCustomForm(prev => ({ ...prev, sku_id: data[0].sku_id }));
        }
      }
    } catch {
      console.error("Failed to fetch catalog in simulator.");
    }
  };

  // Restore simulator state on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("apex_simulator_history");
      const savedHandshakes = localStorage.getItem("apex_simulator_handshakes");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      if (savedHandshakes) setHandshakes(JSON.parse(savedHandshakes));
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save simulator state to localStorage whenever history or handshakes change
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem("apex_simulator_history", JSON.stringify(history));
    } else {
      localStorage.removeItem("apex_simulator_history");
    }
    if (handshakes.length > 0) {
      localStorage.setItem("apex_simulator_handshakes", JSON.stringify(handshakes));
    } else {
      localStorage.removeItem("apex_simulator_handshakes");
    }
  }, [history, handshakes]);

  const presets = [
    {
      id: "A",
      label: "Scenario A: Bulk Optimal",
      sku_id: "CHAIR-001",
      qty: 2,
      budget_inr: 16000,
      badge: "Auto-Approve",
      color: "bg-[#0C8CE9] text-white"
    },
    {
      id: "B",
      label: "Scenario B: High-Value Bundle",
      sku_id: "TABLE-001",
      qty: 2,
      budget_inr: 76000,
      badge: "High Value Gated",
      color: "bg-emerald-600 text-white"
    },
    {
      id: "C",
      label: "Scenario C: Margin Breach",
      sku_id: "CHAIR-001",
      qty: 2,
      budget_inr: 2000,
      badge: "Refused Counter",
      color: "bg-rose-600 text-white"
    },
    {
      id: "D",
      label: "Scenario D: Stock Exhaustion",
      sku_id: "TABLE-001",
      qty: 10,
      budget_inr: 280000,
      badge: "Stock Alternative",
      color: "bg-amber-600 text-white"
    }
  ];

  const handleDispatchStructured = async (skuId: string, qty: number, budgetInr: number, scenarioLabel?: string, simulateFail: boolean = false) => {
    if (loading) return;
    setLoading(true);

    const timeStr = new Date().toLocaleTimeString();
    const newStepId = Date.now().toString();
    const proposedPrice = Math.round((budgetInr / qty) * 100) / 100;
    
    const targetItem = catalog.find(c => c.sku_id === skuId);
    const skuName = targetItem ? targetItem.name : skuId;
    const promptText = scenarioLabel || `Buy ${qty} x ${skuName} under ₹${budgetInr.toLocaleString('en-IN')}`;

    const newStep: HandshakeStep = {
      id: newStepId,
      timestamp: timeStr,
      prompt: promptText
    };

    setHandshakes(prev => [newStep, ...prev]);

    try {
      const res = await fetch(`${API_BASE}/negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_id: "simulator_buyer",
          items: [{ sku_id: skuId, qty: qty }],
          proposed_price_per_unit: proposedPrice,
          budget_cap: budgetInr
        })
      });

      const negData = await res.json();

      if (res.ok) {
        let orderResult = null;
        if (negData.status === "auto_approved") {
          const orderRes = await fetch(`${API_BASE}/orders/settle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              buyer_id: "simulator_buyer",
              sku_id: skuId,
              qty: qty,
              agreed_price_per_unit: proposedPrice,
              simulate_fail: simulateFail
            })
          });
          if (orderRes.ok) {
            const orderData = await orderRes.json();
            orderResult = orderData.order;
          }
        }

        const trail = {
          buyer_prompt: promptText,
          intent_type: "structured_mandate",
          interpreted_intent: {
            items: [{ sku_guess: skuId, qty: qty }],
            budget_cap_inr: budgetInr,
            needs_confirmation_text: `Structured Mandate Executed: ${qty} x ${skuName} @ ₹${proposedPrice}/unit (Budget ₹${budgetInr.toLocaleString('en-IN')})`
          },
          matched_sku: skuId,
          offered_price_per_unit: proposedPrice,
          negotiation_result: negData,
          order_result: orderResult
        };

        setHandshakes(prev => prev.map(item => item.id === newStepId ? { ...item, trail } : item));
        setHistory(prev => [
          ...prev,
          { role: "user", content: promptText },
          { role: "assistant", content: trail.interpreted_intent.needs_confirmation_text }
        ]);
      } else {
        setHandshakes(prev => prev.map(item => item.id === newStepId ? { ...item, error: negData.error || "Negotiation failed" } : item));
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Failed to reach backend";
      setHandshakes(prev => prev.map(item => item.id === newStepId ? { ...item, error: errMsg } : item));
    } finally {
      setLoading(false);
    }
  };

  const handleTestCustomInput = () => {
    setCustomError(null);
    if (!customForm.sku_id) {
      setCustomError("Please select a product SKU from the catalog dropdown.");
      return;
    }
    if (!customForm.qty || customForm.qty <= 0) {
      setCustomError("Quantity must be a positive integer greater than 0.");
      return;
    }
    if (!customForm.budget_inr || customForm.budget_inr <= 0) {
      setCustomError("Target Budget must be a positive INR amount.");
      return;
    }

    setIsCustomModalOpen(false);
    handleDispatchStructured(customForm.sku_id, customForm.qty, customForm.budget_inr, undefined, customSimulateFail);
  };

  const handleClearHistory = () => {
    setHistory([]);
    setHandshakes([]);
    localStorage.removeItem("apex_simulator_history");
    localStorage.removeItem("apex_simulator_handshakes");
  };

  return (
    <div className="h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="bg-[#0B1E36] text-white px-8 py-4 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0C8CE9] flex items-center justify-center font-bold text-white shadow-sm text-sm">
            A
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none">
              Buyer Agent Protocol Simulator
            </h1>
            <p className="text-xs text-blue-300 font-medium mt-1">
              Demo/testing mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-medium transition-colors"
            >
              Clear Conversation History ({history.length / 2} turns)
            </button>
          )}
          <a
            href="/"
            className="text-xs bg-[#0C8CE9] hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
          >
            ← Open Merchant Hub
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        {/* Left Column: Presets & Custom Harness Controls (5 Cols - Fixed Non-Scrolling) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col min-h-0 flex-shrink-0">
          {/* Preset Buttons */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 flex-shrink-0">
            <h2 className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>One-Click Test Presets</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Scenarios A-D</span>
            </h2>
            <div className="space-y-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDispatchStructured(p.sku_id, p.qty, p.budget_inr, p.label)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-xl border border-slate-200/80 hover:border-[#0C8CE9] hover:bg-blue-50/50 transition-all group flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 group-hover:text-[#0C8CE9] transition-colors">{p.label}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">SKU: {p.sku_id} | Qty: {p.qty} | Budget: ₹{p.budget_inr.toLocaleString('en-IN')}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.color}`}>
                    {p.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Structured Custom Input Harness Control Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex-1 flex flex-col justify-between min-h-0">
            <div className="space-y-2">
              <h2 className="font-bold text-slate-900 text-sm flex items-center justify-between">
                <span>Structured Custom Input Harness</span>
                <span className="text-[10px] font-mono bg-blue-50 text-[#0C8CE9] px-2 py-0.5 rounded-full font-bold border border-blue-200">Fail-Safe</span>
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Test any custom catalog product against live guardrails. Structured inputs bypass free-text intent parsing and dispatch directly to the A2A negotiation gateway.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs font-mono text-slate-600">
              <div className="flex justify-between">
                <span>Live Catalog SKUs:</span>
                <span className="font-bold text-slate-900">{catalog.length} Available</span>
              </div>
              <div className="flex justify-between">
                <span>Execution Mode:</span>
                <span className="font-bold text-emerald-600">Direct /negotiate API</span>
              </div>
            </div>

            <button
              onClick={() => {
                fetchCatalog();
                setCustomError(null);
                setIsCustomModalOpen(true);
              }}
              disabled={loading}
              className="w-full bg-[#0C8CE9] hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span>+ Custom Input</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Handshake Protocol Feed (7 Cols - Bounded Scrollable Container) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col min-h-0 overflow-hidden">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 flex-shrink-0">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">A2A Handshake Protocol Feed</h2>
              <p className="text-xs text-slate-500">Live JSON stream: Mandate → Gateway Negotiation → Razorpay Settlement</p>
            </div>
            <span className="text-xs font-mono text-[#0C8CE9] font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {handshakes.length} Handshakes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
            {handshakes.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl p-6">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">A2A</div>
                <div className="font-semibold text-sm text-slate-600">No Active Handshake Stream</div>
                <p className="text-xs max-w-sm">Click any scenario preset button or [+ Custom Input] on the left to trigger the full A2A negotiation cycle.</p>
              </div>
            ) : (
              handshakes.map((hs) => (
                <div key={hs.id} className="bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                  {/* Step Header */}
                  <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500 font-medium">{hs.timestamp}</span>
                    <span className="font-bold text-slate-800">{hs.prompt}</span>
                  </div>

                  {/* Step Content */}
                  <div className="p-4 space-y-3 text-xs font-mono">
                    {hs.error ? (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 font-sans text-xs">
                        ⚠ Error: {hs.error}
                      </div>
                    ) : !hs.trail ? (
                      <div className="p-3 bg-blue-50 text-[#0C8CE9] rounded-lg border border-blue-200 animate-pulse font-sans">
                        ⏳ Dispatching structured payload to Merchant Gateway...
                      </div>
                    ) : (
                      <>
                        {/* Confirmation Box */}
                        {hs.trail.interpreted_intent?.needs_confirmation_text && (
                          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-sans font-semibold text-xs flex items-center gap-2">
                            <span>💬</span>
                            <span>{hs.trail.interpreted_intent.needs_confirmation_text}</span>
                          </div>
                        )}

                        {/* Step 1: Structured Mandate */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-1">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Step 1: Structured Buyer Mandate Payload</div>
                          <div className="text-slate-800 font-semibold">
                            SKU: <span className="text-[#0C8CE9]">{hs.trail.matched_sku}</span> | 
                            Qty: <span className="text-slate-900 font-bold">{hs.trail.interpreted_intent?.items?.[0]?.qty}</span> | 
                            Offered Unit Price: <span className="text-emerald-700 font-bold">₹{hs.trail.offered_price_per_unit?.toLocaleString('en-IN')}</span> | 
                            Budget: <span className="text-emerald-700 font-bold">₹{hs.trail.interpreted_intent?.budget_cap_inr?.toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        {/* Step 2: Gateway Negotiation */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-1">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            Step 2: Merchant Gateway Negotiation (Matched: {hs.trail.matched_sku})
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              hs.trail.negotiation_result?.status === 'auto_approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : hs.trail.negotiation_result?.status === 'gated_pending_approval'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {hs.trail.negotiation_result?.status}
                            </span>
                            <span className="text-slate-700 font-sans font-medium">{hs.trail.negotiation_result?.reasoning}</span>
                          </div>
                          {hs.trail.negotiation_result?.counter_offer && (
                            <div className="text-rose-600 font-bold mt-1">
                              Counter-Offer: ₹{hs.trail.negotiation_result.counter_offer?.toLocaleString('en-IN')} / unit
                            </div>
                          )}
                          {hs.trail.negotiation_result?.suggested_alternative && (
                            <div className="text-amber-700 font-bold mt-1">
                              Suggested Alternative SKU: {hs.trail.negotiation_result.suggested_alternative}
                            </div>
                          )}
                        </div>

                        {/* Step 3: Razorpay Order Settlement */}
                        {hs.trail.order_result && (
                          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Step 3: Order Settlement Record</div>
                            <div className="text-emerald-900 font-bold">
                              Order ID: {hs.trail.order_result.order_id} | Status: {hs.trail.order_result.status}
                            </div>
                            <div className="text-emerald-800 text-[11px]">
                              Total Settled: ₹{hs.trail.order_result.amount_inr?.toLocaleString('en-IN')}
                            </div>
                          </div>
                        )}

                        {/* Raw JSON Accordion */}
                        <details className="mt-2 text-[11px] text-slate-500">
                          <summary className="cursor-pointer font-sans font-semibold hover:text-[#0C8CE9]">Inspect Complete Raw Protocol Handshake JSON</summary>
                          <div className="bg-[#0B1E36] text-blue-300 p-3 rounded-lg mt-2 overflow-x-auto border border-slate-800">
                            <pre>{JSON.stringify(hs.trail, null, 2)}</pre>
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Structured Custom Input Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Custom Structured Test Input</h3>
                <p className="text-xs text-slate-500 mt-0.5">Dispatches structured payload directly to /negotiate</p>
              </div>
              <button
                onClick={() => {
                  setIsCustomModalOpen(false);
                  setCustomError(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {customError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200 flex items-start gap-2">
                <span className="text-rose-500 font-bold text-sm">⚠</span>
                <div>{customError}</div>
              </div>
            )}

            <div className="space-y-4 text-xs font-sans">
              <div>
                <label className="text-slate-700 font-semibold block mb-1.5">Product Name (Live Catalog SKU) *</label>
                <select
                  value={customForm.sku_id}
                  onChange={(e) => setCustomForm({ ...customForm, sku_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                >
                  {catalog.map(item => (
                    <option key={item.sku_id} value={item.sku_id}>
                      {item.sku_id} - {item.name} ({item.category} | Stock: {item.stock_qty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1.5">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={customForm.qty || ""}
                    onChange={(e) => setCustomForm({ ...customForm, qty: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1.5">Target Budget (INR) *</label>
                  <input
                    type="number"
                    min="1"
                    value={customForm.budget_inr || ""}
                    onChange={(e) => setCustomForm({ ...customForm, budget_inr: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                  />
                </div>
              </div>

              {customForm.sku_id && customForm.qty > 0 && customForm.budget_inr > 0 && (
                <div className="p-3 bg-blue-50/70 text-slate-700 rounded-xl border border-blue-200/80 text-[11px] font-mono space-y-1">
                  <div className="font-bold text-[#0C8CE9]">Payload Summary:</div>
                  <div>Proposed Unit Price: ₹{(Math.round((customForm.budget_inr / customForm.qty) * 100) / 100).toLocaleString('en-IN')} / unit</div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom_simulate_fail"
                  checked={customSimulateFail}
                  onChange={(e) => setCustomSimulateFail(e.target.checked)}
                  className="w-4 h-4 text-[#0C8CE9] rounded border-slate-300 focus:ring-[#0C8CE9] cursor-pointer"
                />
                <label htmlFor="custom_simulate_fail" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Simulate Payment Decline (Test Edge Case)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsCustomModalOpen(false);
                  setCustomError(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTestCustomInput}
                className="bg-[#0C8CE9] hover:bg-blue-600 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors shadow-sm"
              >
                Test Custom Input 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
