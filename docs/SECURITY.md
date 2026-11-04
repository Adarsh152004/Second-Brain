# SECURITY.md

## This is a single-user local tool by default

There is **no authentication** on the API by default, because this project
is designed to run on `localhost` on your own machine, where the only
person who can reach it is you. This is a deliberate, documented
trade-off, not an oversight — but it means the following matters a lot:

**Do not expose this to the open internet without adding authentication
first.** If you put it behind a tunnel or deploy it to a host with a public
IP, anyone who finds the URL can read, add to, and delete your entire
knowledge base and run up your (or query your local) LLM.

## If you do expose it

Minimum additions before doing so:
- Put a reverse proxy (e.g. Caddy, nginx) in front with HTTP Basic Auth,
  or add a simple API-key check middleware to `src/api/main.py`.
- Restrict `/documents` DELETE and `/ingest/*` to authenticated requests at
  minimum — read-only chat is lower risk than the ability to modify your
  knowledge base.
- Use HTTPS (a tunnel like Cloudflare Tunnel gives you this for free).

## URL ingestion is a fetch of arbitrary user-supplied input

`POST /ingest/url` fetches whatever URL you give it. Only `http(s)://`
schemes are accepted (`src/ingestion/loaders.py` rejects anything else,
blocking `file://` and similar schemes that could otherwise read local
files through the server). Don't paste URLs you don't trust — the same
caution that applies to clicking any link applies here.

## Uploaded files

- File size is capped (`MAX_UPLOAD_MB` in `.env`, default 25MB) to prevent
  a single huge upload from exhausting memory during chunking/embedding.
- Only `.txt`, `.md`, and `.pdf` extensions are accepted; anything else is
  rejected rather than passed to a parser it wasn't meant for.
- Uploaded files are stored under `data/documents/` with a generated ID,
  not the original filename, to avoid path-traversal issues from a
  maliciously-named upload.

## Secrets

- If you configure a cloud fallback (`GROQ_API_KEY`), it lives in `.env`,
  which is git-ignored. Never commit `.env`.

## Data at rest

- Your documents and the vector database are stored unencrypted on local
  disk (`data/documents/`, `data/chroma/`). If your knowledge base
  contains sensitive material and your machine isn't otherwise encrypted
  (e.g. full-disk encryption), consider enabling that at the OS level.

## Things explicitly out of scope for this MVP

- Multi-user accounts or permissions.
- Encryption at rest for the vector database or stored documents.
- Audit logging of who queried what (there's only one user by design).

## Prompt-injection awareness

Because this system can ingest arbitrary web pages and PDFs, be aware that
retrieved content is inserted into the LLM's context. A malicious document
could contain text designed to manipulate the model's behavior (a form of
prompt injection). This project's RAG prompt instructs the model to treat
retrieved context as reference material to answer from, not as
instructions to follow — a reasonable mitigation, but not a guarantee.
Don't ingest documents from sources you wouldn't otherwise trust.
