"""Ollama embeddings - calls local nomic-embed-text model."""
from typing import List
import httpx
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)


async def embed_one(text: str) -> List[float]:
    """Embed a single text string."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ollama_host}/api/embed",
                json={"model": settings.embedding_model, "input": text},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            embeddings = data.get("embeddings", [])
            if embeddings:
                return embeddings[0]
    except Exception as e:
        logger.warning(f"Ollama embedding failed: {e}. Using zero vector.")
    return [0.0] * settings.embedding_dim


async def embed_many(texts: List[str]) -> List[List[float]]:
    """Embed multiple texts."""
    results = []
    for text in texts:
        results.append(await embed_one(text))
    return results
