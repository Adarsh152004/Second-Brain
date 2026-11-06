"""Multi-Tiered Response & Tool Cache (Exact, Semantic & Prompt Prefix) with PostgreSQL & SQLite Storage."""
import time
import hashlib
import math
import re
import json
import sqlite3
from typing import Dict, Any, Optional, Tuple, List
from src.embeddings.cohere_embeddings import embed_query
from src.config.settings import settings
from src.utils.logging import get_logger
from src.db.connection import is_postgres_configured
import src.db.cache_pg as pg_cache

logger = get_logger(__name__)

_EXACT_CACHE: Dict[str, Dict[str, Any]] = {}
_SEMANTIC_CACHE: List[Dict[str, Any]] = []
_PROMPT_PREFIX_CACHE: Dict[str, Dict[str, Any]] = {}
_TOOL_CACHE: Dict[str, Dict[str, Any]] = {}

CACHE_STATS = {
    "exact_hits": 0,
    "semantic_hits": 0,
    "prompt_cache_hits": 0,
    "misses": 0,
    "tokens_saved": 0,
    "cost_saved_usd": 0.0,
}

DEFAULT_TTL_SECONDS = 86400  # 24 hours
SEMANTIC_SIMILARITY_THRESHOLD = 0.85


def _get_db():
    conn = sqlite3.connect(settings.memory_db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cache_entries (
            cache_key TEXT PRIMARY KEY,
            cache_type TEXT NOT NULL,
            query TEXT NOT NULL,
            model TEXT,
            data_json TEXT NOT NULL,
            vector_json TEXT,
            tokens INTEGER DEFAULT 250,
            timestamp REAL NOT NULL,
            ttl INTEGER DEFAULT 86400
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_type_key ON cache_entries(cache_type, cache_key)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_expiry ON cache_entries(timestamp, ttl)")
    conn.commit()
    return conn


def _init_cache_from_db():
    """Load unexpired cache entries from SQLite on process boot."""
    now = time.time()
    try:
        with _get_db() as conn:
            # Clean expired
            conn.execute("DELETE FROM cache_entries WHERE timestamp + ttl < ?", (now,))
            conn.commit()

            rows = conn.execute("""
                SELECT cache_key, cache_type, query, model, data_json, vector_json, tokens, timestamp, ttl
                FROM cache_entries
            """).fetchall()

            for r in rows:
                ckey, ctype, query, model, data_json, vec_json, tokens, ts, ttl = r
                try:
                    data = json.loads(data_json)
                    vec = json.loads(vec_json) if vec_json else []
                except Exception:
                    continue

                if ctype == "exact":
                    _EXACT_CACHE[ckey] = {
                        "timestamp": ts,
                        "ttl": ttl,
                        "data": data,
                        "tokens": tokens,
                    }
                elif ctype == "semantic":
                    _SEMANTIC_CACHE.append({
                        "query": query,
                        "vector": vec,
                        "model": model,
                        "timestamp": ts,
                        "ttl": ttl,
                        "data": data,
                        "tokens": tokens,
                    })
        logger.info(f"Loaded {len(_EXACT_CACHE)} exact & {len(_SEMANTIC_CACHE)} semantic cache entries from DB.")
    except Exception as e:
        logger.warning(f"Could not initialize cache from DB: {e}")


# Initialize once on module load
try:
    _init_cache_from_db()
except Exception:
    pass


def _hash_key(prefix: str, text: str) -> str:
    return f"{prefix}:{hashlib.sha256(text.strip().lower().encode('utf-8')).hexdigest()}"


def _cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    if n1 == 0.0 or n2 == 0.0:
        return 0.0
    return dot / (n1 * n2)


def _text_ngrams(text: str, n: int = 3) -> set:
    clean = re.sub(r'\s+', ' ', text.lower().strip())
    if len(clean) < n:
        return {clean}
    return {clean[i:i+n] for i in range(len(clean) - n + 1)}


def _ngram_jaccard(t1: str, t2: str) -> float:
    ng1 = _text_ngrams(t1)
    ng2 = _text_ngrams(t2)
    union = ng1.union(ng2)
    if not union:
        return 0.0
    return len(ng1.intersection(ng2)) / len(union)


def get_cached_response(query: str, model: str = "") -> Optional[Dict[str, Any]]:
    now = time.time()
    keys = (_hash_key(f"chat:{model}", query), _hash_key("chat:", query))
    for k in keys:
        if k in _EXACT_CACHE:
            entry = _EXACT_CACHE[k]
            if now - entry["timestamp"] < entry["ttl"]:
                CACHE_STATS["exact_hits"] += 1
                saved_tok = entry.get("tokens", 250)
                CACHE_STATS["tokens_saved"] += saved_tok
                CACHE_STATS["cost_saved_usd"] += round((saved_tok / 1_000_000) * 0.40, 6)
                logger.info(f"Exact Cache Hit for query: {query[:50]}...")
                res = dict(entry["data"])
                res["is_cached"] = True
                res["cache_type"] = "exact"
                res["similarity_score"] = 1.0
                return res
            else:
                del _EXACT_CACHE[k]
    return None


def get_semantic_cached_response(
    query: str,
    model: str = "",
    threshold: float = SEMANTIC_SIMILARITY_THRESHOLD,
) -> Optional[Dict[str, Any]]:
    now = time.time()
    if not _SEMANTIC_CACHE:
        return None

    try:
        q_vec = embed_query(query)
    except Exception:
        q_vec = []
    has_valid_vec = any(v != 0.0 for v in q_vec)

    best_score = 0.0
    best_entry = None

    for entry in list(_SEMANTIC_CACHE):
        if now - entry["timestamp"] > entry["ttl"]:
            try:
                _SEMANTIC_CACHE.remove(entry)
            except ValueError:
                pass
            continue

        score = 0.0
        if has_valid_vec and entry.get("vector") and any(v != 0.0 for v in entry["vector"]):
            score = _cosine_similarity(q_vec, entry["vector"])
        else:
            score = _ngram_jaccard(query, entry["query"])

        if score > best_score:
            best_score = score
            best_entry = entry

    if best_entry and best_score >= threshold:
        CACHE_STATS["semantic_hits"] += 1
        saved_tok = best_entry.get("tokens", 250)
        CACHE_STATS["tokens_saved"] += saved_tok
        CACHE_STATS["cost_saved_usd"] += round((saved_tok / 1_000_000) * 0.40, 6)
        logger.info(
            f"Semantic Cache Hit! Score: {best_score:.3f} | Query: '{query[:40]}' matched '{best_entry['query'][:40]}'"
        )
        res = dict(best_entry["data"])
        res["is_cached"] = True
        res["cache_type"] = "semantic"
        res["similarity_score"] = round(best_score, 3)
        res["matched_query"] = best_entry["query"]
        return res

    return None


def set_cached_response(
    query: str,
    data: dict,
    model: str = "",
    ttl: int = DEFAULT_TTL_SECONDS,
    tokens: int = 250,
):
    now = time.time()
    entry = {
        "timestamp": now,
        "ttl": ttl,
        "data": data,
        "tokens": tokens,
    }
    k1 = _hash_key(f"chat:{model}", query)
    k2 = _hash_key("chat:", query)
    _EXACT_CACHE[k1] = entry
    _EXACT_CACHE[k2] = entry

    try:
        vec = embed_query(query)
    except Exception:
        vec = []

    if len(_SEMANTIC_CACHE) >= 500:
        _SEMANTIC_CACHE.pop(0)

    _SEMANTIC_CACHE.append({
        "query": query,
        "vector": vec,
        "model": model,
        "timestamp": now,
        "ttl": ttl,
        "data": data,
        "tokens": tokens,
    })

    # Persist to PostgreSQL if configured
    if is_postgres_configured():
        try:
            pg_cache.set_cache_entry(
                cache_type="exact",
                cache_key=k1,
                query=query,
                model=model,
                response_data=data,
                tokens_saved=tokens,
                ttl_seconds=ttl,
                embedding=vec if vec else None
            )
        except Exception as e:
            logger.debug(f"Failed to persist cache entry to Postgres: {e}")

    # Persist to SQLite
    try:
        data_str = json.dumps(data)
        vec_str = json.dumps(vec) if vec else "[]"
        with _get_db() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO cache_entries
                (cache_key, cache_type, query, model, data_json, vector_json, tokens, timestamp, ttl)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (k1, "exact", query, model, data_str, vec_str, tokens, now, ttl))
            conn.execute("""
                INSERT OR REPLACE INTO cache_entries
                (cache_key, cache_type, query, model, data_json, vector_json, tokens, timestamp, ttl)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (f"sem:{k1}", "semantic", query, model, data_str, vec_str, tokens, now, ttl))
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to persist cache entry to SQLite: {e}")


def check_prompt_prefix_cache(system_prompt: str, model: str = "") -> Tuple[bool, int, float]:
    if not system_prompt or len(system_prompt) < 50:
        return False, 0, 1.0

    prefix_hash = hashlib.sha256(system_prompt.strip().encode('utf-8')).hexdigest()
    key = f"prompt:{model}:{prefix_hash}"
    now = time.time()

    approx_tokens = max(1, int(len(system_prompt) / 3.8))

    if key in _PROMPT_PREFIX_CACHE:
        entry = _PROMPT_PREFIX_CACHE[key]
        if now - entry["timestamp"] < entry["ttl"]:
            CACHE_STATS["prompt_cache_hits"] += 1
            entry["hits"] += 1
            discount = 0.25
            logger.info(f"Prompt Prefix Cache Hit! Approx {approx_tokens} tokens reused.")
            return True, approx_tokens, discount

    _PROMPT_PREFIX_CACHE[key] = {
        "timestamp": now,
        "ttl": 86400,
        "hits": 1,
        "tokens": approx_tokens,
    }
    return False, approx_tokens, 1.0


def get_cached_tool_result(tool_name: str, args: dict) -> Optional[str]:
    key = _hash_key(f"tool:{tool_name}", str(sorted(args.items())))
    now = time.time()
    if key in _TOOL_CACHE:
        entry = _TOOL_CACHE[key]
        if now - entry["timestamp"] < entry["ttl"]:
            logger.info(f"Tool Cache Hit for {tool_name}")
            return entry["result"]
    return None


def set_cached_tool_result(tool_name: str, args: dict, result: str, ttl: int = 600):
    key = _hash_key(f"tool:{tool_name}", str(sorted(args.items())))
    _TOOL_CACHE[key] = {
        "timestamp": time.time(),
        "ttl": ttl,
        "result": result,
    }


def get_cache_stats() -> Dict[str, Any]:
    total_hits = (
        CACHE_STATS["exact_hits"]
        + CACHE_STATS["semantic_hits"]
        + CACHE_STATS["prompt_cache_hits"]
    )
    total_queries = total_hits + CACHE_STATS["misses"]
    hit_rate = round((total_hits / max(1, total_queries)) * 100, 1)

    return {
        **CACHE_STATS,
        "total_hits": total_hits,
        "total_queries": total_queries,
        "hit_rate_pct": hit_rate,
        "exact_entries_count": len(_EXACT_CACHE),
        "semantic_entries_count": len(_SEMANTIC_CACHE),
        "prompt_prefixes_count": len(_PROMPT_PREFIX_CACHE),
        "cached_tools_count": len(_TOOL_CACHE),
        "similarity_threshold": SEMANTIC_SIMILARITY_THRESHOLD,
    }


def clear_cache():
    _EXACT_CACHE.clear()
    _SEMANTIC_CACHE.clear()
    _PROMPT_PREFIX_CACHE.clear()
    _TOOL_CACHE.clear()
    try:
        with _get_db() as conn:
            conn.execute("DELETE FROM cache_entries")
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to clear SQLite cache: {e}")

    if is_postgres_configured():
        try:
            from src.db.connection import get_db_cursor
            with get_db_cursor() as cur:
                cur.execute("DELETE FROM public.llm_cache;")
        except Exception as e:
            logger.warning(f"Failed to clear Postgres cache: {e}")

    logger.info("All caches cleared.")
