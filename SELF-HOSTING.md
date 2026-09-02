# Self-Hosting Build My AI

Build My AI is fully self-hostable. The backend is **zero-dependency** (Python 3
standard library only — no `pip install`, no build step) and the frontend is a
**static, zero-build** site (vanilla JS + HTML/CSS). One image or one checkout
runs everything.

This guide covers four paths, from a laptop to a public HTTPS domain:

| # | Path | Use it when | Entry point |
|---|------|-------------|-------------|
| 1 | Local dev, no Docker | Hacking on the code, quick look | `backend/api/server.py` + `python3 -m http.server` |
| 2 | Docker dev, single host | One-command run on your machine/VM, no TLS | `docker-compose.yml` |
| 3 | Docker production, HTTPS | Public domain, same-origin, auto-TLS | `docker-compose.prod.yml` + `deploy/docker/Caddyfile` |
| 4 | Bare-metal production | No Docker on the server (systemd + reverse proxy) | `deploy/` |

All four expose the same acceptance check: `GET /v1/health` must return
`{"ok": true, "service": "buildmyai-api", "version": "0.1"}`.

---

## The one env var you must understand: `BMA_LICENSE_SECRET`

The backend can mint license keys, signed with `BMA_LICENSE_SECRET`. The shipped
default is the literal string `dev-secret-change-me` — fine on loopback, but
**anyone who knows it could mint valid licenses**.

To prevent an accidental public exposure, the server **fails closed**: at startup,
if the bind host is anything other than `127.0.0.1` / `localhost` / `::1` **and**
the secret is still the default, it refuses to start (`backend/api/server.py`,
`create_server()`):

```
refusing to bind <host> with the default BMA_LICENSE_SECRET — inject a real secret first
```

Consequences per path:

- **Local dev (path 1)** binds `127.0.0.1` by default, so it runs with the
  default secret. Fine for development; set a real secret if you will issue
  licenses.
- **Docker (paths 2 & 3)** run the API with `--host 0.0.0.0` inside the container
  — a non-loopback bind — so they **require** `BMA_LICENSE_SECRET`. The compose
  files have no default (`${BMA_LICENSE_SECRET:?...}`) and abort if it is unset.
- **Bare-metal (path 4)** keeps the API on `127.0.0.1`, but the secret is still
  required for real license issuance and must never stay the default.

Generate one with:

```bash
openssl rand -hex 32
```

---

## Environment variables reference

Read from `backend/api/server.py`, `backend/api/mailer.py`, `backend/ops/backup.py`,
and the compose/deploy files. All are optional unless noted.

**Core**

| Var | Default | Meaning |
|-----|---------|---------|
| `BMA_LICENSE_SECRET` | `dev-secret-change-me` | License signing key. Required for any non-loopback bind (see above). |
| `BMA_DB` | `backend/api/data/events.db` | SQLite path for anonymous telemetry/feedback events. |
| `BMA_USERS_DB` | `backend/api/data/users.db` | SQLite path for accounts (PBKDF2-hashed passwords, session/token hashes). |
| `BMA_LOG` | `1` | Structured, body-free access logging (`path`/`status` only). Set `0` to mute. |
| `BMA_ADVISOR_LLM` | (unset) | Optional loopback URL of an OpenAI-compatible LLM to upgrade `/v1/advise` classification. Non-loopback URLs are ignored; failures fall back to keyword rules. |

Identity and telemetry are **split across two databases** (`users.db` vs
`events.db`) so account data and anonymous events never mix. Both live under the
same data directory / volume.

**Billing (Stripe) — optional; leave empty to keep checkout/portal honestly `503`**

| Var | Meaning |
|-----|---------|
| `BMA_STRIPE_SECRET` | Stripe secret API key. Card data never touches this process (Stripe-hosted checkout/portal). |
| `BMA_STRIPE_WEBHOOK_SECRET` | Verifies the raw body of `POST /v1/billing/webhook`. |
| `BMA_STRIPE_PRICE_PRO` / `BMA_STRIPE_PRICE_BUSINESS` | Stripe price IDs per tier. |
| `BMA_CHECKOUT_SUCCESS_URL` / `BMA_CHECKOUT_CANCEL_URL` / `BMA_PORTAL_RETURN_URL` | Redirect targets. |

