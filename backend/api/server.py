#!/usr/bin/env python3
"""Build My AI — backend API v0 (the P2/P3 skeleton from backend/README.md).

Zero-dependency: Python 3 stdlib only (http.server, sqlite3, hmac) — same
philosophy as the frontend (no package manager, runs anywhere, easy to audit).

Endpoints (drafts from the plan, minimal but real):
  GET  /v1/health                     liveness
  GET  /v1/registry/models[?vram=N]   model registry (data file, not hardcoded)
  POST /v1/advise                     need + hardware -> recommended plan
  POST /v1/license/verify             HMAC-signed key -> {valid, tier, grace_until}
  POST /v1/telemetry/deploy           anonymous deploy stats (schema-whitelisted)
  POST /v1/feedback                   up/down aggregate (no content, ever)
  POST /v1/auth/signup                create account -> session token
  POST /v1/auth/login                 email + password -> session token
  POST /v1/auth/logout                invalidate the presented session token
  GET  /v1/auth/me                    Bearer token -> {name, email, plan}

Identity vs telemetry stay in SEPARATE databases: users/sessions live in
data/users.db, anonymous events in data/events.db — so the "telemetry is
anonymous" claim stays auditable at the file level. Passwords are stored
as PBKDF2-HMAC-SHA256 (per-user salt); sessions store only the sha256 of
the token, so neither secret exists in the database.

Privacy red lines (docs/19 §4), enforced in code and by backend/tests:
  - every POST body is validated against a strict field whitelist; unknown
    fields and free-text-shaped values are rejected with 400
  - /v1/advise processes need_text in memory only: never logged, never stored,
    never echoed back
  - nothing in this service ever accepts document content, chat content,
    filenames or directory structures

Run:   python3 backend/api/server.py [--port 8940] [--host 127.0.0.1]
Mint:  python3 backend/api/server.py --mint pro   (demo license for testing)
Env:   BMA_LICENSE_SECRET (default dev secret; binding a non-loopback --host
       with the default secret refuses to start — anyone could mint licenses),
       BMA_DB (sqlite path), BMA_DEBUG,
       BMA_RATE_AUTH / BMA_RATE_EVENTS ('requests/seconds' per client IP,
       defaults 30/60 and 120/60 — login runs 100k PBKDF2 rounds, telemetry
       and feedback write to disk anonymously; both need a brute-force lid),
       BMA_ADVISOR_LLM (opt-in: loopback URL of an OpenAI-compatible LLM, e.g.
       http://127.0.0.1:8080 — upgrades /v1/advise classification from keyword
       rules to the local model; non-loopback URLs are ignored, failures fall
       back to rules)
"""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
REGISTRY_PATH = os.path.join(ROOT, 'registry.json')
DB_PATH = os.environ.get('BMA_DB', os.path.join(ROOT, 'data', 'events.db'))
USERS_DB = os.environ.get('BMA_USERS_DB', os.path.join(ROOT, 'data', 'users.db'))
DEFAULT_SECRET = 'dev-secret-change-me'  # fine on loopback, fatal on a public bind
LICENSE_SECRET = os.environ.get('BMA_LICENSE_SECRET', DEFAULT_SECRET)
PBKDF2_ITERS = 100000            # stdlib-only password hashing
SESSION_DAYS = 30
GRACE_HOURS = 72                 # offline grace: never lock out a user who is offline
MAX_BODY = 16 * 1024             # nothing legitimate is bigger than this
MAX_NEED_TEXT = 500              # one sentence, not a document
LLM_TIMEOUT_S = 4                # advisor LLM is local; anything slower falls back to rules

# BMA_ADVISOR_LLM may only point at this machine: need_text never leaves it
LOOPBACK_URL = re.compile(r'^https?://(localhost|127\.0\.0\.1)(:\d+)?/?$')

