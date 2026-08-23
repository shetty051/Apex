"use client";

import React from "react";

export default function BuyerSimulatorPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500 flex items-center justify-center font-bold text-slate-950 text-base shadow-sm shadow-lime-500/20">
              A2A
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Buyer Agent Simulator</h1>
              <p className="text-xs text-slate-500">Autonomous A2A Negotiation & Order Protocol Client</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-lime-50 text-lime-800 text-xs font-semibold rounded-full border border-lime-200">
            <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
            A2A Client Ready
          </span>
        </div>

        {/* Content Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Interactive Mission Console</h2>
          <p className="text-sm text-slate-600">
            This simulator allows you to issue free-text procurement missions to the Gemini Buyer Agent, which autonomously negotiates with the Merchant Gateway and executes Razorpay transactions.
          </p>

          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800">
            <div className="text-slate-500">// Sample A2A Handshake JSON Payload Structure</div>
            <pre className="mt-2 text-lime-400">
{`{
  "buyer_prompt": "buy me 2 chairs under 16k",
  "interpreted_intent": { "sku_guess": "chair", "qty": 2, "budget_cap_inr": 16000 },
  "matched_sku": "CHAIR-001",
  "negotiation_result": { "status": "auto_approved" },
  "order_result": { "order_id": "order_TTD53Di8PhiBTp", "status": "captured" }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
