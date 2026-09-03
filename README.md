<h1 align="center">Build My AI</h1>

<p align="center">
  <b>Own your private AI.</b><br>
  A non-commercial, open-source project for AI enthusiasts and developers who want to
  own their whole AI stack — a private, on-device AI, no model, GPU, RAG, or Docker expertise required.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <a href="https://github.com/Qiaofei-Y/AI-SET-UP-GROUP/actions/workflows/tests.yml"><img alt="CI" src="https://github.com/Qiaofei-Y/AI-SET-UP-GROUP/actions/workflows/tests.yml/badge.svg"></a>
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen">
  <img alt="Tests" src="https://img.shields.io/badge/tests-backend%2056%20%C2%B7%20frontend%20172-success">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen">
</p>

---

## What is Build My AI?

Build My AI is a **non-commercial, open-source project** for running a private AI that lives on your own hardware — built for AI enthusiasts and developers who want to own their whole stack. You describe what you want your AI to do in plain language; it picks a suitable open model, checks your machine, and generates a guided installer — no jargon, no lock-in.

It ships as two halves you host together:

- **A zero-dependency backend API** (`backend/`) — model advice, accounts & auth, and opt-in telemetry. Pure Python **standard library**: no `pip install`, no SDKs, no supply chain.
- **The full frontend** (`frontend/`) — marketing site, a guided setup wizard, an account center, and a chat demo. Zero-build **vanilla JS**: no npm, no bundler.

Everything runs on your box. Your data and inference stay local by default — the browser only ever talks to `127.0.0.1` and your own origin.

## How it works

<p align="center">
  <img alt="Build My AI architecture: a zero-dependency static site whose only networked file (local-llm.js) probes local AI services in a priority ladder — Project RAG, streaming chat, the Ollama engine, then an offline static demo — with an optional local backend API, all running on your own hardware." src="docs/assets/architecture.png" width="100%">
</p>

The static site is **offline-first**: `local-llm.js` — the only file allowed to touch the network — probes your machine and climbs a priority ladder, from a citation-backed **Project RAG** down to a built-in **static demo** if nothing local is running. An optional **backend API** (`127.0.0.1:8940`) auto-enhances the experience when it's online. Nothing leaves the device.

## Why self-host it

- **Own your stack.** All data, accounts, and inference on hardware you control.
- **Zero dependencies.** stdlib Python + vanilla JS. The base runtime *is* the whole footprint — nothing to audit, nothing to break in a `npm audit`.
- **A privacy red line that's executable.** The security model is written as test assertions (`frontend/tests/security.test.js`): only one file may make network requests, free-text never hits the wire, structured logs can't contain a request body. Violate an invariant and CI goes red.
- **Production guardrails included.** Session auth (PBKDF2, hashed tokens), SQLite WAL + versioned migrations, online backups, structured logging, reverse-proxy + CSP config, and CI on every PR.

## Quickstart

### Docker (one command)

```bash
git clone https://github.com/Qiaofei-Y/AI-SET-UP-GROUP.git
cd AI-SET-UP-GROUP
BMA_ADMIN_SECRET=$(openssl rand -hex 32) docker compose up -d --build
open http://localhost:8931           # the product
curl http://localhost:8940/v1/health # the API
```

The API binds inside the container, so it **refuses to start with the default secret** — set `BMA_ADMIN_SECRET` (the command above generates one). To stop: `docker compose down`.

### Local dev (no Docker, no dependencies)

```bash
# backend — stdlib only
python3 backend/api/server.py                 # 127.0.0.1:8940

# frontend — any static server (fetch is blocked on file://, so use http)
cd frontend && python3 -m http.server 8931
open http://localhost:8931
```

## Test

The one test suite doubles as the security spec — a non-zero exit fails CI.

```bash
python3 backend/tests/api.test.py        # 56 tests: boots a real server, speaks real HTTP
python3 backend/ops/backup.py --selftest # backup → encrypt → restore → row-compare drill
bash   frontend/tests/run.sh             # 172 static+unit + headless-Chrome XSS + all-page smoke
```

## How it works

```
                         ┌─────────────────────────── your machine ───────────────────────────┐
  browser ── http ──►  frontend (static, vanilla JS)  ── /v1/* ──►  backend API (stdlib Python)
                         wizard · chat · accounts          │           advise · auth · telemetry
                         only talks to 127.0.0.1 / self    │           SQLite (users.db + events.db, split)
                                                           └──► your local model engine (Ollama :11434 / llm-lab)
```

