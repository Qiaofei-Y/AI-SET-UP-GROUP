# Examples

Small, copy-pasteable scripts that exercise the **real** Build My AI backend API.
Everything here talks to the zero-dependency stdlib server in `backend/api/server.py`
over plain HTTP — no SDK, no client library, just `curl` and a POSIX shell.

## Prerequisites

Start the API first (pick one):

```bash
# straight from the repo (Python 3, stdlib only, listens on 127.0.0.1:8940)
python3 backend/api/server.py

# or via Docker
docker compose up
```

Sanity check that it's up:

```bash
curl -s http://127.0.0.1:8940/v1/health
# -> {"ok": true, "service": "buildmyai-api", "version": "0.1"}
```

## The examples

| File | What it does |
|------|--------------|
| [`api-tour.sh`](./api-tour.sh) | End-to-end tour of the public API: health check, a model recommendation from `/v1/advise`, then a full signup → login → `/v1/auth/me` session round-trip. |

### Running the tour

```bash
sh examples/api-tour.sh
```

Point it at a different host/port with `BASE_URL`:

```bash
BASE_URL=http://127.0.0.1:8940 sh examples/api-tour.sh
```

## Notes on the API

- **Strict field whitelist.** Every POST body is validated against an exact
  schema. Unknown fields, missing required fields, or wrong-shaped values are
  rejected with `400 {"error": "unknown_field:x | missing_field:x | invalid_field:x"}`.
  If you add a field the server doesn't know, the request fails — this is
  intentional (it's how the privacy red line is enforced in code).
- **`/v1/advise` takes `hardware`, not a free-form prompt.** The request is
  `{"hardware": {"gpu": ...}, "need_text"?: ..., "template"?: ..., "mode"?: ...}`.
  `need_text` is optional, capped at 500 chars, and is never logged, stored, or
  echoed back — it's used in-memory only to classify your need into a template.
- **Sessions are Bearer tokens.** `signup`/`login` return a 48-hex-char `token`;
  send it as `Authorization: Bearer <token>` to authenticated routes like
  `GET /v1/auth/me`. The server stores only a SHA-256 of the token, never the token itself.
- **This is a local, single-machine API by default** — it binds `127.0.0.1`.
  For anything beyond localhost, see `deploy/` and `docs/20`.

For the full endpoint reference see [`docs/20-backend-architecture-and-api.md`](../docs/20-backend-architecture-and-api.md).
