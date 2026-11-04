# ROADMAP.md

## Near-term (still $0)
- [ ] OCR fallback for scanned PDFs (`pytesseract`, also free/local).
- [ ] Highlight the exact retrieved snippet within the source document view,
      not just show it in a citation card.
- [ ] Re-ranking retrieved chunks with a local cross-encoder before
      generation, for better precision on larger knowledge bases.
- [ ] Support `.docx` and `.epub` loaders.
- [ ] "Forget this" button per chat turn to correct/remove a bad memory
      without clearing the whole session.
- [ ] Export a session's chat + citations as a markdown file.

## Medium-term (may introduce small costs)
- [ ] Optional real web search tool (as opposed to "fetch this URL"),
      using a search API's free tier, clearly opt-in.
- [ ] Move to an async task queue for ingestion so large-document uploads
      don't block the request.
- [ ] Add lightweight auth (API key or Basic Auth) as a first-class option
      for anyone who wants to expose this beyond `localhost`.
- [ ] A "knowledge graph" view showing which documents/chunks are
      semantically related to each other.

## Longer-term
- [ ] Multi-user support with per-user knowledge bases, if you ever want to
      share this with others rather than keep it personal.
- [ ] Swap ChromaDB's local mode for a server-backed instance (or Qdrant)
      if the knowledge base grows past what local mode comfortably handles.
- [ ] Scheduled re-crawling of ingested URLs to keep web-sourced content
      current.
- [ ] Voice input/output (this pairs naturally with the WhatsApp voice
      agent project — same STT/TTS stack could feed this system's RAG
      pipeline instead of a plain LLM).

## Explicitly not planned
- Any always-on cloud hosting as the default — this stays a local-first,
  $0 tool unless you deliberately choose to deploy it elsewhere.
- Automated ingestion of arbitrary websites without the user providing the
  URL each time (that's a crawler, a different and much bigger project).
