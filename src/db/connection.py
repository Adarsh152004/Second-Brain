"""Supabase / PostgreSQL connection pool manager with thread-safety and auto-recovery."""
import os
import urllib.parse
from contextlib import contextmanager
from typing import Optional, Generator
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)

_POOL: Optional[pool.ThreadedConnectionPool] = None
_CHECKED_INIT = False


def get_connection_string() -> Optional[str]:
    """Build a valid PostgreSQL connection string from settings."""
    db_url = settings.database_url.strip() if settings.database_url else ""
    if db_url and "[YOUR-PASSWORD]" not in db_url:
        return db_url

    password = settings.postgres_password.strip() if settings.postgres_password else ""
    if not password:
        return None

    # Percent-encode password if it contains special characters
    safe_pass = urllib.parse.quote_plus(password)
    user = urllib.parse.quote_plus(settings.postgres_user)
    host = settings.postgres_host
    port = settings.postgres_port
    db = settings.postgres_db

    return f"postgresql://{user}:{safe_pass}@{host}:{port}/{db}?sslmode=require"


def is_postgres_configured() -> bool:
    """Return True if Postgres / Supabase connection parameters are present."""
    return get_connection_string() is not None


def get_pool() -> Optional[pool.ThreadedConnectionPool]:
    """Retrieve or initialize the thread-safe connection pool."""
    global _POOL
    if _POOL is not None and not _POOL.closed:
        return _POOL

    conn_str = get_connection_string()
    if not conn_str:
        return None

    try:
        # Min 1, Max 10 connections for pooled efficiency (per conn-pooling guidelines)
        _POOL = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=conn_str,
            connect_timeout=8
        )
        logger.info(f"Initialized PostgreSQL connection pool for host {settings.postgres_host}.")
        return _POOL
    except Exception as e:
        logger.warning(f"Could not initialize PostgreSQL pool: {e}")
        return None


@contextmanager
def get_db_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    """Context manager yielding a pooled connection with automatic commit/rollback and return."""
    p = get_pool()
    if not p:
        raise ConnectionError("PostgreSQL connection pool is not configured or offline.")

    conn = p.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        p.putconn(conn)


@contextmanager
def get_db_cursor(commit: bool = True) -> Generator[psycopg2.extensions.cursor, None, None]:
    """Context manager yielding a RealDictCursor from the pool."""
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        if commit:
            conn.commit()


def ping_postgres() -> dict:
    """Test Postgres connectivity and return latency and version."""
    if not is_postgres_configured():
        return {"configured": False, "status": "unconfigured"}

    import time
    start = time.perf_counter()
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT version(), current_database(), current_user;")
            row = cur.fetchone()
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {
                "configured": True,
                "status": "online",
                "latency_ms": latency_ms,
                "database": row["current_database"] if row else None,
                "user": row["current_user"] if row else None,
                "version": row["version"].split(",")[0] if row else None
            }
    except Exception as e:
        return {
            "configured": True,
            "status": "error",
            "error": str(e)
        }


def ensure_postgres_schema() -> bool:
    """Ensure core tables exist in PostgreSQL if connected."""
    global _CHECKED_INIT
    if _CHECKED_INIT or not is_postgres_configured():
        return False

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Check if sessions exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'sessions'
                    );
                """)
                exists = cur.fetchone()[0]
                if not exists:
                    logger.info("Auto-initializing production schema in Supabase...")
                    from pathlib import Path
                    migration_file = Path("supabase/migrations/20261105000000_production_schema.sql")
                    if migration_file.exists():
                        cur.execute(migration_file.read_text(encoding="utf-8"))
                        logger.info("Applied 20261105000000_production_schema.sql successfully.")
            _CHECKED_INIT = True
            return True
    except Exception as e:
        logger.warning(f"Could not auto-verify schema: {e}")
        return False

