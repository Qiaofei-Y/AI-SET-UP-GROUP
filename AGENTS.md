# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this repo.
Claude Code users: [CLAUDE.md](CLAUDE.md) is the detailed, authoritative version —
this file is the short, agent-neutral summary.

## What this is

An open-source, self-hostable platform for standing up a private on-device AI:
a **zero-dependency stdlib Python backend** (`backend/`) and a **zero-build vanilla
JS site** (`frontend/`). No npm, no pip install, no bundler, no SDKs. Keep it that way.

## Non-negotiable invariants (enforced by tests — violating them fails CI)

1. **Zero dependencies.** Never add a package manager, dependency, CDN, or build step.
2. **One egress point.** Only `frontend/assets/local-llm.js` may make network
   requests. Any `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon`/`new Image(`/`import(`
   anywhere else fails `frontend/tests/security.test.js`.
3. **No unsafe rendering.** Escape via `esc()` + `textContent`. No raw `innerHTML`,
   `eval`, `document.write`, `insertAdjacentHTML`, or string timers.
4. **Local assets only.** All `<script>`/`<link>`/images are local relative paths.
5. **Privacy red line.** Backend rejects free text (400) and never logs bodies,
   emails, or tokens. `users.db` (identity) and `events.db` (telemetry) stay split.
6. **Bilingual UI.** Every visible string has paired `data-en`/`data-zh` (or `t(en, zh)`).
7. **Honesty.** Never surface a claim the code can't back. If a feature isn't real,
   don't say it is.

## Before you edit

- Touching `server.py`? Read [`docs/20`](docs/20-backend-architecture-and-api.md) first.
- Touching anything network-facing? Read [`docs/19`](docs/19-security-model.md).
- Adding files / pages? Read [`docs/17`](docs/17-repo-architecture-and-conventions.md) (conventions, port map, code split).

## Definition of done

Run all three (this is what CI runs) and keep them green:

```bash
python3 backend/tests/api.test.py
python3 backend/ops/backup.py --selftest
bash   frontend/tests/run.sh
```

## Workflow

`main` is protected: branch → PR → both CI checks green → merge. Do not push to `main`.
