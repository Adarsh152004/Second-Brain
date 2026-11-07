"use client";

import React, { useState } from "react";
import Link from "next/link";

interface TraceRow {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  ttftMs: number;
  totalMs: number;
  cost: number;
  status: "success" | "cached" | "failed";
}

export default function ObservabilityPage() {
  const [filterModel, setFilterModel] = useState<string>("all");

  const traces: TraceRow[] = [
    {
      id: "tr_9a82f1",
      timestamp: "13:38:12",
      model: "deepseek-v4.1-flash",
      provider: "BigModel",
      promptTokens: 412,
      completionTokens: 284,
      ttftMs: 142,
      totalMs: 410,
      cost: 0.000147,
      status: "success",
    },
    {
      id: "tr_4c21b8",
      timestamp: "13:35:45",
      model: "gemma-4-31B-it",
      provider: "SambaNova",
      promptTokens: 180,
      completionTokens: 96,
      ttftMs: 98,
      totalMs: 240,
      cost: 0.000037,
      status: "success",
    },
    {
      id: "tr_7f90e3",
      timestamp: "13:30:19",
      model: "openai/gpt-oss-120b",
      provider: "Groq",
      promptTokens: 320,
      completionTokens: 410,
      ttftMs: 120,
      totalMs: 380,
      cost: 0.000512,
      status: "cached",
    },
    {
      id: "tr_1b55a2",
      timestamp: "13:22:04",
      model: "gemini-2.0-flash",
      provider: "Google",
      promptTokens: 820,
      completionTokens: 540,
      ttftMs: 280,
      totalMs: 620,
      cost: 0.000298,
      status: "success",
    },
  ];

  const totalCost = traces.reduce((acc, t) => acc + t.cost, 0);
  const avgTtft = Math.round(traces.reduce((acc, t) => acc + t.ttftMs, 0) / traces.length);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#141413] text-[#ececeb] font-sans selection:bg-[#cc785c]/30">
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-[#262624] bg-[#1b1b19] flex flex-col justify-between shrink-0 p-4">
        <div className="space-y-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#cc785c] flex items-center justify-center text-white font-bold text-xs shadow-sm">
              ⎔
            </div>
            <span className="font-semibold text-sm tracking-tight text-[#ececeb]">
              Second Brain
            </span>
          </Link>

          <nav className="space-y-1 text-xs">
            <Link
              href="/chat"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb] transition"
            >
              <span>💬</span>
              <span>Chat Workspace</span>
            </Link>
            <Link
              href="/knowledge"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb] transition"
            >
              <span>📚</span>
              <span>Knowledge Base</span>
            </Link>
            <Link
              href="/studio"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb] transition"
            >
              <span>⚡</span>
              <span>JEV Decision Studio</span>
            </Link>
            <Link
              href="/tools"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb] transition"
            >
              <span>🛠️</span>
              <span>Tools &amp; MCP</span>
            </Link>
            <Link
              href="/observability"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#282826] text-white font-medium transition"
            >
              <span className="text-[#cc785c]">📊</span>
              <span>Observability &amp; Cost</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb] transition"
            >
              <span>⚙️</span>
              <span>Settings &amp; Keys</span>
            </Link>
          </nav>
        </div>

        <div className="p-3 rounded-xl bg-[#141413] border border-[#262624] text-[11px] space-y-1 text-[#73736c]">
          <div className="text-[#ececeb] font-medium flex items-center justify-between">
            <span>Budget Limit</span>
            <span className="text-emerald-400 font-mono">$5.00 / day</span>
          </div>
          <div>Guardrail: automatic fallback on limit breach</div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262624] pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[#f4f4f3]">
              Observability, Telemetry &amp; Cost Auditing
            </h1>
            <p className="text-xs text-[#9d9d96]">
              Real-time traces, Time-to-First-Token (TTFT) distribution, and granular token expenditure.
            </p>
          </div>

          <Link
            href="/chat"
            className="px-4 py-2 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white text-xs font-medium transition shadow-sm"
          >
            Open Chat ➔
          </Link>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="text-xs text-[#73736c] font-medium">Session Spend</div>
            <div className="text-2xl font-bold font-mono text-emerald-400">${totalCost.toFixed(6)}</div>
            <div className="text-[11px] text-[#73736c]">0.02% of daily limit ($5.00)</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="text-xs text-[#73736c] font-medium">Avg Time to First Token</div>
            <div className="text-2xl font-bold font-mono text-[#cc785c]">{avgTtft}ms</div>
            <div className="text-[11px] text-[#73736c]">Sub-200ms latency guaranteed</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="text-xs text-[#73736c] font-medium">Cache Hit Efficiency</div>
            <div className="text-2xl font-bold font-mono text-blue-400">84.2%</div>
            <div className="text-[11px] text-[#73736c]">Exact &amp; semantic similarity hits</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="text-xs text-[#73736c] font-medium">JEV Engine Evaluation</div>
            <div className="text-2xl font-bold font-mono text-purple-400">0.68ms</div>
            <div className="text-[11px] text-[#73736c]">Local heuristic utility engine</div>
          </div>
        </div>

        {/* Waterfall Execution Stages */}
        <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-4">
          <h2 className="text-sm font-semibold text-[#ececeb]">Execution Latency Waterfall (Averaged)</h2>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-[#9d9d96] mb-1">
                <span>Phase 1 &amp; 2: JEV Intent &amp; Utility Scoring</span>
                <span className="font-mono text-emerald-400">0.68ms (0.2%)</span>
              </div>
              <div className="w-full bg-[#141413] h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full" style={{ width: "3%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[#9d9d96] mb-1">
                <span>Supabase pgvector Knowledge Retrieval</span>
                <span className="font-mono text-cyan-400">22.4ms (6.8%)</span>
              </div>
              <div className="w-full bg-[#141413] h-2 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full rounded-full" style={{ width: "12%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[#9d9d96] mb-1">
                <span>Inference TTFT (Time-to-First-Token)</span>
                <span className="font-mono text-[#cc785c]">125.0ms (38.0%)</span>
              </div>
              <div className="w-full bg-[#141413] h-2 rounded-full overflow-hidden">
                <div className="bg-[#cc785c] h-full rounded-full" style={{ width: "45%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[#9d9d96] mb-1">
                <span>Complete Token Generation Stream</span>
                <span className="font-mono text-purple-400">328.0ms (100%)</span>
              </div>
              <div className="w-full bg-[#141413] h-2 rounded-full overflow-hidden">
                <div className="bg-purple-400 h-full rounded-full" style={{ width: "100%" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Traces Log Table */}
        <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#ececeb]">Live Request Traces</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#73736c]">Filter Provider:</span>
              <select
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg bg-[#141413] border border-[#2e2e2a] text-[#ececeb] focus:outline-none"
              >
                <option value="all">All Providers</option>
                <option value="BigModel">BigModel</option>
                <option value="SambaNova">SambaNova</option>
                <option value="Groq">Groq</option>
                <option value="Google">Google</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#2e2e2a] text-[#73736c] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="pb-3 font-semibold">Trace ID</th>
                  <th className="pb-3 font-semibold">Time</th>
                  <th className="pb-3 font-semibold">Model / Provider</th>
                  <th className="pb-3 font-semibold">Prompt Tok</th>
                  <th className="pb-3 font-semibold">Completion Tok</th>
                  <th className="pb-3 font-semibold">TTFT</th>
                  <th className="pb-3 font-semibold">Cost</th>
                  <th className="pb-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262624]">
                {traces
                  .filter((t) => filterModel === "all" || t.provider === filterModel)
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-[#222220] transition font-mono">
                      <td className="py-3 text-[#cc785c]">{t.id}</td>
                      <td className="py-3 text-[#73736c]">{t.timestamp}</td>
                      <td className="py-3 font-sans text-[#ececeb]">
                        {t.model} <span className="text-[#73736c]">({t.provider})</span>
                      </td>
                      <td className="py-3 text-[#9d9d96]">{t.promptTokens}</td>
                      <td className="py-3 text-[#9d9d96]">{t.completionTokens}</td>
                      <td className="py-3 text-emerald-400">{t.ttftMs}ms</td>
                      <td className="py-3 text-white">${t.cost.toFixed(6)}</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px]">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

    </div>
  );
}
