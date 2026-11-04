from src.utils.textsplit import split_text


def test_short_text_returns_single_chunk():
    text = "This is a short paragraph."
    chunks = split_text(text, chunk_size=800, overlap=150)
    assert chunks == [text]


def test_empty_text_returns_no_chunks():
    assert split_text("", chunk_size=800, overlap=150) == []
    assert split_text("   ", chunk_size=800, overlap=150) == []


def test_long_text_splits_into_multiple_chunks():
    paragraph = "Sentence number %d provides some filler content. " 
    text = "\n\n".join(paragraph % i * 3 for i in range(20))
    chunks = split_text(text, chunk_size=200, overlap=20)
    assert len(chunks) > 1
    for chunk in chunks:
        # Overlap can push slightly over; chunks shouldn't be wildly oversized.
        assert len(chunk) <= 260


def test_overlap_shares_content_between_consecutive_chunks():
    paragraph = "Paragraph %d has unique filler words to check overlap behavior properly here.\n\n"
    text = "".join(paragraph % i for i in range(10))
    chunks = split_text(text, chunk_size=150, overlap=40)
    assert len(chunks) > 1
    # The tail of one chunk should reappear at the head of the next.
    tail = chunks[0][-40:]
    assert tail[:15] in chunks[1]
