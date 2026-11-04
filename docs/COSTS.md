# Cost Analysis

Verified against official docs/pricing in **September 2026**. Re-check
anything you rely on beyond hobby use — free tiers move.

## Summary table

| Component | Option used | Free? | Free limit | Card required? | Alternative |
|---|---|---|---|---|---|
| Embeddings | Ollama, local (`nomic-embed-text`) | Fully free, unlimited | Your hardware/time | No | OpenAI `text-embedding-3-small`: ~$0.02 / 1M tokens |
| LLM (generation) | Ollama, local (`llama3.2` or larger) | Fully free, unlimited | Your hardware/time | No | Groq free tier: 30 req/min, no card |
| Vector database | ChromaDB, local file-based | Fully free, open source (Apache-2.0) | Disk space only | No | Qdrant (also free/local), Pinecone (paid cloud) |
| Document storage | Local filesystem | Fully free | Disk space | No | — |
| Chat memory | SQLite, local | Fully free | Disk space | No | — |
| Web page fetching | Direct HTTP fetch, no third-party API | Fully free | None | No | A search API (Tavily, SerpAPI) only if you want the agent to *search the open web*, not just fetch a URL you give it — those have paid tiers and are not included by default |
| Hosting | Your own machine (`localhost`) | Fully free | N/A | No | Render/Fly.io free tier if you want it reachable outside your LAN — same trade-offs as any self-hosted free-tier app: cold starts, limited hours |
| PDF parsing | `pypdf`, local | Fully free, open source | None | No | — |

## Why this is genuinely $0 for personal use

Unlike the WhatsApp voice-agent project, this system has **no external
service in its default path at all** — no Meta API, no per-message billing,
no rate limits imposed by anyone but your own hardware. Everything (LLM,
embeddings, vector store, storage) runs on the machine you start it on.
The only thing costing you anything is electricity and disk space.

## Where cost could enter if you extend it

- **Swapping local models for cloud ones** (e.g. using GPT-4-class models
  for better answer quality) — priced per token by whichever provider you
  choose; not needed for this to work, just an option.
- **Giving the agent real web search** (as opposed to "fetch this URL I
  gave you," which is already free) requires a search API; most have a
  free tier (Tavily's free tier, at time of writing, covers a few thousand
  searches/month) but it's a external dependency this project doesn't
  assume you want.
- **Exposing it outside your own machine** so you can use it from your
  phone — needs either a tunnel (Cloudflare Tunnel, free) or hosting
  (Render/Fly.io free tier with the same cold-start caveats as any free
  hosting tier).
- **Running a bigger local LLM than your hardware comfortably handles** —
  not a cash cost, but a real cost in patience; see `TROUBLESHOOTING.md`
  for picking a model size that fits your machine.

## What this document can't promise

- Free-tier terms for any optional cloud fallback (Groq, a search API) can
  change; re-check before depending on them.
- "Free" assumes you already own the computer this runs on.
