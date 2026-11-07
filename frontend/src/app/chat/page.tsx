"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";

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

interface TraceItem {
  trace_id?: string;
  model?: string;
  provider?: string;
  selected_model?: string;
  timestamp?: number | string;
  latency_ms?: number;
  ttft_ms?: number;
  tokens_per_sec?: number;
  cost_usd?: number;
  cost?: number;
  total_tokens?: number;
  status?: string;
  prompt_preview?: string;
  response_preview?: string;
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

function getActiveToolExecution(m: any): { tool: string; message: string; state: string } | null {
  if (!m || !Array.isArray(m.parts)) return null;
  for (let i = m.parts.length - 1; i >= 0; i--) {
    const p = m.parts[i];
    if (p && (p.type.startsWith("tool-") || p.type === "tool-invocation")) {
      const toolName = p.toolName || p.type.replace(/^tool-/, "");
      const state = p.state || "executing";
      let msg = p.input?.message || (state === "output-available" ? `Tool ${toolName} completed` : `Executing ${toolName}...`);
      if (toolName === "web_search" || toolName.includes("web")) {
        msg = state === "output-available" ? "Web search completed" : "Searching live web...";
      } else if (toolName === "knowledge_rag_search" || toolName.includes("rag")) {
        msg = state === "output-available" ? "Context retrieved from documents" : "Retrieving relevant knowledge...";
      } else if (toolName === "calculator") {
        msg = state === "output-available" ? "Calculation completed" : "Executing calculator...";
      }
      return { tool: toolName, message: msg, state };
    }
  }
  return null;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeTools, setActiveTools] = useState({ rag: false, web: false });
  const [selectedModel, setSelectedModel] = useState("Auto (JEV Routed)");

  // Threading / Chat Sessions
  const [sessionId, setSessionId] = useState<string>(() => "session_" + Date.now());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Documents & RAG Upload
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [docCount, setDocCount] = useState<number>(0);
  const [documentsList, setDocumentsList] = useState<any[]>([]);
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  // MCP Server
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [mcpInfo, setMcpInfo] = useState<any>(null);
  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const [selectedMcpTool, setSelectedMcpTool] = useState<string>("calculator");
  const [mcpToolArg, setMcpToolArg] = useState<string>("sqrt(144) + sin(pi/4) * 10");
  const [mcpResult, setMcpResult] = useState<string | null>(null);
  const [isExecutingMcp, setIsExecutingMcp] = useState(false);

  // Cache stats
  const [cacheStats, setCacheStats] = useState<any>(null);

  // Tool status for real-time indicator
  const [currentToolStatus, setCurrentToolStatus] = useState<string | null>(null);

  // Modals
  const [jevStudioOpen, setJevStudioOpen] = useState(false);
  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [jevInspectOpen, setJevInspectOpen] = useState(false);
  const [inspectDecision, setInspectDecision] = useState<any>(null);

  // JEV Weights
  const [wAcc, setWAcc] = useState(0.40);
  const [wSpd, setWSpd] = useState(0.30);
  const [wCst, setWCst] = useState(0.20);
  const [wFit, setWFit] = useState(0.10);

