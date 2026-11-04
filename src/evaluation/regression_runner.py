"""Automated Evaluation & Regression Testing Runner."""
import sqlite3
import time
import uuid
from typing import Dict, Any, List, Optional
from src.agent.langgraph_agent import run_agent
from src.evaluation.quality_evaluator import evaluate_heuristics, evaluate_with_llm_judge
from src.evaluation.hallucination_detector import detect_hallucinations
from src.evaluation.safety_evaluator import evaluate_safety
from src.evaluation.dataset_manager import get_dataset_test_cases, list_datasets
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


def _get_db():
    conn = sqlite3.connect(settings.memory_db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS eval_runs (
            id TEXT PRIMARY KEY,
            dataset_id TEXT,
            model_tested TEXT,
            timestamp REAL,
            test_count INTEGER,
            avg_quality_score REAL,
            avg_correctness REAL,
            avg_relevance REAL,
            avg_latency_ms REAL,
            hallucination_rate REAL,
            safety_pass_rate REAL,
            total_cost_usd REAL,
            status TEXT,
            report_summary TEXT
        )
    """)
    conn.commit()
    return conn


async def run_evaluation_suite(
    dataset_id: str,
    model: str = "groq",
    min_quality_threshold: float = 75.0,
) -> Dict[str, Any]:
    """Execute complete benchmark test suite against an LLM and generate evaluation report."""
    test_cases = get_dataset_test_cases(dataset_id)
    if not test_cases:
        return {"error": f"No test cases found in dataset {dataset_id}"}

    run_id = f"run-{uuid.uuid4().hex[:8]}"
    start_time = time.time()
    results = []
    
    total_quality = 0.0
    total_correctness = 0.0
    total_relevance = 0.0
    total_latency = 0.0
    hallucination_count = 0
    safety_pass_count = 0

    logger.info(f"Starting Evaluation Run {run_id} on {len(test_cases)} test cases with model {model}...")

    for tc in test_cases:
        t0 = time.time()
        agent_res = await run_agent(f"eval-{run_id}", tc["query"], preferred_backend=model)
        lat_ms = (time.time() - t0) * 1000.0
        
        answer = agent_res.get("answer", "")
        
        # Evaluate metrics
        quality = evaluate_heuristics(tc["query"], answer, tc.get("expected_answer"))
        halluc = detect_hallucinations(answer, "")
        safety = evaluate_safety(answer)

        q_score = quality["overall_score"]
        total_quality += q_score
        total_correctness += quality["correctness"]
        total_relevance += quality["relevance"]
        total_latency += lat_ms

        if halluc["is_hallucinated"]:
            hallucination_count += 1
        if safety["is_safe"]:
            safety_pass_count += 1

        results.append({
            "test_case_id": tc["id"],
            "query": tc["query"],
            "expected": tc.get("expected_answer"),
            "answer_preview": answer[:150] + "...",
            "quality_score": q_score,
            "latency_ms": round(lat_ms, 1),
            "is_safe": safety["is_safe"]
        })

    n = max(1, len(test_cases))
    avg_q = round(total_quality / n, 2)
    avg_corr = round(total_correctness / n, 2)
    avg_rel = round(total_relevance / n, 2)
    avg_lat = round(total_latency / n, 1)
    halluc_rate = round((hallucination_count / n) * 100, 1)
    safety_rate = round((safety_pass_count / n) * 100, 1)
    
    passed_regression = avg_q >= min_quality_threshold
    status = "PASSED" if passed_regression else "FAILED_REGRESSION"
    summary_text = f"Evaluated {n} tests. Quality: {avg_q}/100 (Threshold: {min_quality_threshold}). Hallucination: {halluc_rate}%. Safety: {safety_rate}%."

    with _get_db() as conn:
        conn.execute(
            """
            INSERT INTO eval_runs (
                id, dataset_id, model_tested, timestamp, test_count,
                avg_quality_score, avg_correctness, avg_relevance,
                avg_latency_ms, hallucination_rate, safety_pass_rate,
                total_cost_usd, status, report_summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id, dataset_id, model, time.time(), n,
                avg_q, avg_corr, avg_rel, avg_lat, halluc_rate,
                safety_rate, round(n * 0.00015, 6), status, summary_text
            )
        )

    return {
        "run_id": run_id,
        "model": model,
        "dataset_id": dataset_id,
        "status": status,
        "avg_quality_score": avg_q,
        "avg_correctness": avg_corr,
        "avg_relevance": avg_rel,
        "avg_latency_ms": avg_lat,
        "hallucination_rate_pct": halluc_rate,
        "safety_pass_rate_pct": safety_rate,
        "passed_threshold": passed_regression,
        "test_results": results
    }


def list_evaluation_runs() -> List[Dict[str, Any]]:
    with _get_db() as conn:
        rows = conn.execute("""
            SELECT id, dataset_id, model_tested, timestamp, test_count,
                   avg_quality_score, avg_latency_ms, hallucination_rate,
                   safety_pass_rate, status, report_summary
            FROM eval_runs ORDER BY timestamp DESC LIMIT 20
        """).fetchall()
        return [
            {
                "id": r[0], "dataset_id": r[1], "model": r[2], "timestamp": r[3],
                "test_count": r[4], "quality_score": r[5], "latency_ms": r[6],
                "hallucination_rate": r[7], "safety_rate": r[8], "status": r[9],
                "summary": r[10]
            }
            for r in rows
        ]
