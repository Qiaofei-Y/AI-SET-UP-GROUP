#!/usr/bin/env bash
# UI smoke test: every page must render, initialise the FX layer (data-fx="on"),
# keep its top bar, and produce zero console errors. Zero dependencies beyond
# python3 + headless Chrome (skipped politely when no Chrome is installed).
# Usage: bash frontend/tests/ui.smoke.sh   (run.sh calls this after the XSS test)
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
WEB="$(dirname "$DIR")"

CHROME=""
for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v google-chrome 2>/dev/null)" \
  "$(command -v chromium 2>/dev/null)" \
  "$(command -v chromium-browser 2>/dev/null)"; do
  if [ -n "${c:-}" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
done
if [ -z "$CHROME" ]; then
  echo "  SKIP  no Chrome/Chromium found (static suite still covers markup)"
  exit 0
fi

# own throwaway server on a random port — never depends on the dev :8931
PORT=$((20000 + RANDOM % 20000))
( cd "$WEB" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
SRV=$!
trap 'kill "$SRV" 2>/dev/null' EXIT
sleep 0.6

PAGES="index.html privacy.html terms.html how-it-works.html capabilities.html templates.html deploy.html downloads.html signup.html signup.html?mode=login build.html chat.html dashboard.html forgot-password.html reset-password.html reset-password.html?token=demo verify-email.html verify-email.html?token=demo account.html 404.html"
PASS=0; FAIL=0
for p in $PAGES; do
  LOG="$(mktemp)"
  DOM="$("$CHROME" --headless --disable-gpu --no-sandbox --enable-logging=stderr \
        --virtual-time-budget=3000 --dump-dom "http://127.0.0.1:$PORT/$p" 2>"$LOG")"
  ERRS="$(grep -Ec 'CONSOLE.*(Uncaught|TypeError|ReferenceError|SyntaxError)' "$LOG" || true)"
  rm -f "$LOG"
  OK=1
  echo "$DOM" | grep -q 'data-fx="on"' || { OK=0; WHY="fx layer never initialised"; }
  echo "$DOM" | grep -Eq 'class="(topbar|topnav)' || { OK=0; WHY="top bar missing"; }
  [ "${ERRS:-0}" -eq 0 ] || { OK=0; WHY="$ERRS console error(s)"; }
  if [ "$OK" -eq 1 ]; then PASS=$((PASS+1)); echo "  ok    $p"
  else FAIL=$((FAIL+1)); echo "  FAIL  $p — $WHY"; fi
done

echo "  $PASS pages ok, $FAIL failed"
[ "$FAIL" -eq 0 ]
