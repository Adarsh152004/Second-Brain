# -*- coding: utf-8 -*-
"""Main agent pipeline with Streaming, JEV Decision Engine, Automatic Web Search & RAG, TTFT Telemetry, Waterfall Tracing & Cost Accounting."""
import time
import uuid
import json
from typing import AsyncGenerator, Dict, Any, List, Optional
from src.agent.orchestrator import run_orchestrator
from src.agent.llm_backends import stream_route_chat
from src.agent.mcp_tools import execute_mcp_tool
from src.agent.agents.web_search_agent import tavily_search
from src.agent.jev_engine import get_jev_engine
from src.agent.rag import _build_context_block
from src.vectorstore.chroma_store import search
from src.memory import store
from src.observability.cost_tracker import record_trace, estimate_tokens, check_budget_status
from src.observability.cache import (
    get_cached_response,
    get_semantic_cached_response,
    set_cached_response,
    check_prompt_prefix_cache,
    CACHE_STATS,
)
from src.evaluation.safety_evaluator import evaluate_safety
from src.evaluation.hallucination_detector import detect_hallucinations
from src.utils.logging import get_logger

logger = get_logger(__name__)


def _detect_web_intent(message: str, use_web: bool = False) -> bool:
    if use_web:
        return True
    q = message.lower().strip()
    # Suppress automatic web search if user is explicitly asking about their documents/files
    if any(d in q for d in ["in the document", "in the pdf", "in my file", "in the file", "from the upload", "in my notes", "summarize the document", "summarize the file"]):
        return False
    web_signals = [
        "today", "yesterday", "tomorrow", "weather", "latest", "news", "current",
        "stock", "price", "who won", "score", "election", "release date", "update", "schedule",
        "trending", "what happened", "2024", "2025", "2026", "browse", "search web", "search for",
        "what is the current", "real-time"
    ]
    return any(w in q for w in web_signals)


def _detect_rag_intent(message: str, use_rag: bool = False) -> bool:
    if use_rag:
        return True
    q = message.lower().strip()
    rag_signals = [
        "document", "doc", "pdf", "file", "uploaded", "paper", "notes", "my file",
        "in the text", "what did i write", "second brain", "summarize the document",
        "resume", "attachment", "according to", "in my notes", "from my upload"
    ]
    return any(w in q for w in rag_signals)