# browser calls come only from our own dev/demo origins
ALLOWED_ORIGIN = re.compile(r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$')

TEMPLATES = ('company', 'legal', 'writing', 'research', 'support', 'data')
MODES = ('local', 'cloud', 'hybrid')


# ---------- registry (a data file, not hardcoded — docs/09 M2-2) ----------

def load_registry():
    with open(REGISTRY_PATH, encoding='utf-8') as f:
        return json.load(f)


def pick_model(models, vram_gb):
    """Largest model whose vram_min_gb fits; smallest as the floor fallback."""
    fitting = [m for m in models if m['vram_min_gb'] <= vram_gb]
    pool = fitting or models
    return max(pool, key=lambda m: m['vram_min_gb']) if fitting else min(pool, key=lambda m: m['vram_min_gb'])


# ---------- advisor (keyword rules; local LLM upgrade is opt-in via BMA_ADVISOR_LLM) ----------

KEYWORDS = (
    ('legal',    ('contract', 'legal', 'clause', 'lawyer', 'agreement', 'compliance',
                  '合同', '法务', '条款', '法律', '协议', '合规')),
    ('support',  ('support', 'customer', 'faq', 'ticket', 'helpdesk',
                  '客服', '工单', '售后')),
    ('data',     ('spreadsheet', 'excel', 'csv', 'analytics', 'dashboard', 'sales data',
                  '表格', '数据分析', '报表')),
    ('research', ('paper', 'research', 'study', 'literature', 'report',
                  '论文', '研究', '文献', '报告')),
    ('writing',  ('write', 'writing', 'draft', 'polish', 'rewrite', 'copy',
                  '写作', '起草', '润色', '改写', '文案')),
)


def classify(need_text):
    low = (need_text or '').lower()
    for slug, words in KEYWORDS:
        if any(w in low for w in words):
            return slug
    return 'company'


def classify_llm(need_text):
    """Template slug from the local LLM (llm-lab :8080, OpenAI-compatible), or
    None so the caller falls back to keyword rules. The need_text red line
    holds: BMA_ADVISOR_LLM must be a loopback URL (checked before any request,
    so the text never leaves this machine), and the reply is clamped to the
    TEMPLATES enum — a prompt-injected need_text can at worst mispick a slug."""
    url = os.environ.get('BMA_ADVISOR_LLM', '')
    if not url or not LOOPBACK_URL.match(url):
        return None
    payload = json.dumps({
        'messages': [
            {'role': 'system',
             'content': 'Classify the user need into exactly one word from this list: '
                        + ', '.join(TEMPLATES) + '. Reply with that single word only.'},
            {'role': 'user', 'content': need_text},
        ],
        'temperature': 0, 'max_tokens': 8, 'stream': False,
    }).encode()
    req = urllib.request.Request(url.rstrip('/') + '/v1/chat/completions', data=payload,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT_S) as r:
            reply = json.loads(r.read())['choices'][0]['message']['content']
    except Exception:
        return None
    word = (reply or '').strip().strip('."\'`').lower()
    return word if word in TEMPLATES else None


def advise(body, models):
    hw = body['hardware']
    gpu = hw['gpu']
    vram = 8 if gpu == 'none' else hw.get('vram_gb', 8)
    template = body.get('template')
    advisor = 'client'                      # caller already classified (docs/16 §8 path)
    if not template:
        need = body.get('need_text')
        template = classify_llm(need) if need else None
        advisor = 'llm' if template else 'rules'
        template = template or classify(need)
    mode = body.get('mode') or ('cloud' if gpu == 'none' else 'local')
    model = pick_model(models, 24 if mode == 'cloud' else vram)  # cloud gets the big tier
    rag = template != 'writing'   # doc-grounded templates get RAG; writing works from style samples
    why_en = ('Cloud tier: no dedicated GPU on this machine.' if gpu == 'none'
              else 'Largest model that fits in %d GB of VRAM.' % vram)
    why_zh = ('云端档位:这台电脑没有独立显卡。' if gpu == 'none'
              else '在 %d GB 显存内能装下的最大模型。' % vram)
    return {'template': template, 'mode': mode, 'rag': rag, 'model': model,
            'advisor': advisor, 'why': {'en': why_en, 'zh': why_zh}}


# ---------- license (HMAC-signed, stateless, offline grace) ----------

def mint_license(tier, secret=None):
    token = secrets.token_hex(6)
    sig = _license_sig(tier.upper(), token, secret)
    return 'BMA-%s-%s-%s' % (tier.upper(), token, sig)


def _license_sig(tier, token, secret=None):
    key = (secret or LICENSE_SECRET).encode()
    return hmac.new(key, ('%s:%s' % (tier, token)).encode(), hashlib.sha256).hexdigest()[:12]


def verify_license(license_key, secret=None):
    m = re.match(r'^BMA-(PRO|BUSINESS)-([0-9a-f]{12})-([0-9a-f]{12})$', license_key or '')
    if not m:
        return None
    tier, token, sig = m.groups()
    return tier.lower() if hmac.compare_digest(sig, _license_sig(tier, token, secret)) else None


# ---------- auth (self-built P2: users + sessions in their own database) ----------

def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    return salt, hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ITERS)


