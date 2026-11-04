# Second Brain — a self-hosted personal AI knowledge agent

Feed it your notes, PDFs, and web pages. Ask it questions in plain English.
It answers using *your* material and shows you exactly which document (and
which chunk of it) each part of the answer came from — a real
retrieval-augmented generation (RAG) system, not a chatbot with vibes.

Runs entirely on your own machine for **$0**: local embeddings, local vector
database, local LLM. No API keys required for the default setup. Every
"free" claim below was checked against official docs/pricing in
**September 2026** — see `COSTS.md`.

## What it actually does

- **Ingest**: drop in `.txt` / `.md` / `.pdf` files, paste raw text, or give
  it a URL and it will fetch and clean the page itself.
- **Chunk + embed**: splits documents into overlapping chunks, embeds them
  locally with Ollama's `nomic-embed-text`, stores the vectors in a local
  ChromaDB database.
- **Chat with citations**: ask a question, it retrieves the most relevant
  chunks, answers using only that context, and cites which document (and
  where) each claim came from — so you can verify it, not just trust it.
- **Remembers the conversation**: follow-up questions ("what about the
  second point?") work, per chat session.
- **Simple web UI**: one page, no build step — upload documents, watch
  ingestion progress, chat, click a citation to see the source chunk.

## Quickstart

```bash
git clone <this-repo> && cd second-brain
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt --break-system-packages
ollama pull llama3.2
ollama pull nomic-embed-text
uvicorn src.api.main:app --reload --port 8000
```

Open `http://localhost:8000` — upload a document, ask it about that
document. Full walkthrough: `SETUP.md`.

## Documentation map

| File | What's in it |
|---|---|
| `DESIGN.md` | Product goal, RAG architecture, alternatives considered |
| `ARCHITECTURE.md` | Component diagram (Mermaid), data flow, ingestion pipeline |
| `SETUP.md` | Install, model downloads, first run |
| `IMPLEMENTATION.md` | Step-by-step build roadmap |
| `DEVELOPMENT.md` | Local dev workflow, adding a new document loader |
| `SECURITY.md` | What's protected, what isn't (this is a single-user local tool) |
| `TROUBLESHOOTING.md` | Common errors by symptom |
| `COSTS.md` | What's free, what could cost money if you scale it up |
| `ROADMAP.md` | What's next |

## Project layout

```
second-brain/
├── src/
│   ├── api/            FastAPI app: chat, ingest, documents, static UI
│   ├── ingestion/       Loaders (txt/md/pdf/url) + chunking
│   ├── embeddings/      Ollama embedding client
│   ├── vectorstore/     ChromaDB wrapper
│   ├── agent/           RAG orchestrator: retrieve -> prompt -> generate -> cite
│   ├── memory/          Per-session chat history (SQLite)
│   ├── config/          Settings from environment variables
│   ├── utils/           Logging, retry, text splitting
│   └── web/             Single-page chat + upload UI (static HTML/JS)
├── data/
│   ├── documents/       Uploaded source files (kept for citation lookup)
│   └── chroma/          Vector database files (created on first run)
├── tests/
├── scripts/
└── docker-compose.yml   app + Ollama
```

## Status

Working MVP: ingestion (file upload + URL fetch), chunking, local
embeddings, vector search, RAG chat with citations, session memory, a
usable single-page UI. Single-user, single-process, no auth — this is a
personal tool, not a multi-tenant product. See `ROADMAP.md` for what
production-hardening would add if you ever wanted to share it.
