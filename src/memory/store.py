"""Dual Storage Memory Engine: Supabase PostgreSQL when configured, with seamless SQLite fallback."""
import sqlite3
import time
import uuid
import json
from typing import List, Dict, Any, Optional
from src.config.settings import settings
from src.utils.logging import get_logger
from src.db.connection import is_postgres_configured, ensure_postgres_schema
import src.db.memory_pg as pg_store

logger = get_logger(__name__)


def _conn():
    conn = sqlite3.connect(settings.memory_db_path)
    # Ensure turns table
    cursor = conn.execute("PRAGMA table_info(turns)")
    cols = [r[1] for r in cursor.fetchall()]
    if not cols:
        conn.execute("""
            CREATE TABLE turns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                ts REAL DEFAULT (strftime('%s', 'now')),
                decision_json TEXT DEFAULT '',
                sources_json TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    else:
        if "ts" not in cols:
            try:
                conn.execute("ALTER TABLE turns ADD COLUMN ts REAL DEFAULT (strftime('%s', 'now'))")
                conn.commit()
            except Exception:
                pass
        if "decision_json" not in cols:
            try:
                conn.execute("ALTER TABLE turns ADD COLUMN decision_json TEXT DEFAULT ''")
                conn.commit()
            except Exception:
                pass
        if "sources_json" not in cols:
            try:
                conn.execute("ALTER TABLE turns ADD COLUMN sources_json TEXT DEFAULT ''")
                conn.commit()
            except Exception:
                pass
        if "created_at" not in cols:
            try:
                conn.execute("ALTER TABLE turns ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
                conn.commit()
            except Exception:
                pass

    # Ensure sessions table
    cursor_sess = conn.execute("PRAGMA table_info(sessions)")
    sess_cols = [r[1] for r in cursor_sess.fetchall()]
    if not sess_cols:
        conn.execute("""
            CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

    # Ensure performance indexes (Supabase/Postgres query optimization best practice)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_turns_session_id ON turns(session_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_turns_session_recent ON turns(session_id, id DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_turns_first_user_msg ON turns(session_id, role, id ASC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC)")
    conn.commit()

    return conn


def _clean_title(text: str) -> str:
    """Generate a clean 4-8 word title from a prompt."""
    if not text:
        return "New Chat"
    cleaned = text.strip().replace("\n", " ")
    words = cleaned.split()
    if len(words) <= 7:
        title = " ".join(words)
    else:
        title = " ".join(words[:7]) + "..."
    if title:
        title = title[0].upper() + title[1:]
    return title[:60]


def create_session(session_id: Optional[str] = None, title: str = "New Chat") -> dict:
    if is_postgres_configured():
        try:
            ensure_postgres_schema()
            return pg_store.create_session(session_id, title)
        except Exception as e:
            logger.warning(f"Postgres create_session failed, falling back to SQLite: {e}")

    sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
    with _conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, title, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            (sid, title)
        )
    return {"id": sid, "title": title}


