"use client";

import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE = "http://localhost:8000";

export default function MerchantHub() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "orders" | "logs" | "settings">("home");

  // Live state from backend
  const [catalog, setCatalog] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [guardrails, setGuardrails] = useState({ margin_floor_pct: 20, max_discount_pct: 15, approval_gate_inr: 50000 });
  const [logFilter, setLogFilter] = useState<"all" | "discount" | "gated" | "failure">("all");

  // Modals & Drawers
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Form state for Settings
  const [formGuardrails, setFormGuardrails] = useState({ margin_floor_pct: 20, max_discount_pct: 15, approval_gate_inr: 50000 });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Fetch data periodically
  const fetchData = async () => {
    try {
      const [catRes, guardRes, ordRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/catalog`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/guardrails`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/orders`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/logs?type=${logFilter}`).then(r => r.ok ? r.json() : [])
      ]);

      if (Array.isArray(catRes)) setCatalog(catRes);
      if (guardRes) {
        setGuardrails(guardRes);
        setFormGuardrails(prev => (prev.margin_floor_pct === guardRes.margin_floor_pct && prev.max_discount_pct === guardRes.max_discount_pct && prev.approval_gate_inr === guardRes.approval_gate_inr) ? prev : guardRes);
      }
      if (Array.isArray(ordRes)) setOrders(ordRes);
      if (Array.isArray(logsRes)) setLogs(logsRes);
    } catch (e) {
      console.error("Error fetching live backend data:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [logFilter]);

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
    : "42.5";

  // Revenue trend data for Recharts
  const chartData = orders.map((o, idx) => ({
    name: `Order #${idx + 1}`,
    amount: o.amount_inr || 0,
    sku: o.sku_id
  }));

  if (chartData.length === 0) {
    chartData.push(
      { name: "09:00 AM", amount: 16000, sku: "CHAIR-001" },
      { name: "11:30 AM", amount: 38000, sku: "TABLE-001" },
      { name: "02:15 PM", amount: 24000, sku: "STORE-001" }
    );
  }

  // Save Guardrails
  const handleSaveGuardrails = async () => {
    try {
      const res = await fetch(`${API_BASE}/guardrails`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formGuardrails)
      });
      if (res.ok) {
        const updated = await res.json();
        setGuardrails(updated);
        setSaveStatus("Guardrails updated successfully!");
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (e) {
      setSaveStatus("Failed to update guardrails.");
    }
  };

  // Reset Demo
  const handleResetDemo = async () => {
    try {
      await fetch(`${API_BASE}/reset-demo`, { method: "POST" });
      fetchData();
      alert("Demo state has been reset to seed catalog!");
    } catch (e) {
      alert("Failed to reset demo state.");
    }
  };

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
                  R
                </div>
                <div>
                  <span className="font-bold text-base tracking-tight text-white block leading-none">
                    Razorpay Apex
                  </span>
                  <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider block mt-1">
                    Merchant Hub
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 mx-auto rounded-lg bg-[#0C8CE9] flex items-center justify-center font-bold text-white text-sm shadow-sm">
                R
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
                onClick={() => setActiveTab(tab.id as any)}
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
                      <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} />
                      <Area type="monotone" dataKey="amount" stroke="#0C8CE9" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
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
                            (item.stock_qty ?? item.stock) <= 5 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {item.stock_qty ?? item.stock} in stock {(item.stock_qty ?? item.stock) <= 5 ? '(Low)' : ''}
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
                            <button
                              onClick={() => setSelectedOrder(ord)}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-md transition-colors"
                            >
                              Inspect JSON
                            </button>
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
                        onClick={() => setLogFilter(f.id as any)}
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
                      No logs found for filter '{logFilter}'.
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
                    <span className="font-mono text-sm font-bold text-[#0C8CE9]">{formGuardrails.margin_floor_pct}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={formGuardrails.margin_floor_pct}
                    onChange={e => setFormGuardrails({ ...formGuardrails, margin_floor_pct: Number(e.target.value) })}
                    className="w-full accent-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Offers resulting in a gross margin below this threshold will be refused.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Max Discount Cap (%):</label>
                    <span className="font-mono text-sm font-bold text-[#0C8CE9]">{formGuardrails.max_discount_pct}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={formGuardrails.max_discount_pct}
                    onChange={e => setFormGuardrails({ ...formGuardrails, max_discount_pct: Number(e.target.value) })}
                    className="w-full accent-[#0C8CE9]"
                  />
                  <p className="text-xs text-slate-500">Maximum allowable discount relative to retail price.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Approval Gate Threshold (INR):</label>
                  <input
                    type="number"
                    value={formGuardrails.approval_gate_inr}
                    onChange={e => setFormGuardrails({ ...formGuardrails, approval_gate_inr: Number(e.target.value) })}
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
                    onClick={handleResetDemo}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium py-2.5 px-5 rounded-lg text-sm transition-all"
                  >
                    Reset Demo State
                  </button>
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
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Audit Event Trace</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500 text-xs uppercase font-semibold">Decision:</span>
                <p className="font-bold text-slate-900">{selectedLog.decision}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase font-semibold">Reasoning:</span>
                <p className="text-slate-800">{selectedLog.reasoning}</p>
              </div>
              {selectedLog.buyer_prompt && (
                <div>
                  <span className="text-slate-500 text-xs uppercase font-semibold">Buyer Prompt:</span>
                  <p className="text-slate-800 italic">"{selectedLog.buyer_prompt}"</p>
                </div>
              )}
              <div className="bg-[#0B1E36] text-blue-300 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-64">
                <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="bg-slate-900 text-white text-xs font-semibold py-2 px-4 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
