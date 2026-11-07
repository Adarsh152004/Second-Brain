"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"sql" | "rag" | "mcp">("sql");

  return (
    <div className="min-h-screen bg-[#141413] text-[#ececeb] flex flex-col font-sans selection:bg-[#cc785c]/30">
      
      {/* NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#141413]/85 border-b border-[#262624] px-6 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#cc785c] flex items-center justify-center text-white font-semibold text-sm shadow-sm group-hover:bg-[#d97d62] transition">
              ⎔
            </div>
            <span className="font-semibold text-base tracking-tight text-[#ececeb]">
              Second Brain
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-[#9d9d96]">
            <a href="#capabilities" className="hover:text-[#ececeb] transition">
              Capabilities
            </a>
            <a href="#architecture" className="hover:text-[#ececeb] transition">
              JEV Routing
            </a>
            <a href="#memory" className="hover:text-[#ececeb] transition">
              Supabase Memory
            </a>
            <a href="#pricing" className="hover:text-[#ececeb] transition">
              Pricing
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[#9d9d96] hover:text-[#ececeb] px-3 py-1.5 rounded-lg transition"
          >
            Sign in
          </Link>
          <Link
            href="/chat"
            className="text-sm font-medium bg-[#cc785c] hover:bg-[#d97d62] text-white px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            <span>Start Chatting</span>
            <span>➔</span>
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="relative pt-20 pb-16 px-6 lg:px-12 max-w-5xl mx-auto text-center space-y-8">
        
        {/* Subtle Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#333330] bg-[#1c1c1a] text-xs text-[#b0b0a8] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#cc785c] animate-pulse"></span>
          <span>Joint Expected Value (JEV) Router • Supabase pgvector v2.4</span>
        </div>

        {/* Editorial Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#f4f4f3] leading-[1.15]">
          Your thoughts, your data, and the world&apos;s best models.{" "}
          <span className="italic font-serif text-[#cc785c]">Unified.</span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#9d9d96] leading-relaxed">
          Second Brain dynamically routes your toughest problems across DeepSeek, Claude, Llama 3.3, and Gemma in real time—grounded by persistent vector memory and protected by probabilistic utility theory.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/chat"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white font-medium text-sm transition shadow-md flex items-center justify-center gap-2"
          >
            <span>Open Workspace</span>
            <span>➔</span>
          </Link>
          <a
            href="#interactive-demo"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-[#333330] bg-[#1c1c1a] hover:bg-[#242422] text-[#ececeb] font-medium text-sm transition flex items-center justify-center gap-2"
          >
            <span>View Architecture Demo</span>
            <span>↓</span>
          </a>
        </div>

        {/* Trust & Model Badges */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#73736c] uppercase tracking-wider font-mono">
          <span>DeepSeek V4.1</span>
          <span>•</span>
          <span>SambaNova Gemma 4</span>
          <span>•</span>
          <span>Groq Llama 3.3</span>
          <span>•</span>
          <span>Gemini 2.0 Flash</span>
          <span>•</span>
          <span>Supabase pgvector</span>
        </div>
      </header>

      {/* INTERACTIVE WORKSPACE PREVIEW CARD (Claude / Mistral aesthetic) */}
      <section id="interactive-demo" className="px-6 lg:px-12 max-w-5xl mx-auto w-full pb-24">
        <div className="bg-[#1c1c1a] border border-[#2e2e2a] rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Card Topbar */}
          <div className="border-b border-[#2e2e2a] bg-[#191918] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#383834]"></span>
              <span className="w-3 h-3 rounded-full bg-[#383834]"></span>
              <span className="w-3 h-3 rounded-full bg-[#383834]"></span>
              <span className="ml-3 text-xs font-mono text-[#73736c]">
                workspace / session-824
              </span>
            </div>

            {/* Scenario Tabs */}
            <div className="flex items-center gap-1 bg-[#141413] p-1 rounded-lg border border-[#2e2e2a]">
              <button
                onClick={() => setActiveTab("sql")}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeTab === "sql"
                    ? "bg-[#282826] text-[#ececeb] font-medium"
                    : "text-[#73736c] hover:text-[#9d9d96]"
                }`}
              >
                PostgreSQL Schema
              </button>
              <button
                onClick={() => setActiveTab("rag")}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeTab === "rag"
                    ? "bg-[#282826] text-[#ececeb] font-medium"
                    : "text-[#73736c] hover:text-[#9d9d96]"
                }`}
              >
                Vector Grounding
              </button>
              <button
                onClick={() => setActiveTab("mcp")}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeTab === "mcp"
                    ? "bg-[#282826] text-[#ececeb] font-medium"
                    : "text-[#73736c] hover:text-[#9d9d96]"
                }`}
              >
                Tool Execution
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* User Prompt */}
            <div className="flex items-start gap-4 justify-end">
              <div className="bg-[#242422] border border-[#333330] text-[#ececeb] text-sm p-4 rounded-2xl rounded-tr-sm max-w-xl">
                {activeTab === "sql" &&
                  "Optimize our PostgreSQL schema with pgvector HNSW indexing, and show the exact migration script for sub-10ms vector search."}
                {activeTab === "rag" &&
                  "Summarize our latest architecture RFC from the attached document and cross-check system security bounds."}
                {activeTab === "mcp" &&
                  "Execute a Python simulation computing the expected latency utility curve for 10k requests across 4 models."}
              </div>
              <div className="w-8 h-8 rounded-full bg-[#333330] flex items-center justify-center text-xs font-medium text-[#b0b0a8] shrink-0">
                U
              </div>
            </div>

            {/* Assistant Stream */}
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-[#cc785c] flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">
                ⎔
              </div>
              <div className="flex-1 space-y-4">
                
                {/* JEV Reasoning Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#242422] border border-[#333330] text-xs text-[#9d9d96]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>JEV Routed to:</span>
                  <span className="font-medium text-[#ececeb]">
                    {activeTab === "sql" && "DeepSeek V4.1 Flash (via BigModel)"}
                    {activeTab === "rag" && "SambaNova Gemma 4 (240ms TTFT)"}
                    {activeTab === "mcp" && "Groq Llama 3.3 70B + Python MCP Sandbox"}
                  </span>
                  <span className="text-[#575752]">•</span>
                  <span className="font-mono text-[11px] text-[#cc785c]">0.68ms eval</span>
                </div>

                {/* Content */}
                <div className="text-sm text-[#d4d4d0] leading-relaxed space-y-3">
                  {activeTab === "sql" && (
                    <>
                      <p>
                        Here is the production-ready migration script using <strong>pgvector</strong> with an <strong>HNSW cosine index</strong>. This keeps memory usage below 8MB per 100k vectors while sustaining sub-10ms search latency:
                      </p>
                      <pre className="p-4 rounded-xl bg-[#141413] border border-[#2e2e2a] font-mono text-xs text-[#e07a5f] overflow-x-auto">
{`-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- High-performance HNSW index for cosine similarity
CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query execution setting for optimal precision
SET hnsw.ef_search = 40;`}
                      </pre>
                    </>
                  )}

                  {activeTab === "rag" && (
                    <>
                      <p>
                        Retrieved <strong>3 verified chunks</strong> from your Supabase knowledge base (similarity threshold: 0.884).
                      </p>
                      <div className="p-3 rounded-xl bg-[#242422] border border-[#333330] text-xs text-[#9d9d96]">
                        <strong>Chunk #12:</strong> Architecture RFC strictly enforces tenant data separation via Postgres Row Level Security (RLS) policies.
                      </div>
                    </>
                  )}

                  {activeTab === "mcp" && (
                    <>
                      <p>
                        Executed Python interpreter sandbox with NumPy in <strong>14.2ms</strong>. Result:
                      </p>
                      <div className="p-3 rounded-xl bg-[#141413] border border-[#2e2e2a] font-mono text-xs text-[#9d9d96]">
                        &gt;&gt;&gt; JEV Expected Utility: 0.942 | Cost reduction vs GPT-4: 87.4%
                      </div>
                    </>
                  )}
                </div>

                {/* Micro Action Bar */}
                <div className="flex items-center gap-4 text-xs text-[#73736c] pt-2">
                  <span className="hover:text-[#9d9d96] cursor-pointer">Copy code</span>
                  <span>•</span>
                  <span className="hover:text-[#9d9d96] cursor-pointer">Open in Canvas Drawer</span>
                  <span>•</span>
                  <span className="font-mono">TTFT: 142ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES (3 Pillars like Claude & Mistral) */}
      <section id="capabilities" className="py-20 px-6 lg:px-12 max-w-5xl mx-auto space-y-16 border-t border-[#262624]">
        <div className="space-y-4 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-normal text-[#f4f4f3] tracking-tight">
            Architected for accuracy, speed, and cost efficiency.
          </h2>
          <p className="text-sm sm:text-base text-[#9d9d96] leading-relaxed">
            No single model wins at everything. Second Brain pairs state-of-the-art decision theory with persistent memory so you get the best intelligence for every token.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#282826] border border-[#383834] flex items-center justify-center text-[#cc785c] font-semibold text-lg">
              ⚡
            </div>
            <h3 className="text-base font-medium text-[#ececeb]">
              Joint Expected Value Router
            </h3>
            <p className="text-xs text-[#9d9d96] leading-relaxed">
              Sub-millisecond probabilistic decision engine that calculates the optimal trade-off between latency, cost, and task accuracy before dispatching queries.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#282826] border border-[#383834] flex items-center justify-center text-[#cc785c] font-semibold text-lg">
              📚
            </div>
            <h3 className="text-base font-medium text-[#ececeb]">
              Supabase pgvector Memory
            </h3>
            <p className="text-xs text-[#9d9d96] leading-relaxed">
              Permanent vector embeddings, hybrid dense/sparse search, and chunk auditing. Your documents remain grounded in your private Postgres database.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#282826] border border-[#383834] flex items-center justify-center text-[#cc785c] font-semibold text-lg">
              🛠️
            </div>
            <h3 className="text-base font-medium text-[#ececeb]">
              Sandboxed Agent Tools (MCP)
            </h3>
            <p className="text-xs text-[#9d9d96] leading-relaxed">
              Live web synthesis with Tavily, real-time Python computation, and schema reflection with Model Context Protocol (MCP) integrations.
            </p>
          </div>

        </div>
      </section>

      {/* PRICING TABLE */}
      <section id="pricing" className="py-20 px-6 lg:px-12 max-w-5xl mx-auto space-y-12 border-t border-[#262624]">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <h2 className="text-3xl font-normal text-[#f4f4f3] tracking-tight">
            Transparent, predictable access.
          </h2>
          <p className="text-sm text-[#9d9d96]">
            Start free, scale with your research and production workloads.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          
          {/* Free Tier */}
          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-[#ececeb]">Community</h3>
                <div className="text-2xl font-normal text-[#f4f4f3] mt-2">$0</div>
                <div className="text-xs text-[#73736c]">Free forever</div>
              </div>
              <ul className="text-xs text-[#9d9d96] space-y-2">
                <li>✓ Unlimited chat sessions</li>
                <li>✓ JEV auto-routing across Groq &amp; Gemini</li>
                <li>✓ Up to 100 document chunks</li>
                <li>✓ Basic web search</li>
              </ul>
            </div>
            <Link
              href="/register"
              className="w-full py-2.5 rounded-xl border border-[#383834] bg-[#242422] hover:bg-[#2b2b28] text-center text-xs font-medium text-[#ececeb] transition"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Tier (Featured) */}
          <div className="p-6 rounded-2xl bg-[#222220] border border-[#cc785c]/60 flex flex-col justify-between space-y-6 relative shadow-xl">
            <div className="space-y-4">
              <div>
                <div className="inline-block text-[10px] uppercase tracking-wider font-semibold bg-[#cc785c]/20 text-[#e07a5f] px-2 py-0.5 rounded-full mb-1">
                  Most Popular
                </div>
                <h3 className="text-lg font-medium text-[#ececeb]">Researcher Pro</h3>
                <div className="text-2xl font-normal text-[#f4f4f3] mt-2">
                  $20 <span className="text-xs text-[#73736c]">/ month</span>
                </div>
                <div className="text-xs text-[#73736c]">For heavy research &amp; engineering</div>
              </div>
              <ul className="text-xs text-[#ececeb] space-y-2">
                <li>✓ Access to DeepSeek V4.1 &amp; SambaNova</li>
                <li>✓ Dedicated Supabase vector database</li>
                <li>✓ Python interpreter &amp; SQL MCP tools</li>
                <li>✓ Artifact side drawer &amp; canvas export</li>
                <li>✓ Sub-150ms Time-to-First-Token</li>
              </ul>
            </div>
            <Link
              href="/register"
              className="w-full py-2.5 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-center text-xs font-medium text-white transition shadow-sm"
            >
              Start 14-Day Trial
            </Link>
          </div>

          {/* Enterprise */}
          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-[#ececeb]">Organization</h3>
                <div className="text-2xl font-normal text-[#f4f4f3] mt-2">Custom</div>
                <div className="text-xs text-[#73736c]">For teams requiring dedicated infra</div>
              </div>
              <ul className="text-xs text-[#9d9d96] space-y-2">
                <li>✓ Bring your own API keys &amp; models</li>
                <li>✓ Custom Supabase VPC instance</li>
                <li>✓ Role-based access &amp; audit logs</li>
                <li>✓ Dedicated 99.9% uptime SLA</li>
              </ul>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded-xl border border-[#383834] bg-[#242422] hover:bg-[#2b2b28] text-center text-xs font-medium text-[#ececeb] transition"
            >
              Contact Sales
            </Link>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#262624] py-12 px-6 lg:px-12 mt-auto bg-[#111110]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#73736c]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#cc785c] flex items-center justify-center text-white text-[10px] font-bold">
              ⎔
            </div>
            <span className="font-medium text-[#9d9d96]">Second Brain AI</span>
            <span>• © 2026. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/chat" className="hover:text-[#ececeb] transition">
              Workspace
            </Link>
            <Link href="/login" className="hover:text-[#ececeb] transition">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-[#ececeb] transition">
              Sign Up
            </Link>
            <a
              href="https://github.com/Adarsh152004/Second-Brain"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#ececeb] transition"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
