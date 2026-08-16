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

Privacy red lines (docs/19 §4), enforced in code and by backend/tests:
  - every POST body is validated against a strict field whitelist; unknown
    fields and free-text-shaped values are rejected with 400
  - /v1/advise processes need_text in memory only: never logged, never stored,
    never echoed back
  - nothing in this service ever accepts document content, chat content,
    filenames or directory structures

Run:   python3 backend/api/server.py [--port 8940]
Mint:  python3 backend/api/server.py --mint pro   (demo license for testing)
Env:   BMA_LICENSE_SECRET (default dev secret), BMA_DB (sqlite path), BMA_DEBUG
"""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
REGISTRY_PATH = os.path.join(ROOT, 'registry.json')
DB_PATH = os.environ.get('BMA_DB', os.path.join(ROOT, 'data', 'events.db'))
LICENSE_SECRET = os.environ.get('BMA_LICENSE_SECRET', 'dev-secret-change-me')
GRACE_HOURS = 72                 # offline grace: never lock out a user who is offline
MAX_BODY = 16 * 1024             # nothing legitimate is bigger than this
MAX_NEED_TEXT = 500              # one sentence, not a document

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


# ---------- advisor (rule version; an LLM can replace classify() later) ----------

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


def advise(body, models):
    hw = body['hardware']
    gpu = hw['gpu']
    vram = 8 if gpu == 'none' else hw.get('vram_gb', 8)
    template = body.get('template') or classify(body.get('need_text'))
    mode = body.get('mode') or ('cloud' if gpu == 'none' else 'local')
    model = pick_model(models, 24 if mode == 'cloud' else vram)  # cloud gets the big tier
    rag = template != 'writing'   # doc-grounded templates get RAG; writing works from style samples
    why_en = ('Cloud tier: no dedicated GPU on this machine.' if gpu == 'none'
              else 'Largest model that fits in %d GB of VRAM.' % vram)
    why_zh = ('云端档位:这台电脑没有独立显卡。' if gpu == 'none'
              else '在 %d GB 显存内能装下的最大模型。' % vram)
    return {'template': template, 'mode': mode, 'rag': rag, 'model': model,
            'why': {'en': why_en, 'zh': why_zh}}


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
    'model':    (True, _enum(*MODEL_IDS)),
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
        id INTEGER PRIMARY KEY, ts INTEGER, template TEXT, model TEXT, os TEXT,
        gpu TEXT, vram_gb INTEGER, ram_gb INTEGER, mode TEXT, success INTEGER,
        duration_s INTEGER, error_code TEXT)''')
    con.execute('''CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY, ts INTEGER, rating TEXT, template TEXT, model TEXT)''')
    con.commit()
    con.close()


def insert(table, cols, vals, path=DB_PATH):
    con = sqlite3.connect(path)
    con.execute('INSERT INTO %s (%s) VALUES (%s)' % (table, ','.join(cols), ','.join('?' * len(vals))), vals)
    con.commit()
    con.close()


# ---------- HTTP ----------

class Api(BaseHTTPRequestHandler):
    server_version = 'BuildMyAI-API/0.1'

    # -- plumbing --
    def _cors(self):
        origin = self.headers.get('Origin', '')
        if ALLOWED_ORIGIN.match(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
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
        n = int(self.headers.get('Content-Length', 0) or 0)
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
        return self._json(404, {'error': 'not_found'})

    def do_POST(self):
        handlers = {
            '/v1/advise': self._advise,
            '/v1/license/verify': self._license,
            '/v1/telemetry/deploy': self._telemetry,
            '/v1/feedback': self._feedback,
        }
        h = handlers.get(self.path)
        if not h:
            return self._json(404, {'error': 'not_found'})
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
               ('ts', 'template', 'model', 'os', 'gpu', 'vram_gb', 'ram_gb', 'mode',
                'success', 'duration_s', 'error_code'),
               (int(time.time()), body['template'], body['model'], body['os'], body['gpu'],
                body['vram_gb'], body['ram_gb'], body['mode'], int(body['success']),
                body.get('duration_s'), body.get('error_code')))
        return self._json(200, {'ok': True})

    def _feedback(self, body):
        err = validate(body, FEEDBACK_SCHEMA)
        if err:
            return self._json(400, {'error': err})
        insert('feedback', ('ts', 'rating', 'template', 'model'),
               (int(time.time()), body['rating'], body['template'], body['model']))
        return self._json(200, {'ok': True})


def create_server(port=8940, host='127.0.0.1'):
    init_db()
    return ThreadingHTTPServer((host, port), Api)


def main():
    ap = argparse.ArgumentParser(description='Build My AI backend API v0')
    ap.add_argument('--port', type=int, default=8940)
    ap.add_argument('--mint', metavar='TIER', choices=['pro', 'business'],
                    help='print a demo license key and exit')
    args = ap.parse_args()
    if args.mint:
        print(mint_license(args.mint))
        return
    httpd = create_server(args.port)
    print('buildmyai-api v0 on http://127.0.0.1:%d  (db: %s)' % (args.port, DB_PATH))
    httpd.serve_forever()


if __name__ == '__main__':
    main()
