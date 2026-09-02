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
ok('local-llm.js: OLLAMA pinned to 127.0.0.1 and assigned exactly once',
  /var OLLAMA = 'http:\/\/127\.0\.0\.1:11434'/.test(conn) && (conn.match(/\bOLLAMA\s*=/g) || []).length === 1);
// P0-13 same-origin topology (docs/22): API may be EITHER the local loopback
// literal (page served from localhost — dev/demo) OR the empty string (deployed
// page — every call stays same-origin via the reverse proxy). The conditional
// is locked to this exact shape so no third host is ever constructible.
ok('local-llm.js: LOCAL_PAGE predicate tests location.hostname against localhost/127.0.0.1 only',
  /var LOCAL_PAGE = \/\^\(localhost\|127\\\.0\\\.0\\\.1\)\$\/\.test\(location\.hostname\);/.test(conn)
  && (conn.match(/\bLOCAL_PAGE\s*=/g) || []).length === 1);
ok('local-llm.js: API is loopback (local page) or same-origin \'\' (deployed), assigned exactly once',
  /var API = LOCAL_PAGE \? 'http:\/\/127\.0\.0\.1:\d+' : '';/.test(conn)
  && (conn.match(/\bAPI\s*=/g) || []).length === 1);
const fetches = conn.match(/\bfetch\s*\(/g) || [];
const pinnedFetches = conn.match(/\bfetch\s*\(\s*(BASE|PORTAL|ADVISOR|OLLAMA|API)\s*\+/g) || [];
ok('local-llm.js: every fetch() targets BASE, PORTAL, ADVISOR, OLLAMA or API (' + pinnedFetches.length + '/' + fetches.length + ')',
  fetches.length > 0 && fetches.length === pinnedFetches.length);
ok('local-llm.js: no other URL literals besides 127.0.0.1', !/https?:\/\/(?!127\.0\.0\.1)/.test(conn));
ok('local-llm.js: no XHR/WebSocket/EventSource/beacon/Image/dynamic-import',
  !/XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon|new\s+Image\s*\(|\bimport\s*\(/.test(conn));
ok('local-llm.js: no innerHTML use', !/innerHTML/.test(conn));

// telemetry/feedback are OPT-IN (privacy.html promises this): both senders must
// gate on the consent check BEFORE the fetch, so nothing anonymous leaves the
// machine without the user opting in.
ok('local-llm.js: reportPlan gates /v1/telemetry/deploy on consented()',
  /function reportPlan[\s\S]*?consented\(\)[\s\S]*?\/v1\/telemetry\/deploy/.test(conn));
ok('local-llm.js: chat-feedback gates /v1/feedback on consented()',
  /chat-feedback[\s\S]*?consented\(\)[\s\S]*?\/v1\/feedback/.test(conn));

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

// ---------- 2b. i18n bilingual parity ----------
// Every visible string must carry BOTH languages: an element with data-en needs
// data-zh (and vice-versa), and the same for placeholder (-ph) and aria-label
// (-al) pairs. A one-sided attribute is a defect — this locks the invariant so a
// half-translated element fails here instead of shipping.
for (const f of htmlFiles) {
  const h = read(f);
  const tags = h.match(/<[^>]*\bdata-(?:en|zh)(?:-ph|-al)?\b[^>]*>/g) || [];
  let bad = 0;
  for (const tag of tags) {
    const pairs = [['data-en', 'data-zh'], ['data-en-ph', 'data-zh-ph'], ['data-en-al', 'data-zh-al']];
    for (const [en, zh] of pairs) {
      const hasEn = new RegExp('\\b' + en + '\\b(?![-\\w])').test(tag);
      const hasZh = new RegExp('\\b' + zh + '\\b(?![-\\w])').test(tag);
      if (hasEn !== hasZh) { bad++; }
    }
  }
  ok(rel(f) + ': i18n data-en/zh (+ -ph/-al) attributes are always bilingual', bad === 0);
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

// ---------- 8. build.js MODELS/pickModel ↔ backend registry.json stay in sync ----------
// (registry.json's own note: it mirrors the wizard's MODELS table — this is the
//  executable version of that reminder, so editing one side alone fails here.
//  pickModel itself is executed in a sandbox against the need→model matrix so
//  frontend and backend keep the SAME need-aware selection rule.)
const registry = JSON.parse(fs.readFileSync(path.join(WEB, '..', 'backend', 'api', 'registry.json'), 'utf8'));
const byId = {};
for (const m of registry.models) byId[m.id] = m;
const modelsSrc = (build.match(/var MODELS = \[[\s\S]*?\n  \];/) || [''])[0];
const pickSrc = (build.match(/var NEED_BONUS[\s\S]*?function pickModel[\s\S]*?\n  \}/) || [''])[0];
let MODELS = [];
try { MODELS = vm.runInNewContext(modelsSrc + ' MODELS;'); } catch (e) { /* fails the count check */ }
ok('build.js MODELS parsed and entry count matches registry (' + MODELS.length + '/' + registry.models.length + ')',
   MODELS.length > 0 && MODELS.length === registry.models.length);
for (const m of MODELS) {
  const want = byId[m.id] || {};
  ok('registry in sync with build.js MODELS entry ' + m.id,
     want.file === m.file && want.repo === m.repo && want.quant === m.quant &&
     want.name === m.name && want.vram_min_gb === m.vram &&
     want.quality === m.quality && want.speed === m.speed &&
     want.ollama === m.ollama &&
     JSON.stringify(want.best_for) === JSON.stringify(m.best_for) &&
     Math.abs(parseFloat((m.size || '').replace(/[^\d.]/g, '')) - want.size_gb) < 0.05);
}
ok('build.js MODELS ordered largest-first (floor fallback relies on it)',
   MODELS.every((m, i) => i === 0 || MODELS[i - 1].vram >= m.vram));
// the need→model matrix: mirrored by backend test_advise_matches_template_to_model
const MATRIX = [
  [24, 'legal', 'qwen2.5-32b-instruct'],
  [24, 'writing', 'qwen2.5-32b-instruct'],
  [12, 'data', 'qwen2.5-14b-instruct'],
  [12, 'writing', 'llama-3.1-8b-instruct'],
  [12, 'support', 'qwen2.5-7b-instruct'],
  [8, 'support', 'qwen2.5-7b-instruct'],
  [8, 'data', 'qwen2.5-7b-instruct'],
  [8, 'company', 'llama-3.1-8b-instruct'],
  [6, 'company', 'mistral-7b-instruct-v0.3'],
];
let pick = null;
try { pick = vm.runInNewContext(modelsSrc + pickSrc + '; pickModel'); } catch (e) { /* fails below */ }
for (const [vram, need, want] of MATRIX) {
  let got = null;
  try { got = pick(String(vram), need).id; } catch (e) { /* fails below */ }
  ok('pickModel need-aware matrix: ' + need + '@' + vram + 'GB -> ' + want, got === want);
}

// ---------- 8b. generated install artifacts are REAL and content-safe ----------
// The old PowerShell demo installer is retired for good: its bug class (PS 5.1
// parameter traps behind -EncodedCommand) must not come back.
ok('build.js contains no PowerShell installer machinery (retired demo, docs/22 P0-6)',
   !/Invoke-WebRequest|EncodedCommand|powershell(\.exe)?\s+-/i.test(build));
// Execute the real builders and assert on the actual artifact text.
const buildersSrc = (build.match(/function isLlama[\s\S]*?function ollamaGuide[\s\S]*?\n  \}/) || [''])[0];
let art = null;
try {
  art = vm.runInNewContext('(function(){' + modelsSrc + buildersSrc +
    '; return MODELS.map(function(m){ return {id: m.id, ollama: m.ollama, bat: ollamaInstaller(m), guide: ollamaGuide(m)}; });})()');
} catch (e) { /* fails below */ }
ok('ollama builders execute and cover every model (' + (art ? art.length : 0) + '/' + registry.models.length + ')',
   Array.isArray(art) && art.length === registry.models.length);
const HOST_OK = /^(https?:\/\/)(ollama\.com|www\.nvidia\.com|www\.llama\.com|localhost(:\d+)?)([/?]|$)/;
for (const a of art || []) {
  ok('installer pulls the exact pinned tag for ' + a.id,
     a.bat.indexOf('ollama pull ' + a.ollama) >= 0 && a.guide.indexOf(a.ollama) >= 0);
  const urls = (a.bat + '\n' + a.guide).match(/https?:\/\/[^\s"')`]+/g) || [];
  ok('artifact URLs for ' + a.id + ' stay on the official whitelist (' + urls.length + ' urls)',
     urls.length > 0 && urls.every((u) => HOST_OK.test(u)));
  const isLl = a.ollama.indexOf('llama') === 0;
  ok('Llama license notice ' + (isLl ? 'present' : 'absent') + ' for ' + a.id + ' (docs/22 P0-10)',
     isLl === (a.bat.indexOf('Built with Llama') >= 0) &&
     isLl === (a.guide.indexOf('Llama 3.1 Community License') >= 0));
}

// P0-10 WEBSITE LAYER: the plan/download UI (not just the generated files) must
// surface "Built with Llama" + the license link for Llama-family models.
const uiNoticeSrc = (build.match(/function llamaNoticeHtml[\s\S]*?\n  \}/) || [''])[0];
let uiNotice = null;
try {
  uiNotice = vm.runInNewContext('(function(){ var t=function(en,zh){return en;};' + modelsSrc +
    ' function isLlama(m){ return m.ollama.indexOf("llama") === 0; }' + uiNoticeSrc +
    '; return MODELS.map(function(m){ return {id: m.id, ollama: m.ollama, html: llamaNoticeHtml(m)}; });})()');
} catch (e) { /* fails below */ }
ok('UI llamaNoticeHtml executes and covers every model (' + (uiNotice ? uiNotice.length : 0) + '/' + registry.models.length + ')',
   Array.isArray(uiNotice) && uiNotice.length === registry.models.length);
for (const u of uiNotice || []) {
  const isLl = u.ollama.indexOf('llama') === 0;
  ok('UI "Built with Llama" notice ' + (isLl ? 'present' : 'absent') + ' for ' + u.id + ' (P0-10 site layer)',
     isLl === (u.html.indexOf('Built with Llama') >= 0) &&
     isLl === (u.html.indexOf('llama.com/llama3_1/license') >= 0));
}

// ---------- 8c. batch-2 installer contract: manifest schema + pinned runtime ----------
// docs/24 groundwork. Two invariants, same guardrail spirit as §8/§8b:
//  (1) the wizard's install-plan.json (installManifest) matches the shared
//      manifest.schema.json the desktop installer will consume — no drift.
//  (2) the runtime decision (llama.cpp, digest-pinned, official source) is
//      recorded as data and never ships a fabricated digest.
function validateJson(val, spec) {
  const types = Array.isArray(spec.type) ? spec.type : [spec.type];
  const t = val === null ? 'null' : (Array.isArray(val) ? 'array' : typeof val);
  if (types.indexOf(t) < 0) return false;
  if (spec.enum && spec.enum.indexOf(val) < 0) return false;
  if (spec.type === 'object' && spec.properties) {
    for (const r of (spec.required || [])) if (!(r in val)) return false;
    for (const k in spec.properties) if (k in val && !validateJson(val[k], spec.properties[k])) return false;
  }
  return true;
}

const manifestSchema = JSON.parse(fs.readFileSync(path.join(WEB, '..', 'installer', 'manifest.schema.json'), 'utf8'));
const manifestSrc = (build.match(/function installManifest[\s\S]*?\n  \}/) || [''])[0];
for (const mode of ['local', 'cloud']) {
  let mans = null;
  try {
    mans = vm.runInNewContext('(function(){' + modelsSrc +
      ' var STATE={need:"company",needText:"",os:"win11",gpu:"nvidia",vram:"12",ram:"32",mode:"' + mode + '"};' +
      manifestSrc +
      '; return MODELS.map(function(m){ return {id:m.id, obj: JSON.parse(installManifest({model:m, rag:true}))}; });})()');
  } catch (e) { /* fails below */ }
  ok('installManifest executes for every model in ' + mode + ' mode (' + (mans ? mans.length : 0) + '/' + registry.models.length + ')',
     Array.isArray(mans) && mans.length === registry.models.length);
  for (const mm of mans || [])
    ok('install-plan.json conforms to manifest.schema.json — ' + mm.id + ' (' + mode + ')', validateJson(mm.obj, manifestSchema));
}

const runtime = JSON.parse(fs.readFileSync(path.join(WEB, '..', 'installer', 'runtime.json'), 'utf8'));
ok('installer runtime engine is llama.cpp (batch-2 decision, docs/24)', runtime.engine === 'llama.cpp');
ok('installer runtime is digest-pinned to an official ggml-org image',
   !!runtime.pin && runtime.pin.mechanism === 'digest' && /ggml-org\/llama\.cpp/.test(runtime.pin.image || ''));
const RT_HOST_OK = /^https:\/\/(github\.com|ghcr\.io)\/ggml-org\/llama\.cpp/;
ok('installer runtime sources stay on the official whitelist (' + (runtime.official_sources || []).length + ')',
   Array.isArray(runtime.official_sources) && runtime.official_sources.length > 0 && runtime.official_sources.every((u) => RT_HOST_OK.test(u)));
ok('installer runtime never ships a fabricated digest (null until measured at build)',
   runtime.pin.digest === null ? (typeof runtime.pin.digest_status === 'string' && runtime.pin.digest_status.length > 0)
                               : /^sha256:[0-9a-f]{64}$/.test(runtime.pin.digest));

// ---------- 8d. batch-2 model-artifact fetch policy (direct GGUF pull) ----------
// The llama.cpp installer pulls GGUF weights straight from Hugging Face — a
// different fetch path than today's `ollama pull` (§8b). Lock it: HF-only host,
// mandatory sha256, resolve/main/<file> shape, safe re-run.
const fetchPolicy = JSON.parse(fs.readFileSync(path.join(WEB, '..', 'installer', 'fetch-policy.json'), 'utf8'));
const ma = fetchPolicy.model_artifacts;
ok('fetch-policy allows only huggingface.co for model artifacts',
   Array.isArray(ma.allowed_hosts) && ma.allowed_hosts.length === 1 && ma.allowed_hosts[0] === 'huggingface.co');
ok('fetch-policy requires sha256 integrity on every model download',
   !!ma.integrity && ma.integrity.required === true && ma.integrity.algorithm === 'sha256' &&
   typeof ma.integrity.digest_status === 'string' && ma.integrity.digest_status.length > 0);
ok('fetch-policy url_template resolves to an allowed host', /^https:\/\/huggingface\.co\//.test(ma.url_template));
ok('fetch-policy retry is idempotent + resumable (safe re-run)',
   !!fetchPolicy.retry && fetchPolicy.retry.idempotent === true && fetchPolicy.retry.resume === true);

let fetchMans = null;
try {
  fetchMans = vm.runInNewContext('(function(){' + modelsSrc +
    ' var STATE={need:"company",needText:"",os:"win11",gpu:"nvidia",vram:"12",ram:"32",mode:"local"};' +
    manifestSrc +
    '; return MODELS.map(function(m){ return {id:m.id, obj: JSON.parse(installManifest({model:m, rag:true}))}; });})()');
} catch (e) { /* fails below */ }
ok('manifests available for fetch-URL derivation (' + (fetchMans ? fetchMans.length : 0) + '/' + registry.models.length + ')',
   Array.isArray(fetchMans) && fetchMans.length === registry.models.length);
const GGUF_URL_OK = /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/main\/[^/]+\.gguf$/i;
for (const fm of fetchMans || []) {
  const url = ma.url_template
    .replace('{repo}', fm.obj.plan.source.replace(/^huggingface\.co\//, ''))
    .replace('{file}', fm.obj.plan.model_file);
  ok('GGUF download URL stays on the whitelisted host + resolve/main form — ' + fm.id,
     GGUF_URL_OK.test(url) && ma.allowed_hosts.indexOf(url.split('/')[2]) >= 0);
}

// ---------- summary ----------
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
