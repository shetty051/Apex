"use client";

import React from "react";

export default function BuyerSimulatorPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0C8CE9] flex items-center justify-center font-bold text-white text-base shadow-sm">
              R
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Razorpay Buyer Simulator</h1>
              <p className="text-xs text-slate-500">Autonomous A2A Negotiation & Payment Protocol Client</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            A2A Client Online
          </span>
        </div>

        {/* Content Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Interactive Mission Console</h2>
          <p className="text-sm text-slate-600">
            This simulator allows you to issue free-text procurement missions to the Gemini Buyer Agent, which autonomously negotiates with the Merchant Gateway and executes Razorpay transactions.
          </p>

          <div className="bg-[#0B1E36] text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-slate-800">
            <div className="text-blue-300">// Sample A2A Handshake JSON Payload Structure</div>
            <pre className="mt-2 text-emerald-400">
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
