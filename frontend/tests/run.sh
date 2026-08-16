#!/usr/bin/env bash
# Run all local security tests. Usage: bash frontend/tests/run.sh
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Static + unit security tests (node) =="
node "$DIR/security.test.js"
NODE_RC=$?

echo
echo "== Runtime XSS test (headless browser) =="
CHROME=""
for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v google-chrome 2>/dev/null)" \
  "$(command -v chromium 2>/dev/null)" \
  "$(command -v chromium-browser 2>/dev/null)"; do
  if [ -n "${c:-}" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
done

BROWSER_RC=0
if [ -z "$CHROME" ]; then
  echo "  SKIP  no Chrome/Chromium found (static tests still cover escaping via unit test)"
else
  OUT="$("$CHROME" --headless --disable-gpu --no-sandbox --virtual-time-budget=2500 \
        --dump-dom "file://$DIR/xss.browser.html" 2>/dev/null)"
  if echo "$OUT" | grep -q "XSS-SAFE-PASS"; then
    echo "  ok    malicious payload rendered as inert text (no node injection, no execution)"
  else
    echo "  FAIL  runtime XSS test"
    echo "$OUT" | grep -o 'XSS-FAIL[^<]*' | head -1
    BROWSER_RC=1
  fi
fi

echo
if [ "$NODE_RC" -eq 0 ] && [ "$BROWSER_RC" -eq 0 ]; then
  echo "All security tests passed."
  exit 0
else
  echo "Security tests FAILED."
  exit 1
fi
