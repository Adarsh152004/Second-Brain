"""Production PostgreSQL conversation memory & session thread storage for Supabase."""
import json
import uuid
from typing import List, Dict, Any, Optional
from src.db.connection import get_db_cursor
from src.utils.logging import get_logger

logger = get_logger(__name__)


def _clean_title(text: str) -> str:
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
    sid = session_id or str(uuid.uuid4())
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO public.sessions (id, title, updated_at)
            VALUES (%s, %s, now())
            ON CONFLICT (id) DO NOTHING;
        """, (sid, title))
    return {"id": sid, "title": title}


def list_sessions() -> List[Dict[str, Any]]:
    query = """
        SELECT s.id::text, s.title, s.created_at, s.updated_at,
               COUNT(t.id) as message_count,
               (
                   SELECT content 
                   FROM public.turns 
                   WHERE session_id = s.id AND role = 'user' 
                   ORDER BY id ASC 
                   LIMIT 1
               ) as first_user_msg
        FROM public.sessions s
        LEFT JOIN public.turns t ON s.id = t.session_id
        GROUP BY s.id
        ORDER BY s.updated_at DESC;
    """
    with get_db_cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()

    results = []
    for r in rows:
        sid = r["id"]
        title = r["title"]
        first_msg = r["first_user_msg"]

        display_title = title
        if (not title or title in ("New Chat", "Chat Session", "default_session")) and first_msg:
            display_title = _clean_title(first_msg)
            try:
                with get_db_cursor() as u_cur:
                    u_cur.execute(
                        "UPDATE public.sessions SET title = %s WHERE id = %s",
                        (display_title, sid)
                    )
            except Exception:
                pass

        results.append({
            "id": sid,
            "title": display_title or "New Chat",
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
            "message_count": int(r["message_count"] or 0)
        })
    return results


def get_session(session_id: str) -> dict:
    with get_db_cursor() as cur:
        cur.execute("SELECT id::text, title, created_at, updated_at FROM public.sessions WHERE id = %s", (session_id,))
        row = cur.fetchone()
        if not row:
            create_session(session_id, "New Chat")
            cur.execute("SELECT id::text, title, created_at, updated_at FROM public.sessions WHERE id = %s", (session_id,))
            row = cur.fetchone()

    turns = get_recent(session_id, limit=200)
    title = row["title"] if row else "New Chat"
    return {
        "id": session_id,
        "title": title,
        "turns": turns,
        "created_at": row["created_at"].isoformat() if row and row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row and row["updated_at"] else None
    }


def update_session_title(session_id: str, title: str) -> bool:
    with get_db_cursor() as cur:
        cur.execute(
            "UPDATE public.sessions SET title = %s, updated_at = now() WHERE id = %s",
            (title.strip()[:80], session_id)
        )
        return cur.rowcount > 0


def delete_session(session_id: str) -> bool:
    with get_db_cursor() as cur:
        cur.execute("DELETE FROM public.turns WHERE session_id = %s", (session_id,))
        cur.execute("DELETE FROM public.sessions WHERE id = %s", (session_id,))
    return True


def save_turn(session_id: str, role: str, content: str, decision: Any = None, sources: Any = None):
    # Ensure session exists
    with get_db_cursor() as cur:
        cur.execute("SELECT title FROM public.sessions WHERE id = %s", (session_id,))
        row = cur.fetchone()
        if not row:
            init_title = _clean_title(content) if role == "user" else "New Chat"
            cur.execute("""
                INSERT INTO public.sessions (id, title, updated_at)
                VALUES (%s, %s, now())
                ON CONFLICT (id) DO UPDATE SET updated_at = now();
            """, (session_id, init_title))
        elif row["title"] in ("New Chat", "Chat Session", "default_session") and role == "user":
            new_title = _clean_title(content)
            cur.execute("UPDATE public.sessions SET title = %s, updated_at = now() WHERE id = %s", (new_title, session_id))
        else:
            cur.execute("UPDATE public.sessions SET updated_at = now() WHERE id = %s", (session_id,))

        dec_json = json.dumps(decision) if decision else "{}"
        src_json = json.dumps(sources) if sources else "[]"

        cur.execute("""
            INSERT INTO public.turns (session_id, role, content, decision, sources, created_at)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, now());
        """, (session_id, role, content, dec_json, src_json))


def get_recent(session_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    query = """
        SELECT id, role, content, decision, sources, created_at
        FROM public.turns
        WHERE session_id = %s
        ORDER BY id DESC
        LIMIT %s;
    """
    with get_db_cursor() as cur:
        cur.execute(query, (session_id, limit))
        rows = cur.fetchall()

    results = []
    for r in reversed(rows):
        dec = r["decision"]
        if isinstance(dec, str):
            try:
                dec = json.loads(dec)
            except Exception:
                pass

        src = r["sources"]
        if isinstance(src, str):
            try:
                src = json.loads(src)
            except Exception:
                pass

        ts = r["created_at"].timestamp() if r["created_at"] else 0
        results.append({
            "id": f"msg-{r['id']}",
            "role": r["role"],
            "content": r["content"],
            "timestamp": ts,
            "decision": dec,
            "sources": src
        })
    return results


def clear(session_id: str):
    with get_db_cursor() as cur:
        cur.execute("DELETE FROM public.turns WHERE session_id = %s", (session_id,))
        cur.execute("UPDATE public.sessions SET updated_at = now() WHERE id = %s", (session_id,))

