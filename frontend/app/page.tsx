"use client";

import React, { useState } from "react";

export default function MerchantHub() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "orders" | "logs" | "settings">("home");

  // Mock catalog data for shell
  const mockCatalog = [
    { sku_id: "CHAIR-001", name: "Ergonomic Mesh Executive Chair", category: "Seating", wholesale: 4000, retail: 8500, stock: 50 },
    { sku_id: "CHAIR-003", name: "Executive Leather High-Back Chair", category: "Seating", wholesale: 7000, retail: 13500, stock: 1 },
    { sku_id: "TABLE-001", name: "Modular 8-Seater Conference Table", category: "Meeting Room", wholesale: 24000, retail: 42000, stock: 6 },
    { sku_id: "MAT-001", name: "Anti-Fatigue Ergonomic Standing Mat", category: "Accessories", wholesale: 900, retail: 1800, stock: 45 },
  ];

  // Mock orders data for shell
  const mockOrders = [
    { order_id: "order_TTD53Di8PhiBTp", sku_id: "CHAIR-001", qty: 2, amount: 16000, status: "captured", decision: "auto_approved" },
    { order_id: "order_TTD6slzfUDLj6x", sku_id: "TABLE-001", qty: 1, amount: 38000, status: "captured", decision: "auto_approved" },
    { order_id: "order_TTBYyLP3aSCQgD", sku_id: "CHAIR-001", qty: 1, amount: 8000, status: "PAYMENT_RECOVERY_REQUIRED", decision: "auto_approved" },
  ];

  // Mock logs data for shell
  const mockLogs = [
    { timestamp: "2026-08-23T17:54:01Z", decision: "auto_approved", reasoning: "Offer meets all automatic approval criteria.", math: "₹8,000 / unit (Qty: 2)" },
    { timestamp: "2026-08-23T17:54:21Z", decision: "refused", reasoning: "Offer refused (margin too low and discount too high). Acceptable price is ₹7225.0 or higher.", math: "₹1,000 / unit (Qty: 2)" },
    { timestamp: "2026-08-23T17:55:36Z", decision: "refused_insufficient_stock", reasoning: "Requested quantity 2 exceeds available stock (1). Suggested: CHAIR-001", math: "Stock check failed" },
  ];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-slate-950 border-r border-slate-800 transition-all duration-300 flex flex-col justify-between z-20`}
      >
        <div>
          {/* Logo & Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
                  A2A
                </div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Apex Merchant
                </span>
              </div>
            ) : (
              <div className="w-8 h-8 mx-auto rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">
                A2A
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {[
              { id: "home", label: "Dashboard & Catalog", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
              { id: "orders", label: "Live Orders", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
              { id: "logs", label: "Audit Logs", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
              { id: "settings", label: "Guardrails Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
                title={!sidebarOpen ? tab.label : undefined}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Simulator Button */}
        <div className="p-3 border-t border-slate-800">
          <a
            href="/simulator"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 px-3 rounded-lg text-sm font-semibold shadow-lg shadow-emerald-950 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {sidebarOpen && <span>Launch Buyer Simulator</span>}
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-200 capitalize">
              {activeTab === "home" ? "Dashboard & Catalog" : activeTab === "orders" ? "Live Orders" : activeTab === "logs" ? "Audit Trail & Logs" : "Guardrails Engine Settings"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              FastAPI Node Active
            </span>
          </div>
        </header>

        {/* View Contents */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "home" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <div className="text-sm font-medium text-slate-400">Total Seed SKUs</div>
                  <div className="text-3xl font-bold text-slate-100 mt-2">12</div>
                  <div className="text-xs text-emerald-400 mt-1">In-Memory Store</div>
                </div>
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <div className="text-sm font-medium text-slate-400">Margin Floor</div>
                  <div className="text-3xl font-bold text-slate-100 mt-2">20%</div>
                  <div className="text-xs text-indigo-400 mt-1">Guardrail Enforced</div>
                </div>
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <div className="text-sm font-medium text-slate-400">Approval Gate</div>
                  <div className="text-3xl font-bold text-slate-100 mt-2">₹50,000</div>
                  <div className="text-xs text-amber-400 mt-1">Human Gate Threshold</div>
                </div>
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <div className="text-sm font-medium text-slate-400">Active Payment Provider</div>
                  <div className="text-3xl font-bold text-slate-100 mt-2">Razorpay</div>
                  <div className="text-xs text-teal-400 mt-1">Test Mode Connected</div>
                </div>
              </div>

              {/* Seed Catalog Table */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                  <h2 className="font-semibold text-slate-200">Catalog Preview</h2>
                  <span className="text-xs text-slate-400">Showing top SKUs</span>
                </div>
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">SKU ID</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Wholesale</th>
                      <th className="p-3">Retail</th>
                      <th className="p-3">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mockCatalog.map((item) => (
                      <tr key={item.sku_id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-mono text-indigo-400 font-medium">{item.sku_id}</td>
                        <td className="p-3 font-medium text-slate-200">{item.name}</td>
                        <td className="p-3 text-slate-400">{item.category}</td>
                        <td className="p-3 text-slate-400">₹{item.wholesale}</td>
                        <td className="p-3 text-slate-200 font-semibold">₹{item.retail}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.stock <= 5 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-300'}`}>
                            {item.stock} {item.stock <= 5 ? '(Low Stock)' : ''}
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
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h2 className="font-semibold text-slate-200">Recent Orders & Transactions</h2>
                </div>
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3">Decision</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mockOrders.map((ord) => (
                      <tr key={ord.order_id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-mono text-xs text-slate-400">{ord.order_id}</td>
                        <td className="p-3 font-semibold text-slate-200">{ord.sku_id}</td>
                        <td className="p-3 text-slate-300">{ord.qty}</td>
                        <td className="p-3 font-semibold text-slate-100">₹{ord.amount}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {ord.decision}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ord.status === 'captured' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            {ord.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-6">
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                  <h2 className="font-semibold text-slate-200">Audit Stream</h2>
                  <div className="flex gap-2 text-xs">
                    <button className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-medium hover:bg-slate-700">All</button>
                    <button className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:bg-slate-800">Failures</button>
                    <button className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:bg-slate-800">Gated</button>
                  </div>
                </div>
                <div className="divide-y divide-slate-800">
                  {mockLogs.map((log, index) => (
                    <div key={index} className="p-4 hover:bg-slate-900/50 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-500">{log.timestamp}</span>
                        <span className={`px-2 py-0.5 rounded font-semibold ${log.decision === 'auto_approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {log.decision}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 font-medium">{log.reasoning}</p>
                      <div className="text-xs font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800">
                        {log.math}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6 max-w-2xl">
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-6">
                <h2 className="font-semibold text-slate-200 text-lg border-b border-slate-800 pb-3">Guardrail Engine Configuration</h2>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Margin Floor (%):</label>
                  <input type="number" defaultValue={20} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono" />
                  <p className="text-xs text-slate-500">Offers resulting in a gross margin below this threshold will be automatically refused.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Max Discount Cap (%):</label>
                  <input type="number" defaultValue={15} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono" />
                  <p className="text-xs text-slate-500">Maximum allowable discount relative to retail price.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Approval Gate Threshold (INR):</label>
                  <input type="number" defaultValue={50000} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono" />
                  <p className="text-xs text-slate-500">Order totals exceeding this amount require human approval regardless of margin health.</p>
                </div>

                <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-all shadow-lg shadow-indigo-950">
                  Save Guardrail Settings
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
