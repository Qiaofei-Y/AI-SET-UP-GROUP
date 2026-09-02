<!--
Thanks for contributing to Build My AI. Keep it zero-dependency and honest.
See CONTRIBUTING.md and AGENTS.md for the full workflow and invariants.
-->

## What & why

<!-- One or two sentences: what this changes and the motivation. Link any issue. -->

Closes #

## Definition of done

All three CI suites are green locally (a non-zero exit fails CI):

- [ ] `python3 backend/tests/api.test.py` (boots a real server, speaks real HTTP)
- [ ] `bash frontend/tests/run.sh` (static + unit + headless-Chrome XSS + all-page smoke)
- [ ] `python3 backend/ops/backup.py --selftest` (backup → restore drill)

## Invariants (enforced by tests — see `docs/19`, `docs/17`)

- [ ] **Zero new dependencies** — no package manager, SDK, bundler, build step, or CDN link.
- [ ] **Single egress** — only `frontend/assets/local-llm.js` makes network requests; no new `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon`/`new Image(`/`import(` elsewhere.
- [ ] **No unsafe rendering** — input/output go through `esc()` + `textContent`; no raw `innerHTML`, `eval`, `document.write`, `insertAdjacentHTML`, or string timers.
- [ ] **Local assets only** — every `<script>`/`<link>`/image is a local relative path.
- [ ] **Privacy red line** — backend still rejects free text (400) and never logs bodies/emails/tokens; `users.db` and `events.db` stay split.
- [ ] **Bilingual UI** — every new visible string ships paired English/Chinese (`data-en`/`data-zh`, `-ph` for placeholders; `t(en, zh)` for JS-generated strings).
- [ ] **Honest** — no claim the code can't back; docs/site stay consistent with the change.

<!-- If this PR intentionally relaxes a security assertion, update the test in the same PR and explain why here (process: docs/18 §3). -->
