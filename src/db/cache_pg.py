"""Production PostgreSQL multi-tier cache store for Supabase."""
import json
import time
from typing import Dict, Any, Optional, List
from src.db.connection import get_db_cursor
from src.utils.logging import get_logger

logger = get_logger(__name__)


def get_cache_entry(cache_type: str, cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve an unexpired cache entry from public.llm_cache."""
    query = """
        SELECT response_data, tokens_saved, expires_at
        FROM public.llm_cache
        WHERE cache_type = %s 
          AND cache_key = %s 
          AND expires_at > now();
    """
    try:
        with get_db_cursor() as cur:
            cur.execute(query, (cache_type, cache_key))
            row = cur.fetchone()
            if row:
                data = row["response_data"]
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                    except Exception:
                        pass
                return {
                    "data": data,
                    "tokens": row["tokens_saved"] or 0
                }
    except Exception as e:
        logger.debug(f"Postgres cache read miss or error: {e}")
    return None


def set_cache_entry(
    cache_type: str,
    cache_key: str,
    query: str,
    model: str,
    response_data: Any,
    tokens_saved: int = 250,
    ttl_seconds: int = 86400,
    embedding: Optional[List[float]] = None
):
    """Store or update a cache entry in public.llm_cache."""
    resp_json = json.dumps(response_data)
    vec_str = f"[{','.join(str(float(x)) for x in embedding)}]" if embedding else None
    query_sql = """
        INSERT INTO public.llm_cache (
            cache_key, cache_type, query, model, response_data, 
            embedding, tokens_saved, created_at, expires_at
        )
        VALUES (%s, %s, %s, %s, %s::jsonb, %s::vector, %s, now(), now() + interval '%s second')
        ON CONFLICT (cache_key) DO UPDATE SET
            response_data = EXCLUDED.response_data,
            tokens_saved = EXCLUDED.tokens_saved,
            expires_at = EXCLUDED.expires_at;
    """
    try:
        with get_db_cursor() as cur:
            cur.execute(query_sql, (
                cache_key, cache_type, query[:500], model, resp_json, 
                vec_str, tokens_saved, ttl_seconds
            ))
    except Exception as e:
        logger.debug(f"Postgres cache write error: {e}")


def cleanup_expired() -> int:
    """Purge expired cache entries."""
    try:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM public.llm_cache WHERE expires_at <= now();")
            return cur.rowcount
    except Exception:
        return 0

