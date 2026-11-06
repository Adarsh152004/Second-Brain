import os, time, re, json
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict

@dataclass
class CandidateAction:
    action_type: str
    recommended_model: str
    target_tool: Optional[str] = None
    expected_accuracy: float = 0.85
    estimated_latency_ms: int = 400
    estimated_cost_usd: float = 0.0001
    expected_utility: float = 0.0
    reasoning: str = ""

@dataclass
class JEVDecision:
    query: str
    judgment: Dict[str, Any]
    evaluation: Dict[str, Any]
    verification: Dict[str, Any]
    selected_action: CandidateAction
    ranked_candidates: List[Dict[str, Any]]
    execution_time_ms: float
    timestamp: float

class JEVDecisionEngine:
    MODEL_PROFILES = {
        "groq": {"model_name": "openai/gpt-oss-120b", "cost_per_1m_in": 0.59, "cost_per_1m_out": 0.79, "avg_latency_ms": 280, "reasoning_score": 0.90, "tool_use_score": 0.92, "speed_score": 0.99},
        "sambanova": {"model_name": "gemma-4-31B-it", "cost_per_1m_in": 0.10, "cost_per_1m_out": 0.20, "avg_latency_ms": 240, "reasoning_score": 0.93, "tool_use_score": 0.91, "speed_score": 0.98},
        "bigmodel": {"model_name": "deepseek-v4.1-flash", "cost_per_1m_in": 0.15, "cost_per_1m_out": 0.30, "avg_latency_ms": 320, "reasoning_score": 0.96, "tool_use_score": 0.94, "speed_score": 0.95},
        "gemini": {"model_name": "gemini-2.0-flash", "cost_per_1m_in": 0.10, "cost_per_1m_out": 0.40, "avg_latency_ms": 420, "reasoning_score": 0.92, "tool_use_score": 0.90, "multimodal_score": 0.98},
        "openrouter": {"model_name": "anthropic/claude-3.5-sonnet", "cost_per_1m_in": 3.00, "cost_per_1m_out": 15.00, "avg_latency_ms": 950, "reasoning_score": 0.98, "tool_use_score": 0.96, "coding_score": 0.99},
        "mistral": {"model_name": "mistral-large-latest", "cost_per_1m_in": 2.00, "cost_per_1m_out": 6.00, "avg_latency_ms": 600, "reasoning_score": 0.91, "tool_use_score": 0.88},
        "cloudflare": {"model_name": "@cf/meta/llama-3.1-8b-instruct", "cost_per_1m_in": 0.05, "cost_per_1m_out": 0.15, "avg_latency_ms": 220, "reasoning_score": 0.78, "tool_use_score": 0.75}
    }

    DEFAULT_WEIGHTS = {"accuracy": 0.45, "speed": 0.25, "cost_efficiency": 0.15, "context_fit": 0.15}

    def __init__(self, weights=None):
        self.weights = weights or self.DEFAULT_WEIGHTS

    def _evaluate_with_typesafe_jev(self, query: str) -> Optional[Dict[str, Any]]:
        # Bypassed to eliminate the 1.5s blocking network delay on unavailable remote endpoint.
        # The local sub-millisecond Heuristic Utility Engine completes in <1ms.
        return None

    def phase_1_judgment(self, query: str, context=None, preferred_backend: str = None):
        q_lower = query.lower().strip()
        word_count = len(query.split())

        has_math = any(w in q_lower for w in ["calculate", "compute", "equation", "sum of", "percentage", "+", "*", "/", "sqrt", "sin", "cos", "tan", "="]) or bool(re.search(r"\d+\s*[\+\-\*/]\s*\d+", q_lower))
        has_code = any(w in q_lower for w in ["python", "code", "script", "function", "def ", "class ", "debug", "algorithm", "sql", "regex", "write a program", "traceback"])
        has_db = any(w in q_lower for w in ["database", "sqlite", "table", "schema", "query table", "select ", "insert into"])
        has_web = any(w in q_lower for w in ["browse", "url", "http", "website", "latest news", "today", "current weather", "search web"])
        has_system = any(w in q_lower for w in ["system memory", "cpu usage", "disk space", "hardware", "server metrics", "ram"])
        has_doc_rag = any(w in q_lower for w in ["in my notes", "second brain", "my document", "what did i write", "search my knowledge"])
        is_greeting = q_lower in ["hi", "hello", "hey", "good morning", "good evening", "who are you", "what can you do"]

        if word_count > 60 or "compare and analyze" in q_lower or "deep dive" in q_lower:
            complexity = "high"
        elif word_count > 20 or has_code or has_math:
            complexity = "medium"
        else:
            complexity = "low"

        domain = "general"
        if has_math: domain = "mathematics"
        elif has_code: domain = "coding"
        elif has_db: domain = "database"
        elif has_web: domain = "web_research"
        elif has_system: domain = "system_diagnostics"
        elif has_doc_rag: domain = "knowledge_retrieval"
        engine_source = "Heuristic Utility Engine"
        confidence = 0.92

        # Respect user preferred backend if specified
        active_default_model = "groq"
        if preferred_backend and preferred_backend.lower() not in ("auto", "auto (jev routed)", "default"):
            active_default_model = preferred_backend.lower()
        elif os.environ.get("SAMBANOVA_API_KEY"):
            active_default_model = "sambanova"
        elif os.environ.get("GROQ_API_KEY"):
            active_default_model = "groq"
        elif os.environ.get("GEMINI_API_KEY"):
            active_default_model = "gemini"

        candidate_actions = []
        candidate_actions.append(CandidateAction(
            action_type="direct_chat",
            recommended_model=active_default_model,
            expected_accuracy=0.88 if not has_code else 0.80,
            estimated_latency_ms=250,
            estimated_cost_usd=0.00008,
            reasoning=f"High-throughput direct stream with {active_default_model}"
        ))

        if has_math:
            candidate_actions.append(CandidateAction(
                action_type="mcp_tool",
                recommended_model=active_default_model,
                target_tool="calculator",
                expected_accuracy=0.99,
                estimated_latency_ms=320,
                estimated_cost_usd=0.00010,
                reasoning="Exact mathematical calculation via MCP calculator"
            ))
        if has_code:
            candidate_actions.append(CandidateAction(
                action_type="mcp_tool",
                recommended_model=active_default_model,
                target_tool="python_interpreter",
                expected_accuracy=0.96,
                estimated_latency_ms=450,
                estimated_cost_usd=0.00015,
                reasoning="Sandboxed Python runtime verification"
            ))
        if has_db:
            candidate_actions.append(CandidateAction(
                action_type="mcp_tool",
                recommended_model=active_default_model,
                target_tool="sqlite_database_explorer",
                expected_accuracy=0.95,
                estimated_latency_ms=380,
                estimated_cost_usd=0.00012,
                reasoning="Direct SQLite schema inspection"
            ))
        if has_web:
            candidate_actions.append(CandidateAction(
                action_type="mcp_tool",
                recommended_model=active_default_model,
                target_tool="web_browser_reader",
                expected_accuracy=0.94,
                estimated_latency_ms=800,
                estimated_cost_usd=0.00030,
                reasoning="Live web search and page reader"
            ))
        if has_system:
            candidate_actions.append(CandidateAction(
                action_type="mcp_tool",
                recommended_model=active_default_model,
                target_tool="system_metrics_analyzer",
                expected_accuracy=0.99,
                estimated_latency_ms=180,
                estimated_cost_usd=0.00005,
                reasoning="Live OS CPU and RAM metrics"
            ))
        if has_doc_rag or complexity != "low":
            candidate_actions.append(CandidateAction(
                action_type="rag_retrieval",
                recommended_model=active_default_model,
                expected_accuracy=0.92,
                estimated_latency_ms=300,
                estimated_cost_usd=0.00010,
                reasoning=f"Semantic document search with {active_default_model}"
            ))
        if complexity == "high" or "prove" in q_lower or "architect" in q_lower:
            candidate_actions.append(CandidateAction(
                action_type="deep_reasoning",
                recommended_model=active_default_model,
                expected_accuracy=0.98,
                estimated_latency_ms=1200,
                estimated_cost_usd=0.00150,
                reasoning=f"High-tier reasoning with {active_default_model}"
            ))

        return {
            "engine_source": engine_source,
            "confidence": confidence,
            "state_signals": {
                "has_math": has_math, "has_code": has_code, "has_db": has_db,
                "has_web": has_web, "has_system": has_system, "has_doc_rag": has_doc_rag,
                "is_greeting": is_greeting, "word_count": word_count
            },
            "complexity": complexity,
            "domain": domain,
            "candidate_actions": candidate_actions
        }

    def phase_2_evaluation(self, judgment_state: Dict[str, Any], preferred_backend: str = None):
        candidates: List[CandidateAction] = judgment_state["candidate_actions"]
        w_acc = self.weights.get("accuracy", 0.45)
        w_spd = self.weights.get("speed", 0.25)
        w_cst = self.weights.get("cost_efficiency", 0.15)
        w_fit = self.weights.get("context_fit", 0.15)

        is_explicit = preferred_backend and preferred_backend.lower() not in ("auto", "auto (jev routed)", "default")

        ranked = []
        for c in candidates:
            if is_explicit:
                c.recommended_model = preferred_backend.lower()

            speed_score = max(0.1, 1.0 - (c.estimated_latency_ms / 2000.0))
            cost_score = max(0.1, 1.0 - (c.estimated_cost_usd / 0.002))
            fit_score = 0.95 if (c.action_type == "mcp_tool" and c.target_tool) or (c.action_type == "direct_chat" and judgment_state["complexity"] == "low") else 0.85
            utility = (w_acc * c.expected_accuracy) + (w_spd * speed_score) + (w_cst * cost_score) + (w_fit * fit_score)
            c.expected_utility = round(utility, 4)
            ranked.append({
                "action_type": c.action_type,
                "recommended_model": c.recommended_model,
                "target_tool": c.target_tool,
                "expected_accuracy": c.expected_accuracy,
                "estimated_latency_ms": c.estimated_latency_ms,
                "estimated_cost_usd": c.estimated_cost_usd,
                "expected_utility": c.expected_utility,
                "speed_score": round(speed_score, 3),
                "cost_score": round(cost_score, 3),
                "reasoning": c.reasoning
            })

        ranked.sort(key=lambda x: x["expected_utility"], reverse=True)
        candidates.sort(key=lambda x: x.expected_utility, reverse=True)
        fallback_model = preferred_backend.lower() if is_explicit else "groq"
        best_candidate = candidates[0] if candidates else CandidateAction(action_type="direct_chat", recommended_model=fallback_model, reasoning="Default direct chat")
        return best_candidate, ranked

    def phase_3_verification(self, best_candidate: CandidateAction, query: str):
        passed = True
        flags = []
        reasons = []
        jailbreak_patterns = ["ignore all previous instructions", "system prompt bypass", "dan mode", "jailbreak"]
        if any(p in query.lower() for p in jailbreak_patterns):
            flags.append("SAFETY_PROMPT_INJECTION_RISK")
            reasons.append("Potential prompt injection pattern detected in input state.")

        model = best_candidate.recommended_model
        env_map = {
            "groq": "GROQ_API_KEY",
            "sambanova": "SAMBANOVA_API_KEY",
            "bigmodel": "BIGMODEL_API_KEY",
            "gemini": "GEMINI_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
            "mistral": "MISTRAL_API_KEY",
            "cloudflare": "CF_API_TOKEN"
        }
        required_env = env_map.get(model)
        if required_env and not os.environ.get(required_env):
            flags.append("FALLBACK_API_KEY_UNAVAILABLE_" + model.upper())
            reasons.append(required_env + " is not set. Fallback to active backend required.")
            for fb in ["sambanova", "groq", "gemini"]:
                if os.environ.get(env_map.get(fb, "")):
                    best_candidate.recommended_model = fb
                    break

        try:
            from src.observability.cost_tracker import check_budget_status
            b_status = check_budget_status(best_candidate.estimated_cost_usd)
            if not b_status.get("allowed", True):
                flags.append("BUDGET_CAP_EXCEEDED")
                reasons.append("Budget cap limit reached: " + str(b_status.get("message", "")))
                if b_status.get("action") == "strict_reject":
                    passed = False
        except Exception:
            pass

        return {
            "noul_verified": passed,
            "confidence": 0.98 if passed and not flags else 0.85,
            "policy_status": "APPROVED" if passed else "REJECTED",
            "verification_status": "APPROVED" if passed else "REJECTED",
            "flags": flags,
            "reasons": reasons,
            "enforced_action": best_candidate.action_type,
            "enforced_model": best_candidate.recommended_model
        }

    def decide(self, query: str, context=None, user_preferences=None, **kwargs):
        start_time = time.perf_counter()
        preferred_backend = user_preferences.get("backend") if user_preferences else None
        judgment = self.phase_1_judgment(query, context, preferred_backend=preferred_backend)
        best_candidate, ranked_candidates = self.phase_2_evaluation(judgment, preferred_backend=preferred_backend)
        verification = self.phase_3_verification(best_candidate, query)
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return JEVDecision(
            query=query,
            judgment=judgment,
            evaluation={
                "top_action": best_candidate.action_type,
                "top_utility": best_candidate.expected_utility,
                "top_model": best_candidate.recommended_model,
                "target_tool": best_candidate.target_tool,
                "ranked_candidates": ranked_candidates
            },
            verification=verification,
            selected_action=best_candidate,
            ranked_candidates=ranked_candidates,
            execution_time_ms=round(elapsed_ms, 2),
            timestamp=time.time()
        )

_global_jev_engine = None

def get_jev_engine():
    global _global_jev_engine
    if _global_jev_engine is None:
        _global_jev_engine = JEVDecisionEngine()
    return _global_jev_engine
