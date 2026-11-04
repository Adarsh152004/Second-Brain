from src.agent.rag import _build_context_block


def test_empty_context_when_nothing_retrieved():
    block = _build_context_block([])
    assert "no documents" in block.lower()


def test_context_block_includes_markers_and_titles():
    retrieved = [
        {"text": "Paris is the capital of France.", "title": "geo-notes.txt",
         "doc_id": "abc", "chunk_index": 0, "distance": 0.1},
        {"text": "The Eiffel Tower was completed in 1889.", "title": "geo-notes.txt",
         "doc_id": "abc", "chunk_index": 1, "distance": 0.2},
    ]
    block = _build_context_block(retrieved)
    assert "[1]" in block and "[2]" in block
    assert "Paris is the capital of France." in block
    assert "geo-notes.txt" in block
