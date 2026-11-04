"""Evaluation, Observability, Cost Optimization, Feedback & A/B Testing API Endpoints."""
import time
import json
from fastapi import APIRouter, HTTPException, Body, Response, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from src.observability.cost_tracker import (
    get_cost_summary,
    get_trace_details,
    save_feedback,
    export_feedback_jsonl,
    get_experiments,
    create_experiment,
    record_experiment_result,
    get_budget_policies,
    update_budget_policy,
    check_budget_status,
)
from src.observability.cache import get_cache_stats, clear_cache
from src.evaluation.quality_evaluator import evaluate_heuristics, evaluate_with_llm_judge, compare_pairwise_models
from src.evaluation.hallucination_detector import detect_hallucinations
from src.evaluation.safety_evaluator import evaluate_safety
from src.evaluation.dataset_manager import list_datasets, create_dataset, add_test_case, get_dataset_test_cases
from src.evaluation.regression_runner import run_evaluation_suite, list_evaluation_runs
from src.evaluation.prompt_manager import list_prompts, save_prompt_version
from src.router.recommendations import generate_cost_recommendations
from src.agent.llm_backends import get_llm_response

router = APIRouter(prefix="/eval", tags=["Evaluation & Observability"])


class JudgeRequest(BaseModel):
    query: str
    answer: str
    expected_answer: Optional[str] = None
    context: Optional[str] = None
    judge_model: Optional[str] = None


class CompareRequest(BaseModel):
    query: str
    answer_a: str
    answer_b: str
    model_a: Optional[str] = "Model A"
    model_b: Optional[str] = "Model B"


class EvalRunRequest(BaseModel):
    dataset_id: str
    model: Optional[str] = "groq"
    min_quality_threshold: Optional[float] = 75.0


class DatasetCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "general"


class TestCaseCreateRequest(BaseModel):
    query: str
    expected_answer: Optional[str] = ""
    tags: Optional[str] = "general"


class PromptCreateRequest(BaseModel):
    name: str
    template: str
    description: Optional[str] = ""


class FeedbackRequest(BaseModel):
    trace_id: str
    session_id: Optional[str] = ""
    rating: int  # 1 for up, -1 for down
    tags: Optional[List[str]] = []
    comment: Optional[str] = ""
    prompt: Optional[str] = ""
    response: Optional[str] = ""
    model: Optional[str] = ""
    provider: Optional[str] = ""


class ExperimentCreateRequest(BaseModel):
    name: str
    prompt_a: str
    prompt_b: str
    model_a: Optional[str] = "groq"
    model_b: Optional[str] = "groq"
    description: Optional[str] = ""


class ExperimentRunRequest(BaseModel):
    test_input: str


class BudgetPolicyUpdateRequest(BaseModel):
    daily_cap_usd: float
    monthly_cap_usd: float
    alert_threshold_pct: float
    action_on_exceed: str  # 'warn_only', 'throttle_to_cheapest', 'block'
    policy_name: Optional[str] = "Global Budget Cap"


@router.get("/metrics")
async def get_metrics():
    """Cost, latency, token, TTFT, and provider usage analytics."""
    summary = get_cost_summary()
    cache_info = get_cache_stats()
    budget_info = check_budget_status()
    return {
        "cost_and_usage": summary,
        "cache": cache_info,
        "budget": budget_info
    }


@router.get("/traces")
async def get_traces_list(limit: int = Query(20, ge=1, le=100)):
    from src.observability.cost_tracker import list_traces
    return list_traces(limit)

