# DEVELOPMENT.md

## Local dev workflow

```bash
source .venv/bin/activate
ollama serve                                   # if not already running as a service
uvicorn src.api.main:app --reload --port 8000
```

The `--reload` flag restarts on file changes. The web UI is served as
static files, so a browser refresh picks up `src/web` changes immediately
with no restart needed.

## Conventions

- All configuration goes through `src/config/settings.py`.
- `src/vectorstore`, `src/embeddings`, and `src/agent/llm_backends.py` each
  expose a small interface so you can swap the underlying provider without
  touching callers.
- Log with `src/utils/logging.py`'s shared logger, never `print`.

## Running tests

```bash
pytest tests/ -v
```

Tests mock Ollama and ChromaDB where practical so the suite runs without
needing the models pulled or a server running.

## Adding a new document loader

1. Write a function in `src/ingestion/loaders.py`: `load_x(data) -> tuple[str, str]`
   returning `(title, plain_text)`.
2. Register the file extension in the dispatch table at the top of
   `src/api/ingest.py`.
3. No other changes needed — chunking, embedding, and storage are format-agnostic.

## Adding a new LLM or embedding backend

Same pattern as loaders: implement the existing interface
(`LLMBackend.chat(...)` or `embed(texts) -> vectors`), then add it to the
relevant `get_backend()`/config dispatch. Keep return shapes identical to
existing backends so nothing downstream needs to change.

## Tuning retrieval quality

- `CHUNK_SIZE` / `CHUNK_OVERLAP` in `.env` control how documents are split
  — smaller chunks give more precise citations but can lose context;
  larger chunks give more context but coarser citations.
- `RETRIEVAL_TOP_K` controls how many chunks are retrieved per question —
  more isn't always better, since irrelevant chunks can dilute the
  context and pull the model off track.
- If answers feel shallow, try increasing `RETRIEVAL_TOP_K` first before
  reaching for a bigger model.

## Style

- Type hints throughout.
- Keep functions under ~40 lines; this codebase is meant to be read
  end-to-end by someone learning how RAG actually works, not hidden behind
  a framework.