Stripe (`https://api.stripe.com`) is the **only** non-loopback host the backend
ever dials.

**Email (password reset / verification) — optional; unset ⇒ dev/stdout only**

| Var | Meaning |
|-----|---------|
| `BMA_SMTP_HOST` / `BMA_SMTP_USER` / `BMA_SMTP_PASS` | SMTP endpoint (e.g. Amazon SES). Unset ⇒ mail goes to an in-memory outbox + stdout, not really sent. |
| `BMA_SITE_URL` | Base URL used in reset/verify links inside emails. |
| `BMA_MAIL_FROM` | From header, e.g. `Build My AI <no-reply@example.com>`. |

**Backups** (`backend/ops/backup.py`)

| Var | Default | Meaning |
|-----|---------|---------|
| `BMA_BACKUP_DIR` | `./backups` | Snapshot destination. |
| `BMA_BACKUP_KEEP` | `14` | Snapshots retained per db. |
| `BMA_BACKUP_KEY` | (unset) | openssl passphrase → AES-256 encrypt snapshots at rest. |
| `BMA_BACKUP_S3` | (unset) | `s3://bucket/prefix` to push each snapshot off-box (needs the `aws` CLI + credentials). |

**Reverse proxy (Docker prod only)**

| Var | Default | Meaning |
|-----|---------|---------|
| `BMA_DOMAIN` | `localhost` | Domain Caddy serves and gets an ACME cert for. Unset ⇒ `localhost` with Caddy's internal CA (smoke-test only). |

---

## Same-origin topology (and why it matters)

In production, **one domain serves the static site and proxies `/v1/*` to the
API**. The reverse proxy terminates TLS and forwards `/v1/*` to the backend.

This is deliberate. The frontend's API base (`frontend/assets/local-llm.js`) is:

```js
var LOCAL_PAGE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
var API = LOCAL_PAGE ? 'http://127.0.0.1:8940' : '';
```

- On `localhost`/`127.0.0.1` it talks to the API directly on port `8940`.
- On any real domain the API base is `''` — a **same-origin relative path**, so
  the browser calls `/v1/*` on the same host that served the page.

The payoff: **the exact same static files work locally and in production with
zero configuration**, and no request (card data, model choices) ever crosses an
origin. Paths 3 and 4 both implement this topology (Caddy or nginx). This is why
the production reverse proxy, not the app, owns TLS and port 80/443.

---

## Data persistence

The backend writes exactly two SQLite files: `users.db` and `events.db`
(WAL mode). Persist them or you lose accounts and telemetry.

- **Docker (paths 2 & 3):** the `Dockerfile` sets `BMA_DB=/app/data/events.db`
  and `BMA_USERS_DB=/app/data/users.db`, and the compose files mount the named
  volume `bma-data` at `/app/data`. Back up that volume.
- **Bare-metal (path 4):** both dbs live in `/srv/buildmyai/backend/api/data/`
  (the default path). This directory **must be created before first start** (see
  path 4 — systemd `ProtectSystem=strict` makes its parent read-only, so the
  server cannot create it).

---

## Path 1 — Local dev (no Docker)

Requires Python 3 only.

Terminal A — API (loopback, port 8940):

```bash
python3 backend/api/server.py
# buildmyai-api v0 on http://127.0.0.1:8940  (db: .../data/events.db, advisor: rules)
```

Terminal B — static frontend (port 8931):

```bash
cd frontend && python3 -m http.server 8931
open http://localhost:8931
```

`chat.html`'s `fetch` calls are blocked under `file://`, so you must serve the
frontend over `http://`. Databases are created on first run under
`backend/api/data/`.

Handy: mint a demo license for testing —
`python3 backend/api/server.py --mint pro`.

**Acceptance check:**

```bash
curl -fsS http://127.0.0.1:8940/v1/health
# {"ok": true, "service": "buildmyai-api", "version": "0.1"}
```

---

## Path 2 — Docker dev, single host (no TLS)

