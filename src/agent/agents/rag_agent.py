"""RAG Agent - searches the local knowledge base."""
from src.vectorstore.chroma_store import search
from src.agent.llm_backends import get_llm_response
from src.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM = """You are a knowledge retrieval expert. Using the provided document excerpts,
give a clear, well-structured answer. Use markdown formatting with headers and bullet points.
If the documents don't contain enough information, say so clearly."""


async def run_rag_agent(query: str, history: list[dict] = None) -> dict:
    """Search knowledge base and answer from retrieved documents."""
    chunks = search(query, top_k=6)
    if not chunks:
        return {
            "answer": "I couldn't find any relevant documents in your knowledge base. Try uploading some files first!",
            "sources": [],
            "agent": "RAG Agent",
        }

    context = "\n\n".join(
        f"[Document: {c['metadata'].get('title','Unknown')}]\n{c['text']}" for c in chunks
    )
    messages = (history or []) + [
        {"role": "user", "content": f"Context from knowledge base:\n\n{context}\n\nQuestion: {query}"}
    ]
    answer, backend = await get_llm_response(messages, system=SYSTEM)
    sources = [
        {
            "type": "document",
            "title": c["metadata"].get("title", "Document"),
            "snippet": c["text"][:120],
            "doc_id": c["metadata"].get("doc_id", ""),
        }
        for c in chunks
    ]
    logger.info(f"RAG agent answered using {len(chunks)} chunks via {backend}")
    return {"answer": answer, "sources": sources, "agent": "RAG Agent"}
