# Recipe: call the backend from your own code (no dependencies)

The Build My AI backend (`backend/api/server.py`) is a zero-dependency stdlib HTTP
server on `127.0.0.1:8940`. You can drive it from any language over plain HTTP — no
SDK, no client library. Below: a Python (stdlib `urllib` only) and a JavaScript
(`fetch`) call to `POST /v1/advise`, plus the session-token flow.

Start the server first:

```bash
python3 backend/api/server.py
curl -s http://127.0.0.1:8940/v1/health
# -> {"ok": true, "service": "buildmyai-api", "version": "0.1"}
```

Full endpoint reference: [`docs/20-backend-architecture-and-api.md`](../docs/20-backend-architecture-and-api.md).

## The `/v1/advise` request schema

Every POST body is validated against an **exact whitelist** — unknown, missing, or
wrong-shaped fields get `400 {"error": "missing_field:x | unknown_field:x | invalid_field:x"}`.
For `/v1/advise` the fields are (verified against `ADVISE_SCHEMA` + `HARDWARE_SCHEMA`
in `backend/api/server.py`):

```jsonc
{
  "hardware": {                 // REQUIRED (object)
    "gpu": "nvidia" | "none",   //   REQUIRED
    "vram_gb": 0-256,           //   optional
    "ram_gb": 0-1024            //   optional
  },
  "need_text": "one sentence",  // optional, 1-500 chars — in-memory only, never logged/stored/echoed
  "template": "company" | "legal" | "writing" | "research" | "support" | "data",  // optional
  "mode": "local" | "cloud" | "hybrid"   // optional
}
```

Note the field is **`need_text`** (a whole sentence describing your need) plus a
**`hardware` object with `gpu`** — there is no top-level `need` field. Give either
`need_text` (the server classifies it into a template) or `template` directly.

A successful call returns:

```json
{
  "template": "company",
  "mode": "local",
  "rag": true,
  "model": { "id": "qwen2.5-14b-instruct", "name": "Qwen2.5 14B Instruct",
             "quant": "Q4_K_M", "vram_min_gb": 12, "ollama": "qwen2.5:14b-instruct-q4_K_M", ... },
  "advisor": "rules",
  "why": { "en": "Best fit in 12 GB of VRAM — strongest at this kind of work.",
           "zh": "在 12 GB 显存内的最优选——最擅长这类需求。" }
}
```

## Python — stdlib `urllib` only (no `requests`)

```python
import json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8940"

def post(path, payload, token=None):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)   # session flow, below
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:                        # 4xx/5xx still carry JSON
        return e.code, json.loads(e.read().decode("utf-8"))

status, plan = post("/v1/advise", {
    "need_text": "answer questions over our internal company handbook",
    "hardware": {"gpu": "nvidia", "vram_gb": 12, "ram_gb": 32},
})
m = plan["model"]
print("Template: %s | Mode: %s | RAG: %s" % (plan["template"], plan["mode"], plan["rag"]))
print("Model:    %s (%s, needs %d GB VRAM)" % (m["name"], m["quant"], m["vram_min_gb"]))
print("Why:      %s" % plan["why"]["en"])
```

Output:

```
Template: company | Mode: local | RAG: True
Model:    Qwen2.5 14B Instruct (Q4_K_M, needs 12 GB VRAM)
Why:      Best fit in 12 GB of VRAM — strongest at this kind of work.
```

## JavaScript — `fetch` (Node 18+ or a browser)

```js
const BASE = "http://127.0.0.1:8940";

async function post(path, payload, token) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

const { body: plan } = await post("/v1/advise", {
  need_text: "answer questions over our internal company handbook",
  hardware: { gpu: "nvidia", vram_gb: 12, ram_gb: 32 },
});

const m = plan.model;
console.log(`Template: ${plan.template} | Mode: ${plan.mode} | RAG: ${plan.rag}`);
console.log(`Model:    ${m.name} (${m.quant}, needs ${m.vram_min_gb} GB VRAM)`);
console.log(`Why:      ${plan.why.en}`);
```

(`/v1/advise` needs no auth. In a browser you'd only reach `127.0.0.1:8940` from a
page served on localhost; deployed, the frontend calls the API same-origin behind a
reverse proxy — see `docs/20`.)

## The session-token flow (signup / login → Bearer)

Authenticated routes (e.g. `GET /v1/auth/me`) use a **Bearer token**. Get one from
`signup` or `login`; the server stores only a SHA-256 of it, never the token itself.

```python
# 1. signup — accept_tos MUST be true (clickwrap consent is recorded server-side)
status, out = post("/v1/auth/signup", {
    "name": "Dev",
    "email": "dev@example.com",
    "password": "correct horse battery",   # 8-128 chars
    "accept_tos": True,                     # REQUIRED, must be exactly true
    # optional: "company": "...", "plan": "free" | "pro" | "business"
})
token = out["token"]                        # 48 hex chars

# ...or log an existing account back in:
# status, out = post("/v1/auth/login", {"email": "dev@example.com",
#                                        "password": "correct horse battery"})
# token = out["token"]

# 2. use the token as a Bearer credential (GET, so no body — urlopen with method GET)
import urllib.request, json
req = urllib.request.Request(BASE + "/v1/auth/me", method="GET")
req.add_header("Authorization", "Bearer " + token)
with urllib.request.urlopen(req, timeout=10) as r:
    print(json.load(r))
# -> {'ok': True, 'user': {'name': 'Dev', 'email': 'dev@example.com',
#                          'plan': 'free', 'email_verified': False},
#     'entitlements': {'plan': 'free', 'rank': 0,
#                      'capabilities': ['model_advice', 'guided_install', 'local_chat']}}
```

`signup`/`login` both return `{ok, token, user:{name,email,plan,email_verified}}`.
Send the 48-hex token as `Authorization: Bearer <token>` on any authenticated route.
`POST /v1/auth/logout` (with the Bearer header) revokes that one session.

Everything above is stdlib/`fetch` only — no third-party packages. This is a
single-machine API by default (binds `127.0.0.1`); for beyond-localhost see
`deploy/` and `docs/20`.