One image, two services (`api`, `web`), defined in `docker-compose.yml`. Both are
published only to `127.0.0.1` (not exposed to the network). `BMA_LICENSE_SECRET`
is required because the API binds `0.0.0.0` inside the container.

```bash
BMA_LICENSE_SECRET=$(openssl rand -hex 32) docker compose up -d --build
open http://localhost:8931
```

- `api` → published on `127.0.0.1:8940`; the local-page frontend talks to it directly.
- `web` → serves the static site on `127.0.0.1:8931`.
- Data persists in the named volume `bma-data` (mounted at `/app/data`).

For a real public domain with TLS, use path 3 instead — this file has no reverse
proxy and serves plain HTTP on loopback.

**Acceptance check:**

```bash
curl -fsS http://127.0.0.1:8940/v1/health
# {"ok": true, "service": "buildmyai-api", "version": "0.1"}
```

---

## Path 3 — Docker production (same-origin + automatic HTTPS)

`docker-compose.prod.yml` runs the `api` container (no longer published to the
host) behind a `caddy:2` container that serves the static site and proxies
`/v1/*` to `api:8940`, using `deploy/docker/Caddyfile`. Caddy owns 80/443.

**External action required:** point your domain's A/AAAA record at this host and
make ports 80 and 443 reachable, so Caddy can complete the ACME challenge.

```bash
BMA_DOMAIN=ai.example.com BMA_LICENSE_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker-compose.prod.yml up -d --build
```

- Caddy gets a real HTTPS cert via ACME for `BMA_DOMAIN`.
- Leave `BMA_DOMAIN` unset to smoke-test on `https://localhost` with Caddy's
  internal CA (browser/`curl` will warn; that is expected for the internal CA).
- The API is **not** published to the host — Caddy is its only ingress.
- Volumes: `bma-data` (SQLite), `caddy-data`, `caddy-config`.
- The Caddyfile sets the security headers (CSP, HSTS, nosniff, `frame-ancestors`,
  etc.). The Stripe webhook is verified over the raw body by the app, so the
  proxy needs no special handling.

For live billing/email, inject the optional secrets into the `api` service
environment (they are wired through as `BMA_STRIPE_SECRET`,
`BMA_STRIPE_WEBHOOK_SECRET`, `BMA_SMTP_HOST`, etc.):

```bash
BMA_DOMAIN=ai.example.com \
BMA_LICENSE_SECRET=... \
BMA_STRIPE_SECRET=sk_live_... \
BMA_STRIPE_WEBHOOK_SECRET=whsec_... \
BMA_SMTP_HOST=email-smtp.us-east-1.amazonaws.com \
  docker compose -f docker-compose.prod.yml up -d --build
```

**Acceptance check** (through the proxy, over TLS):

```bash
curl -fsS https://ai.example.com/v1/health
# {"ok": true, "service": "buildmyai-api", "version": "0.1"}
# Smoke-testing with the internal CA (no BMA_DOMAIN)? use: curl -fsSk https://localhost/v1/health
```

---

## Path 4 — Bare-metal production (systemd + reverse proxy)

No Docker on the server. Same same-origin topology as path 3, implemented with a
loopback-bound systemd service and Caddy **or** nginx in front. Full source:
`deploy/README.md`, `deploy/Caddyfile`, `deploy/nginx.conf`,
`deploy/systemd/*`, `deploy/healthcheck.sh`.

**1. Place the code and create dirs.** Put the repo at `/srv/buildmyai`
(`frontend/`, `backend/`). Create a non-privileged user `bma`, the data dir, and
the backup dir, all owned by `bma`:

```bash
sudo useradd --system bma
sudo mkdir -p /srv/buildmyai/backend/api/data /var/backups/bma
sudo chown -R bma:bma /srv/buildmyai/backend/api/data /var/backups/bma
```

The data dir **must exist first** — `buildmyai-api.service` uses
`ProtectSystem=strict`, which makes `/srv` read-only except for the declared
`ReadWritePaths`, so the process cannot create the directory itself.

**2. Replace placeholders (external action: real domain).**

- In `deploy/Caddyfile` **or** `deploy/nginx.conf` and both systemd units,
  replace `buildmyai.example.com` with your real domain.
