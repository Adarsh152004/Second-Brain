# IMPLEMENTATION.md — Step-by-step build roadmap

### 1. Install prerequisites
Python, Ollama. **Verify**: `ollama list` runs without error.

### 2. Create project
Scaffold `src/{api,ingestion,embeddings,vectorstore,agent,memory,config,utils,web}`.
**Verify**: `tree -L 2 src`.

### 3. Set up environment variables
`.env.example` → `.env`; `src/config/settings.py` loads and validates it.
**Verify**: `python -c "from src.config.settings import settings; print(settings.ollama_model)"`.

### 4. Build the text splitter
`src/utils/textsplit.py`. **Verify**: unit test on a known paragraph confirms chunk count and overlap.

### 5. Build document loaders
`src/ingestion/loaders.py` — txt, markdown, pdf (`pypdf`), url (`httpx` + `trafilatura`).
**Common error**: PDFs with no text layer (scanned images) return empty
strings — `pypdf` alone can't OCR; flagged in `TROUBLESHOOTING.md`.
**Verify**: load a sample PDF and print the first 200 characters.

### 6. Build the embeddings client
`src/embeddings/ollama_embeddings.py`, calling `/api/embed`.
**Verify**: `embed(["hello world"])` returns a 768-dimension vector.

### 7. Build the vector store wrapper
`src/vectorstore/chroma_store.py` on top of `chromadb.PersistentClient`.
**Verify**: add a chunk, query with a similar sentence, confirm it's the top result.

### 8. Wire up ingestion end-to-end
`POST /ingest/file`, `/ingest/url`, `/ingest/text` in `src/api/ingest.py`.
**Verify**: ingest a short markdown file, confirm chunk count in the response
and confirm `GET /documents` lists it.

### 9. Build the LLM backend(s)
`src/agent/llm_backends.py` — Ollama default, Groq optional.
**Verify**: `curl http://localhost:11434/api/tags` shows your pulled model.

### 10. Build the RAG agent
`src/agent/rag.py`: retrieve top-k chunks, build the context-only prompt,
call the LLM, format `{answer, sources}`.
**Common error**: forgetting to instruct the model to say "I don't know"
when context is irrelevant — without this, it answers from general
knowledge and citations become misleading.

### 11. Add session memory
`src/memory/store.py`, same SQLite pattern as any chat app.
**Verify**: ask a follow-up question that only makes sense with prior context.

### 12. Wire up the chat endpoint
`POST /chat` in `src/api/chat.py`, tying together memory + retrieval + agent.
**Verify**: end-to-end question against an ingested document returns a
grounded answer with sources.

### 13. Build the web UI
`src/web/index.html` — chat + upload panels, vanilla JS.
**Verify**: open `http://localhost:8000`, upload a file, ask a question, see citations render.

### 14. Add document management
`GET /documents`, `DELETE /documents/{id}` — list and remove ingested docs
(and their vectors).
**Verify**: delete a document, confirm a question about it now gets "I
don't have information about that."

### 15. Add logging
Structured logs for ingestion and chat requests (no full document content
logged by default).

### 16. Add basic input validation
File size limits, accepted extensions, URL scheme checks (reject anything
but `http(s)://`) — see `SECURITY.md`.

### 17. Test locally
`pytest tests/ -v` — text splitter, vector store round-trip, prompt
construction all covered without needing a real Ollama instance running
(mocked in tests).

### 18. Deploy (optional)
If you want it reachable outside your machine: Docker Compose (provided),
plus a tunnel or a host — see `COSTS.md` for trade-offs, and add
authentication first (see `SECURITY.md`) since this MVP has none.

### 19. Real-world testing
Ingest a real mix of your own notes/PDFs, ask questions you know the
answers to, and check whether the citations actually point at the right
place — this is the real test of a RAG system, not just "did it respond."
