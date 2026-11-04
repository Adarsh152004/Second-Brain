"""RAG helper utilities."""
from typing import List, Dict, Any

def _build_context_block(retrieved_chunks: List[Dict[str, Any]]) -> str:
    """Format retrieved document chunks into a structured context block with citations."""
    if not retrieved_chunks:
        return "No documents found."
    
    parts = []
    for i, c in enumerate(retrieved_chunks, 1):
        text = c.get("text") or c.get("content") or ""
        title = c.get("title") or c.get("source") or "Document"
        parts.append(f"[{i}] ({title}): {text}")
    
    return "\n\n".join(parts)
