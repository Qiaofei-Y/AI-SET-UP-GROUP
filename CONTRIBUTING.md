# Contributing to Build My AI

Thanks for helping build a private-AI platform people can actually own. This repo
has a few hard rules that keep it zero-dependency and honest — please skim them
before your first PR.

## Workflow

`main` is protected — you cannot push to it directly. Every change lands via a PR:

1. Branch off `main`.
2. Make your change; keep both test suites green.
3. Open a PR. CI runs **Backend API tests** and **Frontend security + XSS + UI smoke** — both must pass to merge.

## Run it

```bash
python3 backend/api/server.py          # API on 127.0.0.1:8940
cd frontend && python3 -m http.server 8931   # site on :8931 (fetch is blocked on file://)
```

Or the whole stack: `BMA_LICENSE_SECRET=$(openssl rand -hex 32) docker compose up -d --build`.

## Definition of done

A change isn't done until all of these are green (they're what CI runs):

```bash
python3 backend/tests/api.test.py         # 75 tests, real HTTP
python3 backend/ops/backup.py --selftest  # backup/restore drill
bash   frontend/tests/run.sh              # static + unit + headless-Chrome XSS + all-page smoke
```

See [`docs/18`](docs/18-testing-and-quality.md) for the full definition of done and the process for consciously relaxing a security assertion.

## The rules that CI enforces

These are invariants, written as test assertions ([`docs/19`](docs/19-security-model.md), [`docs/17`](docs/17-repo-architecture-and-conventions.md)):

- **Zero dependencies.** Backend is Python stdlib only; frontend is vanilla JS with no build step. Do not add a package manager, SDK, bundler, or CDN link.
- **One egress point.** Only `frontend/assets/local-llm.js` may make network requests. Any `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon`/`new Image(`/`import(` elsewhere fails the build.
- **No unsafe rendering.** User input and model output go through `esc()` + `textContent`. No raw `innerHTML`, `eval`, `document.write`, `insertAdjacentHTML`, or string timers.
- **Local assets only.** Every `<script>`/`<link>`/image is a local relative path.
- **Privacy red line.** Free text is rejected (400) by the backend schema whitelist and never persisted; structured logs carry only method/path/status/ms/ip — never a body, email, or token.
- **Bilingual UI.** Every visible string ships paired English/Chinese (`data-en`/`data-zh`, `-ph` for placeholders; `t(en, zh)` for JS-generated strings).

If a change genuinely needs to relax an assertion, update the test in the same PR and explain why (the process is in `docs/18 §3`).

## Docs mirror the code

The site's copy/flow/pricing must stay consistent with `docs/` (esp. 02, 04, 05, 11) and the design system in `figma/`. Change one side, check the other. Never ship a claim the code can't back — honesty is a project invariant, not a nicety.

## Style

Match the surrounding code: its naming, idioms, and comment density. Read [CLAUDE.md](CLAUDE.md) and [`docs/17`](docs/17-repo-architecture-and-conventions.md) for the code-split conventions and the port map before adding files.