def list_sessions() -> List[Dict[str, Any]]:
    if is_postgres_configured():
        try:
            ensure_postgres_schema()
            return pg_store.list_sessions()
        except Exception as e:
            logger.warning(f"Postgres list_sessions failed, falling back to SQLite: {e}")

    with _conn() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO sessions (id, title, updated_at)
            SELECT DISTINCT session_id, 'Chat Session', CURRENT_TIMESTAMP FROM turns WHERE session_id IS NOT NULL AND session_id != ''
        """)
        conn.commit()

        query = """
            SELECT s.id, s.title, s.created_at, s.updated_at,
                   COUNT(t.id) as message_count,
                   (SELECT content FROM turns WHERE session_id = s.id AND role = 'user' ORDER BY id ASC LIMIT 1) as first_user_msg
            FROM sessions s
            LEFT JOIN turns t ON s.id = t.session_id
            GROUP BY s.id
            ORDER BY s.updated_at DESC
        """
        rows = conn.execute(query).fetchall()

        results = []
        for r in rows:
            sid, title, created_at, updated_at, count, first_msg = r
            display_title = title
            if (not title or title in ("New Chat", "Chat Session", "default_session")) and first_msg:
                display_title = _clean_title(first_msg)
                try:
                    conn.execute("UPDATE sessions SET title=? WHERE id=?", (display_title, sid))
                except Exception:
                    pass

            results.append({
                "id": sid,
                "title": display_title or "New Chat",
                "created_at": created_at,
                "updated_at": updated_at,
                "message_count": count or 0,
            })
        conn.commit()
    return results


def get_session(session_id: str) -> dict:
    if is_postgres_configured():
        try:
            ensure_postgres_schema()
            return pg_store.get_session(session_id)
        except Exception as e:
            logger.warning(f"Postgres get_session failed, falling back to SQLite: {e}")

    with _conn() as conn:
        row = conn.execute("SELECT id, title, created_at, updated_at FROM sessions WHERE id=?", (session_id,)).fetchone()
        if not row:
            turns_exist = conn.execute("SELECT 1 FROM turns WHERE session_id=? LIMIT 1", (session_id,)).fetchone()
            if turns_exist:
                create_session(session_id, "New Chat")
                row = conn.execute("SELECT id, title, created_at, updated_at FROM sessions WHERE id=?", (session_id,)).fetchone()

        turns = get_recent(session_id, limit=200)
        title = row[1] if row else "New Chat"
        return {
            "id": session_id,
            "title": title,
            "turns": turns,
            "created_at": row[2] if row else None,
            "updated_at": row[3] if row else None
        }


def update_session_title(session_id: str, title: str) -> bool:
    if is_postgres_configured():
        try:
            return pg_store.update_session_title(session_id, title)
        except Exception as e:
            logger.warning(f"Postgres update_session_title failed, falling back to SQLite: {e}")

    with _conn() as conn:
        cur = conn.execute("UPDATE sessions SET title=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (title.strip()[:80], session_id))
        return cur.rowcount > 0


def delete_session(session_id: str) -> bool:
    if is_postgres_configured():
        try:
            return pg_store.delete_session(session_id)
        except Exception as e:
            logger.warning(f"Postgres delete_session failed, falling back to SQLite: {e}")

    with _conn() as conn:
        conn.execute("DELETE FROM turns WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    return True


def save_turn(session_id: str, role: str, content: str, decision: Any = None, sources: Any = None):
    if is_postgres_configured():
        try:
            ensure_postgres_schema()
            pg_store.save_turn(session_id, role, content, decision, sources)
            return
        except Exception as e:
            logger.warning(f"Postgres save_turn failed, falling back to SQLite: {e}")

    with _conn() as conn:
        # Check if session exists
        row = conn.execute("SELECT title FROM sessions WHERE id=?", (session_id,)).fetchone()
        if not row:
            init_title = _clean_title(content) if role == "user" else "New Chat"
            conn.execute(
                "INSERT INTO sessions (id, title, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (session_id, init_title)
            )
        elif row[0] in ("New Chat", "Chat Session", "default_session") and role == "user":
            new_title = _clean_title(content)
            conn.execute(
                "UPDATE sessions SET title=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (new_title, session_id)
            )
        else:
            conn.execute("UPDATE sessions SET updated_at=CURRENT_TIMESTAMP WHERE id=?", (session_id,))

        try:
            decision_str = json.dumps(decision, default=str) if decision else ""
        except Exception:
            decision_str = str(decision) if decision else ""

        try:
            sources_str = json.dumps(sources, default=str) if sources else ""
        except Exception:
            sources_str = str(sources) if sources else ""

        try:
            conn.execute(
                "INSERT INTO turns (session_id, role, content, ts, decision_json, sources_json) VALUES (?, ?, ?, ?, ?, ?)",
                (session_id, role, content, time.time(), decision_str, sources_str)
            )
        except Exception:
            try:
                conn.execute(
                    "INSERT INTO turns (session_id, role, content, ts) VALUES (?, ?, ?, ?)",
                    (session_id, role, content, time.time())
                )
            except Exception:
                conn.execute(
                    "INSERT INTO turns (session_id, role, content) VALUES (?, ?, ?)",
                    (session_id, role, content)
                )


def add(session_id: str, role: str, content: str, decision: Any = None, sources: Any = None):
    save_turn(session_id, role, content, decision, sources)


def get_recent(session_id: str, limit: int = None) -> List[Dict[str, Any]]:
    if is_postgres_configured():
        try:
            return pg_store.get_recent(session_id, limit or settings.memory_max_turns)
        except Exception as e:
            logger.warning(f"Postgres get_recent failed, falling back to SQLite: {e}")

    max_turns = limit or settings.memory_max_turns
    with _conn() as conn:
        try:
            rows = conn.execute(
                "SELECT id, role, content, ts, decision_json, sources_json FROM turns WHERE session_id=? ORDER BY id DESC LIMIT ?",
                (session_id, max_turns)
            ).fetchall()
        except Exception:
            rows = conn.execute(
                "SELECT id, role, content, ts FROM turns WHERE session_id=? ORDER BY id DESC LIMIT ?",
                (session_id, max_turns)
            ).fetchall()
            rows = [(r[0], r[1], r[2], r[3], "", "") for r in rows]

    results = []
    for r in reversed(rows):
        dec = None
        src = None
        if len(r) > 4 and r[4]:
            try:
                dec = json.loads(r[4])
            except Exception:
                dec = None
        if len(r) > 5 and r[5]:
            try:
                src = json.loads(r[5])
            except Exception:
                src = None

        results.append({
            "id": f"msg-{r[0]}",
            "role": r[1],
            "content": r[2],
            "timestamp": r[3],
            "decision": dec,
            "sources": src
        })
    return results


def clear(session_id: str):
    if is_postgres_configured():
        try:
            pg_store.clear(session_id)
            return
        except Exception as e:
            logger.warning(f"Postgres clear failed, falling back to SQLite: {e}")

    with _conn() as conn:
        conn.execute("DELETE FROM turns WHERE session_id=?", (session_id,))
        conn.execute("UPDATE sessions SET updated_at=CURRENT_TIMESTAMP WHERE id=?", (session_id,))