- In `frontend/sitemap.xml` replace every `https://__DOMAIN__` with the domain,
  and uncomment the `Sitemap:` line in `frontend/robots.txt`.

**3. Inject secrets** (edit the `Environment=` lines in
`deploy/systemd/buildmyai-api.service`):

- `BMA_LICENSE_SECRET` — a real random string (**required**; the default refuses
  a non-loopback bind and is unsafe anywhere).
- Email: `BMA_SMTP_HOST/USER/PASS` (e.g. Amazon SES SMTP; unset ⇒ dev/stdout, no
  real mail) and `BMA_SITE_URL` = your domain.
- Billing (**can stay empty** — checkout/portal return an honest `503` until
  live): `BMA_STRIPE_SECRET`, `BMA_STRIPE_WEBHOOK_SECRET`,
  `BMA_STRIPE_PRICE_PRO/BUSINESS`; then set the Stripe dashboard webhook to
  `https://<domain>/v1/billing/webhook`.

The unit keeps the API on `127.0.0.1:8940` and is heavily sandboxed
(`NoNewPrivileges`, `ProtectSystem=strict`, restricted syscalls/address families,
`ReadWritePaths=/srv/buildmyai/backend/api/data`).

**4. Start the backend:**

```bash
sudo cp deploy/systemd/buildmyai-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now buildmyai-api
```

**5. Start the reverse proxy** (TLS + `/v1/*` proxy + security headers):

- Caddy: put `deploy/Caddyfile` at `/etc/caddy/` and `sudo systemctl reload caddy`
  (auto-issues the cert). Static root is `/srv/buildmyai/frontend`.
- nginx: install `deploy/nginx.conf` into `sites-enabled`, then
  `sudo certbot --nginx -d <domain>` for the cert.

**6. Enable scheduled backups** (every 30 min; see next section):

```bash
sudo cp deploy/systemd/buildmyai-backup.service deploy/systemd/buildmyai-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now buildmyai-backup.timer
```

**Acceptance check** — one-shot smoke test (also validates CSP/HSTS/nosniff):

```bash
deploy/healthcheck.sh https://buildmyai.example.com   # exit 0 = healthy
```

or manually:

```bash
curl -fsS https://buildmyai.example.com/v1/health
# {"ok": true, "service": "buildmyai-api", "version": "0.1"}
curl -sI https://buildmyai.example.com/ | grep -i content-security-policy
```

---

## Backups and recovery drills

`backend/ops/backup.py` (stdlib only) takes WAL-safe **online** SQLite snapshots
of `users.db` and `events.db`, prunes to a retention window, optionally encrypts
(`BMA_BACKUP_KEY`, openssl AES-256) and optionally pushes off-box
(`BMA_BACKUP_S3`, needs the `aws` CLI).

Run once:

```bash
BMA_BACKUP_DIR=/var/backups/bma python3 backend/ops/backup.py
```

On bare metal, `buildmyai-backup.timer` runs it every 30 minutes
(`OnCalendar=*:0/30`, `Persistent=true`) with `BMA_BACKUP_KEEP=48`.

**A backup is not real until recovery is rehearsed.** The self-test performs a
full snapshot → restore → integrity + row-compare drill and exits `0` on success
(CI runs it on every change):

```bash
python3 backend/ops/backup.py --selftest
# backup selftest OK: snapshot + ... + restore + integrity + row-compare passed
```

Restore a specific snapshot:

```bash
python3 backend/ops/backup.py --restore <snapshot-file> --to <dest.db>
```

---

## What still needs a human (outside the code)

Honest limits — these are external actions, not features this repo can do for you:

- A **real domain + DNS** and open ports 80/443 for automatic HTTPS (paths 3, 4).
- **Real secrets**: `BMA_LICENSE_SECRET`, and — only when going live — Stripe keys
  and SMTP credentials. Until Stripe is configured, checkout/portal endpoints
  return an honest `503` rather than a fake flow.
- A company entity + Stripe account, legal review of the terms, a support inbox,
  and wiring the structured `warn`/`error` logs to your alerting.
