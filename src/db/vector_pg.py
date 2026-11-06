"""Production pgvector document chunk & semantic retrieval store for Supabase."""
import json
import uuid
from typing import List, Dict, Any, Optional
from src.db.connection import get_db_cursor
from src.utils.logging import get_logger

logger = get_logger(__name__)


def upsert_chunks(doc_id: str, chunks: List[Dict[str, Any]], title: str = "", metadata: Optional[Dict[str, Any]] = None):
    """Store document chunks with their vector embeddings into public.document_chunks."""
    meta_json = json.dumps(metadata or {})
    with get_db_cursor() as cur:
        # Delete existing chunks for this doc_id to avoid duplication
        cur.execute("DELETE FROM public.document_chunks WHERE doc_id = %s;", (doc_id,))

        for i, ch in enumerate(chunks):
            chunk_text = ch.get("text", "")
            embedding = ch.get("embedding", [])
            # Format embedding as Postgres vector string: '[0.1, 0.2, ...]'
            vec_str = f"[{','.join(str(float(x)) for x in embedding)}]" if embedding else None

            cur.execute("""
                INSERT INTO public.document_chunks (doc_id, chunk_index, title, content, metadata, embedding, created_at)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s::vector, now());
            """, (doc_id, i, title, chunk_text, meta_json, vec_str))
    logger.info(f"Upserted {len(chunks)} chunks into Supabase pgvector for doc_id={doc_id}.")


def search(query_vector: List[float], top_k: int = 5, match_threshold: float = 0.3) -> List[Dict[str, Any]]:
    """Perform cosine distance ANN search using HNSW index on pgvector."""
    if not query_vector:
        return []

    vec_str = f"[{','.join(str(float(x)) for x in query_vector)}]"
    query = """
        SELECT id::text, doc_id, chunk_index, title, content, metadata,
               1 - (embedding <=> %s::vector) as similarity
        FROM public.document_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector ASC
        LIMIT %s;
    """
    with get_db_cursor() as cur:
        cur.execute(query, (vec_str, vec_str, top_k))
        rows = cur.fetchall()

    results = []
    for r in rows:
        sim = float(r["similarity"] or 0)
        if sim < match_threshold:
            continue
        meta = r["metadata"]
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                meta = {}

        results.append({
            "id": f"{r['doc_id']}_{r['chunk_index']}",
            "doc_id": r["doc_id"],
            "title": r["title"] or r["doc_id"],
            "text": r["content"],
            "score": round(sim, 4),
            "metadata": meta
        })
    return results


def list_documents() -> List[Dict[str, Any]]:
    """List unique ingested documents with chunk counts."""
    query = """
        SELECT doc_id, title, COUNT(id) as chunk_count, MIN(created_at) as created_at
        FROM public.document_chunks
        GROUP BY doc_id, title
        ORDER BY created_at DESC;
    """
    with get_db_cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()

    docs = []
    for r in rows:
        docs.append({
            "id": r["doc_id"],
            "title": r["title"] or r["doc_id"],
            "chunk_count": int(r["chunk_count"]),
            "created_at": r["created_at"].isoformat() if r["created_at"] else ""
        })
    return docs


def get_document_chunks(doc_id: str) -> List[Dict[str, Any]]:
    """Fetch all chunks for a specific document (chunk inspector)."""
    query = """
        SELECT chunk_index, title, content, created_at
        FROM public.document_chunks
        WHERE doc_id = %s
        ORDER BY chunk_index ASC;
    """
    with get_db_cursor() as cur:
        cur.execute(query, (doc_id,))
        rows = cur.fetchall()

    chunks = []
    for r in rows:
        content = r["content"] or ""
        chunks.append({
            "chunk_id": f"{doc_id}_{r['chunk_index']}",
            "chunk_index": r["chunk_index"],
            "text": content,
            "char_count": len(content),
            "title": r["title"] or doc_id,
            "doc_id": doc_id
        })
    return chunks


def delete_document(doc_id: str) -> bool:
    """Delete all chunks for a document."""
    with get_db_cursor() as cur:
        cur.execute("DELETE FROM public.document_chunks WHERE doc_id = %s;", (doc_id,))
        return cur.rowcount > 0

