"""LLM Quality Evaluation & LLM-as-a-Judge Engine."""
import json
import re
from typing import Dict, Any, List, Optional
from src.agent.llm_backends import get_llm_response
from src.utils.logging import get_logger

logger = get_logger(__name__)


def evaluate_heuristics(query: str, answer: str, expected: str = None) -> Dict[str, Any]:
    """Fast deterministic heuristic evaluation."""
    if not answer or not answer.strip():
        return {
            "correctness": 0, "relevance": 0, "completeness": 0,
            "clarity": 0, "conciseness": 0, "formatting": 0,
            "instruction_following": 0, "overall_score": 0,
            "explanation": "Answer is empty."
        }
    
    # Heuristic scoring components
    length = len(answer.split())
    has_code = "```" in answer
    has_bullets = any(b in answer for b in ["- ", "* ", "1. ", "2. "])
    has_headers = any(h in answer for h in ["# ", "## ", "### "])
    
    # Formatting score
    formatting = 70
    if has_code or has_bullets or has_headers:
        formatting = 95
        
    # Conciseness score
    conciseness = 90
    if length > 800:
        conciseness = 65
    elif length < 10:
        conciseness = 60

    # Relevance & instruction check
    q_words = set(re.findall(r"\w+", query.lower()))
    a_words = set(re.findall(r"\w+", answer.lower()))
    overlap = len(q_words.intersection(a_words)) / max(1, len(q_words))
    relevance = min(100, int(overlap * 100) + 40)
    
    completeness = 85 if length > 40 else 60
    correctness = 85
    instruction_following = 88
    
    if expected:
        exp_words = set(re.findall(r"\w+", expected.lower()))
        exp_overlap = len(exp_words.intersection(a_words)) / max(1, len(exp_words))
        correctness = min(100, int(exp_overlap * 100) + 30)

    overall = int((correctness * 0.3) + (relevance * 0.25) + (completeness * 0.15) + (formatting * 0.15) + (instruction_following * 0.15))

    return {
        "correctness": correctness,
        "relevance": relevance,
        "completeness": completeness,
        "clarity": 90,
        "conciseness": conciseness,
        "formatting": formatting,
        "instruction_following": instruction_following,
        "overall_score": overall,
        "explanation": "Heuristic evaluation based on lexical overlap, structure, and formatting metrics."
    }


async def evaluate_with_llm_judge(
    query: str,
    answer: str,
    expected_answer: Optional[str] = None,
    context: Optional[str] = None,
    judge_model: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute LLM-as-a-Judge to evaluate answer quality and factuality."""
    judge_prompt = f"""You are an expert impartial AI quality evaluation judge.
Evaluate the following AI assistant response on a 0-100 scale for each criterion:

User Query: {query}
Retrieved Context (if any): {context or "None provided"}
Expected Reference Answer (if any): {expected_answer or "None provided"}

AI Response to Evaluate:
\"\"\"
{answer}
\"\"\"

Respond with a valid JSON object ONLY matching this schema:
{{
  "correctness": <0-100>,
  "relevance": <0-100>,
  "completeness": <0-100>,
  "clarity": <0-100>,
  "conciseness": <0-100>,
  "formatting": <0-100>,
  "instruction_following": <0-100>,
  "overall_score": <0-100>,
  "explanation": "<2-3 sentence justification of the ratings>"
}}"""

    try:
        resp, _ = await get_llm_response(
            [{"role": "user", "content": judge_prompt}],
            system="You are a strict evaluation judge. Output ONLY JSON.",
            preferred_backend="groq",
            model=judge_model,
        )
        match = re.search(r"\{.*\}", resp, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        logger.warning(f"LLM-as-a-Judge failed, using heuristics: {e}")

    return evaluate_heuristics(query, answer, expected_answer)


async def compare_pairwise_models(
    query: str,
    answer_a: str,
    answer_b: str,
    model_a_name: str = "Model A",
    model_b_name: str = "Model B",
) -> Dict[str, Any]:
    """Pairwise model comparison: determine winner between Model A and Model B."""
    prompt = f"""Compare two AI model responses to the same user query and select the superior response.

User Query: {query}

--- RESPONSE A ({model_a_name}) ---
{answer_a}

--- RESPONSE B ({model_b_name}) ---
{answer_b}

Respond with JSON ONLY:
{{
  "winner": "{model_a_name}" or "{model_b_name}" or "Tie",
  "score_a": <0-100>,
  "score_b": <0-100>,
  "reasoning": "<concise explanation why the winner was chosen>"
}}"""

    try:
        resp, _ = await get_llm_response(
            [{"role": "user", "content": prompt}],
            system="Impartial pairwise comparison judge. Output ONLY JSON.",
        )
        match = re.search(r"\{.*\}", resp, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        logger.warning(f"Pairwise comparison failed: {e}")

    score_a = evaluate_heuristics(query, answer_a)["overall_score"]
    score_b = evaluate_heuristics(query, answer_b)["overall_score"]
    winner = model_a_name if score_a > score_b else (model_b_name if score_b > score_a else "Tie")
    return {
        "winner": winner,
        "score_a": score_a,
        "score_b": score_b,
        "reasoning": f"Calculated via heuristic metric comparison (Score A: {score_a}, Score B: {score_b})."
    }