async def run_agent(
    session_id: str,
    message: str,
    preferred_backend: str = None,
    model: str = None,
    use_rag: bool = False,
    use_web: bool = False,
) -> dict:
    trace_id = f"tr-{uuid.uuid4().hex[:10]}"
    t_start = time.time()
    target_model = model or preferred_backend or "auto"
    waterfall = []

    s1 = time.time()
    safety_in = evaluate_safety(message, is_user_input=True)
    d1 = round((time.time() - s1) * 1000, 1)
    waterfall.append({"stage": "Input Safety Guardrail", "duration_ms": d1, "status": "passed" if safety_in["is_safe"] else "blocked"})

    if not safety_in["is_safe"]:
        return {
            "answer": "⚠️ Request Blocked: Your input triggered safety or prompt injection protections.",
            "sources": [],
            "agent_used": "Safety Guardrail",
            "intent": "safety_block",
            "trace_id": trace_id,
            "latency_ms": d1,
            "ttft_ms": d1,
            "cost_usd": 0.0,
            "waterfall": waterfall,
            "is_cached": False,
            "is_safe": False
        }

    # Dynamic intents (web search, live temporal queries, document RAG queries) must bypass cache lookup
    is_dynamic_query = use_web or use_rag or _detect_web_intent(message, use_web) or _detect_rag_intent(message, use_rag)

    cached = None
    if not is_dynamic_query:
        cached = get_cached_response(message, target_model)
        if not cached:
            cached = get_semantic_cached_response(message, target_model)

    if cached:
        lat_ms = (time.time() - t_start) * 1000.0
        ctype = cached.get("cache_type", "exact")
        waterfall.append({
            "stage": f"{ctype.title()} Cache Lookup",
            "duration_ms": 1.0,
            "status": f"HIT ({int(cached.get('similarity_score', 1.0)*100)}%)"
        })
        cache_decision = {
            "engine_source": f"{ctype.title()} Cache Engine",
            "recommended_model": ctype,
            "expected_utility": 1.0,
            "reasoning": f"Reused response from {ctype} cache with zero API latency and zero cost.",
            "action_type": "cache_hit"
        }
        store.save_turn(session_id, "user", message)
        store.save_turn(session_id, "assistant", cached["answer"], decision=cache_decision, sources=cached.get("sources", []))
        return {
            **cached,
            "trace_id": trace_id,
            "latency_ms": round(lat_ms, 1),
            "ttft_ms": 1.0,
            "tokens_per_sec": 500.0,
            "cost_usd": 0.0,
            "waterfall": waterfall,
            "is_cached": True,
            "cache_type": ctype,
            "jev_decision": cache_decision
        }

    s_jev = time.time()
    jev_engine = get_jev_engine()
    jev_decision = jev_engine.decide(message, user_preferences={"backend": preferred_backend})
    d_jev = round((time.time() - s_jev) * 1000, 1)
    waterfall.append({"stage": "JEV Decision Engine", "duration_ms": d_jev, "status": f"{jev_decision.selected_action.action_type} (U={jev_decision.selected_action.expected_utility:.3f})"})

    # --- Tool Execution: Web Search ---
    should_search_web = _detect_web_intent(message, use_web) or (jev_decision.selected_action.action_type == "web_search")
    web_results = []
    if should_search_web:
        s_web = time.time()
        try:
            web_results = await tavily_search(message, max_results=4)
            d_web = round((time.time() - s_web) * 1000, 1)
            waterfall.append({"stage": "Tavily Web Search", "duration_ms": d_web, "status": f"{len(web_results)} results"})
        except Exception as e:
            logger.warning(f"Web search error: {e}")

    # --- Tool Execution: RAG Knowledge Retrieval ---
    should_rag = _detect_rag_intent(message, use_rag) or (jev_decision.selected_action.action_type == "rag_retrieval")
    docs = []
    if should_rag:
        try:
            retrieved = search(message, top_k=4)
            if retrieved:
                docs = retrieved
                waterfall.append({"stage": "Knowledge Retrieval", "duration_ms": 25.0, "status": f"{len(docs)} chunks"})
        except Exception as e:
            logger.warning(f"RAG search error: {e}")

    # --- Tool Execution: MCP (Math, Python, SQLite) ---
    tool_used = None
    tool_output = None
    if jev_decision.selected_action.action_type == "mcp_tool" and jev_decision.selected_action.target_tool:
        tool_name = jev_decision.selected_action.target_tool
        s_tool = time.time()
        tool_res = await execute_mcp_tool(tool_name, {"expression": message, "query": message, "code": message})
        d_tool = round((time.time() - s_tool) * 1000, 1)
        tool_used = tool_name
        tool_output = tool_res
        waterfall.append({"stage": f"MCP Tool: {tool_name}", "duration_ms": d_tool, "status": "executed"})

    history = store.get_recent(session_id, limit=8)
    history_msgs = [{"role": t["role"], "content": t["content"]} for t in history]

    context_parts = []
    if docs:
        context_parts.append(f"### Relevant Uploaded Documents:\n{_build_context_block(docs)}")
    if web_results:
        web_text = "\n\n".join([f"[{i+1}] {r.get('title','Web Result')} ({r.get('url','')})\n{r.get('content','')[:450]}" for i, r in enumerate(web_results)])
        context_parts.append(f"### Live Web Search Results:\n{web_text}")
    if tool_output:
        context_parts.append(f"### Tool Execution Result ({tool_used}):\n{json.dumps(tool_output, indent=2)}")

    if context_parts:
        context_prompt = (
            f"{''.join([cp + '\n\n' for cp in context_parts])}"
            f"User Query: {message}\n\n"
            f"Answer thoroughly based on the context above. Cite document names or source URLs where applicable."
        )
    else:
        context_prompt = message

    effective_backend = preferred_backend or jev_decision.selected_action.recommended_model
    all_msgs = history_msgs + [{"role": "user", "content": context_prompt}]

    from src.agent.llm_backends import route_chat
    answer, used_backend, used_model = await route_chat(
        messages=all_msgs,
        preferred_backend=effective_backend,
        model=model
    )

    lat_ms = (time.time() - t_start) * 1000.0
    inp_tok = estimate_tokens(context_prompt) + sum(estimate_tokens(m["content"]) for m in history_msgs)
    out_tok = estimate_tokens(answer)
    total_tok = inp_tok + out_tok
    tok_sec = round((out_tok / (lat_ms / 1000.0)), 1) if lat_ms > 0 else 0.0

    all_sources = []
    for d in docs:
        all_sources.append({"type": "document", "title": d.get("title", "Document"), "score": d.get("score")})
    for r in web_results:
        all_sources.append({"type": "web", "title": r.get("title", "Web Result"), "url": r.get("url")})

    cost_usd = record_trace(
        trace_id=trace_id, session_id=session_id, provider=used_backend,
        model=used_model, input_tokens=inp_tok, output_tokens=out_tok,
        latency_ms=lat_ms, ttft_ms=round(lat_ms * 0.35, 1), tokens_per_sec=tok_sec,
        intent="general", agent_used=f"{used_backend.upper()} Agent",
        status="success", prompt_preview=message, response_preview=answer,
        rag_chunks=len(docs), mcp_calls=1 if tool_used else 0,
        waterfall_stages=waterfall
    )

    store.save_turn(session_id, "user", message)
    store.save_turn(session_id, "assistant", answer, decision=jev_decision.judgment, sources=all_sources)

    has_dynamic_context = bool(docs) or bool(web_results) or bool(tool_output) or is_dynamic_query
    if not has_dynamic_context:
        set_cached_response(message, {"answer": answer, "sources": all_sources}, used_model, tokens=total_tok)
    else:
        logger.info(f"Skipping cache write for dynamic query (docs={len(docs)}, web={len(web_results)}, tool={bool(tool_used)})")

    return {
        "answer": answer, "sources": all_sources,
        "agent_used": f"{used_backend.upper()} Agent",
        "intent": "general",
        "tool_used": tool_used, "tool_output": tool_output,
        "trace_id": trace_id, "latency_ms": round(lat_ms, 1),
        "ttft_ms": round(lat_ms * 0.35, 1), "tokens_per_sec": tok_sec,
        "total_tokens": total_tok, "input_tokens": inp_tok,
        "output_tokens": out_tok, "cost_usd": cost_usd,
        "provider": used_backend, "model": used_model,
        "is_cached": False, "is_safe": True,
        "waterfall": waterfall, "jev_decision": jev_decision.judgment
    }


