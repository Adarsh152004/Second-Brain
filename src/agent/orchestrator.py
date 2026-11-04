"""LangGraph Orchestrator - routes queries to specialist agents with MCP & Multi-LLM support."""
from typing import TypedDict, Optional, Annotated, List
from langgraph.graph import StateGraph, END
from src.agent.llm_backends import get_llm_response
from src.utils.logging import get_logger

logger = get_logger(__name__)


class AgentState(TypedDict):
    session_id: str
    query: str
    history: list
    intent: str
    has_docs: bool
    preferred_backend: Optional[str]
    model: Optional[str]
    answer: str
    sources: list
    agent_used: str
    backend_used: str


async def classify_intent(state: AgentState) -> AgentState:
    query = state["query"]
    has_docs = state.get("has_docs", False)
    q_lower = query.lower()

    if any(w in q_lower for w in ["write code", "debug", "error", "function", "class", "syntax",
                                  "python", "javascript", "typescript", "sql", "algorithm",
                                  "implement", "fix this", "code review", "calculate", "compute"]):
        return {**state, "intent": "code"}

    if any(w in q_lower for w in ["summarize", "summary", "brief", "overview", "tldr",
                                  "key points", "main points"]):
        if has_docs:
            return {**state, "intent": "summarize"}

    if any(w in q_lower for w in ["latest", "news", "today", "current", "recent", "2024", "2025", "2026",
                                  "price", "weather", "stock"]):
        return {**state, "intent": "web"}

    if any(w in q_lower for w in ["my document", "uploaded", "in my file", "from my notes"]):
        return {**state, "intent": "rag"}

    # Dynamic LLM classification
    try:
        prompt = (
            f"Classify this user message into exactly ONE category.\n"
            f"Has uploaded documents: {has_docs}\n\n"
            f"Message: {query}\n\n"
            f"Categories: rag, web, code, summarize, general\n"
            f"Respond with ONLY one category word."
        )
        resp, _ = await get_llm_response(
            [{"role": "user", "content": prompt}],
            preferred_backend=state.get("preferred_backend"),
        )
        intent = resp.strip().lower().split()[0] if resp.strip() else "general"
        intent = intent if intent in ("rag", "web", "code", "summarize", "general") else "general"
        if intent in ("rag", "summarize") and not has_docs:
            intent = "web"
    except Exception:
        intent = "rag" if has_docs else "general"

    logger.info(f"LangGraph Classified Intent: {intent}")
    return {**state, "intent": intent}


async def rag_node(state: AgentState) -> AgentState:
    from src.agent.agents.rag_agent import run_rag_agent
    result = await run_rag_agent(state["query"], state.get("history"))
    return {**state, **result, "agent_used": result["agent"]}


async def web_node(state: AgentState) -> AgentState:
    from src.agent.agents.web_search_agent import run_web_search_agent
    result = await run_web_search_agent(state["query"], state.get("history"))
    return {**state, **result, "agent_used": result["agent"]}


async def code_node(state: AgentState) -> AgentState:
    from src.agent.agents.code_agent import run_code_agent
    result = await run_code_agent(state["query"], state.get("history"), model=state.get("model"))
    return {**state, **result, "agent_used": result["agent"]}


async def summarize_node(state: AgentState) -> AgentState:
    from src.agent.agents.summarizer_agent import run_summarizer_agent
    result = await run_summarizer_agent(state["query"], state.get("history"))
    return {**state, **result, "agent_used": result["agent"]}


async def general_node(state: AgentState) -> AgentState:
    from src.agent.agents.general_agent import run_general_agent
    result = await run_general_agent(state["query"], state.get("history"))
    return {**state, **result, "agent_used": result["agent"]}


def route_intent(state: AgentState) -> str:
    intent = state.get("intent", "general")
    return intent if intent in ("rag", "web", "code", "summarize") else "general"


def build_graph() -> StateGraph:
    g = StateGraph(AgentState)
    g.add_node("classify", classify_intent)
    g.add_node("rag", rag_node)
    g.add_node("web", web_node)
    g.add_node("code", code_node)
    g.add_node("summarize", summarize_node)
    g.add_node("general", general_node)

    g.set_entry_point("classify")
    g.add_conditional_edges("classify", route_intent, {
        "rag": "rag", "web": "web", "code": "code", "summarize": "summarize", "general": "general"
    })
    for node in ("rag", "web", "code", "summarize", "general"):
        g.add_edge(node, END)
    return g.compile()


_graph = None

def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


async def run_orchestrator(
    session_id: str,
    query: str,
    history: list,
    has_docs: bool,
    preferred_backend: str = None,
    model: str = None,
) -> dict:
    graph = get_graph()
    initial_state: AgentState = {
        "session_id": session_id,
        "query": query,
        "history": history,
        "intent": "",
        "has_docs": has_docs,
        "preferred_backend": preferred_backend,
        "model": model,
        "answer": "",
        "sources": [],
        "agent_used": "AI Assistant",
        "backend_used": "",
    }
    final = await graph.ainvoke(initial_state)
    return {
        "answer": final.get("answer", ""),
        "sources": final.get("sources", []),
        "agent_used": final.get("agent_used", "AI Assistant"),
        "intent": final.get("intent", "general"),
    }