@router.get("/traces/{trace_id}")
async def get_trace(trace_id: str ):
    """Get detailed visual waterfall execution trace for a request."""
    trace = get_trace_details(trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace


@router.get("/cache/stats")
async def cache_stats():
    return get_cache_stats()


@router.post("/cache/clear")
async def cache_clear():
    clear_cache()
    return {"status": "cleared"}


@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Submit user thumbs up/down rating with tags & comment."""
    fb_id = save_feedback(
        trace_id=req.trace_id,
        session_id=req.session_id or "default",
        rating=req.rating,
        tags=req.tags or [],
        comment=req.comment or "",
        prompt=req.prompt or "",
        response=req.response or "",
        model=req.model or "",
        provider=req.provider or ""
    )
    return {"status": "saved", "feedback_id": fb_id}


@router.get("/feedback/export")
async def export_feedback(format: str = Query("chatml", pattern="^(chatml|openai|dpo)$")):
    """Export fine-tuning dataset formatted for ChatML, OpenAI SFT, or DPO JSONL."""
    jsonl_str = export_feedback_jsonl(format_type=format)
    return Response(
        content=jsonl_str,
        media_type="application/x-jsonlines",
        headers={
            "Content-Disposition": f"attachment; filename=finetune_dataset_{format}.jsonl"
        }
    )

@router.get("/experiments")
async def list_experiments():
    """List all active and past A/B prompt experiments."""
    return {"experiments": get_experiments()}


@router.post("/experiments")
async def create_new_experiment(req: ExperimentCreateRequest):
    """Create a new A/B prompt experiment."""
    exp_id = create_experiment(
        name=req.name,
        prompt_a=req.prompt_a,
        prompt_b=req.prompt_b,
        model_a=req.model_a or "groq",
        model_b=req.model_b or "groq",
        description=req.description or ""
    )
    return {"experiment_id": exp_id, "status": "created"}


@router.post("/experiments/{exp_id}/run")
async def run_ab_experiment(exp_id: str, req: ExperimentRunRequest):
    """Execute Variant A and Variant B side-by-side with latency & quality evals."""
    exps = get_experiments()
    target = next((e for e in exps if e["id"] == exp_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Experiment not found")

    prompt_a_filled = target["prompt_a"].replace("{input}", req.test_input)
    prompt_b_filled = target["prompt_b"].replace("{input}", req.test_input)

    # Run Variant A
    t0_a = time.time()
    resp_a, _ = await get_llm_response(prompt_a_filled, preferred_backend=target.get("model_a", "groq"))
    lat_a = round((time.time() - t0_a) * 1000, 1)

    # Run Variant B
    t0_b = time.time()
    resp_b, _ = await get_llm_response(prompt_b_filled, preferred_backend=target.get("model_b", "groq"))
    lat_b = round((time.time() - t0_b) * 1000, 1)

    # Pairwise Judge comparison
    judge_res = await compare_pairwise_models(
        query=req.test_input,
        answer_a=resp_a,
        answer_b=resp_b,
        model_a_name="Variant A",
        model_b_name="Variant B"
    )

    winner = "tie"
    if judge_res.get("winner") == "Variant A":
        winner = "a"
    elif judge_res.get("winner") == "Variant B":
        winner = "b"

    score_a = judge_res.get("score_a", 80.0)
    score_b = judge_res.get("score_b", 80.0)

    record_experiment_result(
        experiment_id=exp_id,
        test_input=req.test_input,
        response_a=resp_a,
        response_b=resp_b,
        latency_a=lat_a,
        latency_b=lat_b,
        cost_a=0.0001,
        cost_b=0.0001,
        score_a=score_a,
        score_b=score_b,
        winner=winner
    )

    return {
        "experiment_id": exp_id,
        "variant_a": {
            "response": resp_a,
            "latency_ms": lat_a,
            "score": score_a,
            "cost_usd": 0.0001
        },
        "variant_b": {
            "response": resp_b,
            "latency_ms": lat_b,
            "score": score_b,
            "cost_usd": 0.0001
        },
        "comparison": judge_res,
        "winner": winner
    }


@router.get("/budget")
async def get_budget():
    """Get current budget policies and real-time spend vs caps."""
    policy = get_budget_policies()
    status = check_budget_status()
    return {"policy": policy, "status": status}


@router.post("/budget")
async def update_budget(req: BudgetPolicyUpdateRequest):
    """Update spending caps, warning thresholds, and breach actions."""
    updated = update_budget_policy(
        daily_cap_usd=req.daily_cap_usd,
        monthly_cap_usd=req.monthly_cap_usd,
        alert_threshold_pct=req.alert_threshold_pct,
        action_on_exceed=req.action_on_exceed,
        policy_name=req.policy_name or "Global Budget Cap"
    )
    return {"status": "updated", "policy": updated}


@router.post("/judge")
async def judge_response(req: JudgeRequest):
    return await evaluate_with_llm_judge(
        query=req.query,
        answer=req.answer,
        expected_answer=req.expected_answer or "",
        context=req.context or "",
        judge_model=req.judge_model or "groq",
    )


@router.post("/compare")
async def compare_models(req: CompareRequest):
    return await compare_pairwise_models(
        query=req.query,
        answer_a=req.answer_a,
        answer_b=req.answer_b,
        model_a_name=req.model_a or "Model A",
        model_b_name=req.model_b or "Model B",
    )


@router.post("/guardrails/safety")
async def check_safety(query: str = Body(..., embed=True)):
    return evaluate_safety(query, is_user_input=True)


@router.post("/guardrails/hallucination")
async def check_hallucination(context: str = Body(...), answer: str = Body(...)):
    return detect_hallucinations(answer, context)


@router.get("/datasets")
async def get_datasets():
    return {"datasets": list_datasets()}


@router.post("/datasets")
async def add_dataset(req: DatasetCreateRequest):
    ds_id = create_dataset(req.name, req.description or "", req.category or "general")
    return {"dataset_id": ds_id, "status": "created"}


@router.get("/datasets/{dataset_id}/testcases")
async def get_test_cases(dataset_id: str):
    return {"test_cases": get_dataset_test_cases(dataset_id)}


@router.post("/datasets/{dataset_id}/testcases")
async def add_test_case_endpoint(dataset_id: str, req: TestCaseCreateRequest):
    tc_id = add_test_case(dataset_id, req.query, req.expected_answer or "", req.tags or "general")
    return {"test_case_id": tc_id, "status": "created"}


@router.post("/runs")
async def trigger_eval_run(req: EvalRunRequest):
    return await run_evaluation_suite(
        dataset_id=req.dataset_id,
        model=req.model or "groq",
        min_quality_threshold=req.min_quality_threshold or 75.0,
    )


@router.get("/runs")
async def get_eval_runs():
    return {"runs": list_evaluation_runs()}


@router.get("/prompts")
async def get_prompts():
    return {"prompts": list_prompts()}


@router.post("/prompts")
async def add_prompt_version(req: PromptCreateRequest):
    p_id = save_prompt_version(req.name, req.template, req.description or "")
    return {"prompt_id": p_id, "status": "saved"}


@router.get("/recommendations")
async def get_recommendations():
    return {"recommendations": generate_cost_recommendations()}


# ================================================
# JEV (Judgment, Evaluation, Verification) API
# ================================================
@router.post("/jev/decide")
async def run_jev_decision(data: Dict[str, Any]):
    from src.agent.jev_engine import get_jev_engine
    query = data.get("query") or data.get("prompt") or data.get("message") or "Help with general query"
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    engine = get_jev_engine()
    decision = engine.decide(query, context=data.get("context"))
    return {
        "status": "success",
        "decision": {
            "query": decision.query,
            "judgment": decision.judgment,
            "evaluation": decision.evaluation,
            "verification": decision.verification,
            "selected_action": {
                "action_type": decision.selected_action.action_type,
                "recommended_model": decision.selected_action.recommended_model,
                "target_tool": decision.selected_action.target_tool,
                "expected_accuracy": decision.selected_action.expected_accuracy,
                "estimated_latency_ms": decision.selected_action.estimated_latency_ms,
                "estimated_cost_usd": decision.selected_action.estimated_cost_usd,
                "expected_utility": decision.selected_action.expected_utility,
                "reasoning": decision.selected_action.reasoning
            },
            "ranked_candidates": decision.ranked_candidates,
            "execution_time_ms": decision.execution_time_ms,
            "timestamp": decision.timestamp
        }
    }

@router.get("/jev/models")
async def get_jev_models():
    from src.agent.jev_engine import get_jev_engine
    engine = get_jev_engine()
    return {
        "model_profiles": engine.MODEL_PROFILES,
        "utility_weights": engine.weights
    }

@router.post("/jev/weights")
async def update_jev_weights(data: Dict[str, Any]):
    from src.agent.jev_engine import get_jev_engine
    engine = get_jev_engine()
    mapping = {
        "accuracy": ["accuracy", "w_acc", "w_accuracy"],
        "speed": ["speed", "w_spd", "w_speed", "w_latency"],
        "cost_efficiency": ["cost_efficiency", "w_cst", "w_cost"],
        "context_fit": ["context_fit", "w_fit", "w_domain_fit"]
    }
    for target_k, aliases in mapping.items():
        for alias in aliases:
            if alias in data:
                try:
                    engine.weights[target_k] = float(data[alias])
                    break
                except Exception:
                    pass
    return {"status": "success", "weights": engine.weights}

@router.get("/jev/status")
async def get_jev_status():
    from src.agent.jev_engine import get_jev_engine
    import os
    engine = get_jev_engine()
    from src.config.settings import settings
    has_typesafe_key = bool(
        os.environ.get("JEV_API_KEY") or
        os.environ.get("TYPESAFE_API_KEY") or
        getattr(settings, "jev_api_key", "") or
        getattr(settings, "typesafe_api_key", "")
    )
    return {
        "status": "ready",
        "typesafe_ai_integrated": True,
        "typesafe_key_configured": has_typesafe_key,
        "active_engine": "TypeSafe AI Jev (System One)" if has_typesafe_key else "Heuristic Multi-Attribute Utility Engine",
        "model": os.environ.get("TYPESAFE_MODEL", "jev-latest"),
        "weights": engine.weights
    }

