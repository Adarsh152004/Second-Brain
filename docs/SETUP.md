# SETUP.md

## Prerequisites

- Python 3.11+
- [Ollama](https://ollama.com) installed (for local LLM + embeddings)
- ~4GB free disk space for the default models

## 1. Install Ollama and pull the models

```bash
curl -fsSL https://ollama.com/install.sh | sh   # macOS/Linux
ollama pull llama3.2          # chat model, ~2GB
ollama pull nomic-embed-text  # embedding model, ~274MB
```

Confirm it's running:

```bash
curl http://localhost:11434
# should print: Ollama is running
```

## 2. Set up the Python environment

```bash
git clone <this-repo> && cd second-brain
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt --break-system-packages
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

The defaults work out of the box for the fully-local setup — you only need
to edit `.env` if you want to point at a cloud LLM (`LLM_BACKEND=groq` plus
`GROQ_API_KEY`) or change model sizes.

## 4. Run it

```bash
uvicorn src.api.main:app --reload --port 8000
```

Open `http://localhost:8000` in a browser.

## 5. Ingest something

- Drag a `.txt`, `.md`, or `.pdf` file into the upload panel, **or**
- Paste a URL and click "Fetch & ingest", **or**
- Paste raw text with a title.

Watch the response — it reports how many chunks were created.

## 6. Ask it a question

Type a question about the document you just ingested. The answer should
include a "Sources" section listing which document (and which chunk) it
used — click one to see the exact text it drew from.

## Expected result

A question about content you ingested gets answered using that content,
with visible citations. A question about something *not* in your knowledge
base gets an honest "I don't have information about that" rather than a
confident-sounding guess.

## Choosing model sizes for your hardware

| Your machine | Chat model | Notes |
|---|---|---|
| Laptop, no GPU, 8-16GB RAM | `llama3.2:1b` or `llama3.2:3b` | Fast, noticeably less capable |
| Laptop/desktop, 16-32GB RAM | `llama3.2` (3B, this project's default) | Good balance |
| Desktop with a GPU, 24GB+ VRAM | `qwen3-coder:30b` or `llama3.3:70b` | Much stronger answers, needs real hardware |

Change `OLLAMA_MODEL` in `.env` and re-run `ollama pull <model>`.

## Common errors at this stage

See `TROUBLESHOOTING.md`. Most first-run problems are: Ollama not running,
the embedding model not pulled, or `pypdf` failing on a scanned
(image-only) PDF that has no extractable text layer.
