"""ChromaDB vector store using Cohere embeddings."""
import uuid
import chromadb
from chromadb.config import Settings as ChromaSettings
from src.config.settings import settings
from src.embeddings.cohere_embeddings import embed_texts, embed_query
from src.utils.logging import get_logger

logger = get_logger(__name__)
_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name="second_brain",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def upsert_chunks(doc_id: str, chunks: list[str], metadata: dict):
    col = _get_collection()
    if not chunks:
        return
    embeddings = embed_texts(chunks, input_type="search_document")
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metas = [{**metadata, "chunk_index": i, "doc_id": doc_id} for i in range(len(chunks))]
    col.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metas)
    logger.info("Upserted chunks for doc_id=" + str(doc_id))


class SimpleBM25:
    """Pure-python BM25 ranking for hybrid retrieval."""
    def __init__(self, corpus: list[str], k1: float = 1.5, b: float = 0.75):
        import math, re
        from collections import Counter
        self.k1 = k1
        self.b = b
        self.corpus = corpus
        self.docs_tokens = [re.findall(r'\b\w+\b', d.lower()) for d in corpus]
        self.doc_lens = [len(d) for d in self.docs_tokens]
        self.avg_doc_len = sum(self.doc_lens) / max(len(self.doc_lens), 1)
        self.doc_count = len(corpus)
        self.df = Counter()
        for doc in self.docs_tokens:
            self.df.update(set(doc))
        self.idf = {}
        for term, freq in self.df.items():
            self.idf[term] = math.log(1 + (self.doc_count - freq + 0.5) / (freq + 0.5))

    def get_scores(self, query: str) -> list[float]:
        import re
        from collections import Counter
        q_tokens = re.findall(r'\b\w+\b', query.lower())
        scores = [0.0] * self.doc_count
        for i, doc in enumerate(self.docs_tokens):
            if not doc:
                continue
            doc_len = self.doc_lens[i]
            doc_tf = Counter(doc)
            score = 0.0
            for token in q_tokens:
                if token in doc_tf:
                    tf = doc_tf[token]
                    idf = self.idf.get(token, 0.0)
                    denom = tf + self.k1 * (1 - self.b + self.b * (doc_len / max(self.avg_doc_len, 1)))
                    score += idf * (tf * (self.k1 + 1)) / max(denom, 1e-6)
            scores[i] = score
        return scores


def search(query: str, top_k: int = None, hybrid: bool = True) -> list[dict]:
    top_k = top_k or settings.retrieval_top_k
    col = _get_collection()
    if col.count() == 0:
        return []
    
    # 1. Dense Vector Query
    q_emb = embed_query(query)
    dense_k = min(top_k * 2, col.count())
    results = col.query(query_embeddings=[q_emb], n_results=dense_k)
    
    dense_candidates = []
    if results and results.get("documents") and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i] if results.get("metadatas") else {}
            dist = results["distances"][0][i] if results.get("distances") else 0
            cid = results["ids"][0][i] if results.get("ids") else str(i)
            title = meta.get("title") or meta.get("filename") or "Document"
            dense_candidates.append({
                "id": cid,
                "text": doc,
                "content": doc,
                "title": title,
                "metadata": meta,
                "doc_id": meta.get("doc_id", ""),
                "dense_score": round(1 - dist, 4),
            })

    if not hybrid or len(dense_candidates) <= 1:
        out = []
        for c in dense_candidates[:top_k]:
            c["score"] = c.get("dense_score", 0.5)
            c["retrieval_mode"] = "dense"
            out.append(c)
        return out

    # 2. Sparse BM25 Re-Ranking via Reciprocal Rank Fusion (RRF)
    corpus = [c["text"] for c in dense_candidates]
    bm25 = SimpleBM25(corpus)
    bm25_scores = bm25.get_scores(query)

    # Sort indices by BM25 score
    bm25_ranked_indices = sorted(range(len(corpus)), key=lambda i: bm25_scores[i], reverse=True)
    bm25_ranks = {idx: rank for rank, idx in enumerate(bm25_ranked_indices)}

    fused = []
    for dense_rank, c in enumerate(dense_candidates):
        sparse_rank = bm25_ranks.get(dense_rank, dense_rank)
        # Reciprocal Rank Fusion formula
        rrf = (0.6 / (60 + dense_rank)) + (0.4 / (60 + sparse_rank))
        combined_score = round(min(1.0, (c["dense_score"] * 0.7) + (rrf * 15)), 4)
        c["score"] = combined_score
        c["retrieval_mode"] = "hybrid"
        fused.append(c)

    fused.sort(key=lambda x: x["score"], reverse=True)
    return fused[:top_k]


def get_document_chunks(doc_id: str) -> list[dict]:
    """Retrieve all individual chunks for a specific document to inspect."""
    col = _get_collection()
    results = col.get(where={"doc_id": doc_id}, include=["documents", "metadatas"])
    if not results or not results.get("ids"):
        results = col.get(where={"title": doc_id}, include=["documents", "metadatas"])
    if not results or not results.get("ids"):
        results = col.get(where={"filename": doc_id}, include=["documents", "metadatas"])

    chunks = []
    if results and results.get("ids"):
        for i, cid in enumerate(results["ids"]):
            doc_text = results["documents"][i] if results.get("documents") else ""
            meta = results["metadatas"][i] if results.get("metadatas") else {}
            chunks.append({
                "chunk_id": cid,
                "chunk_index": meta.get("chunk_index", i),
                "text": doc_text,
                "char_count": len(doc_text),
                "title": meta.get("title") or meta.get("filename") or "Document",
                "doc_id": meta.get("doc_id", doc_id),
            })
    chunks.sort(key=lambda x: x["chunk_index"])
    return chunks


def list_documents() -> list[dict]:
    col = _get_collection()
    if col.count() == 0:
        return []
    all_items = col.get(include=["metadatas"])
    seen = {}
    if all_items and all_items.get("metadatas"):
        for meta in all_items["metadatas"]:
            did = meta.get("doc_id", "")
            title = meta.get("title") or meta.get("filename") or "Document"
            fname = meta.get("filename") or title
            ext = fname.rsplit(".", 1)[-1].upper() if "." in fname else "DOC"
            if did and did not in seen:
                seen[did] = {
                    "id": did,
                    "doc_id": did,
                    "title": title,
                    "filename": fname,
                    "chunk_count": 0,
                    "chunks": 0,
                    "chunks_count": 0,
                    "file_type": ext,
                    "type": ext
                }
            if did in seen:
                seen[did]["chunk_count"] += 1
                seen[did]["chunks"] += 1
                seen[did]["chunks_count"] += 1
    return list(seen.values())


list_docs = list_documents


def delete_document(doc_id: str):
    col = _get_collection()
    results = col.get(where={"doc_id": doc_id})
    if not results or not results.get("ids"):
        results = col.get(where={"title": doc_id})
    if not results or not results.get("ids"):
        results = col.get(where={"filename": doc_id})
    if results and results.get("ids"):
        col.delete(ids=results["ids"])
        logger.info(f"Deleted doc_id={doc_id} ({len(results['ids'])} chunks)")
