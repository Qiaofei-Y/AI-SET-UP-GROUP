#!/usr/bin/env node
/* Local security tests for the Build My AI web app. Zero dependencies.
   Run:  node web/tests/security.test.js   (exit code 1 on any failure)

   Covers:
   - Static scan for dangerous sinks (eval, new Function, document.write, string-timers).
   - No external/remote scripts, styles, or images (keeps a tight resource surface).
   - No javascript: URLs, no target=_blank without rel=noopener, no obvious hardcoded secrets.
   - Unit-tests the REAL esc() from chat.js against XSS payloads.
   - Asserts user-typed input flows through esc() + textContent (never raw innerHTML). */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'tests' || e.name === 'node_modules') continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(fp));
    else out.push(fp);
  }
  return out;
}
const files = walk(WEB);
const read = (f) => fs.readFileSync(f, 'utf8');
const jsFiles = files.filter((f) => f.endsWith('.js'));
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(WEB, f);

console.log('Scanning', jsFiles.length, 'JS and', htmlFiles.length, 'HTML files\n');

// ---------- 1. dangerous JS sinks ----------
const jsAll = jsFiles.map(read).join('\n');
ok('no eval()', !/[^.\w]eval\s*\(/.test(jsAll));
ok('no new Function()', !/\bnew\s+Function\s*\(/.test(jsAll));
ok('no document.write', !/document\.write/.test(jsAll));
ok('no string-argument setTimeout/setInterval', !/set(Timeout|Interval)\s*\(\s*['"`]/.test(jsAll));
ok('no .outerHTML assignment', !/\.outerHTML\s*=/.test(jsAll));
ok('no insertAdjacentHTML', !/insertAdjacentHTML/.test(jsAll));
// network egress: only the local-model connector may talk to the network, and
// only to 127.0.0.1. The exemption is by EXACT path (not basename) so a rogue
// second "local-llm.js" elsewhere would still be caught by the global check.
const EGRESS_PAT = /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon|new\s+Image\s*\(|\bimport\s*\(/;
const CONNECTOR_PATH = path.join(WEB, 'assets', 'local-llm.js');
const connectorCopies = jsFiles.filter((f) => path.basename(f) === 'local-llm.js');
ok('exactly one local-llm.js, at assets/', connectorCopies.length === 1 && connectorCopies[0] === CONNECTOR_PATH);
const jsNoConnector = jsFiles.filter((f) => f !== CONNECTOR_PATH).map(read).join('\n');
ok('no network egress outside assets/local-llm.js (fetch/XHR/WS/SSE/beacon/Image/import)',
  !EGRESS_PAT.test(jsNoConnector));
const conn = read(CONNECTOR_PATH);
ok('local-llm.js: BASE pinned to 127.0.0.1 and assigned exactly once',
  /var BASE = 'http:\/\/127\.0\.0\.1:\d+'/.test(conn) && (conn.match(/\bBASE\s*=/g) || []).length === 1);
ok('local-llm.js: PORTAL pinned to 127.0.0.1 and assigned exactly once',
  /var PORTAL = 'http:\/\/127\.0\.0\.1:\d+'/.test(conn) && (conn.match(/\bPORTAL\s*=/g) || []).length === 1);
ok('local-llm.js: ADVISOR pinned to 127.0.0.1 and assigned exactly once',
  /var ADVISOR = 'http:\/\/127\.0\.0\.1:\d+'/.test(conn) && (conn.match(/\bADVISOR\s*=/g) || []).length === 1);
ok('local-llm.js: API pinned to 127.0.0.1 and assigned exactly once',
  /var API = 'http:\/\/127\.0\.0\.1:\d+'/.test(conn) && (conn.match(/\bAPI\s*=/g) || []).length === 1);
const fetches = conn.match(/\bfetch\s*\(/g) || [];
const pinnedFetches = conn.match(/\bfetch\s*\(\s*(BASE|PORTAL|ADVISOR|API)\s*\+/g) || [];
ok('local-llm.js: every fetch() targets BASE, PORTAL, ADVISOR or API (' + pinnedFetches.length + '/' + fetches.length + ')',
  fetches.length > 0 && fetches.length === pinnedFetches.length);
ok('local-llm.js: no other URL literals besides 127.0.0.1', !/https?:\/\/(?!127\.0\.0\.1)/.test(conn));
ok('local-llm.js: no XHR/WebSocket/EventSource/beacon/Image/dynamic-import',
  !/XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon|new\s+Image\s*\(|\bimport\s*\(/.test(conn));
ok('local-llm.js: no innerHTML use', !/innerHTML/.test(conn));

// ---------- 2. HTML resource surface ----------
for (const f of htmlFiles) {
  const h = read(f);
  const remoteSrc = /(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.test(h);
  ok(rel(f) + ': no remote src/href (scripts/styles/images are local)', !remoteSrc);
  ok(rel(f) + ': no javascript: URLs', !/["'\s]javascript:/i.test(h));
  ok(rel(f) + ': no target=_blank without rel=noopener',
     !/target\s*=\s*["']_blank["'](?![^>]*rel\s*=\s*["'][^"']*noopener)/i.test(h));
  ok(rel(f) + ': loads base.css', /assets\/base\.css/.test(h));
}

// ---------- 3. no hardcoded real secrets ----------
// (The masked placeholder "sk-local-****3a9f" in the demo UI is not a real key.)
const secretPat = /(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-(?!local-)[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})/;
ok('no hardcoded API keys / private keys / tokens', !secretPat.test(jsAll + htmlFiles.map(read).join('\n')));

// ---------- 4. unit-test the REAL esc() from chat.js ----------
const chat = read(path.join(WEB, 'assets', 'chat.js'));
const escSrc = (chat.match(/function esc\(s\)\s*\{[\s\S]*?\}/) || [])[0];
ok('esc() present in chat.js', !!escSrc);
if (escSrc) {
  const esc = vm.runInNewContext('(' + escSrc + ')');
  const payloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "'><svg/onload=alert(1)>",
    '</b><iframe src=javascript:alert(1)>',
    '`"&<>'
  ];
  for (const p of payloads) {
    const e = esc(p);
    ok('esc neutralizes "<" in: ' + JSON.stringify(p), !e.includes('<'));
    ok('esc neutralizes ">" in: ' + JSON.stringify(p), !e.includes('>'));
    ok('esc neutralizes double-quote in: ' + JSON.stringify(p), !e.includes('"'));
    ok('esc neutralizes single-quote in: ' + JSON.stringify(p), !e.includes("'"));
  }
  // & must be entity-encoded (no bare & that could start an unintended entity/attr)
  ok('esc encodes & (no bare ampersand)', !/&(?!(amp|lt|quot|gt|#));?/.test(esc('a & b <c> "d"')) || esc('&') === '&amp;');
}

// ---------- 5. user input never reaches raw innerHTML ----------
ok('chat.js escapes user text before innerHTML (esc(en)/esc(zh))',
   /esc\(en\)/.test(chat) && /esc\(zh\)/.test(chat));
ok('chat.js renders message text via textContent (not innerHTML)',
   /\.textContent\s*=/.test(chat));
ok('chat.js typed input is passed to ask() (escaped downstream)',
   /ask\(v,\s*v\)/.test(chat));

// ---------- 6. build.js: free-text need box value is not read into generated output ----------
// (build.js may WRITE a prefill into the box, but must never READ its value into
//  the installer / manifest / cloud manual — that value is attacker-controllable text.)
const build = read(path.join(WEB, 'assets', 'build.js'));
const chainedRead = /getElementById\(\s*['"]needText['"]\s*\)\s*\.value/.test(build); // getElementById('needText').value
const boxValueRead = /\bbox\.value\b(?!\s*=[^=])/.test(build);                       // box.value used as a read (not "box.value = ")
ok('build.js never reads the free-text need box value into generation (write-only prefill)',
   !chainedRead && !boxValueRead);

// ---------- 7. i18n stores only a language code ----------
const i18n = read(path.join(WEB, 'assets', 'i18n.js'));
ok("i18n localStorage stores only the 'bma-lang' code",
   /setItem\(\s*['"]bma-lang['"]\s*,\s*lang\s*\)/.test(i18n));

// ---------- summary ----------
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
