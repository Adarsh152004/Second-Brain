"""Claim-Level Hallucination and Fact Consistency Detector."""
import re
from typing import Dict, Any, List


def detect_hallucinations(answer: str, context: str) -> Dict[str, Any]:
    """Check answer claims against retrieved source context."""
    if not answer or not answer.strip():
        return {"hallucination_score": 0.0, "is_hallucinated": False, "unsupported_claims": []}

    if not context or not context.strip():
        # General knowledge mode without RAG
        return {
            "hallucination_score": 0.05,
            "is_hallucinated": False,
            "confidence": 0.95,
            "unsupported_claims": [],
            "grounded_ratio": 1.0
        }

    # Split answer into sentence claims
    sentences = [s.strip() for s in re.split(r"(?<=[.!?]) +", answer) if len(s.strip()) > 15]
    if not sentences:
        return {"hallucination_score": 0.0, "is_hallucinated": False, "unsupported_claims": []}

    context_lower = context.lower()
    unsupported = []
    supported_count = 0

    for s in sentences:
        words = [w for w in re.findall(r"\w+", s.lower()) if len(w) > 4]
        if not words:
            supported_count += 1
            continue
        overlap = sum(1 for w in words if w in context_lower) / len(words)
        if overlap < 0.30:  # Low groundedness in context
            unsupported.append({"claim": s, "support_ratio": round(overlap, 2)})
        else:
            supported_count += 1

    hallucination_rate = round(len(unsupported) / max(1, len(sentences)), 3)
    is_hallucinated = hallucination_rate > 0.35

    return {
        "hallucination_score": hallucination_rate,
        "is_hallucinated": is_hallucinated,
        "confidence": round(1.0 - hallucination_rate, 3),
        "total_claims": len(sentences),
        "unsupported_count": len(unsupported),
        "unsupported_claims": unsupported,
        "grounded_ratio": round(supported_count / max(1, len(sentences)), 3)
    }
