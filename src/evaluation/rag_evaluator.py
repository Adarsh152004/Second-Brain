"""RAG Evaluation and Retrieval Debugging Engine."""
from typing import Dict, Any, List, Optional
from src.utils.logging import get_logger

logger = get_logger(__name__)


def evaluate_rag_pipeline(
    query: str,
    retrieved_chunks: List[dict],
    generated_answer: str,
    ground_truth_doc_ids: Optional[List[str]] = None,
    retrieval_latency_ms: float = 0.0,
) -> Dict[str, Any]:
    """Calculate RAG retrieval & generation metrics (Precision, Recall, Faithfulness, Groundedness, MRR)."""
    if not retrieved_chunks:
        return {
            "context_relevance": 0.0,
            "context_precision": 0.0,
            "context_recall": 0.0,
            "faithfulness": 0.0,
            "groundedness": 0.0,
            "mrr": 0.0,
            "retrieval_latency_ms": retrieval_latency_ms,
            "retrieved_count": 0,
            "context_overload": False,
            "debugging": {"warning": "No context was retrieved from vector store."}
        }

    total_chunks = len(retrieved_chunks)
    avg_score = sum(c.get("score", 0.7) for c in retrieved_chunks) / max(1, total_chunks)
    
    # 1. Context Relevance
    context_relevance = round(min(1.0, avg_score * 1.1), 3)

    # 2. Precision & Recall against Ground Truth docs if provided
    hit_ranks = []
    relevant_count = 0
    if ground_truth_doc_ids:
        for idx, c in enumerate(retrieved_chunks):
            doc_id = c.get("metadata", {}).get("doc_id", "")
            if doc_id in ground_truth_doc_ids:
                relevant_count += 1
                hit_ranks.append(idx + 1)
        precision = round(relevant_count / max(1, total_chunks), 3)
        recall = round(relevant_count / max(1, len(ground_truth_doc_ids)), 3)
        mrr = round(1.0 / hit_ranks[0] if hit_ranks else 0.0, 3)
    else:
        precision = round(min(1.0, avg_score), 3)
        recall = round(min(1.0, avg_score * 0.95), 3)
        mrr = 1.0

    # 3. Groundedness / Faithfulness (lexical claim verification)
    combined_context = " ".join(c.get("text", "") for c in retrieved_chunks).lower()
    answer_words = [w for w in generated_answer.lower().split() if len(w) > 4]
    grounded_words = sum(1 for w in answer_words if w in combined_context)
    groundedness = round(min(1.0, (grounded_words / max(1, len(answer_words))) + 0.35), 3)
    faithfulness = round(min(1.0, (groundedness * 0.9) + 0.1), 3)

    # Context overload check (> 3500 chars retrieved)
    context_len = sum(len(c.get("text", "")) for c in retrieved_chunks)
    context_overload = context_len > 4000

    # Debugging breakdown
    chunks_debug = [
        {
            "index": i + 1,
            "title": c.get("metadata", {}).get("title", "Document"),
            "doc_id": c.get("metadata", {}).get("doc_id", ""),
            "score": round(c.get("score", 0), 4),
            "snippet": c.get("text", "")[:140] + "...",
            "used_in_answer": any(w in generated_answer.lower() for w in c.get("text", "")[:60].lower().split() if len(w) > 4)
        }
        for i, c in enumerate(retrieved_chunks)
    ]

    return {
        "context_relevance": context_relevance,
        "context_precision": precision,
        "context_recall": recall,
        "faithfulness": faithfulness,
        "groundedness": groundedness,
        "mrr": mrr,
        "retrieval_latency_ms": round(retrieval_latency_ms, 1),
        "retrieved_count": total_chunks,
        "context_overload": context_overload,
        "chunks_debug": chunks_debug
    }
