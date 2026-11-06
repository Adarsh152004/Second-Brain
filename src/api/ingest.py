"""Ingestion endpoints for Files (PDF, DOC, DOCX, TXT, MD, CSV), URLs, and Notes."""
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from src.config.settings import settings
from src.ingestion.loaders import load_file_content, load_text, load_url
from src.utils.logging import get_logger
from src.utils.textsplit import split_text
from src.vectorstore import chroma_store
from src.observability.cache import clear_cache

router = APIRouter()
logger = get_logger(__name__)


async def _ingest(doc_id: str, title: str, raw_text: str, filename: str = "") -> dict:
    if not raw_text or not raw_text.strip():
        raise HTTPException(400, f"No text could be extracted from {title or filename or 'file'}.")
    chunks = split_text(raw_text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        # Single chunk fallback
        chunks = [raw_text[:2000]]
    chroma_store.upsert_chunks(doc_id, chunks, {"title": title, "doc_id": doc_id, "filename": filename or title})
    # Invalidate response cache so subsequent queries reflect new document contents
    clear_cache()
    return {
        "status": "success",
        "doc_id": doc_id,
        "title": title,
        "filename": filename or title,
        "chunks": len(chunks),
        "total_chars": len(raw_text),
    }


@router.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    if file.size and file.size > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File too large. Maximum size is {settings.max_upload_mb}MB.")
    data = await file.read()
    fname = file.filename or "uploaded_document"
    try:
        doc_id, title, text = load_file_content(data, fname)
        return await _ingest(doc_id, title, text, filename=fname)
    except Exception as e:
        logger.error(f"Failed to ingest file {fname}: {e}")
        raise HTTPException(500, f"Failed to parse and ingest file: {str(e)}")


@router.post("/ingest/url")
async def ingest_url(url: str = Form(...)):
    try:
        doc_id, title, text = load_url(url)
        return await _ingest(doc_id, title, text, filename=url)
    except Exception as e:
        logger.error(f"Failed to ingest url {url}: {e}")
        raise HTTPException(500, f"Failed to ingest URL: {str(e)}")


@router.post("/ingest/text")
async def ingest_text(title: str = Form(...), text: str = Form(...)):
    doc_id, raw = load_text(text, title)
    return await _ingest(doc_id, title, raw, filename=title)


@router.get("/ingest/documents")
@router.get("/documents")
async def list_documents():
    return {"documents": chroma_store.list_documents()}


@router.get("/ingest/documents/{doc_id}/chunks")
@router.get("/documents/{doc_id}/chunks")
async def get_document_chunks(doc_id: str):
    """Inspect all text chunks of an indexed document."""
    chunks = chroma_store.get_document_chunks(doc_id)
    return {"doc_id": doc_id, "chunks": chunks, "count": len(chunks)}


@router.delete("/ingest/document/{doc_id}")
@router.delete("/ingest/documents/{doc_id}")
@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    chroma_store.delete_document(doc_id)
    # Invalidate response cache so deleted documents are not served from stale cache
    clear_cache()
    return {"status": "deleted", "doc_id": doc_id}
