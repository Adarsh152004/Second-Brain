"use client";

import React, { useState } from "react";
import Link from "next/link";

interface ModelBenchmark {
  id: string;
  name: string;
  provider: string;
  latencyMs: number;
  costIn: number;
  costOut: number;
  reasoningScore: number;
  speedScore: number;
  contextWindow: string;
  status: "online" | "degraded";
}

export default function JevStudioPage() {
  const [wAcc, setWAcc] = useState(0.40);
  const [wSpd, setWSpd] = useState(0.30);
  const [wCst, setWCst] = useState(0.20);
  const [wFit, setWFit] = useState(0.10);

  const [testQuery, setTestQuery] = useState("Implement an async queue worker in Python with exponential backoff and PostgreSQL persistence.");
  const [rankedModels, setRankedModels] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const models: ModelBenchmark[] = [
    {
      id: "bigmodel",
      name: "DeepSeek V4.1 Flash",
      provider: "BigModel",
      latencyMs: 320,
      costIn: 0.15,
      costOut: 0.30,
      reasoningScore: 0.96,
      speedScore: 0.95,
      contextWindow: "128k",
      status: "online",
    },
    {
      id: "sambanova",
      name: "SambaNova Gemma 4",
      provider: "SambaNova RDU",
      latencyMs: 240,
      costIn: 0.10,
      costOut: 0.20,
      reasoningScore: 0.93,
      speedScore: 0.98,
      contextWindow: "64k",
      status: "online",
    },
    {
      id: "groq",
      name: "Groq Llama 3.3 70B",
      provider: "Groq LPU",
      latencyMs: 280,
      costIn: 0.59,
      costOut: 0.79,
      reasoningScore: 0.90,
      speedScore: 0.99,
      contextWindow: "128k",
      status: "online",
    },
    {
      id: "gemini",
      name: "Gemini 2.0 Flash",
      provider: "Google Vertex",
      latencyMs: 420,
      costIn: 0.10,
      costOut: 0.40,
      reasoningScore: 0.92,
      speedScore: 0.90,
      contextWindow: "1000k",
      status: "online",
    },
  ];

  // Calculate utility ranking based on weights
  const runSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const scored = models.map((m) => {
        // Utility formula: wAcc * reasoning + wSpd * speed + wCst * (1 - cost/max) + wFit * 0.95
        const costFactor = Math.max(0, 1 - (m.costIn + m.costOut) / 2.0);
        const utility = wAcc * m.reasoningScore + wSpd * m.speedScore + wCst * costFactor + wFit * 0.95;
        return {
          ...m,
          utility: utility.toFixed(4),
          confidence: (utility * 100).toFixed(1),
        };
      });

      scored.sort((a, b) => Number(b.utility) - Number(a.utility));
      setRankedModels(scored);
      setIsSimulating(false);
    }, 280);
  };

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
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#282826] text-white font-medium transition"
            >
              <span className="text-[#cc785c]">⚡</span>
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
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb] transition"
            >
              <span>📊</span>
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
            <span>Decision Model</span>
            <span className="text-emerald-400 font-mono">0.68ms</span>
          </div>
          <div>Expected Utility optimization active</div>
        </div>
      </aside>

      {/* MAIN STUDIO VIEW */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262624] pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[#f4f4f3]">
              Joint Expected Value (JEV) Decision Studio
            </h1>
            <p className="text-xs text-[#9d9d96]">
              Configure probabilistic utility weights, test dynamic routing curves, and benchmark inference backends.
            </p>
          </div>

          <button
            onClick={runSimulation}
            className="px-4 py-2 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white text-xs font-medium transition shadow-sm flex items-center gap-2"
          >
            <span>Run Routing Simulation</span>
            <span>➔</span>
          </button>
        </div>

        {/* 4 Interactive Weight Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-[#ececeb]">Accuracy (w_acc)</span>
              <span className="font-mono text-[#cc785c] font-semibold">{(wAcc * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={wAcc}
              onChange={(e) => setWAcc(parseFloat(e.target.value))}
              className="w-full accent-[#cc785c] cursor-pointer"
            />
            <p className="text-[11px] text-[#73736c]">Weight given to reasoning rigor, code correctness, and logic depth.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-[#ececeb]">Speed (w_spd)</span>
              <span className="font-mono text-emerald-400 font-semibold">{(wSpd * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={wSpd}
              onChange={(e) => setWSpd(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-[#73736c]">Weight given to Time-to-First-Token and token streaming throughput.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-[#ececeb]">Cost (w_cost)</span>
              <span className="font-mono text-blue-400 font-semibold">{(wCst * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={wCst}
              onChange={(e) => setWCst(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <p className="text-[11px] text-[#73736c]">Incentivizes selecting low-cost token pricing models when tasks allow.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-[#ececeb]">Context Fit (w_fit)</span>
              <span className="font-mono text-purple-400 font-semibold">{(wFit * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={wFit}
              onChange={(e) => setWFit(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[11px] text-[#73736c]">Bonus for large window capability and specialized tool execution.</p>
          </div>

        </div>

        {/* Live Simulation Playground */}
        <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#ececeb]">Live Routing Intent Simulation</h2>
              <p className="text-xs text-[#73736c]">Type any prompt to observe the real-time JEV candidate ranking.</p>
            </div>
            <span className="text-xs text-[#cc785c] font-mono">Formula: U = Σ (w_i × s_i)</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#141413] border border-[#2e2e2a] focus:border-[#cc785c] focus:outline-none text-xs text-[#ececeb]"
            />
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="px-5 py-2.5 rounded-xl bg-[#282826] hover:bg-[#333330] text-white text-xs font-medium transition"
            >
              {isSimulating ? "Calculating..." : "Evaluate Query"}
            </button>
          </div>

          {/* Ranking Results */}
          {rankedModels.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3">
              {rankedModels.map((m, idx) => (
                <div
                  key={m.id}
                  className={`p-4 rounded-xl border transition ${
                    idx === 0
                      ? "bg-[#282826] border-[#cc785c] shadow-lg shadow-[#cc785c]/10"
                      : "bg-[#141413] border-[#2e2e2a]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#ececeb]">
                      #{idx + 1} {m.name}
                    </span>
                    {idx === 0 && (
                      <span className="text-[10px] uppercase font-semibold bg-[#cc785c] text-white px-1.5 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] text-[#9d9d96] font-mono">
                    <div className="flex justify-between">
                      <span>Utility Score:</span>
                      <strong className="text-white">{m.utility}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Confidence:</span>
                      <strong className="text-emerald-400">{m.confidence}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Latency:</span>
                      <span>{m.latencyMs}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Model Arena Comparison Matrix */}
        <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-4">
          <h2 className="text-sm font-semibold text-[#ececeb]">Inference Backends Benchmark Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#2e2e2a] text-[#73736c] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="pb-3 font-semibold">Model Name</th>
                  <th className="pb-3 font-semibold">Inference Engine</th>
                  <th className="pb-3 font-semibold">Avg Latency</th>
                  <th className="pb-3 font-semibold">Cost / 1M In</th>
                  <th className="pb-3 font-semibold">Cost / 1M Out</th>
                  <th className="pb-3 font-semibold">Reasoning</th>
                  <th className="pb-3 font-semibold">Context</th>
                  <th className="pb-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262624]">
                {models.map((m) => (
                  <tr key={m.id} className="hover:bg-[#222220] transition">
                    <td className="py-3 font-medium text-[#ececeb]">{m.name}</td>
                    <td className="py-3 text-[#9d9d96]">{m.provider}</td>
                    <td className="py-3 font-mono text-emerald-400">{m.latencyMs}ms</td>
                    <td className="py-3 font-mono text-[#9d9d96]">${m.costIn.toFixed(2)}</td>
                    <td className="py-3 font-mono text-[#9d9d96]">${m.costOut.toFixed(2)}</td>
                    <td className="py-3 font-mono text-[#cc785c]">{(m.reasoningScore * 100).toFixed(0)}%</td>
                    <td className="py-3 font-mono text-[#73736c]">{m.contextWindow}</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Active
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