def _token_hash(token):
    # sessions store only this digest: a leaked users.db can't impersonate anyone
    return hashlib.sha256(token.encode()).hexdigest()


def users_con():
    return sqlite3.connect(USERS_DB)


def init_users_db(path=None):
    path = path or USERS_DB
    os.makedirs(os.path.dirname(path), exist_ok=True)
    con = sqlite3.connect(path)
    con.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, ts INTEGER, name TEXT, email TEXT UNIQUE,
        company TEXT, plan TEXT, pw_salt BLOB, pw_hash BLOB)''')
    con.execute('''CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER, ts INTEGER, expires INTEGER)''')
    con.commit()
    con.close()


def create_session(con, user_id):
    token = secrets.token_hex(24)
    now = int(time.time())
    con.execute('INSERT INTO sessions (token_hash, user_id, ts, expires) VALUES (?,?,?,?)',
                (_token_hash(token), user_id, now, now + SESSION_DAYS * 86400))
    return token


def session_user(con, token):
    """token -> (id, name, email, plan) or None (unknown / expired)."""
    if not token:
        return None
    row = con.execute(
        'SELECT u.id, u.name, u.email, u.plan FROM sessions s JOIN users u ON u.id = s.user_id '
        'WHERE s.token_hash = ? AND s.expires > ?',
        (_token_hash(token), int(time.time()))).fetchone()
    return row


# ---------- schema whitelist (the privacy red line, executable) ----------

def _enum(*vals):
    return lambda v: v in vals


def _int(lo, hi):
    return lambda v: isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi


def _bool(v):
    return isinstance(v, bool)


def _short_id(v):  # identifiers only — shape-limited so free text can't hide here
    return isinstance(v, str) and re.match(r'^[A-Za-z0-9.\-]{4,64}$', v) is not None


def _need_text(v):
    return isinstance(v, str) and 0 < len(v) <= MAX_NEED_TEXT


MODEL_IDS = tuple(m['id'] for m in load_registry()['models'])

TELEMETRY_SCHEMA = {
    # keeps wizard plan-stats separate from real installer results in the flywheel
    'stage':      (False, _enum('plan_generated', 'install')),
    'template':   (True,  _enum(*TEMPLATES)),
    'model':      (True,  _enum(*MODEL_IDS)),
    'os':         (True,  _enum('win10', 'win11', 'mac')),
    'gpu':        (True,  _enum('nvidia', 'none')),
    'vram_gb':    (True,  _int(0, 256)),
    'ram_gb':     (True,  _int(0, 1024)),
    'mode':       (True,  _enum(*MODES)),
    'success':    (True,  _bool),
    'duration_s': (False, _int(0, 86400)),
    'error_code': (False, _enum('gpu_check_failed', 'download_failed', 'runtime_failed', 'other')),
}

FEEDBACK_SCHEMA = {
    'rating':   (True, _enum('up', 'down')),
    'template': (True, _enum(*TEMPLATES)),
    # shape-limited id, not an enum: chat feedback may name any local model the
    # user runs (e.g. Qwen2.5-7B-Instruct); the pattern still shuts out free text
    'model':    (True, _short_id),
}

LICENSE_SCHEMA = {
    'license_key':        (True, lambda v: isinstance(v, str) and len(v) <= 64),
    'device_fingerprint': (True, _short_id),
}

HARDWARE_SCHEMA = {
    'gpu':     (True,  _enum('nvidia', 'none')),
    'vram_gb': (False, _int(0, 256)),
    'ram_gb':  (False, _int(0, 1024)),
}

ADVISE_SCHEMA = {
    'need_text': (False, _need_text),
    'template':  (False, _enum(*TEMPLATES)),
    'mode':      (False, _enum(*MODES)),
    'hardware':  (True,  lambda v: isinstance(v, dict)),
}


def _email_shape(v):
    return isinstance(v, str) and len(v) <= 254 and re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v) is not None


def _identity_name(v):  # identity field (users.db, never events.db): capped, single line
    return isinstance(v, str) and 0 < len(v.strip()) <= 80 and re.search(r'[\r\n\t]', v) is None


def _password_shape(v):
    return isinstance(v, str) and 8 <= len(v) <= 128


SIGNUP_SCHEMA = {
    'name':     (True,  _identity_name),
    'email':    (True,  _email_shape),
    'password': (True,  _password_shape),
    'company':  (False, _identity_name),
    'plan':     (False, _enum('free', 'pro', 'business')),
}

LOGIN_SCHEMA = {
    'email':    (True, _email_shape),
    'password': (True, _password_shape),
}


def validate(body, schema):
    """Strict whitelist: unknown key, missing required or bad value -> error name."""
    if not isinstance(body, dict):
        return 'body_not_object'
    for k in body:
        if k not in schema:
            return 'unknown_field:%s' % k
    for k, (required, check) in schema.items():
        if k not in body:
            if required:
                return 'missing_field:%s' % k
            continue
        if not check(body[k]):
            return 'invalid_field:%s' % k
    return None


# ---------- storage (aggregates only — see red lines above) ----------

def init_db(path=DB_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    con = sqlite3.connect(path)
    con.execute('''CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY, ts INTEGER, stage TEXT, template TEXT, model TEXT, os TEXT,
        gpu TEXT, vram_gb INTEGER, ram_gb INTEGER, mode TEXT, success INTEGER,
        duration_s INTEGER, error_code TEXT)''')
    try:  # migrate pre-stage databases
        con.execute('ALTER TABLE telemetry ADD COLUMN stage TEXT')
    except sqlite3.OperationalError:
        pass
    con.execute('''CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY, ts INTEGER, rating TEXT, template TEXT, model TEXT)''')
    con.commit()
    con.close()


def insert(table, cols, vals, path=DB_PATH):
    con = sqlite3.connect(path)
    con.execute('INSERT INTO %s (%s) VALUES (%s)' % (table, ','.join(cols), ','.join('?' * len(vals))), vals)
    con.commit()
    con.close()


# ---------- rate limiting (P0-16: PBKDF2 CPU + anonymous-write disk are DoS faces) ----------

RATE_BUCKETS = {  # only endpoints that burn CPU (auth) or write unauthenticated (events)
    '/v1/auth/signup': 'auth', '/v1/auth/login': 'auth', '/v1/auth/logout': 'auth',
    '/v1/telemetry/deploy': 'events', '/v1/feedback': 'events',
}
RATE_DEFAULTS = {'auth': '30/60', 'events': '120/60'}
_RATE = {}                       # (bucket, ip) -> [window_start, count]
_RATE_LOCK = threading.Lock()


def rate_limited(bucket, ip):
    """Fixed-window counter per (bucket, client IP). Limits come from
    BMA_RATE_AUTH / BMA_RATE_EVENTS as 'requests/seconds' (read per call so
    tests and operators can tune without restarting)."""
    spec = os.environ.get('BMA_RATE_' + bucket.upper(), RATE_DEFAULTS[bucket])
    limit, window = (int(x) for x in spec.split('/'))
    now = time.time()
    with _RATE_LOCK:
        if len(_RATE) > 4096:    # bound memory: drop windows that already expired
            for k in [k for k, v in _RATE.items() if now - v[0] >= window]:
                del _RATE[k]
        slot = _RATE.get((bucket, ip))
        if not slot or now - slot[0] >= window:
            _RATE[(bucket, ip)] = [now, 1]
            return False
        slot[1] += 1
        return slot[1] > limit


# ---------- HTTP ----------

class Api(BaseHTTPRequestHandler):
    server_version = 'BuildMyAI-API/0.1'
    timeout = 10                 # slowloris lid: stalled sockets drop, threads free up

    # -- plumbing --
    def _cors(self):
        origin = self.headers.get('Origin', '')
        if ALLOWED_ORIGIN.match(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    def _json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            n = int(self.headers.get('Content-Length', 0) or 0)
        except ValueError:
            n = -1               # non-numeric header falls through to the same 400
        if n < 0:                # a negative read() would swallow the socket till EOF
            self._json(400, {'error': 'bad_content_length'})
            return None
        if n > MAX_BODY:
            self._json(413, {'error': 'body_too_large'})
            return None
        try:
            return json.loads(self.rfile.read(n) or b'{}')
        except (ValueError, UnicodeDecodeError):
            self._json(400, {'error': 'bad_json'})
            return None

    def log_message(self, fmt, *args):
        # never log request bodies (need_text privacy); path-only line in debug mode
        if os.environ.get('BMA_DEBUG'):
            super().log_message(fmt, *args)

    # -- routes --
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path, _, query = self.path.partition('?')
        if path == '/v1/health':
            return self._json(200, {'ok': True, 'service': 'buildmyai-api', 'version': '0.1'})
        if path == '/v1/registry/models':
            models = load_registry()['models']
            params = dict(p.split('=', 1) for p in query.split('&') if '=' in p)
            vram = params.get('vram')
            if vram is not None:
                if not vram.isdigit():
                    return self._json(400, {'error': 'invalid_field:vram'})
                models = [m for m in models if m['vram_min_gb'] <= int(vram)]
            return self._json(200, {'models': models,
                                    'recommended': models[0]['id'] if models else None})
        if path == '/v1/auth/me':
            return self._auth_me()
        return self._json(404, {'error': 'not_found'})

    def do_POST(self):
        handlers = {
            '/v1/advise': self._advise,
            '/v1/license/verify': self._license,
            '/v1/telemetry/deploy': self._telemetry,
            '/v1/feedback': self._feedback,
            '/v1/auth/signup': self._auth_signup,
            '/v1/auth/login': self._auth_login,
            '/v1/auth/logout': self._auth_logout,
        }
        h = handlers.get(self.path)
        if not h:
            return self._json(404, {'error': 'not_found'})
        bucket = RATE_BUCKETS.get(self.path)
        if bucket and rate_limited(bucket, self.client_address[0]):
            return self._json(429, {'error': 'rate_limited'})
        body = self._body()
        if body is None:
            return
        return h(body)

    def _advise(self, body):
        err = validate(body, ADVISE_SCHEMA)
        if not err:
            err = validate(body['hardware'], HARDWARE_SCHEMA)
        if err:
            return self._json(400, {'error': err})
        # need_text lives and dies inside this call: not logged, not stored, not echoed
        return self._json(200, advise(body, load_registry()['models']))

    def _license(self, body):
        err = validate(body, LICENSE_SCHEMA)
        if err:
            return self._json(400, {'error': err})
        tier = verify_license(body['license_key'])
        if not tier:
            return self._json(200, {'valid': False})
        return self._json(200, {'valid': True, 'tier': tier,
                                'grace_until': int(time.time()) + GRACE_HOURS * 3600})

    def _telemetry(self, body):
        err = validate(body, TELEMETRY_SCHEMA)
        if err:
            return self._json(400, {'error': err})
        insert('telemetry',
               ('ts', 'stage', 'template', 'model', 'os', 'gpu', 'vram_gb', 'ram_gb', 'mode',
                'success', 'duration_s', 'error_code'),
               (int(time.time()), body.get('stage', 'install'), body['template'], body['model'],
                body['os'], body['gpu'], body['vram_gb'], body['ram_gb'], body['mode'],
                int(body['success']), body.get('duration_s'), body.get('error_code')))
        return self._json(200, {'ok': True})

    def _feedback(self, body):
        err = validate(body, FEEDBACK_SCHEMA)
        if err:
            return self._json(400, {'error': err})
        insert('feedback', ('ts', 'rating', 'template', 'model'),
               (int(time.time()), body['rating'], body['template'], body['model']))
        return self._json(200, {'ok': True})

    # -- auth (users.db only; nothing here ever touches events.db) --
    def _bearer(self):
        m = re.match(r'^Bearer\s+([0-9a-f]{48})$', self.headers.get('Authorization', '') or '')
        return m.group(1) if m else None

    def _auth_signup(self, body):
        err = validate(body, SIGNUP_SCHEMA)
        if err:
            return self._json(400, {'error': err})
        email = body['email'].strip().lower()
        salt, pw = hash_password(body['password'])
        con = users_con()
        try:
            cur = con.execute(
                'INSERT INTO users (ts, name, email, company, plan, pw_salt, pw_hash) '
                'VALUES (?,?,?,?,?,?,?)',
                (int(time.time()), body['name'].strip(), email,
                 (body.get('company') or '').strip() or None,
                 body.get('plan', 'free'), salt, pw))
            token = create_session(con, cur.lastrowid)
            con.commit()
        except sqlite3.IntegrityError:
            return self._json(409, {'error': 'email_taken'})
        finally:
            con.close()
        return self._json(200, {'ok': True, 'token': token,
                                'user': {'name': body['name'].strip(), 'email': email,
                                         'plan': body.get('plan', 'free')}})

    def _auth_login(self, body):
        err = validate(body, LOGIN_SCHEMA)
        if err:
            return self._json(400, {'error': err})
        email = body['email'].strip().lower()
        con = users_con()
        try:
            row = con.execute(
                'SELECT id, name, plan, pw_salt, pw_hash FROM users WHERE email = ?',
                (email,)).fetchone()
            # unknown email still runs the hash: same timing, same error either way
            salt = row[3] if row else b'\x00' * 16
            _, pw = hash_password(body['password'], salt)
            if not row or not hmac.compare_digest(pw, row[4]):
                return self._json(401, {'error': 'bad_credentials'})
            token = create_session(con, row[0])
            con.commit()
        finally:
            con.close()
        return self._json(200, {'ok': True, 'token': token,
                                'user': {'name': row[1], 'email': email, 'plan': row[2]}})

    def _auth_logout(self, body):
        token = self._bearer()
        if not token:
            return self._json(401, {'error': 'no_token'})
        con = users_con()
        try:
            con.execute('DELETE FROM sessions WHERE token_hash = ?', (_token_hash(token),))
            con.commit()
        finally:
            con.close()
        return self._json(200, {'ok': True})

    def _auth_me(self):
        con = users_con()
        try:
            row = session_user(con, self._bearer())
        finally:
            con.close()
        if not row:
            return self._json(401, {'error': 'not_logged_in'})
        return self._json(200, {'ok': True,
                                'user': {'name': row[1], 'email': row[2], 'plan': row[3]}})


def create_server(port=8940, host='127.0.0.1'):
    if host not in ('127.0.0.1', 'localhost', '::1') and LICENSE_SECRET == DEFAULT_SECRET:
        # P0-17 fail-closed: with the shipped secret anyone could mint pro licenses,
        # so a public bind must prove a real secret was injected — before any socket opens
        raise SystemExit('refusing to bind %s with the default BMA_LICENSE_SECRET — '
                         'inject a real secret first' % host)
    init_db()
    init_users_db()
    return ThreadingHTTPServer((host, port), Api)


def main():
    ap = argparse.ArgumentParser(description='Build My AI backend API v0')
    ap.add_argument('--port', type=int, default=8940)
    ap.add_argument('--host', default='127.0.0.1',
                    help='bind address (default loopback; non-loopback requires '
                         'a non-default BMA_LICENSE_SECRET and a TLS reverse proxy in front)')
    ap.add_argument('--mint', metavar='TIER', choices=['pro', 'business'],
                    help='print a demo license key and exit')
    args = ap.parse_args()
    if args.mint:
        print(mint_license(args.mint))
        return
    httpd = create_server(args.port, args.host)
    llm = os.environ.get('BMA_ADVISOR_LLM', '')
    if llm and not LOOPBACK_URL.match(llm):
        print('BMA_ADVISOR_LLM ignored (not loopback) — need_text never leaves this machine')
        llm = ''
    print('buildmyai-api v0 on http://%s:%d  (db: %s, advisor: %s)'
          % (args.host, args.port, DB_PATH, llm or 'rules'))
    httpd.serve_forever()


if __name__ == '__main__':
    main()
