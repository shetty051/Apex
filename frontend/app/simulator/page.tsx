"use client";

import React from "react";

export default function BuyerSimulatorPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-slate-100">Buyer Protocol Simulator</h1>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
            A2A Client Ready
          </span>
        </div>
        <p className="text-slate-400">
          This is the standalone Buyer Agent Simulator interface. Next phase will wire real interactive chat & mission executions here!
        </p>
      </div>
    </div>
  );
}
