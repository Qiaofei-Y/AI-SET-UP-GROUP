#!/bin/sh
# api-tour.sh — a guided tour of the Build My AI backend API.
#
# Zero dependencies beyond curl + a POSIX shell. Exercises only endpoints and
# request shapes that actually exist in backend/api/server.py.
#
# Start the API first:   python3 backend/api/server.py   (or: docker compose up)
# Then run:              sh examples/api-tour.sh
# Override the target:   BASE_URL=http://127.0.0.1:8940 sh examples/api-tour.sh

set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:8940}"

# curl wrapper: silent, but still fail loudly on connection errors.
req() {
    curl -sS "$@"
}

echo "== Build My AI API tour =="
echo "Target: $BASE_URL"
echo

# ---------------------------------------------------------------------------
# 1. Liveness. GET /v1/health -> {"ok": true, "service": ..., "version": ...}
# ---------------------------------------------------------------------------
echo "[1] GET /v1/health"
req "$BASE_URL/v1/health"
echo
echo

# ---------------------------------------------------------------------------
# 2. Model recommendation. POST /v1/advise
#    Required: "hardware" (object) with "gpu": "nvidia" | "none".
#    Optional: "need_text" (<=500 chars), "template", "mode", and
#              hardware.vram_gb / hardware.ram_gb.
#    NOTE: the top-level free-text field is "need_text" — NOT "need".
#    Response: {template, mode, rag, model:{...}, advisor, why:{en,zh}}
# ---------------------------------------------------------------------------
echo "[2] POST /v1/advise (NVIDIA, 12 GB VRAM, described need)"
req -X POST "$BASE_URL/v1/advise" \
    -H 'Content-Type: application/json' \
    -d '{
      "need_text": "Answer questions over our internal contracts and policies",
      "hardware": { "gpu": "nvidia", "vram_gb": 12, "ram_gb": 32 }
    }'
echo
echo

echo "[2b] POST /v1/advise (no GPU -> cloud tier)"
req -X POST "$BASE_URL/v1/advise" \
    -H 'Content-Type: application/json' \
    -d '{ "hardware": { "gpu": "none" } }'
echo
echo

# ---------------------------------------------------------------------------
# 3. Account round-trip: signup -> login -> /v1/auth/me
#    signup requires: name, email, password (8-128), accept_tos: true.
#    Use a unique email each run so re-running doesn't hit 409 email_taken.
# ---------------------------------------------------------------------------
EMAIL="tour+$(date +%s)@example.com"
PASSWORD="tour-password-123"

echo "[3] POST /v1/auth/signup  (email: $EMAIL)"
req -X POST "$BASE_URL/v1/auth/signup" \
    -H 'Content-Type: application/json' \
    -d "{
      \"name\": \"API Tour\",
      \"email\": \"$EMAIL\",
      \"password\": \"$PASSWORD\",
      \"accept_tos\": true
    }"
echo
echo

# ---------------------------------------------------------------------------
# 4. Login with the same credentials -> a session token (48 hex chars).
# ---------------------------------------------------------------------------
echo "[4] POST /v1/auth/login"
LOGIN=$(req -X POST "$BASE_URL/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{ \"email\": \"$EMAIL\", \"password\": \"$PASSWORD\" }")
echo "$LOGIN"
echo

# Pull the token out of the JSON without needing jq: it's a 48-char hex string
# in a "token": "..." field.
TOKEN=$(printf '%s' "$LOGIN" | grep -oE '[0-9a-f]{48}' | head -n1)

if [ -z "${TOKEN:-}" ]; then
    echo "Could not extract a session token from the login response; stopping." >&2
    exit 1
fi
echo "Extracted session token: $(printf '%s' "$TOKEN" | cut -c1-8)...(48 hex chars)"
echo

# ---------------------------------------------------------------------------
# 5. Authenticated call. GET /v1/auth/me with Authorization: Bearer <token>
#    -> {ok, user:{name,email,plan,email_verified}, entitlements:{...}}
# ---------------------------------------------------------------------------
echo "[5] GET /v1/auth/me  (Authorization: Bearer <token>)"
req "$BASE_URL/v1/auth/me" -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== Done =="
