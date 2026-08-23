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
    <div className="flex h-screen bg-[#F8F9FA] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-slate-200/80 transition-all duration-300 flex flex-col justify-between z-20 shadow-sm`}
      >
        <div>
          {/* Logo & Toggle */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            {sidebarOpen ? (
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-lime-500 flex items-center justify-center font-bold text-slate-950 shadow-sm shadow-lime-500/30 text-sm">
                  A2A
                </div>
                <div>
                  <span className="font-bold text-base tracking-tight text-slate-900 block leading-none">
                    Apex Merchant
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-1">
                    Hub Dashboard
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-9 h-9 mx-auto rounded-xl bg-lime-500 flex items-center justify-center font-bold text-slate-950 text-sm shadow-sm">
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-900 font-semibold shadow-xs"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
                title={!sidebarOpen ? tab.label : undefined}
              >
                <svg className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Simulator Button */}
        <div className="p-3 border-t border-slate-100">
          <a
            href="/simulator"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-600 text-slate-950 font-semibold rounded-xl py-3 px-4 shadow-sm shadow-lime-500/20 text-sm transition-all"
          >
            <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {sidebarOpen && <span>Launch Buyer Simulator</span>}
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
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
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-lime-50 text-lime-800 border border-lime-200">
              <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
              FastAPI Node Active (Port 8000)
            </span>
          </div>
        </header>

        {/* View Contents */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "home" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Seed SKUs</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">12</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                    In-Memory Store
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Margin Floor</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">20%</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-lime-50 text-lime-800 border border-lime-200">
                    Guardrail Enforced
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Approval Gate</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">₹50,000</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Human Gate Threshold
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200/60">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payment Gateway</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">Razorpay</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                    Test Mode Connected
                  </div>
                </div>
              </div>

              {/* Seed Catalog Table */}
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Catalog Preview</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Seed B2B inventory items with automated pricing guardrails</p>
                  </div>
                  <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">Showing top SKUs</span>
                </div>
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 text-slate-500 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-100">
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
                    {mockCatalog.map((item) => (
                      <tr key={item.sku_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">{item.sku_id}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">{item.name}</td>
                        <td className="px-5 py-4 text-slate-500 text-xs font-medium">{item.category}</td>
                        <td className="px-5 py-4 text-slate-500 font-mono text-xs">₹{item.wholesale.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-4 text-slate-900 font-mono text-xs font-bold">₹{item.retail.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            item.stock <= 5 
                              ? 'bg-rose-50 text-rose-700 border-rose-200/60' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          }`}>
                            {item.stock} in stock {item.stock <= 5 ? '(Low)' : ''}
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
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-white">
                  <h2 className="font-bold text-slate-900 text-base">Live Orders & Transactions</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time Razorpay order creation and capture records</p>
                </div>
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50/80 text-slate-500 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Order ID</th>
                      <th className="px-5 py-3.5">SKU ID</th>
                      <th className="px-5 py-3.5">Qty</th>
                      <th className="px-5 py-3.5">Total Amount</th>
                      <th className="px-5 py-3.5">Evaluation</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mockOrders.map((ord) => (
                      <tr key={ord.order_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-500">{ord.order_id}</td>
                        <td className="px-5 py-4 font-bold text-slate-900">{ord.sku_id}</td>
                        <td className="px-5 py-4 text-slate-600 font-medium">{ord.qty}</td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">₹{ord.amount.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-lime-50 text-lime-800 border border-lime-200">
                            {ord.decision}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            ord.status === 'captured'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                              : 'bg-amber-50 text-amber-700 border-amber-200/60'
                          }`}>
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
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Audit Trail & Chain-of-Thought</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Structured logging stream for all negotiation and order events</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold">All</button>
                    <button className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200">Failures</button>
                    <button className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200">Gated</button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {mockLogs.map((log, index) => (
                    <div key={index} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-400 font-medium">{log.timestamp}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          log.decision === 'auto_approved'
                            ? 'bg-lime-50 text-lime-800 border-lime-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200/60'
                        }`}>
                          {log.decision}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{log.reasoning}</p>
                      <div className="text-xs font-mono text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
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
              <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg border-b border-slate-100 pb-3">Guardrail Engine Configuration</h2>
                  <p className="text-xs text-slate-500 mt-2">Adjust deterministic business rules governing AI negotiation decisions</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Margin Floor (%):</label>
                  <input type="number" defaultValue={20} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" />
                  <p className="text-xs text-slate-500">Offers resulting in a gross margin below this threshold will be automatically refused.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Max Discount Cap (%):</label>
                  <input type="number" defaultValue={15} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" />
                  <p className="text-xs text-slate-500">Maximum allowable discount relative to retail price.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Approval Gate Threshold (INR):</label>
                  <input type="number" defaultValue={50000} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" />
                  <p className="text-xs text-slate-500">Order totals exceeding this amount require human approval regardless of margin health.</p>
                </div>

                <button className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-5 rounded-xl text-sm transition-all shadow-sm">
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