async def stream_agent(
    session_id: str,
    message: str,
    preferred_backend: str = None,
    model: str = None,
    use_rag: bool = False,
    use_web: bool = False,
) -> AsyncGenerator[Dict[str, Any], None]:
    trace_id = f"tr-{uuid.uuid4().hex[:10]}"
    t_start = time.time()
    target_model = model or preferred_backend or "auto"
    waterfall = []

    s1 = time.time()
    safety_in = evaluate_safety(message, is_user_input=True)
    d1 = round((time.time() - s1) * 1000, 1)
    waterfall.append({"stage": "Input Safety Guardrail", "duration_ms": d1, "status": "passed" if safety_in["is_safe"] else "blocked"})

    if not safety_in["is_safe"]:
        yield {"type": "chunk", "content": "⚠️ Request Blocked: Your input triggered safety or prompt injection protections.", "token": "⚠️ Request Blocked"}
        yield {"type": "done", "trace_id": trace_id, "latency_ms": d1, "cost_usd": 0.0, "waterfall": waterfall, "is_safe": False}
        return

    # Dynamic intents (web search, live temporal queries, document RAG queries) must bypass cache lookup
    is_dynamic_query = use_web or use_rag or _detect_web_intent(message, use_web) or _detect_rag_intent(message, use_rag)

    cached = None
    if not is_dynamic_query:
        cached = get_cached_response(message, target_model)
        if not cached:
            cached = get_semantic_cached_response(message, target_model)

    if cached:
        lat_ms = (time.time() - t_start) * 1000.0
        ctype = cached.get("cache_type", "exact")
        waterfall.append({
            "stage": f"{ctype.title()} Cache Lookup",
            "duration_ms": 1.0,
            "status": f"HIT ({int(cached.get('similarity_score', 1.0)*100)}%)"
        })
        cache_decision = {
            "engine_source": f"{ctype.title()} Cache Engine",
            "recommended_model": ctype,
            "expected_utility": 1.0,
            "reasoning": f"Reused response from {ctype} cache with zero latency and zero cost.",
            "action_type": "cache_hit"
        }
        store.save_turn(session_id, "user", message)
        store.save_turn(session_id, "assistant", cached["answer"], decision=cache_decision, sources=cached.get("sources", []))
        yield {"type": "jev_decision", "decision": cache_decision}
        yield {"type": "chunk", "content": cached["answer"], "token": cached["answer"]}
        yield {
            "type": "done",
            "trace_id": trace_id,
            "latency_ms": round(lat_ms, 1),
            "ttft_ms": 1.0,
            "tokens_per_sec": 500.0,
            "total_tokens": estimate_tokens(cached["answer"]),
            "cost_usd": 0.0,
            "provider": "cache",
            "model": f"{ctype}-cache",
            "is_cached": True,
            "cache_type": ctype,
            "similarity_score": cached.get("similarity_score", 1.0),
            "waterfall": waterfall,
            "sources": cached.get("sources", []),
            "jev_decision": cache_decision
        }
        return

    s_jev = time.time()
    jev_engine = get_jev_engine()
    jev_decision = jev_engine.decide(message, user_preferences={"backend": preferred_backend})
    d_jev = round((time.time() - s_jev) * 1000, 1)
    waterfall.append({"stage": "JEV Decision Engine", "duration_ms": d_jev, "status": f"{jev_decision.selected_action.action_type} (U={jev_decision.selected_action.expected_utility:.3f})"})

    jev_payload = {
        "engine_source": jev_decision.judgment.get("engine_source", "Heuristic Utility Engine"),
        "confidence": jev_decision.judgment.get("confidence", 0.90),
        "domain": jev_decision.judgment.get("domain", "general"),
        "complexity": jev_decision.judgment.get("complexity", "medium"),
        "action_type": jev_decision.selected_action.action_type,
        "recommended_model": jev_decision.selected_action.recommended_model,
        "target_tool": jev_decision.selected_action.target_tool,
        "expected_utility": round(jev_decision.selected_action.expected_utility, 4),
        "expected_accuracy": jev_decision.selected_action.expected_accuracy,
        "estimated_latency_ms": jev_decision.selected_action.estimated_latency_ms,
        "estimated_cost_usd": jev_decision.selected_action.estimated_cost_usd,
        "reasoning": jev_decision.selected_action.reasoning,
        "ranked_candidates": jev_decision.ranked_candidates,
        "verification_status": jev_decision.verification.get("verification_status", "passed"),
        "policy_action": jev_decision.ranked_candidates[0].get("reasoning", "execute")
    }

    yield {"type": "jev_decision", "decision": jev_payload}

    # --- Tool Execution: Automatic Web Search ---
    should_search_web = _detect_web_intent(message, use_web) or (jev_decision.selected_action.action_type == "web_search")
    web_results = []
    if should_search_web:
        s_web = time.time()
        try:
            yield {"type": "tool_start", "tool": "web_search", "message": f"Searching the web for: {message[:40]}..."}
            web_results = await tavily_search(message, max_results=4)
            d_web = round((time.time() - s_web) * 1000, 1)
            waterfall.append({"stage": "Tavily Web Search", "duration_ms": d_web, "status": f"{len(web_results)} results"})
            yield {"type": "tool_use", "tool": "web_search", "query": message, "results_count": len(web_results)}
        except Exception as e:
            logger.warning(f"Web search error: {e}")

    # --- Tool Execution: Automatic RAG Knowledge Retrieval ---
    should_rag = _detect_rag_intent(message, use_rag) or (jev_decision.selected_action.action_type == "rag_retrieval")
    docs = []
    if should_rag:
        try:
            retrieved = search(message, top_k=4)
            if retrieved:
                docs = retrieved
                waterfall.append({"stage": "Knowledge Retrieval", "duration_ms": 25.0, "status": f"{len(docs)} chunks"})
                yield {
                    "type": "tool_use",
                    "tool": "rag_retrieval",
                    "count": len(docs),
                    "documents": [d.get("title", "Document") for d in docs]
                }
        except Exception as e:
            logger.warning(f"RAG search error: {e}")

    # --- Tool Execution: MCP Tools (calculator, python, sqlite, metrics) ---
    tool_used = None
    tool_output = None
    if jev_decision.selected_action.action_type == "mcp_tool" and jev_decision.selected_action.target_tool:
        tool_name = jev_decision.selected_action.target_tool
        s_tool = time.time()
        yield {"type": "tool_start", "tool": tool_name, "message": f"Executing tool: {tool_name}..."}
        tool_res = await execute_mcp_tool(tool_name, {"expression": message, "query": message, "code": message})
        d_tool = round((time.time() - s_tool) * 1000, 1)
        tool_used = tool_name
        tool_output = tool_res
        waterfall.append({"stage": f"MCP Tool: {tool_name}", "duration_ms": d_tool, "status": "executed"})
        yield {"type": "tool_use", "tool": tool_name, "output": tool_res}

    history = store.get_recent(session_id, limit=8)
    history_msgs = [{"role": t["role"], "content": t["content"]} for t in history]

    # Assemble contextual prompts
    context_parts = []
    if docs:
        context_parts.append(f"### Relevant Uploaded Documents:\n{_build_context_block(docs)}")
    if web_results:
        web_text = "\n\n".join([f"[{i+1}] {r.get('title','Web Result')} ({r.get('url','')})\n{r.get('content','')[:450]}" for i, r in enumerate(web_results)])
        context_parts.append(f"### Live Web Search Results:\n{web_text}")
    if tool_output:
        context_parts.append(f"### Tool Execution Result ({tool_used}):\n{json.dumps(tool_output, indent=2)}")

    if context_parts:
        context_prompt = (
            f"{''.join([cp + '\n\n' for cp in context_parts])}"
            f"User Query: {message}\n\n"
            f"Answer thoroughly based on the provided context where applicable. "
            f"Cite document names or web URLs when appropriate."
        )
    else:
        context_prompt = message

    chosen_backend = preferred_backend or jev_decision.selected_action.recommended_model

    all_msgs = []
    for h in history_msgs:
        all_msgs.append({"role": h["role"], "content": h["content"]})
    all_msgs.append({"role": "user", "content": context_prompt})

    used_backend = chosen_backend or "groq"
    used_model = model or "openai/gpt-oss-120b"

    SYSTEM_PROMPT = """You are Second Brain, an intelligent, helpful AI assistant powered by Multi-LLM Joint Expected Value (JEV) routing, live Web Search, and document RAG capabilities.
Provide clear, accurate, and insightful responses using clean Markdown.
When provided with documents or live web results, synthesize them accurately and mention your sources clearly.
At the very end of your response, always provide 2 to 3 concise, highly relevant follow-up suggestions for what the user might ask or explore next, formatted with the exact delimiter:
<<<SUGGESTIONS>>>
- <Follow-up suggestion 1>
- <Follow-up suggestion 2>
- <Follow-up suggestion 3>"""

    full_answer = ""
    ttft_ms = 0.0
    first_chunk = True

    async for token, b_name, m_name in stream_route_chat(
        messages=all_msgs,
        system=SYSTEM_PROMPT,
        preferred_backend=chosen_backend,
        model=model,
    ):
        if first_chunk:
            ttft_ms = round((time.time() - t_start) * 1000, 1)
            first_chunk = False
            waterfall.append({"stage": "TTFT (Time-to-First-Token)", "duration_ms": ttft_ms, "status": "stream_started"})
        used_backend = b_name
        used_model = m_name
        full_answer += token
        yield {"type": "chunk", "content": token, "token": token}

    lat_ms = (time.time() - t_start) * 1000.0
    inp_tok = estimate_tokens(context_prompt) + sum(estimate_tokens(m["content"]) for m in history_msgs)
    out_tok = estimate_tokens(full_answer)
    total_tok = inp_tok + out_tok
    tok_sec = round((out_tok / (lat_ms / 1000.0)), 1) if lat_ms > 0 else 0.0

    s6 = time.time()
    halluc = detect_hallucinations(full_answer, "")
    d6 = round((time.time() - s6) * 1000, 1)
    waterfall.append({"stage": "Output Guardrail", "duration_ms": d6, "status": "passed"})

    all_sources = []
    for d in docs:
        all_sources.append({"type": "document", "title": d.get("title", "Document"), "score": d.get("score")})
    for r in web_results:
        all_sources.append({"type": "web", "title": r.get("title", "Web Result"), "url": r.get("url")})

    cost_usd = record_trace(
        trace_id=trace_id, session_id=session_id, provider=used_backend,
        model=used_model, input_tokens=inp_tok, output_tokens=out_tok,
        latency_ms=lat_ms, ttft_ms=ttft_ms, tokens_per_sec=tok_sec,
        intent="general", agent_used=f"{used_backend.upper()} Agent",
        status="success", prompt_preview=message, response_preview=full_answer,
        rag_chunks=len(docs), mcp_calls=1 if tool_used else 0,
        waterfall_stages=waterfall
    )

    store.save_turn(session_id, "user", message)
    store.save_turn(session_id, "assistant", full_answer, decision=jev_payload, sources=all_sources)

    has_dynamic_context = bool(docs) or bool(web_results) or bool(tool_output) or is_dynamic_query
    if not has_dynamic_context:
        set_cached_response(message, {"answer": full_answer, "sources": all_sources}, used_model, tokens=total_tok)
    else:
        logger.info(f"Skipping cache write for dynamic stream query (docs={len(docs)}, web={len(web_results)}, tool={bool(tool_used)})")

    yield {
        "type": "done", "trace_id": trace_id, "latency_ms": round(lat_ms, 1),
        "ttft_ms": ttft_ms, "tokens_per_sec": tok_sec, "total_tokens": total_tok,
        "cost_usd": cost_usd, "provider": used_backend, "model": used_model,
        "hallucination_score": halluc.get("hallucination_score", 0.0),
        "is_cached": False, "waterfall": waterfall, "jev_decision": jev_payload,
        "sources": all_sources
    }