  // Observability traces
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Advanced Suite 1: Command Palette, Voice & Export
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // Advanced Suite 2: Code Canvas / Artifacts View
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasTitle, setCanvasTitle] = useState("Artifact Canvas");
  const [canvasContent, setCanvasContent] = useState("");

  // Advanced Suite 3: Document Chunk Inspector
  const [chunkInspectorOpen, setChunkInspectorOpen] = useState(false);
  const [inspectingDocId, setInspectingDocId] = useState("");
  const [inspectingDocTitle, setInspectingDocTitle] = useState("");
  const [inspectingChunks, setInspectingChunks] = useState<any[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Advanced Suite 4: Dynamic MCP Servers & Budget Guardrail
  const [externalServers, setExternalServers] = useState<any[]>([]);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [budgetInfo, setBudgetInfo] = useState<any>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Synchronized refs for real-time streaming options
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const activeToolsRef = useRef(activeTools);
  activeToolsRef.current = activeTools;
  const attachedDocRef = useRef(attachedDoc);
  attachedDocRef.current = attachedDoc;
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/chat/stream",
        body: () => ({
          session_id: sessionIdRef.current,
          use_rag: activeToolsRef.current.rag || !!attachedDocRef.current,
          use_web: activeToolsRef.current.web,
          preferred_backend:
            !selectedModelRef.current.startsWith("Auto")
              ? selectedModelRef.current
              : undefined,
        }),
      }),
    []
  );

  // Official Vercel AI SDK useChat integration
  const {
    messages,
    setMessages,
    sendMessage: aiSendMessage,
    stop: aiStop,
    regenerate: aiRegenerate,
    status,
    error: chatError,
  } = useChat({
    id: sessionId,
    transport,
    onFinish: async () => {
      fetchSessions();
      try {
        const curSess = sessions.find((s) => s.id === sessionIdRef.current);
        if (!curSess || curSess.title === "New Chat" || !curSess.title) {
          await fetch(`/chat/sessions/${sessionIdRef.current}/auto-title`, { method: "POST" });
          fetchSessions();
        }
      } catch {}
    },
  });

  const isStreaming = status === "submitted" || status === "streaming";

  // Automatically sync model name from latest JEV decision in message parts
  useEffect(() => {
    // Only sync auto-routed model indicator when user has explicitly selected Auto mode
    if (messages.length > 0 && selectedModel.startsWith("Auto")) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role === "assistant") {
          const dec = getMessageDecision(m);
          if (dec) {
            const mName = dec.recommended_model || dec.selected_model || dec.model;
            if (mName && mName !== selectedModel) {
              // Keep Auto as prefix so user knows it's auto-routed
              setSelectedModel(`Auto (${mName})`);
            }
            break;
          }
        }
      }
    }
  }, [messages]);

  // Setup marked renderer
  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
      const validLang = (lang && hljs.getLanguage(lang)) ? lang : "";
      let highlighted = text;
      try {
        highlighted = validLang
          ? hljs.highlight(text, { language: validLang }).value
          : hljs.highlightAuto(text).value;
      } catch {
        highlighted = text;
      }
      const displayLang = validLang || "code";
      const escapedCode = text.replace(/"/g, "&quot;");
      return `
        <div class="code-block-wrapper">
          <div class="code-header">
            <span>${displayLang}</span>
            <button class="btn-copy-code" onclick="navigator.clipboard.writeText(this.getAttribute('data-raw')).then(() => { const old = this.innerHTML; this.innerHTML = '<i class=\\'fa-solid fa-check\\' style=\\'color:#10a37f;\\'></i> Copied!'; setTimeout(() => { this.innerHTML = old; }, 2000); })" data-raw="${escapedCode}">
              <i class="fa-regular fa-clone"></i> Copy code
            </button>
          </div>
          <pre><code class="hljs ${validLang}">${highlighted}</code></pre>
        </div>
      `;
    };

    marked.setOptions({
      breaks: true,
      gfm: true,
      renderer: renderer,
    });
  }, []);

  // Fetch sessions from DB
  const fetchSessions = async () => {
    try {
      const res = await fetch("/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : (data.sessions || []));
      }
    } catch (e) {
      console.warn("Failed to fetch sessions:", e);
    }
  };

  // Fetch document count and list
  const fetchDocs = async () => {
    try {
      const res = await fetch("/ingest/documents");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.documents || []);
        setDocumentsList(list);
        setDocCount(list.length);
      }
    } catch (e) {
      console.warn("Failed to fetch documents:", e);
    }
  };

  const fetchCacheStats = async () => {
    try {
      const res = await fetch("/eval/cache/stats");
      if (res.ok) {
        const data = await res.json();
        setCacheStats(data);
      }
    } catch (e) {
      console.warn("Failed to fetch cache stats:", e);
    }
  };

  const handleClearCache = async () => {
    try {
      await fetch("/eval/cache/clear", { method: "POST" });
      fetchCacheStats();
      alert("Cache cleared successfully.");
    } catch (e) {
      alert("Failed to clear cache: " + e);
    }
  };

  const fetchMcpInfo = async () => {
    try {
      const [resInfo, resTools] = await Promise.all([
        fetch("/mcp/info"),
        fetch("/mcp/tools")
      ]);
      if (resInfo.ok) {
        const data = await resInfo.json();
        setMcpInfo(data);
      }
      if (resTools.ok) {
        const toolsData = await resTools.json();
        setMcpTools(toolsData.tools || []);
      }
    } catch (e) {
      console.warn("Failed to fetch MCP server info:", e);
    }
  };

  const runMcpToolTest = async () => {
    setIsExecutingMcp(true);
    setMcpResult(null);
    try {
      let args: any = {};
      if (selectedMcpTool === "calculator") {
        args = { expression: mcpToolArg };
      } else if (selectedMcpTool === "python_interpreter") {
        args = { code: mcpToolArg };
      } else if (selectedMcpTool === "sqlite_database_explorer") {
        args = { action: mcpToolArg || "tables" };
      } else if (selectedMcpTool === "knowledge_rag_search" || selectedMcpTool === "web_search") {
        args = { query: mcpToolArg, top_k: 3, max_results: 3 };
      }
      const res = await fetch("/mcp/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedMcpTool, arguments: args })
      });
      const data = await res.json();
      setMcpResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setMcpResult(JSON.stringify({ error: e.message || String(e) }, null, 2));
    } finally {
      setIsExecutingMcp(false);
    }
  };

  // Load saved theme and initialize sessions on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sb_theme") as "dark" | "light" | null;
      if (saved) {
        setTheme(saved);
      }
      if (typeof window !== "undefined" && window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    } catch {}

    fetchSessions();
    fetchDocs();
    fetchCacheStats();
    fetchMcpInfo();
    fetchMcpServers();
    fetchBudgetInfo();
  }, []);

  // Command Palette Keyboard Listener (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setCanvasOpen(false);
        setChunkInspectorOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Voice Speech-to-Text Recognition
  const speechRecognitionRef = useRef<any>(null);
  const toggleVoiceRecording = () => {
    if (isRecordingVoice) {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
      setIsRecordingVoice(false);
      return;
    }
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onstart = () => setIsRecordingVoice(true);
      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput((prev) => (prev ? prev + " " + transcript.trim() : transcript.trim()));
          if (textareaRef.current) autoResizeTextarea(textareaRef.current);
        }
      };
      rec.onerror = () => setIsRecordingVoice(false);
      rec.onend = () => setIsRecordingVoice(false);
      speechRecognitionRef.current = rec;
      rec.start();
    } catch {
      setIsRecordingVoice(false);
    }
  };

  // Export Chat to Markdown
  const exportChatMarkdown = async () => {
    try {
      const res = await fetch(`/chat/sessions/${sessionId}/export?format=markdown`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([data.markdown || ""], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(data.title || "conversation").replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert("Failed to export conversation: " + e);
    }
  };

  // Open Document Chunk Inspector
  const openChunkInspector = async (docId: string, title: string) => {
    setInspectingDocId(docId);
    setInspectingDocTitle(title);
    setInspectingChunks([]);
    setLoadingChunks(true);
    setChunkInspectorOpen(true);
    try {
      const res = await fetch(`/ingest/documents/${encodeURIComponent(docId)}/chunks`);
      if (res.ok) {
        const data = await res.json();
        setInspectingChunks(data.chunks || []);
      }
    } catch (e) {
      console.error("Failed to fetch doc chunks:", e);
    } finally {
      setLoadingChunks(false);
    }
  };

  // Code Canvas / Artifacts Side Drawer
  const openInCanvas = (title: string, code: string) => {
    setCanvasTitle(title);
    setCanvasContent(code);
    setCanvasOpen(true);
  };

  // Dynamic MCP Servers
  const fetchMcpServers = async () => {
    try {
      const res = await fetch("/mcp/servers");
      if (res.ok) {
        const data = await res.json();
        setExternalServers(data.servers || []);
      }
    } catch {}
  };

  const registerExternalServer = async () => {
    if (!newServerName.trim() || !newServerUrl.trim()) return;
    try {
      await fetch("/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServerName.trim(), url: newServerUrl.trim() }),
      });
      setNewServerName("");
      setNewServerUrl("");
      fetchMcpServers();
    } catch (e) {
      alert("Failed to register MCP server: " + e);
    }
  };

  const fetchBudgetInfo = async () => {
    try {
      const res = await fetch("/eval/budget");
      if (res.ok) {
        const data = await res.json();
        setBudgetInfo(data);
      }
    } catch {}
  };

  // Theme synchronization with body and html
  useEffect(() => {
    if (theme === "light") {
      document.body.setAttribute("data-theme", "light");
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.body.removeAttribute("data-theme");
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

  // Auto-scroll
  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, currentToolStatus]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("sb_theme", next);
      } catch {}
      return next;
    });
  };

  const toggleTool = (tool: "rag" | "web") => {
    setActiveTools((prev) => ({ ...prev, [tool]: !prev[tool] }));
  };

  const autoResizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming) {
        sendMessage(input.trim());
      }
    }
  };

  const startNewChat = () => {
    if (isStreaming) {
      aiStop();
    }
    setMessages([]);
    setInput("");
    setAttachedDoc(null);
    setCurrentToolStatus(null);
    setSessionId("session_" + Date.now());
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const loadSession = async (id: string) => {
    if (isStreaming) {
      aiStop();
    }
    setSessionId(id);
    setCurrentToolStatus(null);
    try {
      const res = await fetch(`/chat/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        const turns = data.turns || [];
        const loadedMsgs: any[] = [];
        turns.forEach((t: any) => {
          if (t.role && t.content) {
            const parts: any[] = [{ type: "text", text: t.content }];
            if (t.sources && Array.isArray(t.sources)) {
              t.sources.forEach((s: any, idx: number) => {
                if (s.type === "web" || s.url) {
                  parts.push({ type: "source-url", sourceId: `web_${idx}`, url: s.url, title: s.title || s.url || "Web Source" });
                } else {
                  parts.push({ type: "source-document", sourceId: `doc_${idx}`, mediaType: "text/plain", title: s.title || s.filename || "Document" });
                }
              });
            }
            if (t.decision) {
              parts.push({ type: "data-jev", data: t.decision });
            }
            loadedMsgs.push({
              id: t.id || `msg-${Math.random()}`,
              role: t.role,
              content: t.content,
              parts,
            });
          } else {
            if (t.user_query) {
              loadedMsgs.push({
                id: `turn-u-${t.id || Math.random()}`,
                role: "user",
                content: t.user_query,
                parts: [{ type: "text", text: t.user_query }],
              });
            }
            if (t.assistant_response) {
              const parts: any[] = [{ type: "text", text: t.assistant_response }];
              if (t.decision_data) {
                parts.push({ type: "data-jev", data: t.decision_data });
              }
              loadedMsgs.push({
                id: `turn-a-${t.id || Math.random()}`,
                role: "assistant",
                content: t.assistant_response,
                parts,
              });
            }
          }
        });
        setMessages(loadedMsgs);
      }
    } catch (e) {
      console.error("Failed to load session turns:", e);
    }
  };

  const handleSessionClick = (id: string) => {
    loadSession(id);
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewChatClick = () => {
    startNewChat();
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const saveRename = async (id: string) => {
    if (!renameTitle.trim()) {
      setRenamingSessionId(null);
      return;
    }
    try {
      await fetch(`/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: renameTitle.trim() } : s))
      );
    } catch (e) {
      console.error("Failed to rename session:", e);
    } finally {
      setRenamingSessionId(null);
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await fetch(`/chat/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) {
        startNewChat();
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/ingest/file", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      setAttachedDoc({
        filename: data.filename || file.name,
        chunks: data.chunks || 1,
        doc_id: data.doc_id || "",
      });
      // Automatically enable RAG tool when user uploads a file
      setActiveTools((prev) => ({ ...prev, rag: true }));
      fetchDocs();
    } catch (err: any) {
      alert("Failed to upload document: " + (err.message || "Unknown error"));
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (modalFileInputRef.current) modalFileInputRef.current.value = "";
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document from your knowledge base?")) return;
    try {
      await fetch(`/ingest/documents/${encodeURIComponent(docId)}`, { method: "DELETE" });
      fetchDocs();
    } catch (e) {
      console.error("Failed to delete doc:", e);
    }
  };

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;
    setInput("");
    setCurrentToolStatus(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    try {
      await aiSendMessage({ text: textToSend.trim() });
    } catch (err: any) {
      console.error("Failed to send message via Vercel AI SDK:", err);
    }
  };

  const handleSendOrStop = () => {
    if (isStreaming) {
      aiStop();
    } else {
      sendMessage(input);
    }
  };

  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const openJevDetails = (decision: any) => {
    setInspectDecision(decision);
    setJevInspectOpen(true);
  };

  const refreshTraces = async () => {
    setLoadingTraces(true);
    try {
      const res = await fetch("/eval/traces?limit=15");
      if (res.ok) {
        const data = await res.json();
        setTraces(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore trace fetch error
    } finally {
      setLoadingTraces(false);
    }
    fetchCacheStats();
  };

  const updateJevWeights = async (
    acc = wAcc,
    spd = wSpd,
    cst = wCst,
    fit = wFit
  ) => {
    try {
      await fetch("/eval/jev/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          w_acc: acc,
          w_spd: spd,
          w_cst: cst,
          w_fit: fit,
        }),
      });
    } catch (e) {
      console.warn("Failed to update weights on server:", e);
    }
  };

  const parseSuggestions = (content: string, userQuery?: string): { body: string; suggestions: string[] } => {
    if (!content) return { body: "", suggestions: [] };
    const delimiter = "<<<SUGGESTIONS>>>";
    if (content.includes(delimiter)) {
      const parts = content.split(delimiter);
      const body = parts[0].trim();
      const rawSuggestions = parts[1] || "";
      const suggestions = rawSuggestions
        .split("\n")
        .map((s) => s.replace(/^[-*•0-9.)\s]+/, "").trim())
        .filter((s) => s.length > 3 && s.length < 130)
        .slice(0, 3);
      return { body, suggestions };
    }

    const sugMatch = content.match(/(\n---\s*\nSuggestions:?|\n###\s*Suggested Next Steps:?|\nSuggestions:?)\s*\n([\s\S]+)$/i);
    if (sugMatch && sugMatch[2]) {
      const body = content.substring(0, sugMatch.index).trim();
      const suggestions = sugMatch[2]
        .split("\n")
        .map((s) => s.replace(/^[-*•0-9.)\s]+/, "").trim())
        .filter((s) => s.length > 3 && s.length < 130)
        .slice(0, 3);
      if (suggestions.length > 0) {
        return { body, suggestions };
      }
    }

    const q = (userQuery || "").toLowerCase();
    let fallback: string[] = [];
    if (q.includes("code") || q.includes("script") || q.includes("function") || q.includes("python") || q.includes("bug") || q.includes("error")) {
      fallback = [
        "Can you provide a complete, working code example?",
        "How can I handle potential errors or edge cases?",
        "How can this be optimized for production performance?",
      ];
    } else if (q.includes("explain") || q.includes("what is") || q.includes("how does")) {
      fallback = [
        "Can you explain this with a practical real-world analogy?",
        "What are the main pros and cons of this approach?",
        "Could you summarize the key takeaways in bullet points?",
      ];
    } else if (q.includes("compare") || q.includes("difference") || q.includes("vs")) {
      fallback = [
        "Which option would you recommend for my specific use-case?",
        "What is the cost and scalability difference between them?",
        "Can you format the comparison as a structured summary table?",
      ];
    } else {
      fallback = [
        "Could you elaborate more on the key points?",
        "What are the best practices to keep in mind?",
        "Give me a step-by-step implementation guide.",
      ];
    }

    let cleanBody = content;
    const delimIdx = cleanBody.indexOf("<<<SUGGESTIONS>>>");
    if (delimIdx !== -1) {
      cleanBody = cleanBody.substring(0, delimIdx).trim();
    }

    return { body: cleanBody, suggestions: fallback };
  };

  const renderMarkdown = (rawMarkdown: string) => {
    try {
      return { __html: marked.parse(rawMarkdown) as string };
    } catch {
      return { __html: rawMarkdown };
    }
  };

  // Group chat sessions like ChatGPT
  const groupSessions = (sessionList: ChatSession[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7Days = today - 7 * 86400000;

    const groups: { [key: string]: ChatSession[] } = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    };

    sessionList.forEach((s) => {
      const sDate = s.updated_at ? new Date(s.updated_at).getTime() : now.getTime();
      if (sDate >= today) {
        groups["Today"].push(s);
      } else if (sDate >= yesterday) {
        groups["Yesterday"].push(s);
      } else if (sDate >= last7Days) {
        groups["Previous 7 Days"].push(s);
      } else {
        groups["Older"].push(s);
      }
    });

    return groups;
  };

  const groupedSessions = groupSessions(sessions);

  return (
    <div className="chat-app-root">
      {/* SIDEBAR (CHATGPT STYLE) */}
      <aside id="sidebar" className={sidebarOpen ? "open" : "collapsed"}>
        <div className="sidebar-brand-row">
          <div className="sidebar-brand" onClick={handleNewChatClick}>
            <img src="/logo.svg" alt="Second Brain" className="sidebar-logo-img" />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Second Brain</span>
              <span className="sidebar-brand-tag">AI</span>
            </div>
          </div>
          <button
            className="sidebar-toggle-btn sidebar-close-btn"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <i className="fa-solid fa-chevron-left desktop-chevron"></i>
            <i className="fa-solid fa-xmark mobile-xmark"></i>
          </button>
        </div>

        <div className="sidebar-action-row">
          <button className="btn-new-chat" id="btn-new-chat" onClick={handleNewChatClick}>
            <i className="fa-solid fa-plus"></i>
            <span>New chat</span>
          </button>
        </div>

        {/* CHAT SESSIONS THREADING LIST */}
        <div className="chat-history-list" id="chat-history-list">
          {sessions.length === 0 ? (
            <div style={{ padding: "20px 14px", color: "var(--text-muted)", fontSize: "12.5px", textAlign: "center", lineHeight: 1.5 }}>
              No chat history yet.<br />Start a new conversation!
            </div>
          ) : (
            Object.entries(groupedSessions).map(([groupName, groupItems]) => {
              if (groupItems.length === 0) return null;
              return (
                <div key={groupName} className="history-group">
                  <div className="history-group-title">{groupName}</div>
                  {groupItems.map((sess) => (
                    <div
                      key={sess.id}
                      className={`chat-history-item ${sess.id === sessionId ? "active" : ""}`}
                      onClick={() => handleSessionClick(sess.id)}
                    >
                      <div className="chat-history-content">
                        <i className="fa-regular fa-message" style={{ fontSize: "12px", opacity: 0.7 }}></i>
                        {renamingSessionId === sess.id ? (
                          <input
                            type="text"
                            className="chat-history-rename-input"
                            value={renameTitle}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename(sess.id);
                              if (e.key === "Escape") setRenamingSessionId(null);
                            }}
                            onBlur={() => saveRename(sess.id)}
                          />
                        ) : (
                          <span className="chat-history-title" title={sess.title}>
                            {sess.title || "New Chat"}
                          </span>
                        )}
                      </div>
                      {renamingSessionId !== sess.id && (
                        <div className="chat-item-actions">
                          <button
                            className="chat-action-btn"
                            title="Rename chat"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingSessionId(sess.id);
                              setRenameTitle(sess.title || "");
                            }}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            className="chat-action-btn delete"
                            title="Delete chat"
                            onClick={(e) => deleteSession(sess.id, e)}
                          >
                            <i className="fa-regular fa-trash-can"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-footer">
          <button
            className="sidebar-footer-btn"
            onClick={() => {
              setDocsModalOpen(true);
              fetchDocs();
              if (typeof window !== "undefined" && window.innerWidth <= 768) {
                setSidebarOpen(false);
              }
            }}
          >
            <i className="fa-solid fa-book-bookmark" style={{ color: "#10a37f" }}></i>
            <span>Knowledge &amp; Docs</span>
            {docCount > 0 && <span className="sidebar-badge">{docCount}</span>}
          </button>
          <button
            className="sidebar-footer-btn"
            onClick={() => {
              setJevStudioOpen(true);
              if (typeof window !== "undefined" && window.innerWidth <= 768) {
                setSidebarOpen(false);
              }
            }}
          >
            <i className="fa-solid fa-sliders" style={{ color: "#f59e0b" }}></i>
            <span>JEV Decision Studio</span>
          </button>
          <button
            className="sidebar-footer-btn"
            onClick={() => {
              setObsModalOpen(true);
              refreshTraces();
              if (typeof window !== "undefined" && window.innerWidth <= 768) {
                setSidebarOpen(false);
              }
            }}
          >
            <i className="fa-solid fa-chart-line" style={{ color: "#60a5fa" }}></i>
            <span>Observability &amp; Traces</span>
          </button>
          <button
            className="sidebar-footer-btn"
            onClick={() => {
              setMcpModalOpen(true);
              fetchMcpInfo();
              if (typeof window !== "undefined" && window.innerWidth <= 768) {
                setSidebarOpen(false);
              }
            }}
          >
            <i className="fa-solid fa-server" style={{ color: "#a855f7" }}></i>
            <span>MCP Server</span>
            <span className="sidebar-badge" style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}>Online</span>
          </button>
          <button className="sidebar-footer-btn" onClick={toggleTheme}>
            <i
              className={theme === "dark" ? "fa-regular fa-moon" : "fa-regular fa-sun"}
              id="theme-icon"
            ></i>
            <span id="theme-text">
              {theme === "dark" ? "Dark Mode" : "Light Mode"}
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main id="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="sidebar-toggle-btn topbar-hamburger"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-label="Toggle sidebar"
            >
              <i className="fa-solid fa-bars"></i>
            </button>
            <div className="topbar-brand" onClick={handleNewChatClick}>
              <img src="/logo.svg" alt="Second Brain" className="topbar-logo-img" />
              <span className="topbar-brand-title">Second Brain</span>
            </div>
            <div
              className="model-selector-pill"
              onClick={() => setJevStudioOpen(true)}
              id="model-display-btn"
            >
              <i className="fa-solid fa-bolt" style={{ color: "#10a37f" }}></i>
              <span id="selected-model-name">{selectedModel}</span>
              <i
                className="fa-solid fa-chevron-down"
                style={{ fontSize: "11px", color: "var(--text-muted)" }}
              ></i>
            </div>
          </div>
          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              className="topbar-icon-btn"
              onClick={() => setCommandPaletteOpen(true)}
              title="Command Palette (Ctrl + K)"
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              <i className="fa-solid fa-terminal" style={{ fontSize: "12px", color: "var(--accent-primary)" }}></i>
              <span className="topbar-btn-text" style={{ fontSize: "11px", opacity: 0.8 }}>Cmd+K</span>
            </button>
            <button
              className="topbar-icon-btn"
              onClick={exportChatMarkdown}
              title="Export Conversation to Markdown"
            >
              <i className="fa-solid fa-arrow-down-to-bracket" style={{ fontSize: "12px" }}></i>
              <span className="topbar-btn-text">Export</span>
            </button>
            <button
              className={`topbar-icon-btn ${canvasOpen ? "active" : ""}`}
              onClick={() => setCanvasOpen((prev) => !prev)}
              title="Toggle Code Canvas / Artifacts"
            >
              <i className="fa-solid fa-layer-group" style={{ fontSize: "12px", color: "#38bdf8" }}></i>
              <span className="topbar-btn-text">Canvas</span>
            </button>
            <button
              className="topbar-icon-btn btn-new-chat-top"
              onClick={handleNewChatClick}
              title="New Chat"
            >
              <i className="fa-solid fa-plus"></i>
              <span className="topbar-btn-text">New chat</span>
            </button>
          </div>
        </header>

        <div id="chat-scroll-container" ref={chatScrollRef}>
          <div className="chat-max-width" id="chat-stream-container">
            {messages.length === 0 ? (
              <div className="welcome-container" id="welcome-screen">
                <div className="welcome-icon">
                  <img src="/logo.svg" alt="Second Brain" className="welcome-logo-img" />
                </div>
                <h1 className="welcome-title">What can I help you with today?</h1>
                <p className="welcome-subtitle">
                  Autonomous Multi-LLM intelligence with automatic RAG document retrieval &amp; real-time web search.
                </p>
                <div className="suggestion-grid">
                  <div
                    className="suggestion-card"
                    onClick={() =>
                      sendMessage("Explain Quantum Computing superposition simply")
                    }
                  >
                    <div className="sug-title">&#9883; Quantum Computing</div>
                    <div className="sug-desc">
                      Explain superposition and entanglement simply
                    </div>
                  </div>
                  <div
                    className="suggestion-card"
                    onClick={() =>
                      sendMessage(
                        "Write a clean Python script for async web scraping with error retry"
                      )
                    }
                  >
                    <div className="sug-title">&#128013; Python Scripting</div>
                    <div className="sug-desc">
                      Async web scraper with rate limiting and exponential backoff
                    </div>
                  </div>
                  <div
                    className="suggestion-card"
                    onClick={() =>
                      sendMessage(
                        "What are the latest AI news and updates from this week?"
                      )
                    }
                  >
                    <div className="sug-title">&#127760; Live Web Search</div>
                    <div className="sug-desc">
                      Automatically queries live web search for real-time news
                    </div>
                  </div>
                  <div
                    className="suggestion-card"
                    onClick={() =>
                      sendMessage(
                        "Draft a concise executive summary for an AI architectural migration"
                      )
                    }
                  >
                    <div className="sug-title">&#128195; Executive Summary</div>
                    <div className="sug-desc">
                      High-level architecture proposal with cost estimation
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg: any, idx: number) => {
                const rawText = getMessageText(msg);
                if (msg.role === "user") {
                  return (
                    <div key={msg.id || idx} className="message-row user-row" style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                      <button
                        className="chat-action-btn"
                        onClick={() => {
                          setInput(rawText);
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            autoResizeTextarea(textareaRef.current);
                          }
                        }}
                        title="Edit prompt and re-send"
                        style={{ opacity: 0.6, fontSize: "11px", marginBottom: "4px" }}
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <div className="user-bubble">{rawText}</div>
                    </div>
                  );
                }

                // Assistant message with parts extraction
                const previousQuery = getMessageText(messages[idx - 1]);
                const parsed = parseSuggestions(rawText, previousQuery);
                const msgSources = getMessageSources(msg);
                const msgDecision = getMessageDecision(msg);
                const msgTelemetry = getMessageTelemetry(msg);
                const toolExec = getActiveToolExecution(msg);

                return (
                  <div
                    key={msg.id || idx}
                    className="message-row assistant-row"
                    id={msg.id}
                  >
                    <div className="msg-avatar assistant-avatar">
                      <img src="/logo.svg" alt="SB" style={{ width: "20px", height: "20px" }} />
                    </div>
                    <div
                      className="msg-bubble-wrap"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      {/* Active tool status pill */}
                      {isStreaming && idx === messages.length - 1 && toolExec && toolExec.state !== "output-available" && (
                        <div className="tool-status-pill">
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                          <span>{toolExec.message}</span>
                        </div>
                      )}

                      {/* Completed tool status pill */}
                      {toolExec && toolExec.state === "output-available" && (
                        <div className="tool-status-pill completed">
                          <i className="fa-solid fa-check" style={{ color: "#10a37f" }}></i>
                          <span>{toolExec.message}</span>
                        </div>
                      )}

                      <div className="assistant-body" id={`${msg.id}-body`}>
                        {parsed.body ? (
                          <>
                            <div
                              dangerouslySetInnerHTML={renderMarkdown(
                                parsed.body
                              )}
                            />
                            {isStreaming && idx === messages.length - 1 && (
                              <span
                                className="streaming-cursor"
                                title="Streaming..."
                              ></span>
                            )}
                          </>
                        ) : isStreaming && idx === messages.length - 1 ? (
                          <div className="typing-indicator">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>
                            No response content generated.
                          </span>
                        )}
                      </div>

                      {/* Source Citations & References */}
                      {msgSources && msgSources.length > 0 && (
                        <div className="message-sources">
                          <div className="sources-label">
                            <i className="fa-solid fa-book-open"></i> Sources &amp; References:
                          </div>
                          <div className="sources-list">
                            {msgSources.map((src: any, sIdx: number) => {
                              const isWeb = src.type === "web" || src.url;
                              const title = src.title || src.filename || src.url || "Document Source";
                              return isWeb ? (
                                <a
                                  key={sIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="source-pill"
                                  title={src.url}
                                >
                                  <i className="fa-solid fa-globe" style={{ color: "#38bdf8" }}></i>
                                  <span>{title}</span>
                                </a>
                              ) : (
                                <div key={sIdx} className="source-pill" title={title}>
                                  <i className="fa-regular fa-file-lines" style={{ color: "#10a37f" }}></i>
                                  <span>{title}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {rawText && (
                        <div
                          className="assistant-actions"
                          id={`${msg.id}-actions`}
                        >
                          <button
                            className="action-btn"
                            onClick={() =>
                              copyMessage(parsed.body || rawText, msg.id)
                            }
                            title="Copy response"
                          >
                            <i
                              className={
                                copiedId === msg.id
                                  ? "fa-solid fa-check"
                                  : "fa-regular fa-clone"
                              }
                              style={{
                                color:
                                  copiedId === msg.id ? "#10a37f" : undefined,
                              }}
                            ></i>
                          </button>
                          <button
                            className="action-btn"
                            onClick={() =>
                              alert("Thanks for the positive feedback!")
                            }
                            title="Good response"
                          >
                            <i className="fa-regular fa-thumbs-up"></i>
                          </button>
                          <button
                            className="action-btn"
                            onClick={() =>
                              alert(
                                "Thanks for the feedback. We will optimize model routing."
                              )
                            }
                            title="Poor response"
                          >
                            <i className="fa-regular fa-thumbs-down"></i>
                          </button>

                          {/* Open in Canvas Button */}
                          <button
                            className="action-btn"
                            onClick={() => openInCanvas("AI Assistant Output", parsed.body || rawText)}
                            title="Open in Code Canvas / Artifact View"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: "#38bdf8" }}></i>
                          </button>

                          {/* Regenerate Button */}
                          {!isStreaming && idx === messages.length - 1 && (
                            <button
                              className="action-btn"
                              onClick={() => aiRegenerate()}
                              title="Regenerate response"
                            >
                              <i className="fa-solid fa-rotate-right"></i>
                            </button>
                          )}

                          {/* Cache indicator badge */}
                          {msgTelemetry?.is_cached && (
                            <div className="cache-indicator-pill" title={`Cached response (${msgTelemetry.cache_type || 'exact'})`}>
                              <i className="fa-solid fa-bolt" style={{ color: "#10a37f" }}></i>
                              <span>
                                {msgTelemetry.cache_type === "semantic"
                                  ? `Semantic Cache (${Math.round((msgTelemetry.similarity_score || 0.88) * 100)}%)`
                                  : "Exact Cache (1ms)"}
                              </span>
                            </div>
                          )}

                          {/* Tracing latency & tokens indicator */}
                          {(msgTelemetry?.latency_ms || msgTelemetry?.tokens_per_sec) && !msgTelemetry?.is_cached && (
                            <div
                              className="trace-indicator-pill"
                              title="Click to view Observability Traces"
                              onClick={() => {
                                setObsModalOpen(true);
                                refreshTraces();
                              }}
                            >
                              <i className="fa-solid fa-chart-line"></i>
                              <span>
                                {msgTelemetry.latency_ms ? `${msgTelemetry.latency_ms.toFixed(0)}ms` : ""}
                                {msgTelemetry.tokens_per_sec ? ` • ${msgTelemetry.tokens_per_sec.toFixed(0)} tok/s` : ""}
                              </span>
                            </div>
                          )}

                          {msgDecision && (
                            <div
                              className="jev-indicator-pill"
                              id={`${msg.id}-jev-pill`}
                              onClick={() => openJevDetails(msgDecision)}
                            >
                              <i
                                className="fa-solid fa-bolt"
                                style={{ color: "#10a37f" }}
                              ></i>
                              <span className="jev-label">
                                {msgDecision.recommended_model ||
                                  msgDecision.selected_model ||
                                  "JEV Routed"}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error banner with retry */}
                      {chatError && idx === messages.length - 1 && (
                        <div className="chat-error-banner">
                          <i className="fa-solid fa-triangle-exclamation"></i>
                          <span>{chatError.message || "Failed to stream response."}</span>
                          <button className="btn-retry" onClick={() => aiRegenerate()}>
                            <i className="fa-solid fa-rotate-right"></i> Retry
                          </button>
                        </div>
                      )}

                      {/* FOLLOW-UP SUGGESTIONS (LIKE CHATGPT) */}
                      {!(isStreaming && idx === messages.length - 1) &&
                        parsed.suggestions.length > 0 && (
                          <div className="followup-suggestions">
                            <div className="followup-header">
                              <i className="fa-regular fa-compass"></i>
                              <span>Suggested follow-ups</span>
                            </div>
                            <div className="followup-pills">
                              {parsed.suggestions.map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  className="followup-pill"
                                  onClick={() => sendMessage(sug)}
                                >
                                  <span>{sug}</span>
                                  <i
                                    className="fa-solid fa-arrow-right"
                                    style={{
                                      fontSize: "10px",
                                      opacity: 0.6,
                                    }}
                                  ></i>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="input-container">
          <div className="input-box">
            {/* ATTACHED FILE CHIP */}
            {attachedDoc && (
              <div className="attached-doc-chip">
                <i className="fa-regular fa-file-lines doc-icon"></i>
                <div className="doc-info">
                  <span className="doc-name">{attachedDoc.filename}</span>
                  <span className="doc-chunks">{attachedDoc.chunks} chunk{attachedDoc.chunks > 1 ? "s" : ""}</span>
                </div>
                <button
                  className="doc-remove-btn"
                  onClick={() => setAttachedDoc(null)}
                  title="Detach document from chat"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              id="user-input"
              className="chat-textarea"
              placeholder={attachedDoc ? `Ask questions about ${attachedDoc.filename}...` : "Message Second Brain..."}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResizeTextarea(e.target);
              }}
              onKeyDown={handleKeyDown}
            />

            <div className="input-toolbar">
              <div className="toolbar-left">
                {/* FILE UPLOAD BUTTON */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <button
                  className={`file-upload-btn ${isUploadingFile ? "uploading" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach document (PDF, Word DOCX, TXT, CSV)"
                  type="button"
                >
                  {isUploadingFile ? (
                    <i className="fa-solid fa-spinner fa-spin" style={{ color: "var(--accent-primary)" }}></i>
                  ) : (
                    <i className="fa-solid fa-paperclip"></i>
                  )}
                </button>

                <button
                  className={`toggle-tool-btn ${activeTools.rag ? "active" : ""}`}
                  id="btn-tool-rag"
                  onClick={() => toggleTool("rag")}
                  title="Toggle Knowledge Document RAG (auto-searches when needed)"
                >
                  <i className="fa-solid fa-database"></i>
                  <span className="tool-btn-text">Knowledge RAG</span>
                </button>
                <button
                  className={`toggle-tool-btn ${activeTools.web ? "active" : ""}`}
                  id="btn-tool-web"
                  onClick={() => toggleTool("web")}
                  title="Toggle Web Search (auto-searches live questions)"
                >
                  <i className="fa-solid fa-globe"></i>
                  <span className="tool-btn-text">Web Search</span>
                </button>

                {/* SPEECH-TO-TEXT VOICE INPUT */}
                <button
                  type="button"
                  className={`btn-voice ${isRecordingVoice ? "voice-active" : ""}`}
                  onClick={toggleVoiceRecording}
                  title={isRecordingVoice ? "Stop voice recording" : "Voice input (Speech-to-Text)"}
                >
                  <i className="fa-solid fa-microphone"></i>
                </button>
              </div>
              <button
                className={`btn-send ${isStreaming ? "stop-btn" : ""}`}
                id="btn-send"
                onClick={handleSendOrStop}
                disabled={!isStreaming && input.trim().length === 0}
                title={isStreaming ? "Stop generating" : "Send message"}
              >
                <i
                  className={isStreaming ? "fa-solid fa-square" : "fa-solid fa-arrow-up"}
                  id="send-icon"
                ></i>
              </button>
            </div>
          </div>
          <div className="disclaimer-text">
            Second Brain automatically activates web search and document retrieval when needed. Verify critical facts and code.
          </div>
        </div>
      </main>

      {/* MOBILE SIDEBAR BACKDROP */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* KNOWLEDGE & DOCUMENTS MODAL */}
      <div
        className={`modal-overlay ${docsModalOpen ? "open" : ""}`}
        id="docs-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setDocsModalOpen(false);
        }}
      >
        <div className="modal-card" style={{ maxWidth: "680px" }}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="fa-solid fa-book-bookmark" style={{ color: "#10a37f" }}></i>
              <span>Knowledge Base &amp; Documents</span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setDocsModalOpen(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
              Upload files to empower Second Brain with contextual retrieval (RAG). Supports PDF, Word documents (.docx, .doc), text, markdown, and CSV.
            </p>

            {/* DROPZONE */}
            <input
              type="file"
              ref={modalFileInputRef}
              style={{ display: "none" }}
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div
              className="upload-dropzone"
              onClick={() => modalFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
            >
              <div className="dropzone-icon">
                {isUploadingFile ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                )}
              </div>
              <div style={{ fontWeight: 500, fontSize: "14px", marginBottom: "4px" }}>
                {isUploadingFile ? "Parsing and indexing document..." : "Click to upload or drag & drop"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                PDF, Word (DOCX/DOC), Markdown, Plain Text, or CSV (up to 50MB)
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 8px 0" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                Indexed Documents ({documentsList.length})
              </h4>
              <button
                className="sidebar-toggle-btn"
                onClick={fetchDocs}
                title="Refresh documents list"
              >
                <i className="fa-solid fa-arrows-rotate" style={{ fontSize: "12px" }}></i>
              </button>
            </div>

            {documentsList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "13px" }}>
                No documents indexed yet. Upload your first PDF or document above!
              </div>
            ) : (
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Chunks</th>
                    <th>Type</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documentsList.map((doc: any, dIdx: number) => (
                    <tr key={doc.id || doc.filename || dIdx}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <i className="fa-regular fa-file-lines" style={{ color: "#10a37f" }}></i>
                          <span style={{ fontWeight: 500, color: "var(--text-main)" }}>
                            {doc.filename || doc.title || "Document"}
                          </span>
                        </div>
                      </td>
                      <td>{doc.chunks_count || doc.chunks || "-"}</td>
                      <td>
                        <span style={{ textTransform: "uppercase", fontSize: "11px", opacity: 0.8 }}>
                          {doc.file_type || doc.type || "file"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="chat-action-btn"
                          onClick={() => openChunkInspector(doc.doc_id || doc.id || doc.filename || doc.title, doc.filename || doc.title || "Document")}
                          title="Inspect chunks"
                          style={{ marginRight: "6px" }}
                        >
                          <i className="fa-solid fa-layer-group" style={{ color: "#38bdf8" }}></i>
                        </button>
                        <button
                          className="chat-action-btn delete"
                          onClick={() => deleteDoc(doc.doc_id || doc.id || doc.filename || doc.title)}
                          title="Delete document"
                        >
                          <i className="fa-regular fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* JEV DECISION STUDIO MODAL */}
      <div
        className={`modal-overlay ${jevStudioOpen ? "open" : ""}`}
        id="jev-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setJevStudioOpen(false);
        }}
      >
        <div className="modal-card">
          <div className="modal-header">
            <div className="modal-title">
              <i className="fa-solid fa-sliders" style={{ color: "#f59e0b" }}></i>
              <span>JEV Decision Engine Studio</span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setJevStudioOpen(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Joint Expected Value (JEV) dynamically selects the optimal model per prompt using multi-attribute utility theory:
              <br />
              <code>U(M) = w_acc * Accuracy + w_spd * Speed - w_cst * Cost + w_fit * ContextFit</code>
            </p>

            <div className="slider-row">
              <div className="slider-label-row">
                <span>🎯 Accuracy / Reasoning Priority</span>
                <span id="val-w-acc">{wAcc.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="slider-input"
                id="slider-w-acc"
                min="0"
                max="1"
                step="0.05"
                value={wAcc}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setWAcc(val);
                  updateJevWeights(val, wSpd, wCst, wFit);
                }}
              />
            </div>

            <div className="slider-row">
              <div className="slider-label-row">
                <span>⚡ Latency / Speed Priority</span>
                <span id="val-w-spd">{wSpd.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="slider-input"
                id="slider-w-spd"
                min="0"
                max="1"
                step="0.05"
                value={wSpd}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setWSpd(val);
                  updateJevWeights(wAcc, val, wCst, wFit);
                }}
              />
            </div>

            <div className="slider-row">
              <div className="slider-label-row">
                <span>💳 Cost Reduction Priority</span>
                <span id="val-w-cst">{wCst.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="slider-input"
                id="slider-w-cst"
                min="0"
                max="1"
                step="0.05"
                value={wCst}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setWCst(val);
                  updateJevWeights(wAcc, wSpd, val, wFit);
                }}
              />
            </div>

            <div className="slider-row">
              <div className="slider-label-row">
                <span>🧩 Context Fit Priority</span>
                <span id="val-w-fit">{wFit.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="slider-input"
                id="slider-w-fit"
                min="0"
                max="1"
                step="0.05"
                value={wFit}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setWFit(val);
                  updateJevWeights(wAcc, wSpd, wCst, val);
                }}
              />
            </div>

            <div
              style={{
                background: "var(--bg-card)",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                marginTop: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "6px",
                  color: "var(--text-secondary)",
                }}
              >
                LIVE MODEL PREFERENCES (Click to Switch)
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "12px" }}>
                <span
                  onClick={() => { setSelectedModel("Auto (JEV Routed)"); setJevStudioOpen(false); }}
                  style={{ background: "rgba(16,163,127,0.15)", color: "#34d399", padding: "4px 9px", borderRadius: "4px", cursor: "pointer" }}
                  title="Auto route using Joint Expected Value"
                >
                  ⚡ Auto (JEV Routed)
                </span>
                <span
                  onClick={() => { setSelectedModel("sambanova"); setJevStudioOpen(false); }}
                  style={{ background: "rgba(236,72,153,0.15)", color: "#f472b6", padding: "4px 9px", borderRadius: "4px", cursor: "pointer" }}
                  title="Force SambaNova SN40L (Gemma 4)"
                >
                  🌸 SambaNova (SN40L)
                </span>
                <span
                  onClick={() => { setSelectedModel("bigmodel"); setJevStudioOpen(false); }}
                  style={{ background: "rgba(14,165,233,0.15)", color: "#38bdf8", padding: "4px 9px", borderRadius: "4px", cursor: "pointer" }}
                  title="Force BigModel (DeepSeek V4.1)"
                >
                  🔮 BigModel (DeepSeek)
                </span>
                <span
                  onClick={() => { setSelectedModel("groq"); setJevStudioOpen(false); }}
                  style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c", padding: "4px 9px", borderRadius: "4px", cursor: "pointer" }}
                  title="Force Groq LPU"
                >
                  🚀 Groq LPU
                </span>
                <span
                  onClick={() => { setSelectedModel("gemini"); setJevStudioOpen(false); }}
                  style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", padding: "4px 9px", borderRadius: "4px", cursor: "pointer" }}
                  title="Force Gemini Flash"
                >
                  ✨ Gemini Flash
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OBSERVABILITY & TRACES MODAL */}
      <div
        className={`modal-overlay ${obsModalOpen ? "open" : ""}`}
        id="obs-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setObsModalOpen(false);
        }}
      >
        <div className="modal-card" style={{ maxWidth: "760px" }}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="fa-solid fa-chart-line" style={{ color: "#3b82f6" }}></i>
              <span>Observability &amp; Execution Traces</span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setObsModalOpen(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body" id="obs-modal-content">
            {/* MULTI-TIER CACHE METRICS */}
            <div className="cache-stats-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                  <i className="fa-solid fa-bolt" style={{ color: "#10a37f" }}></i> Response &amp; Semantic Cache Telemetry
                </span>
                <button className="btn-clear-cache" onClick={handleClearCache}>
                  <i className="fa-solid fa-trash-can"></i> Clear Cache
                </button>
              </div>
              <div className="cache-stats-grid">
                <div className="cache-stat-item">
                  <span>Cache Hit Rate</span>
                  <strong>{cacheStats?.hit_rate_pct ?? 0}%</strong>
                </div>
                <div className="cache-stat-item">
                  <span>Exact Hits</span>
                  <strong>{cacheStats?.exact_hits ?? 0}</strong>
                </div>
                <div className="cache-stat-item">
                  <span>Semantic Hits</span>
                  <strong>{cacheStats?.semantic_hits ?? 0}</strong>
                </div>
                <div className="cache-stat-item">
                  <span>Tokens Saved</span>
                  <strong>{cacheStats?.tokens_saved ?? 0}</strong>
                </div>
                <div className="cache-stat-item">
                  <span>Cost Saved</span>
                  <strong style={{ color: "#10a37f" }}>${cacheStats?.cost_saved_usd ? Number(cacheStats.cost_saved_usd).toFixed(4) : "0.0000"}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
                Recent Execution Traces &amp; Latency:
              </span>
              <button className="topbar-icon-btn" onClick={refreshTraces}>
                <i className={`fa-solid fa-rotate-right ${loadingTraces ? "fa-spin" : ""}`}></i> Refresh
              </button>
            </div>

            <div
              id="traces-container"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "360px",
                overflowY: "auto",
              }}
            >
              {loadingTraces ? (
                <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
                  <i className="fa-solid fa-spinner fa-spin"></i> Fetching traces...
                </div>
              ) : traces.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
                  No recent traces found.
                </div>
              ) : (
                traces.map((t, i) => {
                  const timeFormatted = typeof t.timestamp === "number"
                    ? new Date(t.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : (t.timestamp || "Recent");
                  const costFormatted = Number(t.cost_usd ?? t.cost ?? 0).toFixed(6);

                  return (
                    <div
                      key={i}
                      style={{
                        background: "var(--bg-card)",
                        padding: "12px 14px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>
                          {t.model || t.selected_model || "Optimal LLM"}
                          {t.provider && <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "6px" }}>({t.provider})</span>}
                        </span>
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          {timeFormatted}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", flexWrap: "wrap" }}>
                        <span>⏱ {t.latency_ms ? Number(t.latency_ms).toFixed(1) + "ms" : "N/A"}</span>
                        {t.ttft_ms ? <span>🎯 TTFT: {Number(t.ttft_ms).toFixed(0)}ms</span> : null}
                        <span>⚡ {t.tokens_per_sec ? Number(t.tokens_per_sec).toFixed(1) + " tok/s" : "N/A"}</span>
                        <span>💳 ${costFormatted}</span>
                        {t.total_tokens ? <span>🪙 {t.total_tokens} tok</span> : null}
                      </div>
                      {t.prompt_preview && (
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Query: <em>{t.prompt_preview}</em>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* JEV ROUTING INSPECTION MODAL */}
      <div
        className={`modal-overlay ${jevInspectOpen ? "open" : ""}`}
        id="jev-inspect-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setJevInspectOpen(false);
        }}
      >
        <div className="modal-card">
          <div className="modal-header">
            <div className="modal-title">
              <i className="fa-solid fa-bolt" style={{ color: "#10a37f" }}></i>
              <span>JEV Routing Decision Details</span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setJevInspectOpen(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body" id="jev-inspect-content">
            {!inspectDecision ? (
              <p style={{ color: "var(--text-muted)" }}>No JEV metadata available for this turn.</p>
            ) : (
              <>
                <div
                  style={{
                    background: "var(--bg-card)",
                    padding: "16px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#10a37f",
                      marginBottom: "8px",
                    }}
                  >
                    <i className="fa-solid fa-check-circle"></i> Selected Model:{" "}
                    {inspectDecision.recommended_model ||
                      inspectDecision.selected_model ||
                      "Auto (JEV Routed)"}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                    }}
                  >
                    <div>
                      <strong>Engine Source:</strong>{" "}
                      {inspectDecision.engine_source || "TypeSafe AI Jev (System One)"}
                    </div>
                    <div>
                      <strong>Confidence:</strong>{" "}
                      {inspectDecision.confidence !== undefined
                        ? (inspectDecision.confidence * 100).toFixed(1) + "%"
                        : "95.0%"}
                    </div>
                    <div>
                      <strong>Task Domain:</strong>{" "}
                      {inspectDecision.domain || inspectDecision.task_type || "General"}
                    </div>
                    <div>
                      <strong>Complexity:</strong>{" "}
                      {inspectDecision.complexity || "Medium"}
                    </div>
                    <div>
                      <strong>Action Type:</strong>{" "}
                      {inspectDecision.action_type || "direct_chat"}
                    </div>
                    <div>
                      <strong>Policy Status:</strong>{" "}
                      {inspectDecision.verification_status || inspectDecision.policy_status || "Approved"}
                    </div>
                    <div>
                      <strong>Max Expected Utility:</strong>{" "}
                      {inspectDecision.expected_utility !== undefined
                        ? Number(inspectDecision.expected_utility).toFixed(4)
                        : inspectDecision.max_utility !== undefined
                        ? Number(inspectDecision.max_utility).toFixed(4)
                        : "N/A"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "12px" }}>
                  <h4
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "8px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Utility Calculation &amp; Candidates Matrix
                  </h4>
                  <pre
                    style={{
                      background: "var(--code-bg)",
                      padding: "12px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono)",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(
                      inspectDecision.ranked_candidates || inspectDecision.utilities || inspectDecision,
                      null,
                      2
                    )}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODEL CONTEXT PROTOCOL (MCP) SERVER MODAL */}
      <div
        className={`modal-overlay ${mcpModalOpen ? "open" : ""}`}
        id="mcp-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setMcpModalOpen(false);
        }}
      >
        <div className="modal-card" style={{ maxWidth: "760px" }}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="fa-solid fa-server" style={{ color: "#a855f7" }}></i>
              <span>Model Context Protocol (MCP) Server</span>
              <span className="sidebar-badge" style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc", marginLeft: "6px" }}>
                {mcpInfo?.status || "ONLINE"}
              </span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setMcpModalOpen(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "12px" }}>
              Second Brain runs an official <strong>Model Context Protocol (MCP) Server</strong> (compliant with spec <code>2024-11-05</code>) exposing tools, vector knowledge RAG, live web search, and SQLite exploration over both <strong>stdio</strong> and <strong>HTTP JSON-RPC 2.0</strong>.
            </p>

            {/* MCP CLIENT CONFIGURATION */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)" }}>
                  Connect to Claude Desktop / Cursor / Antigravity:
                </span>
                <button
                  className="btn-copy-code"
                  onClick={() => {
                    const cfg = JSON.stringify({
                      mcpServers: {
                        "second-brain": {
                          command: "python",
                          args: ["-m", "src.mcp.server"],
                          cwd: "c:\\Users\\DELL\\OneDrive\\Desktop\\second-brain\\second-brain"
                        }
                      }
                    }, null, 2);
                    navigator.clipboard.writeText(cfg);
                    alert("Copied MCP client configuration to clipboard!");
                  }}
                >
                  <i className="fa-regular fa-clone"></i> Copy Config
                </button>
              </div>
              <div className="mcp-config-box">
{`{
  "mcpServers": {
    "second-brain": {
      "command": "python",
      "args": ["-m", "src.mcp.server"],
      "cwd": "c:\\Users\\DELL\\OneDrive\\Desktop\\second-brain\\second-brain"
    }
  }
}`}
              </div>
            </div>

            {/* REGISTERED TOOLS */}
            <div style={{ marginBottom: "16px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: "8px" }}>
                Registered MCP Tools ({mcpTools.length}):
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                {mcpTools.map((tool, idx) => (
                  <div key={idx} className="mcp-tool-card">
                    <div className="mcp-tool-header">
                      <span className="mcp-tool-name">{tool.name}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>JSON-RPC 2.0</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {tool.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INTERACTIVE TOOL TESTER */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: "8px" }}>
                Live MCP Tool Runner:
              </span>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <select
                  value={selectedMcpTool}
                  onChange={(e) => {
                    const tool = e.target.value;
                    setSelectedMcpTool(tool);
                    if (tool === "calculator") setMcpToolArg("sqrt(144) + sin(pi/4) * 10");
                    else if (tool === "python_interpreter") setMcpToolArg("print('Hello from Second Brain MCP!')");
                    else if (tool === "sqlite_database_explorer") setMcpToolArg("tables");
                    else if (tool === "knowledge_rag_search") setMcpToolArg("viva questions");
                    else if (tool === "web_search") setMcpToolArg("latest AI agent developments 2026");
                    else if (tool === "cache_inspector") setMcpToolArg("");
                  }}
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-main)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px 10px",
                    fontSize: "12px",
                  }}
                >
                  {mcpTools.map((t, idx) => (
                    <option key={idx} value={t.name}>{t.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={mcpToolArg}
                  onChange={(e) => setMcpToolArg(e.target.value)}
                  placeholder="Tool arguments or expression..."
                  style={{
                    flex: 1,
                    background: "var(--bg-input)",
                    color: "var(--text-main)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px 10px",
                    fontSize: "12px",
                  }}
                />
                <button
                  className="action-btn"
                  onClick={runMcpToolTest}
                  disabled={isExecutingMcp}
                  style={{ padding: "6px 14px", fontSize: "12px", background: "var(--accent-primary)", color: "#fff" }}
                >
                  {isExecutingMcp ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-play"></i>}
                  {" "}Run
                </button>
              </div>
              {mcpResult && (
                <div className="mcp-config-box" style={{ maxHeight: "160px", overflowY: "auto" }}>
                  {mcpResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
          {/* COMMAND PALETTE MODAL (CTRL+K) */}
      {commandPaletteOpen && (
        <div
          className="command-palette-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCommandPaletteOpen(false);
          }}
        >
          <div className="command-palette-card">
            <div className="command-search-row">
              <i className="fa-solid fa-magnifying-glass" style={{ color: "var(--text-muted)" }}></i>
              <input
                type="text"
                className="command-search-input"
                placeholder="Type a command or search conversations..."
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
              />
              <span className="command-kbd">ESC</span>
            </div>
            <div className="command-list">
              <div className="command-section-title">Quick Actions</div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  startNewChat();
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-plus" style={{ color: "#10a37f" }}></i>
                  <span>New Conversation</span>
                </div>
                <span className="command-kbd">Enter</span>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  toggleTool("rag");
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-database" style={{ color: "#38bdf8" }}></i>
                  <span>Toggle Knowledge RAG (Dense + BM25)</span>
                </div>
                <span className="command-kbd">{activeTools.rag ? "Enabled" : "Disabled"}</span>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  toggleTool("web");
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-globe" style={{ color: "#f59e0b" }}></i>
                  <span>Toggle Live Web Search</span>
                </div>
                <span className="command-kbd">{activeTools.web ? "Enabled" : "Disabled"}</span>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  exportChatMarkdown();
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-arrow-down-to-bracket" style={{ color: "#a855f7" }}></i>
                  <span>Export Chat to Markdown (.md)</span>
                </div>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setDocsModalOpen(true);
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-book-bookmark" style={{ color: "#10a37f" }}></i>
                  <span>Open Knowledge &amp; Docs Manager</span>
                </div>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setJevStudioOpen(true);
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-sliders" style={{ color: "#f59e0b" }}></i>
                  <span>Open JEV Decision Studio</span>
                </div>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setObsModalOpen(true);
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-chart-line" style={{ color: "#60a5fa" }}></i>
                  <span>Open Observability &amp; Cost Traces</span>
                </div>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setMcpModalOpen(true);
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-server" style={{ color: "#a855f7" }}></i>
                  <span>Open Model Context Protocol (MCP) Server</span>
                </div>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setSelectedModel("sambanova");
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-microchip" style={{ color: "#ec4899" }}></i>
                  <span>Switch Model: SambaNova SN40L (Gemma 4)</span>
                </div>
                <span className="command-kbd">SN40L</span>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setSelectedModel("bigmodel");
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-brain" style={{ color: "#0ea5e9" }}></i>
                  <span>Switch Model: BigModel (DeepSeek V4.1)</span>
                </div>
                <span className="command-kbd">DeepSeek</span>
              </div>
              <div
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  setSelectedModel("Auto (JEV Routed)");
                }}
              >
                <div className="command-item-left">
                  <i className="fa-solid fa-bolt" style={{ color: "#10a37f" }}></i>
                  <span>Switch Model: Auto (JEV Routing)</span>
                </div>
                <span className="command-kbd">Auto</span>
              </div>

              {sessions.length > 0 && (
                <>
                  <div className="command-section-title">Recent Conversations</div>
                  {sessions
                    .filter((s) => !commandQuery || s.title?.toLowerCase().includes(commandQuery.toLowerCase()))
                    .slice(0, 6)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="command-item"
                        onClick={() => {
                          setCommandPaletteOpen(false);
                          loadSession(s.id);
                        }}
                      >
                        <div className="command-item-left">
                          <i className="fa-regular fa-message" style={{ opacity: 0.6 }}></i>
                          <span>{s.title || "Chat"}</span>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CODE CANVAS / ARTIFACTS DRAWER */}
      <div className={`canvas-drawer ${canvasOpen ? "open" : ""}`} id="canvas-drawer">
        <div className="canvas-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
            <i className="fa-solid fa-layer-group" style={{ color: "#38bdf8" }}></i>
            <span>{canvasTitle}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              className="action-btn"
              onClick={() => {
                navigator.clipboard.writeText(canvasContent);
                alert("Copied canvas content to clipboard!");
              }}
              title="Copy canvas content"
            >
              <i className="fa-regular fa-clone"></i> Copy
            </button>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setCanvasOpen(false)}
              title="Close Canvas"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div className="canvas-body">
          {canvasContent ? (
            <div
              className="assistant-body"
              dangerouslySetInnerHTML={renderMarkdown(canvasContent)}
            />
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontSize: "13px" }}>
              Click <strong>&quot;Canvas&quot;</strong> on any message response or code block to view artifacts in this dedicated workspace.
            </div>
          )}
        </div>
      </div>

      {/* DOCUMENT CHUNK INSPECTOR MODAL */}
      <div
        className={`modal-overlay ${chunkInspectorOpen ? "open" : ""}`}
        id="chunk-inspector-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) setChunkInspectorOpen(false);
        }}
      >
        <div className="modal-card" style={{ maxWidth: "780px" }}>
          <div className="modal-header">
            <div className="modal-title">
              <i className="fa-solid fa-layer-group" style={{ color: "#38bdf8" }}></i>
              <span>Chunks Inspector: {inspectingDocTitle}</span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setChunkInspectorOpen(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "12px" }}>
              Viewing all indexed chunks processed with Cohere embeddings and BM25 sparse keyword indices.
            </p>
            {loadingChunks ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: "8px" }}></i>
                Loading document chunks...
              </div>
            ) : inspectingChunks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                No chunks found for this document.
              </div>
            ) : (
              inspectingChunks.map((c: any, cIdx: number) => (
                <div key={c.chunk_id || cIdx} className="chunk-card">
                  <div className="chunk-card-header">
                    <span style={{ fontWeight: 600, color: "var(--accent-primary)" }}>
                      Chunk #{c.chunk_index !== undefined ? c.chunk_index + 1 : cIdx + 1}
                    </span>
                    <span>{c.char_count || c.text?.length || 0} characters</span>
                  </div>
                  <div className="chunk-text-box">{c.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}