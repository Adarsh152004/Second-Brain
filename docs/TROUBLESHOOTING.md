# TROUBLESHOOTING.md

## "Connection refused" to localhost:11434
Ollama isn't running. Start it with `ollama serve`, or check it's running
as a background service (`ollama list` should work without error).

## Ingesting a PDF returns 0 chunks / empty text
The PDF is likely scanned images with no text layer — `pypdf` extracts
embedded text, it does not OCR. Options: use a PDF that has a real text
layer, or add an OCR step (e.g. `pytesseract`) as a future enhancement —
see `ROADMAP.md`.

## Chat always says "I don't have information about that"
- Confirm the document actually ingested: check `GET /documents` shows a
  chunk count > 0.
- Your question might genuinely not be covered — try a question you know
  is answered verbatim somewhere in the document first, to confirm
  retrieval is working at all.
- Check `RETRIEVAL_TOP_K` in `.env` isn't set to 0 or something unusually
  low.

## Answers are generic / don't seem to use my documents
- Confirm the embedding model matches what was used at ingestion time — if
  you change `EMBEDDING_MODEL` after ingesting documents, old vectors were
  embedded with the previous model and won't compare correctly against new
  query vectors. Re-ingest after changing the embedding model.
- Check the "Sources" section in the UI response — if it's empty, nothing
  relevant was retrieved; if it's populated but the answer ignores it,
  try a smaller/different chat model (some very small models don't follow
  the "answer only from context" instruction well).

## Very slow responses
- Try a smaller Ollama model (`llama3.2:1b`).
- Reduce `RETRIEVAL_TOP_K` — fewer chunks means a shorter prompt.
- Confirm you're not accidentally running the embedding step against a
  much larger model than needed — `nomic-embed-text` should be near-instant
  on CPU.

## "Address already in use" on port 8000
Another `uvicorn` process is already running — find and kill it, or change
`UVICORN_PORT` in `.env`.

## Uploaded file rejected with "unsupported file type"
Only `.txt`, `.md`, and `.pdf` are supported out of the box. To add a new
type, see "Adding a new document loader" in `DEVELOPMENT.md`.

## URL ingestion fails or returns garbled text
- Some sites block automated fetches or require JavaScript to render
  content, which a plain HTTP fetch can't execute — `trafilatura` works
  well on article/blog-style pages, less well on JS-heavy web apps.
- Confirm the URL starts with `http://` or `https://` — other schemes are
  rejected for security reasons (see `SECURITY.md`).

## Docker Compose: app can't reach Ollama
Confirm `OLLAMA_HOST` inside the container points at the service name
(`http://ollama:11434`), not `localhost` — containers reach each other by
service name inside Compose's network.
