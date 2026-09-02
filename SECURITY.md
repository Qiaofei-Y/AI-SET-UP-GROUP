# Security Policy

Thanks for helping keep Build My AI and the people who self-host it safe.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Email **michael.yan@purehd.com** privately with:

- a description of the issue and its impact,
- steps to reproduce (a minimal proof of concept if you have one),
- the affected surface (backend API / frontend / installer / deploy) and the commit or branch.

This is our support/security inbox and we read everything. Please give us a
reasonable window to investigate and ship a fix before any public disclosure.

## Scope

In scope — anything that breaks the project's privacy red line or the safety of
a self-hosted instance, for example:

- a way to make the browser send data anywhere other than `127.0.0.1` or the
  page's own origin (the **single-egress** rule),
- getting free-text user input past the backend schema whitelist so it is
  processed or persisted, or getting a request **body, email, or token** into a log line,
- cross-contamination between the identity database (`users.db`) and the
  telemetry database (`events.db`),
- authentication, session, or password-recovery flaws
  (PBKDF2/hashed-token handling, one-time recovery tokens),
- XSS or other unsafe rendering in the frontend,
- deploy hardening gaps in the shipped reverse-proxy / systemd / Docker config.

Out of scope — issues in software you run alongside this project (your OS, your
local model engine such as Ollama, your reverse proxy, third-party
infrastructure), findings that require a compromised host or physical access,
and anything already documented as a known limitation.

## The privacy red line

The security model is enforced by tests, not convention. Our concrete
invariants:

- **Single egress.** Only `frontend/assets/local-llm.js` may make a network
  request. Any `fetch`/`XHR`/`WebSocket`/`EventSource`/`sendBeacon`/`new Image(`/`import(`
  elsewhere fails the build.
- **Free text is rejected and never logged.** The backend accepts only
  schema-whitelisted structured fields; free text returns `400` and is never
  persisted.
- **Split identity and telemetry.** Accounts live in `users.db` (PBKDF2 salted
  hashes; sessions and recovery tokens stored only as hashes); anonymous events
  live in `events.db`. They never cross-contaminate. Telemetry and feedback are opt-in.
- **Body-free logging.** The backend logs one JSON line per response containing
  only method/path/status/ms/ip — never a body, email, or token.

## References

- Security model (design + invariant → assertion mapping): [`docs/19-security-model.md`](docs/19-security-model.md)
- The executable red line (invariants written as test assertions): [`frontend/tests/security.test.js`](frontend/tests/security.test.js)
- Contributor rules and definition of done: [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md)
