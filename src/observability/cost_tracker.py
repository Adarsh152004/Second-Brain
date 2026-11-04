"""LLM Pricing Matrix, Cost Calculator, Tracing & Cost Analytics Engine."""
import sqlite3
import time
import uuid
import json
from typing import Dict, Any, List, Optional
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)

# Price per 1 Million Tokens ($ USD) [Input, Output]
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "openai/gpt-oss-120b": {"input": 0.15, "output": 0.60},
    "llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
    "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08},
    "mixtral-8x7b-32768": {"input": 0.24, "output": 0.24},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    "gemini-2.0-flash": {"input": 0.10, "output": 0.40},
    "mistral-small-latest": {"input": 0.20, "output": 0.60},
    "mistral-large-latest": {"input": 2.00, "output": 6.00},
    "codestral-latest": {"input": 0.30, "output": 0.90},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "deepseek/deepseek-chat": {"input": 0.14, "output": 0.28},
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast": {"input": 0.20, "output": 0.40},
    "llama3.2": {"input": 0.00, "output": 0.00},
    "exact-cache": {"input": 0.00, "output": 0.00},
    "semantic-cache": {"input": 0.00, "output": 0.00},
}

DEFAULT_RATE = {"input": 0.30, "output": 0.80}

def _get_db():
    conn = sqlite3.connect(settings.memory_db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS traces (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            timestamp REAL,
            provider TEXT,
            model TEXT,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            cached_tokens INTEGER DEFAULT 0,
            latency_ms REAL DEFAULT 0.0,
            ttft_ms REAL DEFAULT 0.0,
            tokens_per_sec REAL DEFAULT 0.0,
            cost_usd REAL DEFAULT 0.0,
            intent TEXT,
            agent_used TEXT,
            status TEXT,
            error TEXT,
            prompt_preview TEXT,
            response_preview TEXT,
            rag_chunks_count INTEGER DEFAULT 0,
            mcp_tool_calls_count INTEGER DEFAULT 0,
            waterfall_json TEXT DEFAULT '[]',
            feedback_rating INTEGER DEFAULT 0,
            feedback_tags TEXT DEFAULT '',
            feedback_comment TEXT DEFAULT ''
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            trace_id TEXT,
            session_id TEXT,
            rating INTEGER,
            tags TEXT,
            comment TEXT,
            prompt TEXT,
            response TEXT,
            model TEXT,
            created_at REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY,
            name TEXT,
            prompt_a TEXT,
            prompt_b TEXT,
            model_a TEXT,
            model_b TEXT,
            description TEXT,
            runs_a INTEGER DEFAULT 0,
            runs_b INTEGER DEFAULT 0,
            avg_latency_a REAL DEFAULT 0.0,
            avg_latency_b REAL DEFAULT 0.0,
            avg_cost_a REAL DEFAULT 0.0,
            avg_cost_b REAL DEFAULT 0.0,
            score_a REAL DEFAULT 0.0,
            score_b REAL DEFAULT 0.0,
            status TEXT DEFAULT 'active',
            created_at REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS budget_policies (
            id TEXT PRIMARY KEY,
            policy_name TEXT,
            daily_cap_usd REAL DEFAULT 5.0,
            monthly_cap_usd REAL DEFAULT 50.0,
            alert_threshold_pct REAL DEFAULT 80.0,
            action_on_exceed TEXT DEFAULT 'downgrade',
            status TEXT DEFAULT 'active'
        )
    """)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM budget_policies")
    if cur.fetchone()[0] == 0:
        conn.execute("""
            INSERT INTO budget_policies (id, policy_name, daily_cap_usd, monthly_cap_usd, alert_threshold_pct, action_on_exceed, status)
            VALUES ('default', 'Global Budget Cap', 5.0, 50.0, 80.0, 'downgrade', 'active')
        """)
    for col in [
        "ALTER TABLE traces ADD COLUMN ttft_ms REAL DEFAULT 0.0",
        "ALTER TABLE traces ADD COLUMN tokens_per_sec REAL DEFAULT 0.0",
        "ALTER TABLE traces ADD COLUMN waterfall_json TEXT DEFAULT '[]'",
        "ALTER TABLE traces ADD COLUMN feedback_rating INTEGER DEFAULT 0",
        "ALTER TABLE traces ADD COLUMN feedback_tags TEXT DEFAULT ''",
        "ALTER TABLE traces ADD COLUMN feedback_comment TEXT DEFAULT ''"
    ]:
        try:
            conn.execute(col)
        except Exception:
            pass
    conn.commit()
    return conn

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rates = MODEL_PRICING.get(model, DEFAULT_RATE)
    cost = (input_tokens / 1_000_000 * rates["input"]) + (output_tokens / 1_000_000 * rates["output"])
    return round(cost, 7)

def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, int(len(text.split()) * 1.33))

def record_trace(
    trace_id: str,
    session_id: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: float,
    intent: str = "general",
    agent_used: str = "Assistant",
    cached_tokens: int = 0,
    status: str = "success",
    error: str = None,
    prompt_preview: str = "",
    response_preview: str = "",
    rag_chunks: int = 0,
    mcp_calls: int = 0,
    ttft_ms: float = 0.0,
    tokens_per_sec: float = 0.0,
    waterfall_stages: List[Dict[str, Any]] = None,
) -> float:
    cost = calculate_cost(model, input_tokens, output_tokens)
    total_tokens = input_tokens + output_tokens
    waterfall_str = json.dumps(waterfall_stages or [])
    with _get_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO traces (
                id, session_id, timestamp, provider, model,
                input_tokens, output_tokens, total_tokens, cached_tokens,
                latency_ms, ttft_ms, tokens_per_sec, cost_usd, intent, agent_used, status, error,
                prompt_preview, response_preview, rag_chunks_count, mcp_tool_calls_count,
                waterfall_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                trace_id, session_id, time.time(), provider, model,
                input_tokens, output_tokens, total_tokens, cached_tokens,
                latency_ms, ttft_ms, tokens_per_sec, cost, intent, agent_used, status, error or "",
                prompt_preview[:400], response_preview[:400], rag_chunks, mcp_calls,
                waterfall_str
            )
        )
    return cost

def get_trace_details(trace_id: str) -> Optional[Dict[str, Any]]:
    with _get_db() as conn:
        row = conn.execute("""
            SELECT id, session_id, timestamp, provider, model, input_tokens, output_tokens,
                    total_tokens, cached_tokens, latency_ms, ttft_ms, tokens_per_sec, cost_usd,
                    intent, agent_used, status, error, prompt_preview, response_preview,
                    rag_chunks_count, mcp_tool_calls_count, waterfall_json, feedback_rating,
                    feedback_tags, feedback_comment
            FROM traces WHERE id = ?
        """, (trace_id,)).fetchone()
        if not row:
            return None
        waterfall = []
        try:
            waterfall = json.loads(row[21]) if row[21] else []
        except Exception:
            waterfall = []
        return {
            "id": row[0],
            "session_id": row[1],
            "timestamp": row[2],
            "provider": row[3],
            "model": row[4],
            "input_tokens": row[5],
            "output_tokens": row[6],
            "total_tokens": row[7],
            "cached_tokens": row[8],
            "latency_ms": round(row[9] or 0.0, 1),
            "ttft_ms": round(row[10] or 0.0, 1),
            "tokens_per_sec": round(row[11] or 0.0, 1),
            "cost_usd": round(row[12] or 0.0, 6),
            "intent": row[13],
            "agent_used": row[14],
            "status": row[15],
            "error": row[16],
            "prompt": row[17],
            "response": row[18],
            "rag_chunks": row[19],
            "mcp_calls": row[20],
            "waterfall": waterfall,
            "feedback_rating": row[22],
            "feedback_tags": row[23],
            "feedback_comment": row[24],
        }

def save_feedback(
    trace_id: str,
    session_id: str,
    rating: int,
    tags: List[str] = None,
    comment: str = "",
    prompt: str = "",
    response: str = "",
    model: str = "",
) -> Dict[str, Any]:
    fb_id = f"fb-{uuid.uuid4().hex[:10]}"
    tags_str = json.dumps(tags or [])
    with _get_db() as conn:
        conn.execute("""
            INSERT INTO feedback (id, trace_id, session_id, rating, tags, comment, prompt, response, model, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (fb_id, trace_id, session_id, rating, tags_str, comment, prompt, response, model, time.time()))
        conn.execute("""
            UPDATE traces
            SET feedback_rating = ?, feedback_tags = ?, feedback_comment = ?
            WHERE id = ?
        """, (rating, ", ".join(tags or []), comment, trace_id))
    return {"status": "success", "feedback_id": fb_id, "trace_id": trace_id, "rating": rating}

def export_feedback_jsonl(format_type: str = "chatml") -> str:
    lines = []
    with _get_db() as conn:
        rows = conn.execute("""
            SELECT rating, prompt, response, model, tags, comment
            FROM feedback ORDER BY created_at DESC
        """).fetchall()
        if format_type.lower() == "dpo":
            for r in rows:
                rating, prompt, resp, model, tags, comment = r
                if rating == 1:
                    item = {
                        "prompt": prompt or "User request",
                        "chosen": resp,
                        "rejected": "[Low quality or inaccurate response flagged by user]",
                        "model": model,
                        "metadata": {"tags": tags, "comment": comment}
                    }
                    lines.append(json.dumps(item))
        elif format_type.lower() == "openai":
            for r in rows:
                rating, prompt, resp, model, tags, comment = r
                if rating == 1:
                    item = {
                        "messages": [
                            {"role": "system", "content": "You are a helpful, expert AI assistant."},
                            {"role": "user", "content": prompt},
                            {"role": "assistant", "content": resp}
                        ]
                    }
                    lines.append(json.dumps(item))
        else:
            for r in rows:
                rating, prompt, resp, model, tags, comment = r
                if rating == 1:
                    item = {
                        "messages": [
                            {"role": "user", "content": prompt},
                            {"role": "assistant", "content": resp}
                        ],
                        "quality": "positive",
                        "model": model
                    }
                    lines.append(json.dumps(item))
    return "\n".join(lines)

def create_experiment(name: str, prompt_a: str, prompt_b: str, model_a: str, model_b: str, description: str = "") -> Dict[str, Any]:
    exp_id = f"exp-{uuid.uuid4().hex[:8]}"
    with _get_db() as conn:
        conn.execute("""
            INSERT INTO experiments (id, name, prompt_a, prompt_b, model_a, model_b, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (exp_id, name, prompt_a, prompt_b, model_a, model_b, description, time.time()))
    return {"status": "created", "experiment_id": exp_id, "name": name}

def get_experiments() -> List[Dict[str, Any]]:
    with _get_db() as conn:
        rows = conn.execute("""
            SELECT id, name, prompt_a, prompt_b, model_a, model_b, description,
                    runs_a, runs_b, avg_latency_a, avg_latency_b, avg_cost_a, avg_cost_b,
                    score_a, score_b, status, created_at
            FROM experiments ORDER BY created_at DESC
        """).fetchall()
        return [
            {
                "id": r[0], "name": r[1], "prompt_a": r[2], "prompt_b": r[3],
                "model_a": r[4], "model_b": r[5], "description": r[6],
                "runs_a": r[7], "runs_b": r[8],
                "avg_latency_a": round(r[9] or 0.0, 1), "avg_latency_b": round(r[10] or 0.0, 1),
                "avg_cost_a": round(r[11] or 0.0, 6), "avg_cost_b": round(r[12] or 0.0, 6),
                "score_a": round(r[13] or 0.0, 2), "score_b": round(r[14] or 0.0, 2),
                "status": r[15], "created_at": r[16]
            }
            for r in rows
        ]

def record_experiment_result(experiment_id: str, variant: str, latency_ms: float, cost_usd: float, score: float = 1.0):
    with _get_db() as conn:
        if variant.lower() == "a":
            conn.execute("""
                UPDATE experiments
                SET runs_a = runs_a + 1,
                    avg_latency_a = (avg_latency_a * runs_a + ?) / (runs_a + 1),
                    avg_cost_a = (avg_cost_a * runs_a + ?) / (runs_a + 1),
                    score_a = (score_a * runs_a + ?) / (runs_a + 1)
                WHERE id = ?
            """, (latency_ms, cost_usd, score, experiment_id))
        else:
            conn.execute("""
                UPDATE experiments
                SET runs_b = runs_b + 1,
                    avg_latency_b = (avg_latency_b * runs_b + ?) / (runs_b + 1),
                    avg_cost_b = (avg_cost_b * runs_b + ?) / (runs_b + 1),
                    score_b = (score_b * runs_b + ?) / (runs_b + 1)
                WHERE id = ?
            """, (latency_ms, cost_usd, score, experiment_id))

def get_budget_policies() -> Dict[str, Any]:
    with _get_db() as conn:
        row = conn.execute("""
            SELECT id, policy_name, daily_cap_usd, monthly_cap_usd, alert_threshold_pct, action_on_exceed, status
            FROM budget_policies LIMIT 1
        """).fetchone()
        today_start = time.time() - 86400
        month_start = time.time() - (86400 * 30)
        day_spend = conn.execute("SELECT COALESCE(SUM(cost_usd), 0) FROM traces WHERE timestamp >= ?", (today_start,)).fetchone()[0]
        month_spend = conn.execute("SELECT COALESCE(SUM(cost_usd), 0) FROM traces WHERE timestamp >= ?", (month_start,)).fetchone()[0]
    daily_cap = row[2] if row and row[2] > 0 else 5.0
    monthly_cap = row[3] if row and row[3] > 0 else 50.0
    return {
        "id": row[0] if row else "default",
        "policy_name": row[1] if row else "Global Budget Cap",
        "daily_cap_usd": daily_cap,
        "monthly_cap_usd": monthly_cap,
        "alert_threshold_pct": row[4] if row else 80.0,
        "action_on_exceed": row[5] if row else "downgrade",
        "status": row[6] if row else "active",
        "current_daily_spend_usd": round(day_spend, 5),
        "current_monthly_spend_usd": round(month_spend, 5),
        "daily_used_pct": round((day_spend / daily_cap) * 100, 1),
        "monthly_used_pct": round((month_spend / monthly_cap) * 100, 1),
    }

def update_budget_policy(
    daily_cap_usd: float,
    monthly_cap_usd: float,
    alert_threshold_pct: float,
    action_on_exceed: str,
    policy_name: str = "Global Budget Cap"
) -> Dict[str, Any]:
    with _get_db() as conn:
        conn.execute("""
            UPDATE budget_policies
            SET daily_cap_usd = ?, monthly_cap_usd = ?, alert_threshold_pct = ?, action_on_exceed = ?, policy_name = ?
            WHERE id = 'default'
        """, (daily_cap_usd, monthly_cap_usd, alert_threshold_pct, action_on_exceed, policy_name))
    return get_budget_policies()

def check_budget_status() -> Dict[str, Any]:
    policy = get_budget_policies()
    is_exceeded = policy["daily_used_pct"] >= 100.0 or policy["monthly_used_pct"] >= 100.0
    is_warning = policy["daily_used_pct"] >= policy["alert_threshold_pct"] or policy["monthly_used_pct"] >= policy["alert_threshold_pct"]
    return {
        "is_exceeded": is_exceeded,
        "is_warning": is_warning,
        "action": policy["action_on_exceed"] if is_exceeded else "normal",
        "policy": policy
    }

def get_cost_summary() -> Dict[str, Any]:
    with _get_db() as conn:
        row = conn.execute("""
            SELECT 
                COUNT(*),
                COALESCE(SUM(cost_usd), 0),
                COALESCE(SUM(input_tokens), 0),
                COALESCE(SUM(output_tokens), 0),
                COALESCE(SUM(total_tokens), 0),
                COALESCE(SUM(cached_tokens), 0),
                COALESCE(AVG(latency_ms), 0),
                COALESCE(AVG(cost_usd), 0),
                COALESCE(AVG(ttft_ms), 0),
                COALESCE(AVG(tokens_per_sec), 0)
            FROM traces
        """).fetchone()
        by_provider = conn.execute("""
            SELECT provider, COUNT(*), SUM(cost_usd), SUM(total_tokens)
            FROM traces GROUP BY provider
        """).fetchall()
        by_model = conn.execute("""
            SELECT model, COUNT(*), SUM(cost_usd), SUM(total_tokens), AVG(latency_ms), AVG(ttft_ms)
            FROM traces GROUP BY model
        """).fetchall()
        fb_stats = conn.execute("""
            SELECT 
                COUNT(*),
                COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END), 0)
            FROM feedback
        """).fetchone()
        recent = conn.execute("""
            SELECT id, session_id, timestamp, provider, model, total_tokens, latency_ms, ttft_ms, tokens_per_sec, cost_usd, agent_used, status, error, prompt_preview, feedback_rating
            FROM traces ORDER BY timestamp DESC LIMIT 25
        """).fetchall()

    total_fb = fb_stats[0] or 0
    thumbs_up = fb_stats[1] or 0
    thumbs_down = fb_stats[2] or 0
    satisfaction_rate = round((thumbs_up / total_fb * 100), 1) if total_fb > 0 else 100.0

    return {
        "total_requests": row[0],
        "total_cost_usd": round(row[1], 4),
        "total_input_tokens": row[2],
        "total_output_tokens": row[3],
        "total_tokens": row[4],
        "total_cached_tokens": row[5],
        "avg_latency_ms": round(row[6], 1),
        "avg_cost_per_request": round(row[7], 5),
        "avg_ttft_ms": round(row[8], 1),
        "avg_tokens_per_sec": round(row[9], 1),
        "feedback_summary": {
            "total_ratings": total_fb,
            "thumbs_up": thumbs_up,
            "thumbs_down": thumbs_down,
            "satisfaction_pct": satisfaction_rate
        },
        "cost_by_provider": [{"provider": r[0], "requests": r[1], "cost": round(r[2] or 0, 4), "tokens": r[3] or 0} for r in by_provider],
        "cost_by_model": [{"model": r[0], "requests": r[1], "cost": round(r[2] or 0, 4), "tokens": r[3] or 0, "avg_latency_ms": round(r[4] or 0, 1), "avg_ttft_ms": round(r[5] or 0, 1)} for r in by_model],
        "recent_traces": [
            {
                "id": r[0], "session_id": r[1], "timestamp": r[2],
                "provider": r[3], "model": r[4], "total_tokens": r[5],
                "latency_ms": round(r[6], 1), "ttft_ms": round(r[7] or 0.0, 1),
                "tokens_per_sec": round(r[8] or 0.0, 1),
                "cost_usd": round(r[9], 5), "agent_used": r[10],
                "status": r[11], "error": r[12], "prompt": r[13],
                "feedback_rating": r[14]
            }
            for r in recent
        ]
    }


def list_traces(limit: int = 20):
    with _get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id as trace_id, session_id, timestamp, provider, model, input_tokens, output_tokens,
                total_tokens, cached_tokens, latency_ms, ttft_ms, tokens_per_sec, cost_usd,
                intent, agent_used, status, error, prompt_preview, response_preview
            FROM traces ORDER BY timestamp DESC LIMIT ?
        """, (limit,))
        cols = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        return [dict(zip(cols, row)) for row in rows]
