"""Simple recursive text splitter."""
from typing import List


def split_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """Split text into overlapping chunks by sentence boundaries."""
    if not text or not text.strip():
        return []
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:])
            break
        # Try to break at sentence boundary
        boundary = text.rfind(". ", start, end)
        if boundary == -1 or boundary <= start:
            boundary = text.rfind(" ", start, end)
        if boundary == -1 or boundary <= start:
            boundary = end
        else:
            boundary += 1  # include the period
        chunks.append(text[start:boundary].strip())
        start = max(start + 1, boundary - overlap)
    return [c for c in chunks if c.strip()]
