"""Evaluation Datasets and Benchmark Test Cases Manager."""
import sqlite3
import json
import time
import uuid
from typing import Dict, Any, List, Optional
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


def _get_db():
    conn = sqlite3.connect(settings.memory_db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS eval_datasets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            version TEXT DEFAULT "v1",
            category TEXT,
            created_at REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS eval_test_cases (
            id TEXT PRIMARY KEY,
            dataset_id TEXT NOT NULL,
            query TEXT NOT NULL,
            expected_answer TEXT,
            expected_doc_ids TEXT,
            tags TEXT,
            created_at REAL,
            FOREIGN KEY (dataset_id) REFERENCES eval_datasets(id)
        )
    """)
    conn.commit()
    return conn


def create_dataset(name: str, description: str = "", category: str = "general") -> str:
    ds_id = f"ds-{uuid.uuid4().hex[:8]}"
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO eval_datasets (id, name, description, category, created_at) VALUES (?, ?, ?, ?, ?)",
            (ds_id, name, description, category, time.time())
        )
    return ds_id


def add_test_case(dataset_id: str, query: str, expected_answer: str = "", tags: str = "general") -> str:
    tc_id = f"tc-{uuid.uuid4().hex[:8]}"
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO eval_test_cases (id, dataset_id, query, expected_answer, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (tc_id, dataset_id, query, expected_answer, tags, time.time())
        )
    return tc_id


def list_datasets() -> List[Dict[str, Any]]:
    with _get_db() as conn:
        rows = conn.execute("SELECT id, name, description, version, category, created_at FROM eval_datasets ORDER BY created_at DESC").fetchall()
        results = []
        for r in rows:
            count = conn.execute("SELECT COUNT(*) FROM eval_test_cases WHERE dataset_id=?", (r[0],)).fetchone()[0]
            results.append({
                "id": r[0], "name": r[1], "description": r[2],
                "version": r[3], "category": r[4], "created_at": r[5],
                "test_case_count": count
            })
        return results


def get_dataset_test_cases(dataset_id: str) -> List[Dict[str, Any]]:
    with _get_db() as conn:
        rows = conn.execute("SELECT id, query, expected_answer, tags FROM eval_test_cases WHERE dataset_id=?", (dataset_id,)).fetchall()
        return [{"id": r[0], "query": r[1], "expected_answer": r[2], "tags": r[3]} for r in rows]


def init_default_benchmarks():
    """Seed initial benchmark evaluation dataset if empty."""
    datasets = list_datasets()
    if not datasets:
        ds_id = create_dataset("Core Assistant Benchmark", "General reasoning, coding, and RAG evaluation test suite", "core")
        add_test_case(ds_id, "Explain binary search in 2 bullet points", "Binary search is a divide-and-conquer algorithm with O(log n) time complexity.", "coding,algorithms")
        add_test_case(ds_id, "What is 25% of 80,000?", "25% of 80,000 is 20,000.", "math,reasoning")
        add_test_case(ds_id, "Summarize the key benefits of LangGraph", "LangGraph enables stateful multi-agent workflows with cycles and human-in-the-loop control.", "architecture,ai")
        logger.info(f"Initialized default benchmark dataset {ds_id}")


init_default_benchmarks()
