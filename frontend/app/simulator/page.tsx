"use client";

import React, { useState } from "react";

const API_BASE = "http://localhost:8000";

interface HistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface HandshakeStep {
  id: string;
  timestamp: string;
  prompt: string;
  trail?: any;
  error?: string;
}

export default function BuyerSimulatorPage() {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [handshakes, setHandshakes] = useState<HandshakeStep[]>([]);
  const [loading, setLoading] = useState(false);

  const presets = [
    {
      id: "A",
      label: "Scenario A: Bulk Optimal",
      prompt: "buy me 2 chairs under 16k",
      badge: "Auto-Approve",
      color: "bg-[#0C8CE9] text-white"
    },
    {
      id: "B",
      label: "Scenario B: High-Value Bundle",
      prompt: "buy me 1 conference table under 38k",
      badge: "High Value",
      color: "bg-emerald-600 text-white"
    },
    {
      id: "C",
      label: "Scenario C: Margin Breach",
      prompt: "buy me 2 chairs under 2k",
      badge: "Refused",
      color: "bg-rose-600 text-white"
    },
    {
      id: "D",
      label: "Scenario D: Partial Stock",
      prompt: "buy me 2 executive high-back chairs",
      badge: "Alternative",
      color: "bg-amber-600 text-white"
    }
  ];

  const handleSendMission = async (textToSend?: string) => {
    const query = textToSend !== undefined ? textToSend : message;
    if (!query.trim() || loading) return;

    setLoading(true);
    const timeStr = new Date().toLocaleTimeString();

    const newStepId = Date.now().toString();
    const newStep: HandshakeStep = {
      id: newStepId,
      timestamp: timeStr,
      prompt: query
    };

    setHandshakes(prev => [newStep, ...prev]);

    try {
      const res = await fetch(`${API_BASE}/buyer/mission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: history
        })
      });

      const data = await res.json();
      if (data.status === "success" && data.handshake_trail) {
        const trail = data.handshake_trail;
        const confirmText = trail.interpreted_intent?.needs_confirmation_text || "Understood: Mission received.";
        
        setHandshakes(prev => prev.map(item => item.id === newStepId ? { ...item, trail } : item));

        setHistory(prev => [
          ...prev,
          { role: "user", content: query },
          { role: "assistant", content: confirmText }
        ]);
      } else {
        setHandshakes(prev => prev.map(item => item.id === newStepId ? { ...item, error: data.message || "Execution error" } : item));
      }
    } catch (e: any) {
      setHandshakes(prev => prev.map(item => item.id === newStepId ? { ...item, error: e.message || "Failed to reach backend" } : item));
    } finally {
      setLoading(false);
      setMessage("");
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    setHandshakes([]);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#0B1E36] text-white px-8 py-5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0C8CE9] flex items-center justify-center font-bold text-white shadow-sm text-sm">
            R
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-none">
              Buyer Agent Protocol Simulator
            </h1>
            <p className="text-xs text-blue-300 font-medium mt-1">
              Natural Language Mission Client → Merchant Agent Gateway
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

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Column: Preset Controls & Mission Input (5 Cols) */}
        <div className="lg:col-span-5 space-y-5 flex flex-col">
          {/* Preset Buttons */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>One-Click Test Presets</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Scenarios A-D</span>
            </h2>
            <div className="space-y-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSendMission(p.prompt)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-xl border border-slate-200/80 hover:border-[#0C8CE9] hover:bg-blue-50/50 transition-all group flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 group-hover:text-[#0C8CE9] transition-colors">{p.label}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">"{p.prompt}"</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.color}`}>
                    {p.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Natural Language Mission Input Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <h2 className="font-bold text-slate-900 text-sm">Custom Mission & Follow-up Prompt</h2>
              <p className="text-xs text-slate-500">
                Type any custom or typo'd mission (e.g. "buy 2 chaisr under 2k") or follow-up ("instead of chairs, buy tables").
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g., buy 2 chairs under 16k or follow-up instead of those chairs..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#0C8CE9]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMission();
                  }
                }}
              />
            </div>

            <div className="pt-2 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Press Enter or click Dispatch</span>
              <button
                onClick={() => handleSendMission()}
                disabled={loading || !message.trim()}
                className="bg-[#0C8CE9] hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
              >
                {loading ? "Dispatching..." : "Dispatch Mission 🚀"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Handshake Protocol Feed (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col min-h-0 overflow-hidden">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">A2A Handshake Protocol Feed</h2>
              <p className="text-xs text-slate-500">Live JSON stream: Prompt → Intent → Gateway → Razorpay Order</p>
            </div>
            <span className="text-xs font-mono text-[#0C8CE9] font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {handshakes.length} Handshakes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {handshakes.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl p-6">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">A2A</div>
                <div className="font-semibold text-sm text-slate-600">No Active Handshake Stream</div>
                <p className="text-xs max-w-sm">Click any scenario button on the left or type a custom prompt to trigger the full A2A negotiation cycle.</p>
              </div>
            ) : (
              handshakes.map((hs) => (
                <div key={hs.id} className="bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                  {/* Step Header */}
                  <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500 font-medium">{hs.timestamp}</span>
                    <span className="font-bold text-slate-800">Prompt: "{hs.prompt}"</span>
                  </div>

                  {/* Step Content */}
                  <div className="p-4 space-y-3 text-xs font-mono">
                    {hs.error ? (
                      <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 font-sans text-xs">
                        ⚠ Error: {hs.error}
                      </div>
                    ) : !hs.trail ? (
                      <div className="p-3 bg-blue-50 text-[#0C8CE9] rounded-lg border border-blue-200 animate-pulse font-sans">
                        ⏳ Dispatching to Gemini Buyer Agent & Merchant Gateway...
                      </div>
                    ) : (
                      <>
                        {/* Confirmation Box */}
                        {hs.trail.interpreted_intent?.needs_confirmation_text && (
                          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-sans font-semibold text-xs">
                            💬 {hs.trail.interpreted_intent.needs_confirmation_text}
                          </div>
                        )}

                        {/* Step 1: Interpreted Intent */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-1">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Step 1: LLM Intent Parsing</div>
                          <div className="text-slate-800 font-semibold">
                            SKU Guess: <span className="text-[#0C8CE9]">{hs.trail.interpreted_intent?.items?.[0]?.sku_guess}</span> | 
                            Qty: <span className="text-slate-900 font-bold">{hs.trail.interpreted_intent?.items?.[0]?.qty}</span> | 
                            Budget: <span className="text-emerald-700 font-bold">₹{hs.trail.interpreted_intent?.budget_cap_inr}</span>
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
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {hs.trail.negotiation_result?.status}
                            </span>
                            <span className="text-slate-700 font-sans font-medium">{hs.trail.negotiation_result?.reasoning}</span>
                          </div>
                          {hs.trail.negotiation_result?.counter_offer && (
                            <div className="text-rose-600 font-bold mt-1">
                              Counter-Offer: ₹{hs.trail.negotiation_result.counter_offer} / unit
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
                            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Step 3: Razorpay Order Settlement</div>
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
    </div>
  );
}
