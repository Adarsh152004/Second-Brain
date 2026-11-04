"""Web Search Agent - searches the web using Tavily."""
import httpx
from src.config.settings import settings
from src.agent.llm_backends import get_llm_response
from src.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM = """You are a web research assistant. Synthesize the provided search results into a
clear, accurate, well-structured answer. Use markdown with headers and bullet points.
Always attribute information to its source when possible."""


async def tavily_search(query: str, max_results: int = 5) -> list[dict]:
    """Call Tavily search API."""
    if not settings.tavily_api_key:
        return []
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                    "include_answer": True,
                },
                timeout=20,
            )
            r.raise_for_status()
            data = r.json()
            return data.get("results", [])
    except Exception as e:
        logger.warning(f"Tavily search failed: {e}")
        return []


async def run_web_search_agent(query: str, history: list[dict] = None) -> dict:
    """Search the web and synthesize results."""
    results = await tavily_search(query)
    if not results:
        return {
            "answer": "Web search is unavailable right now. Please check your Tavily API key.",
            "sources": [],
            "agent": "Web Search Agent",
        }

    context = "\n\n".join(
        f"[{r.get('title','Result')}] ({r.get('url','')})\n{r.get('content','')[:400]}"
        for r in results
    )
    messages = (history or []) + [
        {"role": "user", "content": f"Web search results:\n\n{context}\n\nQuestion: {query}"}
    ]
    answer, backend = await get_llm_response(messages, system=SYSTEM)
    sources = [
        {
            "type": "web",
            "title": r.get("title", "Web Result"),
            "snippet": r.get("content", "")[:120],
            "url": r.get("url", ""),
        }
        for r in results
    ]
    logger.info(f"Web search agent answered with {len(results)} results via {backend}")
    return {"answer": answer, "sources": sources, "agent": "Web Search Agent"}
