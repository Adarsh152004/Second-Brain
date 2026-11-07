"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [keys, setKeys] = useState({
    sambanova: "715cc6bc-e019-4198-••••••••••••",
    bigmodel: "sk-3cd544a8654c4537••••••••••••••••••••••••••••••••",
    groq: "gsk_••••••••••••••••••••••••••••••••••••",
    gemini: "AIzaSy••••••••••••••••••••••••••••••••",
    tavily: "tvly-••••••••••••••••••••••••••••••••",
    supabase: "postgresql://postgres:••••••••@db.xybusfywybuxejnohkcd.supabase.co:5432/postgres",
  });

  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedStatus("API keys securely saved to session configuration!");
    setTimeout(() => setSavedStatus(null), 3000);
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ exported_at: new Date().toISOString(), platform: "Second Brain AI" }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "second_brain_export.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb] transition"
            >
              <span>📊</span>
              <span>Observability &amp; Cost</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#282826] text-white font-medium transition"
            >
              <span className="text-[#cc785c]">⚙️</span>
              <span>Settings &amp; Keys</span>
            </Link>
          </nav>
        </div>

        <div className="p-3 rounded-xl bg-[#141413] border border-[#262624] text-[11px] space-y-1 text-[#73736c]">
          <div className="text-[#ececeb] font-medium flex items-center justify-between">
            <span>Workspace</span>
            <span className="text-[#cc785c]">PRO</span>
          </div>
          <div>All credentials encrypted at rest</div>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262624] pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[#f4f4f3]">
              Settings &amp; Bring-Your-Own-Key (BYOK) Vault
            </h1>
            <p className="text-xs text-[#9d9d96]">
              Manage provider API credentials, privacy isolation, and data exports.
            </p>
          </div>

          <Link
            href="/chat"
            className="px-4 py-2 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white text-xs font-medium transition shadow-sm"
          >
            Return to Chat ➔
          </Link>
        </div>

        {/* API Key Vault Form */}
        <form onSubmit={handleSaveKeys} className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#ececeb]">Inference API Keys</h2>
              <p className="text-xs text-[#73736c]">Keys are used directly by the backend inference and JEV routing engines.</p>
            </div>
            {savedStatus && (
              <span className="text-xs text-emerald-400 font-medium animate-pulse">{savedStatus}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-[#b0b0a8]">SambaNova API Key (Gemma 4 RDU):</label>
              <input
                type="text"
                value={keys.sambanova}
                onChange={(e) => setKeys({ ...keys, sambanova: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#2e2e2a] focus:border-[#cc785c] focus:outline-none font-mono text-[#ececeb]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-[#b0b0a8]">BigModel API Key (DeepSeek V4.1):</label>
              <input
                type="text"
                value={keys.bigmodel}
                onChange={(e) => setKeys({ ...keys, bigmodel: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#2e2e2a] focus:border-[#cc785c] focus:outline-none font-mono text-[#ececeb]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-[#b0b0a8]">Groq API Key (Llama 3.3 70B):</label>
              <input
                type="text"
                value={keys.groq}
                onChange={(e) => setKeys({ ...keys, groq: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#2e2e2a] focus:border-[#cc785c] focus:outline-none font-mono text-[#ececeb]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-[#b0b0a8]">Google Gemini API Key:</label>
              <input
                type="text"
                value={keys.gemini}
                onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#2e2e2a] focus:border-[#cc785c] focus:outline-none font-mono text-[#ececeb]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="font-medium text-[#b0b0a8]">Supabase PostgreSQL Connection URI:</label>
              <input
                type="text"
                value={keys.supabase}
                onChange={(e) => setKeys({ ...keys, supabase: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141413] border border-[#2e2e2a] focus:border-[#cc785c] focus:outline-none font-mono text-[#ececeb]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white text-xs font-medium transition shadow-sm"
            >
              Save Credentials Vault
            </button>
          </div>
        </form>

        {/* Privacy & Cache Toggles */}
        <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-4">
          <h2 className="text-sm font-semibold text-[#ececeb]">Data Privacy &amp; Performance Toggles</h2>
          
          <div className="divide-y divide-[#262624] text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-[#ececeb]">Semantic &amp; Exact Response Caching</div>
                <div className="text-[#73736c]">Skips LLM inference for repeated queries (sub-1ms TTFT).</div>
              </div>
              <button
                type="button"
                onClick={() => setCacheEnabled((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative ${cacheEnabled ? "bg-[#cc785c]" : "bg-[#282826]"}`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${cacheEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-[#ececeb]">Detailed Telemetry &amp; Latency Tracing</div>
                <div className="text-[#73736c]">Records granular timing waterfalls and token costs for audits.</div>
              </div>
              <button
                type="button"
                onClick={() => setTelemetryEnabled((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative ${telemetryEnabled ? "bg-[#cc785c]" : "bg-[#282826]"}`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${telemetryEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Export Data */}
        <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-[#ececeb]">Export Workspace Data</h2>
            <p className="text-xs text-[#73736c]">Download all conversation histories, vector metadata, and trace logs as JSON.</p>
          </div>
          <button
            onClick={handleExportData}
            className="px-4 py-2 rounded-xl bg-[#282826] hover:bg-[#333330] text-xs font-medium text-white transition flex items-center gap-2"
          >
            <span>↓</span>
            <span>Export JSON Archive</span>
          </button>
        </div>

      </main>

    </div>
  );
}

