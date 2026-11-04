"""General Agent - direct conversational AI, no tools needed."""
from src.agent.llm_backends import get_llm_response
from src.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM = """You are Second Brain, an intelligent AI assistant. You are:
- Helpful, thoughtful, and knowledgeable
- Expert at reasoning and analysis
- Clear and concise in your responses
- Using well-structured markdown with headers and bullet points when appropriate
- Honest about what you don't know

At the very end of your response, always provide 2 to 3 concise, highly relevant follow-up suggestions for what the user might ask or explore next, formatted with the exact delimiter:
<<<SUGGESTIONS>>>
- <Follow-up question 1>
- <Follow-up question 2>
- <Follow-up question 3>"""


async def run_general_agent(query: str, history: list[dict] = None) -> dict:
    """Handle general questions and conversation directly."""
    messages = (history or []) + [{"role": "user", "content": query}]
    answer, backend = await get_llm_response(messages, system=SYSTEM)
    logger.info(f"General agent answered via {backend}")
    return {"answer": answer, "sources": [], "agent": "AI Assistant"}
