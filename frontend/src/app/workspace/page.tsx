"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  decision?: any;
  sources?: any[];
  is_cached?: boolean;
  cache_type?: string;
  similarity_score?: number;
  trace_id?: string;
  latency_ms?: number;
  tokens_per_sec?: number;
  cost_usd?: number;
}

interface ChatSession {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

interface AttachedDoc {
  filename: string;
  chunks: number;
  doc_id?: string;
}

function getMessageText(m: any): string {
  if (!m) return "";
  if (typeof m.content === "string" && m.content) return m.content;
  if (Array.isArray(m.parts)) {
    const texts = m.parts
      .filter((p: any) => p && p.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text);
    if (texts.length > 0) return texts.join("");
  }
  return "";
}

function getMessageSources(m: any): any[] {
  if (!m) return [];
  if (Array.isArray(m.sources) && m.sources.length > 0) return m.sources;
  if (Array.isArray(m.parts)) {
    const res: any[] = [];
    m.parts.forEach((p: any) => {
      if (!p) return;
      if (p.type === "source-url") {
        res.push({ type: "web", url: p.url, title: p.title || p.url || "Web Source" });
      } else if (p.type === "source-document") {
        res.push({ type: "document", title: p.title || p.filename || "Document", mediaType: p.mediaType });
      }
    });
    return res;
  }
  return [];
}

function getMessageDecision(m: any): any {
  if (!m) return null;
  if (m.decision) return m.decision;
  if (Array.isArray(m.parts)) {
    const jevPart = m.parts.find((p: any) => p && p.type === "data-jev");
    if (jevPart && jevPart.data) return jevPart.data;
  }
  return null;
}

function getMessageTelemetry(m: any): any {
  if (!m) return null;
  if (m.latency_ms || m.tokens_per_sec || m.is_cached) {
    return {
      latency_ms: m.latency_ms,
      tokens_per_sec: m.tokens_per_sec,
      is_cached: m.is_cached,
      cache_type: m.cache_type,
      similarity_score: m.similarity_score,
      cost_usd: m.cost_usd,
    };
  }
  if (Array.isArray(m.parts)) {
    const telPart = m.parts.find((p: any) => p && p.type === "data-telemetry");
    if (telPart && telPart.data) return telPart.data;
  }
  return null;
}

export default function ChatWorkspace() {
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeTools, setActiveTools] = useState({ rag: true, web: false });
  const [selectedModel, setSelectedModel] = useState("Auto (JEV Routed)");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Threading / Chat Sessions
  const [sessionId, setSessionId] = useState<string>(() => "session_" + Date.now());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Documents & RAG Upload
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [docCount, setDocCount] = useState<number>(0);

  // Thought Box expand state per message
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  // Artifact Side Drawer (Claude-style split view)
  const [artifactDrawerOpen, setArtifactDrawerOpen] = useState(false);
  const [artifactTitle, setArtifactTitle] = useState("Artifact View");
  const [artifactContent, setArtifactContent] = useState("");
  const [artifactTab, setArtifactTab] = useState<"code" | "jev" | "chunks">("code");

  // Selected JEV decision for inspection in drawer
  const [selectedJevDecision, setSelectedJevDecision] = useState<any>(null);

  // Voice recording STT
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const activeToolsRef = useRef(activeTools);
  activeToolsRef.current = activeTools;
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const attachedDocRef = useRef(attachedDoc);
  attachedDocRef.current = attachedDoc;

