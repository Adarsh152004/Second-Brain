"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"sql" | "rag" | "mcp">("sql");
  const [activeArchitecturePhase, setActiveArchitecturePhase] = useState<number>(1);

  return (
    <div className="min-h-screen bg-[#141413] text-[#ececeb] flex flex-col font-sans selection:bg-[#cc785c]/30">
      
      {/* =========================================================================
          NAVIGATION BAR
          ========================================================================= */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#141413]/90 border-b border-[#262624] px-6 lg:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#cc785c] flex items-center justify-center text-white font-semibold text-sm shadow-sm group-hover:bg-[#d97d62] transition">
              ⎔
            </div>
            <span className="font-semibold text-base tracking-tight text-[#ececeb]">
              Second Brain
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-6 text-xs text-[#9d9d96]">
            <Link href="/chat" className="hover:text-[#ececeb] transition">
              Chat Workspace
            </Link>
            <Link href="/knowledge" className="hover:text-[#ececeb] transition">
              Knowledge Base
            </Link>
            <Link href="/studio" className="hover:text-[#ececeb] transition">
              JEV Studio
            </Link>
            <Link href="/tools" className="hover:text-[#ececeb] transition">
              Tools &amp; MCP
            </Link>
            <Link href="/observability" className="hover:text-[#ececeb] transition">
              Observability
            </Link>
            <Link href="/settings" className="hover:text-[#ececeb] transition">
              Settings &amp; BYOK
            </Link>
            <a href="#system-architecture" className="hover:text-[#ececeb] transition">
              Architecture
            </a>
            <a href="#pricing" className="hover:text-[#ececeb] transition">
              Pricing
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-medium text-[#9d9d96] hover:text-[#ececeb] px-3 py-1.5 rounded-lg transition"
          >
            Sign in
          </Link>
          <Link
            href="/chat"
            className="text-xs font-medium bg-[#cc785c] hover:bg-[#d97d62] text-white px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            <span>Launch Workspace</span>
            <span>➔</span>
          </Link>
        </div>
      </nav>

      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <header className="relative pt-20 pb-16 px-6 lg:px-12 max-w-5xl mx-auto text-center space-y-8">
        
        {/* Real-time Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#333330] bg-[#1c1c1a] text-xs text-[#b0b0a8] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Joint Expected Value (JEV) Router • Supabase pgvector HNSW • MCP Tool Sandboxes</span>
        </div>

        {/* Editorial Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#f4f4f3] leading-[1.15]">
          Your thoughts, your data, and the world&apos;s best models.{" "}
          <span className="italic font-serif text-[#cc785c]">Unified.</span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-3xl mx-auto text-base sm:text-lg text-[#9d9d96] leading-relaxed">
          Second Brain is an autonomous enterprise intelligence operating system. It calculates mathematical expected utilities across DeepSeek V4.1, SambaNova Gemma 4, Groq Llama 3.3, and Gemini 2.0 Flash in sub-millisecond time, grounded by Supabase pgvector vector memory and protected by sandboxed MCP tools.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/chat"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white font-medium text-xs transition shadow-md flex items-center justify-center gap-2"
          >
            <span>Open Chat Workspace</span>
            <span>➔</span>
          </Link>
          <a
            href="#system-architecture"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-[#333330] bg-[#1c1c1a] hover:bg-[#242422] text-[#ececeb] font-medium text-xs transition flex items-center justify-center gap-2"
          >
            <span>Explore System Architecture</span>
            <span>↓</span>
          </a>
        </div>

        {/* Real-Time Platform Benchmarks Ribbon */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-left text-xs">
          <div className="p-3.5 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a]">
            <div className="text-[#73736c] text-[11px]">JEV Router Latency</div>
            <div className="font-mono text-emerald-400 font-bold text-base mt-0.5">&lt; 0.7ms</div>
            <div className="text-[10px] text-[#73736c]">Local heuristic engine</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a]">
            <div className="text-[#73736c] text-[11px]">Time to First Token (TTFT)</div>
            <div className="font-mono text-[#cc785c] font-bold text-base mt-0.5">142ms</div>
            <div className="text-[10px] text-[#73736c]">SambaNova &amp; Groq LPU</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a]">
            <div className="text-[#73736c] text-[11px]">Vector Search Index</div>
            <div className="font-mono text-cyan-400 font-bold text-base mt-0.5">pgvector HNSW</div>
            <div className="text-[10px] text-[#73736c]">Sub-10ms recall at scale</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a]">
            <div className="text-[#73736c] text-[11px]">Cache Hit Efficiency</div>
            <div className="font-mono text-purple-400 font-bold text-base mt-0.5">84.2%</div>
            <div className="text-[10px] text-[#73736c]">Exact &amp; semantic match</div>
          </div>
        </div>

      </header>

      {/* =========================================================================
          INTERACTIVE CONVERSATION PREVIEW (CLAUDE & MISTRAL STYLE)
          ========================================================================= */}
      <section className="px-6 lg:px-12 max-w-5xl mx-auto w-full pb-20">
        <div className="bg-[#1c1c1a] border border-[#2e2e2a] rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Preview Header */}
          <div className="border-b border-[#2e2e2a] bg-[#191918] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#383834]"></span>
              <span className="w-3 h-3 rounded-full bg-[#383834]"></span>
              <span className="w-3 h-3 rounded-full bg-[#383834]"></span>
              <span className="ml-3 text-xs font-mono text-[#73736c]">
                live session / interactive query preview
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
                PostgreSQL HNSW
              </button>
              <button
                onClick={() => setActiveTab("rag")}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeTab === "rag"
                    ? "bg-[#282826] text-[#ececeb] font-medium"
                    : "text-[#73736c] hover:text-[#9d9d96]"
                }`}
              >
                Supabase Grounding
              </button>
              <button
                onClick={() => setActiveTab("mcp")}
                className={`px-3 py-1 rounded text-xs transition ${
                  activeTab === "mcp"
                    ? "bg-[#282826] text-[#ececeb] font-medium"
                    : "text-[#73736c] hover:text-[#9d9d96]"
                }`}
              >
                Python MCP Sandbox
              </button>
            </div>
          </div>

          {/* Conversation Body */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4 justify-end">
              <div className="bg-[#242422] border border-[#333330] text-[#ececeb] text-xs p-4 rounded-2xl rounded-tr-sm max-w-xl leading-relaxed">
                {activeTab === "sql" &&
                  "Optimize our PostgreSQL database schema with pgvector HNSW indexing, and show the exact migration script for sub-10ms vector search."}
                {activeTab === "rag" &&
                  "Summarize our latest architecture RFC from the attached document and cross-check system security bounds."}
                {activeTab === "mcp" &&
                  "Execute a Python simulation computing the expected latency utility curve for 10k requests across 4 models."}
              </div>
              <div className="w-8 h-8 rounded-full bg-[#333330] flex items-center justify-center text-xs font-medium text-[#b0b0a8] shrink-0">
                U
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-[#cc785c] flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1 shadow-sm">
                ⎔
              </div>
              <div className="flex-1 space-y-4">
                
                {/* JEV Thought Pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#242422] border border-[#333330] text-xs text-[#9d9d96]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>JEV Intent Routed:</span>
                  <span className="font-medium text-[#ececeb]">
                    {activeTab === "sql" && "DeepSeek V4.1 Flash (BigModel) • High Coding Utility"}
                    {activeTab === "rag" && "SambaNova Gemma 4 • Accelerated RDU (240ms TTFT)"}
                    {activeTab === "mcp" && "Groq Llama 3.3 70B + Sandboxed Python Subprocess"}
                  </span>
                  <span className="text-[#575752]">•</span>
                  <span className="font-mono text-[11px] text-[#cc785c]">0.68ms eval</span>
                </div>

                {/* Content */}
                <div className="text-xs text-[#d4d4d0] leading-relaxed space-y-3">
                  {activeTab === "sql" && (
                    <>
                      <p>
                        Here is the production-ready PostgreSQL migration using <strong>pgvector</strong> with an <strong>HNSW (Hierarchical Navigable Small World)</strong> index. HNSW provides sub-10ms search recall while eliminating the training overhead of IVFFlat:
                      </p>
                      <pre className="p-4 rounded-xl bg-[#141413] border border-[#2e2e2a] font-mono text-xs text-[#e07a5f] overflow-x-auto leading-relaxed">
{`-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create high-recall HNSW cosine distance index
CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw
ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Set runtime query search depth for 99.4% recall
SET hnsw.ef_search = 40;`}
                      </pre>
                    </>
                  )}

                  {activeTab === "rag" && (
                    <>
                      <p>
                        Retrieved <strong>3 verified chunks</strong> from your private Supabase knowledge base (cosine similarity threshold: 0.884).
                      </p>
                      <div className="p-3 rounded-xl bg-[#242422] border border-[#333330] text-xs text-[#9d9d96] font-mono">
                        <strong>Chunk #12:</strong> Multi-tenant isolation is enforced via Postgres Row Level Security (RLS) policies matching auth.uid() across all embedding retrieval queries.
                      </div>
                    </>
                  )}

                  {activeTab === "mcp" && (
                    <>
                      <p>
                        Executed Python interpreter sandbox with NumPy in <strong>14.2ms</strong>. Output:
                      </p>
                      <div className="p-3 rounded-xl bg-[#141413] border border-[#2e2e2a] font-mono text-xs text-emerald-400">
                        &gt;&gt;&gt; JEV Expected Utility: 0.942 | Cost Reduction vs GPT-4: 87.4% | Mean: -0.0142
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-[#73736c] pt-2">
                  <Link href="/chat" className="text-[#cc785c] hover:underline">
                    Try this query in Live Chat ➔
                  </Link>
                  <span>•</span>
                  <span className="font-mono">TTFT: 142ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          DETAILED END-TO-END SYSTEM ARCHITECTURE & FLOW
          ========================================================================= */}
      <section id="system-architecture" className="py-20 px-6 lg:px-12 max-w-5xl mx-auto space-y-16 border-t border-[#262624]">
        <div className="space-y-4 max-w-3xl">
          <div className="text-xs uppercase font-semibold text-[#cc785c] tracking-wider font-mono">
            Technical Specification &amp; Flow
          </div>
          <h2 className="text-3xl font-normal text-[#f4f4f3] tracking-tight">
            How Second Brain processes every token.
          </h2>
          <p className="text-sm text-[#9d9d96] leading-relaxed">
            From the moment you hit Enter to the final streamed token, Second Brain coordinates five deterministic layers: cache lookup, JEV optimization, Supabase vector retrieval, MCP tool execution, and multi-provider streaming.
          </p>
        </div>

        {/* Visual Pipeline Flowchart Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          
          <div className="p-4 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="w-7 h-7 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold font-mono">
              1
            </div>
            <div className="font-semibold text-[#ececeb]">Input &amp; Cache Check</div>
            <p className="text-[11px] text-[#73736c] leading-relaxed">
              Query is checked against exact hash and 0.88-cosine semantic cache. Cached hits return in &lt;1ms.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="w-7 h-7 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold font-mono">
              2
            </div>
            <div className="font-semibold text-[#ececeb]">3-Phase JEV Engine</div>
            <p className="text-[11px] text-[#73736c] leading-relaxed">
              Judgment, Expected Utility evaluation ($U = \sum w_i s_i$), and safety/budget policy validation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="w-7 h-7 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold font-mono">
              3
            </div>
            <div className="font-semibold text-[#ececeb]">Supabase pgvector</div>
            <p className="text-[11px] text-[#73736c] leading-relaxed">
              If RAG is needed, Cohere embeddings query HNSW cosine index (`m=16, ef_construction=64`).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="w-7 h-7 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold font-mono">
              4
            </div>
            <div className="font-semibold text-[#ececeb]">MCP Sandboxed Tools</div>
            <p className="text-[11px] text-[#73736c] leading-relaxed">
              Isolated execution of AST calculator, Python subprocess runner, or Tavily live web queries.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-2">
            <div className="w-7 h-7 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold font-mono">
              5
            </div>
            <div className="font-semibold text-[#ececeb]">Streaming &amp; Artifacts</div>
            <p className="text-[11px] text-[#73736c] leading-relaxed">
              Response streams into chat UI with Claude-style split-screen Artifact side drawer for code and docs.
            </p>
          </div>

        </div>

        {/* Deep Dive: The 3-Phase JEV Decision Theory */}
        <div className="p-8 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-6">
          <div className="space-y-2">
            <div className="text-xs uppercase font-mono font-semibold text-[#cc785c]">Decision Intelligence</div>
            <h3 className="text-xl font-normal text-[#ececeb]">The 3-Phase Joint Expected Value (JEV) Theory</h3>
            <p className="text-xs text-[#9d9d96] leading-relaxed">
              Single-model architectures force a painful compromise between latency, cost, and hallucination. Second Brain solves this by framing every query as an expected utility maximization problem solved in &lt;1 millisecond:
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#141413] border border-[#262624] font-mono text-xs text-[#cc785c] overflow-x-auto text-center">
            Expected Utility: U(a, q) = w_acc · S_acc(a, q) + w_spd · S_spd(a) + w_cost · S_cost(a) + w_fit · S_fit(a, q)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#9d9d96]">
            <div className="space-y-1.5">
              <div className="font-semibold text-[#ececeb]">Phase 1: State Judgment</div>
              <p className="text-[11px] leading-relaxed">
                Extracts query intent, complexity (low/med/high), domain (coding, math, database, general), and tool prerequisites without network round-trips.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-[#ececeb]">Phase 2: Expected Utility Evaluation</div>
              <p className="text-[11px] leading-relaxed">
                Generates candidate actions and scores each against provider benchmarks (accuracy, latency, pricing). Ranks candidate actions probabilistically.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-[#ececeb]">Phase 3: Policy &amp; Safety Verification</div>
              <p className="text-[11px] leading-relaxed">
                Audits against daily budget limits ($5.00), checks prompt injection heuristics, and validates provider API key availability before execution.
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* =========================================================================
          INFERENCE BACKENDS & HARDWARE BENCHMARKS
          ========================================================================= */}
      <section className="py-20 px-6 lg:px-12 max-w-5xl mx-auto space-y-12 border-t border-[#262624]">
        <div className="space-y-3 max-w-2xl">
          <div className="text-xs uppercase font-mono font-semibold text-[#cc785c]">Multi-Provider Inference</div>
          <h2 className="text-3xl font-normal text-[#f4f4f3] tracking-tight">
            Specialized backends for every cognitive task.
          </h2>
          <p className="text-sm text-[#9d9d96]">
            Every model in the Second Brain fleet is benchmarked for its domain strengths:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          
          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-[#ececeb]">DeepSeek V4.1</span>
              <span className="text-[10px] font-mono text-[#cc785c] bg-[#cc785c]/10 px-2 py-0.5 rounded">BigModel</span>
            </div>
            <div className="text-[11px] text-[#9d9d96] leading-relaxed">
              Deep reasoning, complex system architectures, and rigorous mathematical proofs.
            </div>
            <div className="pt-2 border-t border-[#262624] font-mono text-[11px] text-[#73736c] space-y-1">
              <div>Reasoning: <strong className="text-emerald-400">96%</strong></div>
              <div>TTFT: <strong className="text-white">320ms</strong></div>
              <div>Price: <strong className="text-white">$0.15 / 1M in</strong></div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-[#ececeb]">SambaNova Gemma 4</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">RDU Cluster</span>
            </div>
            <div className="text-[11px] text-[#9d9d96] leading-relaxed">
              Ultra-accelerated inference designed for near-instant responses and quick coding iterations.
            </div>
            <div className="pt-2 border-t border-[#262624] font-mono text-[11px] text-[#73736c] space-y-1">
              <div>Reasoning: <strong className="text-emerald-400">93%</strong></div>
              <div>TTFT: <strong className="text-emerald-400">240ms</strong></div>
              <div>Price: <strong className="text-white">$0.10 / 1M in</strong></div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-[#ececeb]">Groq Llama 3.3 70B</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded">LPU Chips</span>
            </div>
            <div className="text-[11px] text-[#9d9d96] leading-relaxed">
              Blazing stream speed (1,200 tok/s) ideal for long summaries, documentation, and drafting.
            </div>
            <div className="pt-2 border-t border-[#262624] font-mono text-[11px] text-[#73736c] space-y-1">
              <div>Reasoning: <strong className="text-emerald-400">90%</strong></div>
              <div>TTFT: <strong className="text-white">280ms</strong></div>
              <div>Price: <strong className="text-white">$0.59 / 1M in</strong></div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-[#ececeb]">Gemini 2.0 Flash</span>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded">Vertex AI</span>
            </div>
            <div className="text-[11px] text-[#9d9d96] leading-relaxed">
              1,000,000 token context window with native multimodal document and vision understanding.
            </div>
            <div className="pt-2 border-t border-[#262624] font-mono text-[11px] text-[#73736c] space-y-1">
              <div>Reasoning: <strong className="text-emerald-400">92%</strong></div>
              <div>Context: <strong className="text-white">1M tokens</strong></div>
              <div>Price: <strong className="text-white">$0.10 / 1M in</strong></div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          SUPABASE PGVECTOR STORAGE ARCHITECTURE
          ========================================================================= */}
      <section className="py-20 px-6 lg:px-12 max-w-5xl mx-auto space-y-12 border-t border-[#262624]">
        <div className="space-y-3 max-w-3xl">
          <div className="text-xs uppercase font-mono font-semibold text-[#cc785c]">Vector Memory Engine</div>
          <h2 className="text-3xl font-normal text-[#f4f4f3] tracking-tight">
            Supabase pgvector: enterprise RAG at millisecond speed.
          </h2>
          <p className="text-sm text-[#9d9d96] leading-relaxed">
            Your knowledge base lives in an enterprise-grade PostgreSQL database with pgvector, indexed with HNSW for sub-10ms similarity queries under concurrent loads.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          
          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="text-sm font-semibold text-[#ececeb] flex items-center gap-2">
              <span className="text-[#cc785c]">📑</span> Overlapping Chunking
            </div>
            <p className="text-[#9d9d96] leading-relaxed">
              Documents are processed into 256-token slices with 32-token overlap, ensuring sentences and semantic context are never truncated at boundaries.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="text-sm font-semibold text-[#ececeb] flex items-center gap-2">
              <span className="text-[#cc785c]">🔍</span> Dense + Sparse Hybrid Search
            </div>
            <p className="text-[#9d9d96] leading-relaxed">
              Combines 1024-dimension Cohere dense vectors with BM25 sparse keyword indices, balancing conceptual semantic matches with exact token recall.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] space-y-3">
            <div className="text-sm font-semibold text-[#ececeb] flex items-center gap-2">
              <span className="text-[#cc785c]">🔒</span> Tenant Row-Level Security
            </div>
            <p className="text-[#9d9d96] leading-relaxed">
              Strict Postgres RLS ensures every vector query matches auth.uid(). Your proprietary PDFs and data are completely isolated at the database engine level.
            </p>
          </div>

        </div>
      </section>

      {/* =========================================================================
          THE 5 PLATFORM WORKSPACES
          ========================================================================= */}
      <section className="py-20 px-6 lg:px-12 max-w-5xl mx-auto space-y-12 border-t border-[#262624]">
        <div className="space-y-3 max-w-2xl">
          <div className="text-xs uppercase font-mono font-semibold text-[#cc785c]">Platform Suite</div>
          <h2 className="text-3xl font-normal text-[#f4f4f3] tracking-tight">
            Six dedicated workspaces for every phase of research.
          </h2>
          <p className="text-sm text-[#9d9d96]">
            Click any suite to launch the live application workspace:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
          
          <Link
            href="/chat"
            className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold">
                💬
              </div>
              <h3 className="font-semibold text-sm text-[#ececeb] group-hover:text-[#cc785c] transition">
                Conversational Workspace
              </h3>
              <p className="text-[#9d9d96] leading-relaxed text-[11px]">
                Claude &amp; Mistral-style chat with real-time streaming, collapsible thought boxes, and split-screen Artifact side drawer.
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#cc785c]">Open Chat ➔</span>
          </Link>

          <Link
            href="/knowledge"
            className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold">
                📚
              </div>
              <h3 className="font-semibold text-sm text-[#ececeb] group-hover:text-[#cc785c] transition">
                Knowledge Base &amp; RAG
              </h3>
              <p className="text-[#9d9d96] leading-relaxed text-[11px]">
                Upload documents, audit chunk embeddings, and test live cosine similarity queries in the vector search sandbox.
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#cc785c]">Manage Knowledge ➔</span>
          </Link>

          <Link
            href="/studio"
            className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold">
                ⚡
              </div>
              <h3 className="font-semibold text-sm text-[#ececeb] group-hover:text-[#cc785c] transition">
                JEV Decision Studio
              </h3>
              <p className="text-[#9d9d96] leading-relaxed text-[11px]">
                Adjust accuracy, speed, and cost weights. Test candidate ranking curves and benchmark inference latency.
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#cc785c]">Tune JEV Weights ➔</span>
          </Link>

          <Link
            href="/tools"
            className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold">
                🛠️
              </div>
              <h3 className="font-semibold text-sm text-[#ececeb] group-hover:text-[#cc785c] transition">
                Tools &amp; MCP Protocol
              </h3>
              <p className="text-[#9d9d96] leading-relaxed text-[11px]">
                Sandboxed Python interpreter, AST calculator, SQLite schema introspection, and Tavily live web synthesis.
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#cc785c]">Explore Tools ➔</span>
          </Link>

          <Link
            href="/observability"
            className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold">
                📊
              </div>
              <h3 className="font-semibold text-sm text-[#ececeb] group-hover:text-[#cc785c] transition">
                Observability &amp; Cost
              </h3>
              <p className="text-[#9d9d96] leading-relaxed text-[11px]">
                Real-time TTFT distributions, token consumption audits, latency waterfalls, and daily budget spend guardrails.
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#cc785c]">Inspect Traces ➔</span>
          </Link>

          <Link
            href="/settings"
            className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] transition group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#282826] text-[#cc785c] flex items-center justify-center font-bold">
                ⚙️
              </div>
              <h3 className="font-semibold text-sm text-[#ececeb] group-hover:text-[#cc785c] transition">
                Settings &amp; BYOK Vault
              </h3>
              <p className="text-[#9d9d96] leading-relaxed text-[11px]">
                Bring your own API keys for SambaNova, BigModel, Groq, and Supabase. Toggle privacy and export JSON archives.
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#cc785c]">Manage Keys ➔</span>
          </Link>

        </div>
      </section>

      {/* =========================================================================
          PRICING TABLE
          ========================================================================= */}
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
                <li>✓ Claude Artifact side drawer &amp; canvas</li>
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

          <div className="p-6 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-[#ececeb]">Organization</h3>
                <div className="text-2xl font-normal text-[#f4f4f3] mt-2">Custom</div>
                <div className="text-xs text-[#73736c]">For teams requiring dedicated infra</div>
              </div>
              <ul className="text-xs text-[#9d9d96] space-y-2">
                <li>✓ Bring your own API keys &amp; models (BYOK)</li>
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

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="border-t border-[#262624] py-12 px-6 lg:px-12 mt-auto bg-[#111110]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#73736c]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#cc785c] flex items-center justify-center text-white text-[10px] font-bold">
              ⎔
            </div>
            <span className="font-medium text-[#9d9d96]">Second Brain AI</span>
            <span>• Built for Researchers, Engineers &amp; Thinkers.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link href="/chat" className="hover:text-[#ececeb] transition">
              Chat
            </Link>
            <Link href="/knowledge" className="hover:text-[#ececeb] transition">
              Knowledge Base
            </Link>
            <Link href="/studio" className="hover:text-[#ececeb] transition">
              JEV Studio
            </Link>
            <Link href="/tools" className="hover:text-[#ececeb] transition">
              Tools
            </Link>
            <Link href="/observability" className="hover:text-[#ececeb] transition">
              Observability
            </Link>
            <Link href="/settings" className="hover:text-[#ececeb] transition">
              Settings
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
