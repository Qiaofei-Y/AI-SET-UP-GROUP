# Recipe: connect the chat page to your OWN local model

The demo chat page (`frontend/chat.html`) is not hard-wired to any cloud service.
On load, and every 15 seconds after, its connector (`frontend/assets/local-llm.js`)
probes a few well-known ports **on your own machine** and lights up the richest
tier that answers. The browser only ever talks to `127.0.0.1` — nothing you type
leaves the computer.

This recipe shows the exact tiers and the minimal real commands to make each one
turn on. Deep dive: [`docs/16-local-ai-web-integration.md`](../docs/16-local-ai-web-integration.md).

## The four tiers (what the connector actually does)

The connector picks the first tier whose service responds, checked in this order:

| # | Tier | Lights up when | Endpoint it calls |
|---|------|----------------|-------------------|
| 1 | **Project RAG** | `127.0.0.1:8080` (chat model) **and** `127.0.0.1:8090` (RAG portal) are both up | `POST http://127.0.0.1:8090/api/rag` — answers cite the indexed project docs; off-topic questions fall through to tier 2 automatically |
| 2 | **General streaming chat** | only `127.0.0.1:8080` is up | `POST http://127.0.0.1:8080/v1/chat/completions` (OpenAI-compatible, SSE stream, last 12 turns of context) |
| 3 | **Ollama fallback** | `127.0.0.1:8080` is down but `127.0.0.1:11434` is up (the engine the guided installer sets up) | `POST http://127.0.0.1:11434/v1/chat/completions` — **requires a pinned model tag** in the request (the connector prefers an `*instruct*` model from `/v1/models`) |
| 4 | **Static demo** | nothing is reachable | built-in sample answers; the page stays fully functional |

Precedence detail: llm-lab (tiers 1–2) always wins over Ollama, because llm-lab is
what carries the RAG portal. If llm-lab comes back while you're on the Ollama rung,
the next 15s re-probe switches you back up.

Fixed ports the connector knows (each pinned to `127.0.0.1`, assigned once, enforced
by the security test suite):

- `8080` — chat model (llama.cpp, OpenAI-compatible) · probed via `GET /v1/models`
- `8090` — RAG portal · probed via `GET /api/health`, queried via `POST /api/rag`
- `11434` — Ollama · probed via `GET /v1/models`
- `8092` — **reserved** advisor slot (used by the build wizard, not the chat page)
- `8940` — the Build My AI backend API (see [`call-the-api.md`](./call-the-api.md))

Re-probe cadence: on `DOMContentLoaded`, then every **15 seconds** while a richer
tier is still missing (1.5s timeout per probe). Disconnects auto-recover.

## Step 0 — serve the page over http:// (required)

`fetch` is blocked on `file://`, so open the page through a static server:

```bash
cd frontend
python3 -m http.server 8931
open http://localhost:8931/chat.html      # localhost/127.0.0.1 counts as a "local page"
```

You'll start at **tier 4 (static demo)**. Bring up a backend below and the chip in
the top-right flips to your real model within ~15s.

## Make tier 3 light up — Ollama (simplest)

Ollama is an **external** engine (not shipped in this repo — the guided installer in
the product sets it up for end users; here you install it yourself from ollama.com).
Once it's running it listens on `127.0.0.1:11434` and the connector finds it.

```bash
# 1. install Ollama (external), then it usually runs as a background service.
#    if not: ollama serve

# 2. pull a model. Tier 3 REQUIRES a pinned tag, and the connector prefers an
#    instruct model. Use the exact tag the plan cards promise, listed in
#    backend/api/registry.json under each model's "ollama" field, e.g.:
ollama pull qwen2.5:7b-instruct-q4_K_M
```

Reload `chat.html`: the chip shows `<model> · Ollama` and answers stream from
`11434`. Pin the quant tag exactly — bare tags (`qwen2.5:7b`) can be re-pointed
upstream.

## Make tiers 1–2 light up — llm-lab

llm-lab is the richer local stack (also **external** to this repo; the `ai` command
comes from a separate `~/llm-lab` install, per this project's CLAUDE.md). Starting it
brings up the chat model on `8080` and, with the portal, RAG on `8090`.

```bash
ai            # brings up: 8080 chat · 8081 embeddings · 8082 code · 8090 RAG portal
```

- **8080 only up** → tier 2: streaming general chat.
- **8080 + 8090 up** → tier 1: RAG. Answers are retrieved from the indexed project
  `.md` docs and rendered with citation cards (file + section). After editing docs,
  refresh the index with `ai ingest ~/AI-SET-UP-GROUP` (or `ai reindex …`).

The chip shows `<model> · RAG` (tier 1) or `<model> · local` (tier 2).

## What you should observe

- Top-right chip and header title change per tier (`· RAG` / `· Ollama` / `· local`
  / `· offline`).
- Tier 1 answers carry citation cards; ask something off-topic and it silently
  drops to tier 2 (general answer, no citations — an intentional "retrieve first,
  refuse rather than invent" design).
- Kill the engine mid-session → within 15s the chip reads `· offline` and you're
  back on demo answers; restart it and it reconnects on the next probe.

## The honest boundaries

- The browser has exactly one file allowed to make network calls
  (`frontend/assets/local-llm.js`), and it can only construct URLs at the five
  `127.0.0.1` ports above — verified by `frontend/tests/security.test.js`.
- Ollama and llm-lab are **external engines**. This repo does not bundle them; it
  only knows how to talk to them if they're running locally.
- The knowledge-base side panel in the demo is a mock (drag-to-upload is animation);
  real corpus management is `ai ingest` / `ai reindex` on the llm-lab side.
