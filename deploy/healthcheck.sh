#!/usr/bin/env bash
# Build My AI — post-deploy smoke test.
#
# Verifies a LIVE deployment over TLS end to end:
#   1. GET /v1/health  -> HTTP 200 with an "ok" body (the loopback API is up and
#      reachable through the reverse proxy).
#   2. HEAD /          -> the homepage ships the Content-Security-Policy header
#      (default-src 'self' + a connect-src) exactly as docs/19 / deploy/Caddyfile
#      specify, plus the transport/sniffing hardening headers (HSTS, nosniff).
#
# Run it right after `systemctl reload caddy` / `certbot --nginx` and again from
# monitoring. Exit 0 = healthy; any non-zero exit means the deploy is not serving
# correctly (wire it to your alerting).
#
# Usage:
#   deploy/healthcheck.sh https://buildmyai.example.com
#   BMA_HEALTH_URL=https://buildmyai.example.com deploy/healthcheck.sh
set -euo pipefail

BASE="${1:-${BMA_HEALTH_URL:-}}"
if [ -z "$BASE" ]; then
  echo "usage: $0 https://your-domain   (or set BMA_HEALTH_URL)" >&2
  exit 2
fi
BASE="${BASE%/}"   # strip a trailing slash so we don't build //v1/health

fail() { echo "FAIL: $*" >&2; exit 1; }

# 1) API health through the reverse proxy.
echo "==> GET $BASE/v1/health"
health="$(curl -fsS --max-time 10 "$BASE/v1/health")" \
  || fail "/v1/health did not return HTTP 200 over TLS"
printf '%s' "$health" | grep -q '"ok"' \
  || fail "/v1/health body is missing \"ok\": $health"
echo "    ok: $health"

# 2) Security headers on the homepage (HEAD -> headers only).
echo "==> HEAD $BASE/"
headers="$(curl -fsS --max-time 10 -I "$BASE/")" \
  || fail "homepage did not respond over TLS"

csp="$(printf '%s\n' "$headers" | grep -i '^content-security-policy:')" \
  || fail "no Content-Security-Policy header on /"
printf '%s' "$csp" | grep -qi "default-src 'self'" \
  || fail "CSP missing \"default-src 'self'\": $csp"
printf '%s' "$csp" | grep -qi "connect-src" \
  || fail "CSP missing connect-src (needed for /v1/* + local model): $csp"
echo "    content-security-policy present"

printf '%s\n' "$headers" | grep -qi '^strict-transport-security:' \
  || fail "missing Strict-Transport-Security header"
printf '%s\n' "$headers" | grep -qi '^x-content-type-options:[[:space:]]*nosniff' \
  || fail "missing X-Content-Type-Options: nosniff header"
echo "    hsts + nosniff present"

echo "PASS: $BASE healthy (/v1/health ok; CSP + HSTS + nosniff present)"
