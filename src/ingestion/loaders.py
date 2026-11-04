"""Document loaders - PDF, DOCX, DOC, plain text, URL via trafilatura."""
import uuid
import os
import io
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Tuple
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


def _extract_pdf_with_multimodal_vision(file_bytes: bytes, filename: str) -> str:
    """
    Automatic OCR extraction using Gemini Multimodal Vision API when a PDF lacks a digital text layer
    (scanned pages, photocopied question papers, images, handwriting).
    """
    import base64
    import json
    import urllib.request
    from src.config.settings import settings

    api_key = getattr(settings, "gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning(f"No Gemini API key available to perform OCR on {filename}.")
        return ""

    logger.info(f"Attempting Multimodal Vision OCR extraction on {filename} ({len(file_bytes)} bytes)...")
    b64_data = base64.b64encode(file_bytes).decode("utf-8")

    prompt = (
        "You are an expert OCR, document transcription, and academic question analysis engine. "
        "Transcribe and extract ALL text, questions, options, code, headings, and viva questions from this document verbatim with complete fidelity. "
        "Do not summarize or skip anything; transcribe the exact content so it can be indexed for retrieval."
    )

    payload = {
        "contents": [{
            "parts": [
                {
                    "inline_data": {
                        "mime_type": "application/pdf",
                        "data": b64_data
                    }
                },
                {"text": prompt}
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192
        }
    }

    data_bytes = json.dumps(payload).encode("utf-8")
    candidate_models = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.0-flash"]

    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=data_bytes, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    extracted = "".join(p.get("text", "") for p in parts).strip()
                    if extracted:
                        logger.info(f"Successfully extracted {len(extracted)} chars from {filename} via {model_name} OCR")
                        return extracted
        except Exception as e:
            logger.warning(f"Vision OCR model {model_name} failed: {e}")
            continue

    return ""


def load_pdf(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """Extract text from PDF. Returns (doc_id, text)."""
    doc_id = str(uuid.uuid4())
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for i, page in enumerate(reader.pages):
            page_content = page.extract_text() or ""
            if not page_content.strip():
                try:
                    page_content = page.extract_text(extraction_mode="layout") or ""
                except Exception:
                    pass
            if page_content.strip():
                pages_text.append(f"[Page {i+1}]\n{page_content.strip()}")
        text = "\n\n".join(pages_text)

        num_pages = len(reader.pages)
        # If pypdf extracted empty, near-empty text, or very low character density (< 50 chars/page), run automatic Vision OCR
        if len(text.strip()) < max(40, num_pages * 50):
            logger.info(f"PDF {filename} has low extracted text ({len(text.strip())} chars across {num_pages} pages). Triggering Automatic Vision OCR...")
            ocr_text = _extract_pdf_with_multimodal_vision(file_bytes, filename)
            if ocr_text and len(ocr_text.strip()) > len(text.strip()):
                text = ocr_text
            elif not text.strip():
                raise ValueError(
                    f"The document '{filename}' is a scanned or image-based PDF and could not be automatically transcribed. "
                    "Please ensure the document contains clear readable text or paste the text directly."
                )

        return doc_id, text
    except Exception as e:
        logger.exception(f"PDF load failed for {filename}: {e}")
        raise


def load_docx(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """Extract text from DOCX using standard library. Returns (doc_id, text)."""
    doc_id = str(uuid.uuid4())
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            paragraphs = []
            for node in tree.iter():
                if node.tag.endswith("}p"):
                    p_text = "".join(t.text for t in node.iter() if t.tag.endswith("}t") and t.text)
                    if p_text.strip():
                        paragraphs.append(p_text.strip())
            text = "\n\n".join(paragraphs)
            if not text.strip():
                text = "\n".join(t.text for t in tree.iter() if t.tag.endswith("}t") and t.text)
            return doc_id, text
    except Exception as e:
        logger.exception(f"DOCX load failed: {e}")
        text = file_bytes.decode("utf-8", errors="ignore")
        return doc_id, text


def load_text(text: str, title: str) -> Tuple[str, str]:
    """Load plain text. Returns (doc_id, text)."""
    doc_id = str(uuid.uuid4())
    return doc_id, text


def load_image(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """Extract text from uploaded images (PNG, JPG, JPEG, WEBP) using Vision OCR."""
    import base64
    import json
    import urllib.request
    from src.config.settings import settings

    doc_id = str(uuid.uuid4())
    api_key = getattr(settings, "gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured for image OCR.")

    ext = filename.rsplit(".", 1)[-1].lower()
    mime = "image/png" if ext == "png" else ("image/webp" if ext == "webp" else "image/jpeg")
    b64_data = base64.b64encode(file_bytes).decode("utf-8")

    prompt = (
        "Extract all text, questions, code, and content from this image verbatim. "
        "Do not summarize; output the exact content clearly so it can be indexed for retrieval."
    )
    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": mime, "data": b64_data}},
                {"text": prompt}
            ]
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192}
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={api_key}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        candidates = res_data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            extracted = "".join(p.get("text", "") for p in parts).strip()
            if extracted:
                return doc_id, extracted
    raise ValueError(f"No text could be extracted from image: {filename}")


def load_file_content(file_bytes: bytes, filename: str) -> Tuple[str, str, str]:
    """Extract text from any uploaded file. Returns (doc_id, title, text)."""
    fname_lower = filename.lower()
    doc_id = str(uuid.uuid4())
    title = filename

    if fname_lower.endswith(".pdf"):
        _, text = load_pdf(file_bytes, filename)
        title = filename[:-4]
    elif fname_lower.endswith(".docx"):
        _, text = load_docx(file_bytes, filename)
        title = filename[:-5]
    elif fname_lower.endswith(".doc"):
        # Legacy Word binary text extraction fallback
        raw = file_bytes.decode("latin-1", errors="ignore")
        text = "".join(c for c in raw if c.isprintable() or c in "\n\r\t")
        title = filename[:-4]
    elif any(fname_lower.endswith(img_ext) for img_ext in [".png", ".jpg", ".jpeg", ".webp"]):
        _, text = load_image(file_bytes, filename)
        title = filename.rsplit(".", 1)[0]
    else:
        text = file_bytes.decode("utf-8", errors="ignore")
        title = filename

    return doc_id, title, text


def load_url(url: str) -> Tuple[str, str, str]:
    """Fetch and extract text from URL. Returns (doc_id, title, text)."""
    try:
        import trafilatura
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            raise ValueError(f"Could not download: {url}")
        text = trafilatura.extract(downloaded)
        if not text:
            raise ValueError(f"Could not extract text from: {url}")
        metadata = trafilatura.extract_metadata(downloaded)
        title = metadata.title if metadata and metadata.title else url
        doc_id = str(uuid.uuid4())
        return doc_id, title, text
    except Exception as e:
        logger.exception(f"URL load failed: {e}")
        raise