- The **wizard** turns a plain-language need into a model choice + a guided Ollama installer, generated client-side (`install-my-ai.bat` + a step-by-step guide + a machine-readable `install-plan.json`).
- The **chat demo** tiers itself to whatever is running locally: project RAG → streaming chat → an Ollama fallback → a static demo, re-probing every 15s.
- **Identity and telemetry are split** across two SQLite databases and never cross-contaminate. Telemetry and feedback are **opt-in**.

## Repository layout

| Path | What's there |
|------|--------------|
| [`backend/`](backend/) | Zero-dependency stdlib API v0 — advise/registry/telemetry/feedback/auth, mailer, backup script |
| [`frontend/`](frontend/) | Zero-build static site — marketing, guided wizard, chat demo, account center, account-recovery pages, and the test suite |
| [`examples/`](examples/) | Copy-pasteable, dependency-free API tours (`curl` + shell) against the real backend |
| [`deploy/`](deploy/) | Production self-host — same-origin Caddy/nginx reverse proxy, systemd units, backup timer, runbook |
| [`docs/`](docs/) | Engineering & product docs (Chinese) — see the index below |
| [`figma/`](figma/) | High-fidelity UI prototypes |
| `Dockerfile` · `docker-compose.yml` · `docker-compose.prod.yml` | One-command self-host (dev, and same-origin HTTPS prod) |

## Self-hosting in production

> Full walkthrough of all four paths (local, Docker dev, Docker HTTPS, bare metal) — env vars, data persistence, backups, acceptance checks — in **[SELF-HOSTING.md](SELF-HOSTING.md)**.

Serve one domain that hosts the site **and** proxies `/v1/*` to the API (the **same-origin** topology — the frontend's API constant resolves to `''`, and card/model data never crosses an origin).

**Docker + Caddy (automatic HTTPS):**

```bash
BMA_DOMAIN=ai.example.com BMA_ADMIN_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker-compose.prod.yml up -d --build
```

Caddy gets a real cert via ACME for `BMA_DOMAIN` and reverse-proxies to the API container (the API is never published to the host). Leave `BMA_DOMAIN` unset to smoke-test on `https://localhost` with Caddy's internal CA. Config: `deploy/docker/Caddyfile`.

**Bare metal:** use [`deploy/`](deploy/) —

- `deploy/Caddyfile` / `deploy/nginx.conf` — reverse proxy + full security headers (CSP/HSTS, per `docs/19`)
- `deploy/systemd/` — API service (sandboxed, real secret injected) + backup timer
- `deploy/README.md` — the runbook, including a `curl /v1/health` acceptance check

## Security model

The privacy red line is enforced by tests, not convention (`frontend/tests/security.test.js`, `docs/19`):

- Only `frontend/assets/local-llm.js` may open a network connection. Any `fetch`/`XHR`/`WebSocket`/`sendBeacon`/`new Image(` elsewhere fails the build.
- User input and model output are always escaped and rendered via `textContent` — no raw `innerHTML`, no `eval`, no string timers.
- All scripts/styles/images are local relative paths — the static site loads zero external resources.
- The backend logs one body-free JSON line per response (method/path/status/ms/ip only) — never a body, email, or token.

Read [`docs/19`](docs/19-security-model.md) before touching anything that talks to the network.

## Contributing

`main` is protected: every change lands via a pull request, and both CI suites must be green. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and the definition of done, and [AGENTS.md](AGENTS.md) if you're driving this repo with an AI coding agent.

## Documentation

> New here? Start with [ONBOARDING.md](ONBOARDING.md) — up and running in 15 minutes, plus the commit bar and the landmines to avoid. Engineering docs are in Chinese.

| Doc | Contents |
|------|----------|
| [01 Vision](docs/01-vision.md) · [02 Product](docs/02-product-overview.md) · [03 Modules](docs/03-core-modules.md) · [04 MVP](docs/04-mvp.md) | Vision, users, journey, MVP scope |
| [06 Moat](docs/06-moat.md) · [07 Roadmap](docs/07-roadmap.md) | Differentiation, roadmap |
| [11 AI architecture](docs/11-ai-architecture-and-model-routing.md) · [16 Local AI ↔ web](docs/16-local-ai-web-integration.md) | Model routing, chat connector |
| [17 Repo conventions](docs/17-repo-architecture-and-conventions.md) · [18 Testing & quality](docs/18-testing-and-quality.md) · [19 Security model](docs/19-security-model.md) · [20 Backend & API](docs/20-backend-architecture-and-api.md) | **Engineering must-reads** |
| [21 Lambda cloud](docs/21-lambda-cloud-integration.md) | Cloud GPU path |

(Full per-doc index: each file in [`docs/`](docs/) is self-describing; 08–10, 13–15 cover resources, testing/experiments, onboarding, and the marketing playbook.)

## License

[MIT](LICENSE).
