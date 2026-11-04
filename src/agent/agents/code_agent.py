"""Code Agent - specialized for programming, debugging, and MCP Python sandbox execution."""
from src.agent.llm_backends import get_llm_response
from src.agent.mcp_tools import tool_python_interpreter, tool_calculator
from src.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM = """You are an expert software engineer and technical assistant.
- Write clean, modern, and production-grade code with comments.
- Explain complex concepts simply and precisely.
- Always use fenced code blocks with language identifiers.
- When calculations or data scripts are involved, provide complete working examples.

At the very end of your response, always provide 2 to 3 concise, highly relevant follow-up suggestions for what the user might ask or explore next, formatted with the exact delimiter:
<<<SUGGESTIONS>>>
- <Follow-up question 1>
- <Follow-up question 2>
- <Follow-up question 3>"""


async def run_code_agent(query: str, history: list[dict] = None, model: str = None) -> dict:
    """Answer technical coding questions."""
    q_lower = query.lower()

    # If user explicitly asks to calculate math or run python calculation
    if any(k in q_lower for k in ["calculate", "what is", "compute", "evaluate"]) and any(op in q_lower for op in ["+", "-", "*", "/", "^", "%", "sqrt"]):
        try:
            math_expr = query.split("calculate")[-1].split("what is")[-1].strip(" ?:")
            calc_res = await tool_calculator(math_expr)
            if not calc_res.startswith("Calculation Error"):
                return {
                    "answer": f"### 🧮 MCP Calculator\n\n**Expression:** `{math_expr}`\n\n**{calc_res}**",
                    "sources": [],
                    "agent": "Code Agent (MCP)",
                }
        except Exception:
            pass

    messages = (history or []) + [{"role": "user", "content": query}]
    answer, backend = await get_llm_response(messages, system=SYSTEM, model=model)
    logger.info(f"Code agent answered via {backend}")
    return {"answer": answer, "sources": [], "agent": "Code Agent"}
