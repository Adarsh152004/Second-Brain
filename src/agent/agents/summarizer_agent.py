"""Summarizer Agent - summarizes documents, content, or any text."""
from src.vectorstore.chroma_store import search
from src.agent.llm_backends import get_llm_response
from src.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM = """You are a professional summarizer and analyst. You:
- Create concise, structured summaries using markdown
- Extract key themes, insights, and actionable points
- Use headers (##, ###), bullet points, and **bold** for emphasis
- Provide a brief overview followed by detailed sections
- Always mention what sources/documents were summarized"""


async def run_summarizer_agent(query: str, history: list[dict] = None) -> dict:
    """Summarize documents from the knowledge base."""
    # Fetch top relevant chunks
    chunks = search(query, top_k=8)
    if not chunks:
        return {
            "answer": "No documents found to summarize. Please upload some files first.",
            "sources": [],
            "agent": "Summarizer Agent",
        }
    context = "\n\n".join(
        f"[{c['metadata'].get('title','Doc')}]\n{c['text']}" for c in chunks
    )
    messages = (history or []) + [
        {"role": "user", "content": f"Please summarize the following content:\n\n{context}\n\nRequest: {query}"}
    ]
    answer, backend = await get_llm_response(messages, system=SYSTEM)
    sources = [
        {"type": "document", "title": c["metadata"].get("title", "Document"), "snippet": c["text"][:120], "doc_id": c["metadata"].get("doc_id", "")}
        for c in chunks
    ]
    logger.info(f"Summarizer agent answered using {len(chunks)} chunks via {backend}")
    return {"answer": answer, "sources": sources, "agent": "Summarizer Agent"}