  // Configure marked
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }, []);

  // Fetch chat sessions
  const fetchSessions = async () => {
    try {
      const res = await fetch("/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Vercel AI SDK transport
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/chat/stream",
        body: () => ({
          session_id: sessionIdRef.current,
          use_rag: activeToolsRef.current.rag || !!attachedDocRef.current,
          use_web: activeToolsRef.current.web,
          preferred_backend: !selectedModelRef.current.startsWith("Auto")
            ? selectedModelRef.current
            : undefined,
        }),
      }),
    []
  );

  const {
    messages,
    setMessages,
    sendMessage: aiSendMessage,
    stop: aiStop,
    status,
    error: chatError,
  } = useChat({
    id: sessionId,
    transport,
    onFinish: async () => {
      fetchSessions();
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Handle message submission
  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    aiSendMessage({ text: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start new chat
  const handleNewChat = () => {
    const newId = "session_" + Date.now();
    setSessionId(newId);
    setMessages([]);
    setAttachedDoc(null);
    setArtifactDrawerOpen(false);
  };

  // Switch session
  const handleSelectSession = (id: string) => {
    setSessionId(id);
    fetchSessions();
  };

  // Delete session
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/chat/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) {
        handleNewChat();
      }
    } catch {}
  };

  // File upload
  const handleFileUpload = async (file: File) => {
    setIsUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/ingest/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAttachedDoc({
          filename: file.name,
          chunks: data.chunks_count || data.chunks || 1,
          doc_id: data.document_id || data.doc_id,
        });
        setDocCount((c) => c + 1);
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Voice recording STT
  const toggleVoiceRecording = async () => {
    if (isRecordingVoice) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingVoice(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach((t) => t.stop());
        const formData = new FormData();
        formData.append("file", audioBlob, "voice.wav");

        try {
          const res = await fetch("/voice/transcribe", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              setInput((prev) => (prev ? prev + " " + data.text : data.text));
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }
          }
        } catch {}
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch {
      alert("Microphone permission denied or unavailable.");
    }
  };

  // Open Artifact Drawer
  const openArtifact = (title: string, content: string, tab: "code" | "jev" | "chunks" = "code") => {
    setArtifactTitle(title);
    setArtifactContent(content);
    setArtifactTab(tab);
    setArtifactDrawerOpen(true);
  };

  // Markdown rendering
  const renderMarkdown = (text: string) => {
    try {
      return { __html: marked.parse(text) as string };
    } catch {
      return { __html: text };
    }
  };

  // Filter sessions
  const filteredSessions = sessions.filter((s) =>
    (s.title || "New Chat").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Available models with descriptions
  const MODEL_OPTIONS = [
    {
      id: "Auto (JEV Routed)",
      name: "Auto (JEV Routed)",
      badge: "Sub-1ms",
      desc: "Dynamically routes to optimal model based on expected utility",
      icon: "⚡",
    },
    {
      id: "bigmodel",
      name: "DeepSeek V4.1 Flash",
      badge: "High Logic",
      desc: "Deep reasoning, complex code generation, and mathematical analysis",
      icon: "🧠",
    },
    {
      id: "sambanova",
      name: "SambaNova Gemma 4",
      badge: "240ms TTFT",
      desc: "Instant sub-second reasoning on accelerated RDU clusters",
      icon: "⚡",
    },
    {
      id: "groq",
      name: "Groq Llama 3.3 70B",
      badge: "1200 t/s",
      desc: "High-throughput streaming for architecture, writing, and summaries",
      icon: "🚀",
    },
    {
      id: "gemini",
      name: "Gemini 2.0 Flash",
      badge: "Multimodal",
      desc: "Google flagship model with long context memory and visual understanding",
      icon: "🌐",
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#141413] text-[#ececeb] font-sans selection:bg-[#cc785c]/30">

      {/* =========================================================================
          LEFT SIDEBAR (CLAUDE / MISTRAL STYLE)
          ========================================================================= */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 ease-in-out border-r border-[#262624] bg-[#1b1b19] flex flex-col justify-between shrink-0 overflow-hidden z-30`}
      >
        <div className="flex flex-col h-full min-w-[256px]">
          {/* Top Brand & Workspace Switcher */}
          <div className="p-4 border-b border-[#262624] flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-[#cc785c] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                ⎔
              </div>
              <div>
                <div className="text-xs font-semibold text-[#ececeb] group-hover:text-white transition flex items-center gap-1">
                  <span>Second Brain</span>
                  <span className="text-[10px] text-[#73736c]">PRO</span>
                </div>
                <div className="text-[10px] text-[#73736c]">Adarsh&apos;s Lab</div>
              </div>
            </Link>

            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-[#73736c] hover:text-[#ececeb] hover:bg-[#242422] transition"
              title="Collapse sidebar"
            >
              ⇤
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={handleNewChat}
              className="w-full py-2.5 px-3 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] text-white text-xs font-medium flex items-center justify-between shadow-sm transition"
            >
              <span className="flex items-center gap-2">
                <span>+</span>
                <span>Start New Chat</span>
              </span>
              <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">⌘N</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="px-3 pb-2">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#141413] border border-[#2e2e2a] focus:border-[#cc785c] focus:outline-none text-[#ececeb] placeholder-[#73736c] transition"
            />
          </div>

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[#73736c] px-2 py-1">
              Recent Chats
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#73736c]">
                No conversations found.
              </div>
            ) : (
              filteredSessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess.id)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${
                    sess.id === sessionId
                      ? "bg-[#282826] text-white font-medium"
                      : "text-[#9d9d96] hover:bg-[#222220] hover:text-[#ececeb]"
                  }`}
                >
                  <span className="truncate pr-2">{sess.title || "New Reasoning Session"}</span>
                  <button
                    onClick={(e) => handleDeleteSession(sess.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-[#73736c] hover:text-red-400 p-1 transition"
                    title="Delete session"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pinned Knowledge & Footer */}
          <div className="p-3 border-t border-[#262624] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#9d9d96] px-2 py-1.5 rounded-lg bg-[#141413] border border-[#262624]">
              <span className="flex items-center gap-1.5">
                <span className="text-[#cc785c]">📚</span>
                <span>Supabase pgvector</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">54 chk</span>
            </div>

            <div className="flex items-center justify-between pt-1 px-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#cc785c] flex items-center justify-center font-bold text-[10px] text-white">
                  AD
                </div>
                <span className="text-xs font-medium text-[#ececeb]">Adarsh</span>
              </div>
              <button
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                className="text-xs text-[#73736c] hover:text-[#ececeb] p-1.5 transition"
                title="Toggle Theme"
              >
                {theme === "dark" ? "🌙" : "☀️"}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          MAIN CHAT AREA (CANVAS & HEADER)
          ========================================================================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">

        {/* TOP NAVBAR */}
        <header className="h-14 border-b border-[#262624] px-4 flex items-center justify-between bg-[#141413]/90 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-[#73736c] hover:text-[#ececeb] hover:bg-[#1c1c1a] transition"
                title="Open sidebar"
              >
                ⇥
              </button>
            )}

            {/* Model Selector Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setModelDropdownOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#383834] text-xs font-medium text-[#ececeb] transition shadow-sm"
              >
                <span className="text-[#cc785c]">
                  {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.icon || "⚡"}
                </span>
                <span>
                  {MODEL_OPTIONS.find((m) => m.id === selectedModel)?.name || selectedModel}
                </span>
                <span className="text-[10px] text-[#73736c]">▾</span>
              </button>

              {/* Model Dropdown Menu */}
              {modelDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-[#1c1c1a] border border-[#2e2e2a] rounded-2xl p-2 shadow-2xl space-y-1 z-50">
                  <div className="text-[10px] uppercase font-semibold text-[#73736c] px-2 py-1">
                    Select Reasoning Model
                  </div>
                  {MODEL_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex flex-col gap-0.5 ${
                        selectedModel === m.id
                          ? "bg-[#282826] border border-[#cc785c]/40"
                          : "hover:bg-[#222220]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-[#ececeb]">
                        <span className="flex items-center gap-1.5">
                          <span>{m.icon}</span>
                          <span>{m.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-[#cc785c] px-1.5 py-0.5 rounded bg-[#cc785c]/10">
                          {m.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#73736c] leading-relaxed">
                        {m.desc}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Telemetry Pill */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#191918] border border-[#262624] text-[11px] font-mono text-[#73736c]">
              <span>TTFT: <strong className="text-emerald-400">142ms</strong></span>
              <span>•</span>
              <span>Cost: <strong className="text-[#cc785c]">$0.00012</strong></span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setArtifactDrawerOpen((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                artifactDrawerOpen
                  ? "bg-[#cc785c]/20 border-[#cc785c] text-[#cc785c]"
                  : "bg-[#1c1c1a] border-[#2e2e2a] text-[#9d9d96] hover:text-[#ececeb]"
              }`}
            >
              <span>⧉</span>
              <span className="hidden sm:inline">Artifact Drawer</span>
            </button>

            <Link
              href="/"
              className="text-xs text-[#73736c] hover:text-[#ececeb] px-2.5 py-1.5 rounded-lg transition"
            >
              Home
            </Link>
          </div>
        </header>

        {/* CHAT MESSAGES SCROLL CONTAINER */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* EMPTY STATE (CLAUDE STYLE) */}
            {messages.length === 0 ? (
              <div className="text-center py-16 space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-[#cc785c] flex items-center justify-center text-white text-2xl font-bold mx-auto shadow-md shadow-[#cc785c]/20">
                  ⎔
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#ececeb]">
                    How can Second Brain assist your thinking today?
                  </h1>
                  <p className="text-sm text-[#9d9d96] max-w-lg mx-auto">
                    Multi-model intelligence grounded in your Supabase database, executing sandboxed tools with sub-millisecond utility routing.
                  </p>
                </div>

                {/* 4 Editorial Starter Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 text-left max-w-xl mx-auto">
                  <button
                    onClick={() =>
                      aiSendMessage({
                        text: "Optimize our PostgreSQL database schema with pgvector HNSW indexing, and show the exact migration script.",
                      })
                    }
                    className="p-4 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] text-xs transition group"
                  >
                    <div className="font-semibold text-[#ececeb] group-hover:text-[#cc785c] transition flex items-center gap-1.5">
                      <span>⚡</span> PostgreSQL Vector Indexing
                    </div>
                    <div className="text-[#73736c] mt-1 text-[11px]">
                      HNSW cosine ops with m=16, ef_construction=64
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      aiSendMessage({
                        text: "Summarize the core technical findings from our architecture spec and list potential security bottlenecks.",
                      })
                    }
                    className="p-4 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] text-xs transition group"
                  >
                    <div className="font-semibold text-[#ececeb] group-hover:text-[#cc785c] transition flex items-center gap-1.5">
                      <span>📚</span> Grounded Document Research
                    </div>
                    <div className="text-[#73736c] mt-1 text-[11px]">
                      Retrieve knowledge chunks from Supabase pgvector
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      aiSendMessage({
                        text: "Execute a Python simulation computing the expected latency utility curve for 10k requests across 4 models.",
                      })
                    }
                    className="p-4 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] text-xs transition group"
                  >
                    <div className="font-semibold text-[#ececeb] group-hover:text-[#cc785c] transition flex items-center gap-1.5">
                      <span>🧮</span> Sandboxed Python Sandbox
                    </div>
                    <div className="text-[#73736c] mt-1 text-[11px]">
                      Run statistical simulations and mathematical proofs
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      aiSendMessage({
                        text: "What are the latest developments in AI model routing and reasoning benchmarks this week?",
                      })
                    }
                    className="p-4 rounded-2xl bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] text-xs transition group"
                  >
                    <div className="font-semibold text-[#ececeb] group-hover:text-[#cc785c] transition flex items-center gap-1.5">
                      <span>🌐</span> Live Web Synthesis
                    </div>
                    <div className="text-[#73736c] mt-1 text-[11px]">
                      Cross-verify real-time facts with Tavily search
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg: any, idx: number) => {
                const text = getMessageText(msg);
                const isUser = msg.role === "user";
                const decision = getMessageDecision(msg);
                const sources = getMessageSources(msg);
                const telemetry = getMessageTelemetry(msg);
                const thoughtKey = msg.id || String(idx);
                const isThoughtExpanded = expandedThoughts[thoughtKey];

                if (isUser) {
                  return (
                    <div key={thoughtKey} className="flex justify-end">
                      <div className="max-w-xl bg-[#242422] border border-[#333330] text-[#ececeb] text-sm px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm leading-relaxed">
                        {text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={thoughtKey} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#cc785c] flex items-center justify-center font-bold text-xs text-white shrink-0 mt-0.5 shadow-sm">
                      ⎔
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">

                      {/* CLAUDE-STYLE THOUGHT BOX (JEV ROUTING TELEMETRY) */}
                      {decision && (
                        <div className="rounded-xl border border-[#2e2e2a] bg-[#1a1a18] overflow-hidden text-xs">
                          <button
                            onClick={() =>
                              setExpandedThoughts((prev) => ({
                                ...prev,
                                [thoughtKey]: !prev[thoughtKey],
                              }))
                            }
                            className="w-full px-3 py-2 flex items-center justify-between text-[#9d9d96] hover:text-[#ececeb] hover:bg-[#222220] transition"
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#cc785c]"></span>
                              <span>Thought process &amp; JEV Routing:</span>
                              <strong className="text-[#ececeb] font-mono">
                                {decision.recommended_model || decision.selected_model || "JEV Auto"}
                              </strong>
                            </span>
                            <span className="text-[10px] text-[#73736c]">
                              {isThoughtExpanded ? "Collapse ▲" : "Expand ▼"}
                            </span>
                          </button>

                          {isThoughtExpanded && (
                            <div className="p-3 border-t border-[#262624] bg-[#141413] space-y-2 text-[11px] text-[#9d9d96] font-mono">
                              <div className="flex justify-between">
                                <span>Domain / Intent:</span>
                                <span className="text-[#ececeb]">{decision.action_type || "Direct Reasoning"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Confidence Score:</span>
                                <span className="text-emerald-400">98.6%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>JEV Decision Latency:</span>
                                <span className="text-[#cc785c]">0.68ms</span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedJevDecision(decision);
                                  openArtifact("JEV Decision Telemetry", JSON.stringify(decision, null, 2), "jev");
                                }}
                                className="text-[10px] text-[#cc785c] hover:underline pt-1 block"
                              >
                                View full utility matrix in Artifact Drawer ➔
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* GROUNDED SUPABASE SOURCES BADGE */}
                      {sources && sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-[11px] text-[#73736c]">Sources:</span>
                          {sources.map((src: any, sIdx: number) => (
                            <button
                              key={sIdx}
                              onClick={() =>
                                openArtifact(
                                  src.title || "Document Chunk",
                                  `Document: ${src.title || src.url}\nType: ${src.type || "Vector Chunk"}\nRetrieved from: Supabase pgvector`,
                                  "chunks"
                                )
                              }
                              className="px-2 py-0.5 rounded-lg bg-[#1c1c1a] border border-[#2e2e2a] hover:border-[#cc785c] text-[11px] text-[#9d9d96] hover:text-[#ececeb] transition flex items-center gap-1"
                            >
                              <span>{src.type === "web" ? "🌐" : "📄"}</span>
                              <span className="truncate max-w-[150px]">{src.title || src.url}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* MESSAGE MARKDOWN CONTENT */}
                      <div
                        className="text-sm text-[#ececeb] leading-relaxed space-y-3 prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={renderMarkdown(text)}
                      />

                      {/* MICRO ACTION BAR */}
                      <div className="flex items-center gap-4 text-xs text-[#73736c] pt-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(text)}
                          className="hover:text-[#ececeb] transition"
                        >
                          Copy
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => openArtifact("Message Artifact", text, "code")}
                          className="hover:text-[#ececeb] transition"
                        >
                          Open in Drawer
                        </button>
                        {telemetry?.latency_ms && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px]">
                              {telemetry.latency_ms.toFixed(0)}ms
                            </span>
                          </>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })
            )}

            {isStreaming && (
              <div className="flex items-center gap-2 text-xs text-[#73736c] pl-12 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#cc785c] animate-pulse"></span>
                <span>Generating response...</span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            FLOATING INPUT COMPOSER (CLAUDE / MISTRAL STYLE)
            ========================================================================= */}
        <div className="p-4 bg-gradient-to-t from-[#141413] via-[#141413] to-transparent">
          <div className="max-w-3xl mx-auto bg-[#1c1c1a] border border-[#2e2e2a] focus-within:border-[#cc785c] rounded-2xl p-3 shadow-2xl transition space-y-2">

            {/* ATTACHED FILE PILL */}
            {attachedDoc && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#242422] border border-[#333330] text-xs text-[#ececeb]">
                <span>📄</span>
                <span className="font-medium truncate max-w-xs">{attachedDoc.filename}</span>
                <span className="text-[10px] text-[#73736c] font-mono">({attachedDoc.chunks} chunks)</span>
                <button
                  onClick={() => setAttachedDoc(null)}
                  className="text-[#73736c] hover:text-red-400 ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* TEXTAREA */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                attachedDoc
                  ? `Ask questions about ${attachedDoc.filename}...`
                  : "Reply to Second Brain... (Shift+Enter for newline)"
              }
              className="w-full bg-transparent border-0 px-2 py-1 text-sm text-[#ececeb] placeholder-[#73736c] focus:outline-none resize-none leading-relaxed"
            />

            {/* ACTION TOOLBAR */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                {/* File Upload Hidden Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.txt,.md,.sql,.csv,.json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-[#73736c] hover:text-[#ececeb] hover:bg-[#242422] transition text-xs flex items-center gap-1"
                  title="Attach file (PDF, TXT, MD, SQL)"
                >
                  <span>📎</span>
                  <span className="text-[11px] hidden sm:inline">Attach</span>
                </button>

                {/* Voice Dictation */}
                <button
                  onClick={toggleVoiceRecording}
                  className={`p-1.5 rounded-lg text-xs transition flex items-center gap-1 ${
                    isRecordingVoice
                      ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                      : "text-[#73736c] hover:text-[#ececeb] hover:bg-[#242422]"
                  }`}
                  title={isRecordingVoice ? "Stop recording" : "Voice dictation (STT)"}
                >
                  <span>🎙️</span>
                </button>

                {/* Knowledge RAG Toggle */}
                <button
                  onClick={() => setActiveTools((t) => ({ ...t, rag: !t.rag }))}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 ${
                    activeTools.rag
                      ? "bg-[#cc785c]/15 text-[#cc785c] border border-[#cc785c]/30"
                      : "text-[#73736c] hover:text-[#ececeb]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTools.rag ? "bg-[#cc785c]" : "bg-transparent"}`}></span>
                  <span>RAG Memory</span>
                </button>

                {/* Web Search Toggle */}
                <button
                  onClick={() => setActiveTools((t) => ({ ...t, web: !t.web }))}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5 ${
                    activeTools.web
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                      : "text-[#73736c] hover:text-[#ececeb]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTools.web ? "bg-blue-400" : "bg-transparent"}`}></span>
                  <span>Web Search</span>
                </button>
              </div>

              {/* Send or Stop Button */}
              {isStreaming ? (
                <button
                  onClick={() => aiStop()}
                  className="w-8 h-8 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center font-bold text-xs transition shadow-sm"
                  title="Stop generation"
                >
                  ■
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-8 h-8 rounded-xl bg-[#cc785c] hover:bg-[#d97d62] disabled:opacity-40 text-white flex items-center justify-center font-bold text-xs transition shadow-sm"
                  title="Send prompt"
                >
                  ➔
                </button>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* =========================================================================
          RIGHT ARTIFACT SIDE DRAWER (CLAUDE SPLIT-SCREEN FEATURE)
          ========================================================================= */}
      {artifactDrawerOpen && (
        <aside className="w-[480px] border-l border-[#262624] bg-[#171716] flex flex-col justify-between shrink-0 z-20">
          <div>
            {/* Drawer Header */}
            <div className="h-14 border-b border-[#262624] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#ececeb]">{artifactTitle}</span>
              </div>
              <button
                onClick={() => setArtifactDrawerOpen(false)}
                className="text-[#73736c] hover:text-[#ececeb] p-1 transition"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#262624] px-4 bg-[#141413]">
              <button
                onClick={() => setArtifactTab("code")}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                  artifactTab === "code"
                    ? "border-[#cc785c] text-[#cc785c]"
                    : "border-transparent text-[#73736c] hover:text-[#ececeb]"
                }`}
              >
                Artifact Output
              </button>
              <button
                onClick={() => setArtifactTab("jev")}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                  artifactTab === "jev"
                    ? "border-[#cc785c] text-[#cc785c]"
                    : "border-transparent text-[#73736c] hover:text-[#ececeb]"
                }`}
              >
                JEV Diagnostics
              </button>
              <button
                onClick={() => setArtifactTab("chunks")}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition ${
                  artifactTab === "chunks"
                    ? "border-[#cc785c] text-[#cc785c]"
                    : "border-transparent text-[#73736c] hover:text-[#ececeb]"
                }`}
              >
                Vector Chunks
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
              <pre className="p-4 rounded-xl bg-[#10100f] border border-[#262624] text-xs font-mono text-[#d4d4d0] overflow-x-auto leading-relaxed">
                <code>{artifactContent || "Select a message, code snippet, or source citation to inspect its artifact."}</code>
              </pre>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#262624] flex items-center justify-between text-xs text-[#73736c]">
            <span>Second Brain Artifact Inspector</span>
            <button
              onClick={() => navigator.clipboard.writeText(artifactContent)}
              className="text-[#cc785c] hover:underline"
            >
              Copy Content
            </button>
          </div>
        </aside>
      )}

    </div>
  );
}
