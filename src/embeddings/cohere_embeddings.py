"""Cohere embedding client with fallback to zero vector."""
import cohere
from src.config.settings import settings
from src.utils.logging import get_logger

logger = get_logger(__name__)
_client = None


def _get_client():
    global _client
    if _client is None:
        _client = cohere.ClientV2(api_key=settings.cohere_api_key)
    return _client


def embed_texts(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    """Return list of embedding vectors. Falls back to zero vectors on error."""
    if not texts:
        return []
    if not settings.cohere_api_key:
        logger.warning("COHERE_API_KEY not set. Using zero vectors.")
        return [[0.0] * settings.embedding_dim for _ in texts]
    try:
        client = _get_client()
        response = client.embed(
            texts=texts,
            model=settings.cohere_embed_model,
            input_type=input_type,
            embedding_types=["float"],
        )
        return response.embeddings.float
    except Exception as e:
        logger.warning(f"Cohere embedding failed: {e}. Using zero vectors.")
        return [[0.0] * settings.embedding_dim for _ in texts]


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    results = embed_texts([query], input_type="search_query")
    return results[0] if results else [0.0] * settings.embedding_dim
