"""Tests for dynamic cache bypass and RAG/Web cache invalidation."""
import pytest
from src.agent.langgraph_agent import _detect_web_intent, _detect_rag_intent
from src.observability.cache import (
    clear_cache,
    set_cached_response,
    get_cached_response,
    _EXACT_CACHE,
    _SEMANTIC_CACHE,
)


def test_detect_web_intent():
    assert _detect_web_intent("what is the weather today?") is True
    assert _detect_web_intent("latest stock price of AAPL") is True
    assert _detect_web_intent("tell me a joke") is False


def test_detect_rag_intent():
    assert _detect_rag_intent("summarize the document") is True
    assert _detect_rag_intent("what did i write in my notes?") is True
    assert _detect_rag_intent("what is 2 + 2?") is False


def test_cache_cleared_on_invalidation():
    clear_cache()
    set_cached_response("What is Python?", {"answer": "A programming language"}, "model_x")
    assert len(_EXACT_CACHE) > 0

    clear_cache()
    assert len(_EXACT_CACHE) == 0
    assert len(_SEMANTIC_CACHE) == 0

