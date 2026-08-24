#!/usr/bin/env python3
"""Backend API tests — boots the real server on an ephemeral port and speaks
real HTTP. Zero dependencies (unittest + urllib). Includes the privacy
red-line cases from docs/19 §4: free text and unknown fields must be rejected.

Run: python3 backend/tests/api.test.py
"""
import json
import os
import socket
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'api'))
# isolate the dbs BEFORE importing the server module
_TMP = tempfile.mkdtemp(prefix='bma-test-')
os.environ['BMA_DB'] = os.path.join(_TMP, 'events.db')
os.environ['BMA_USERS_DB'] = os.path.join(_TMP, 'users.db')
import server  # noqa: E402


def call(port, path, body=None, method=None, origin=None):
    """Returns (status, json, headers) without raising on 4xx."""
    url = 'http://127.0.0.1:%d%s' % (port, path)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ('POST' if data else 'GET'))
    req.add_header('Content-Type', 'application/json')
    if origin:
        req.add_header('Origin', origin)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b'{}'), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}'), dict(e.headers)


def db_count(table):
    import sqlite3
    con = sqlite3.connect(os.environ['BMA_DB'])
    n = con.execute('SELECT COUNT(*) FROM %s' % table).fetchone()[0]
    con.close()
    return n


def start_fake_llm(reply):
    """Minimal OpenAI-compatible /v1/chat/completions stub on an ephemeral port."""
    class H(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers.get('Content-Length', 0) or 0))
            body = json.dumps({'choices': [{'message': {'content': reply}}]}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    httpd = ThreadingHTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


HW = {'gpu': 'nvidia', 'vram_gb': 12, 'ram_gb': 32}


class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.create_server(port=0)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    # ---- health & registry ----
    def test_health(self):
        s, j, _ = call(self.port, '/v1/health')
        self.assertEqual((s, j['ok']), (200, True))

    def test_registry_filters_by_vram(self):
        s, j, _ = call(self.port, '/v1/registry/models?vram=12')
        ids = [m['id'] for m in j['models']]
        self.assertEqual(s, 200)
        self.assertIn('qwen2.5-14b-instruct', ids)
        self.assertNotIn('qwen2.5-32b-instruct', ids)
        self.assertEqual(j['recommended'], 'qwen2.5-14b-instruct')

    def test_registry_rejects_bad_vram(self):
        s, j, _ = call(self.port, '/v1/registry/models?vram=abc')
        self.assertEqual(s, 400)

    def test_registry_data_file_schema(self):
        # the intake bar for new models: every entry complete and well-typed
        models = server.load_registry()['models']
        self.assertTrue(models)
        ids = [m['id'] for m in models]
        self.assertEqual(len(ids), len(set(ids)), 'duplicate model id')
        for m in models:
            for field, typ in (('id', str), ('name', str), ('quant', str), ('file', str),
                               ('repo', str), ('size_gb', (int, float)), ('vram_min_gb', int),
                               ('license', str), ('quality', int), ('speed', int)):
                self.assertIn(field, m, m.get('id'))
                self.assertIsInstance(m[field], typ, '%s.%s' % (m.get('id'), field))
            self.assertGreater(m['vram_min_gb'], 0)
            self.assertGreater(m['size_gb'], 0)
            self.assertTrue(m['license'], '%s: license must be recorded' % m['id'])
            self.assertTrue(server._short_id(m['id']), '%s: id must be shape-safe' % m['id'])

    # ---- advise: rule tiers mirror frontend pickModel ----
    def test_advise_tiers(self):
        for vram, expect in ((24, '32b'), (12, '14b'), (8, '8b')):
            s, j, _ = call(self.port, '/v1/advise',
                           {'hardware': {'gpu': 'nvidia', 'vram_gb': vram, 'ram_gb': 32}})
            self.assertEqual(s, 200)
            self.assertIn(expect, j['model']['id'])
            self.assertEqual(j['mode'], 'local')

    def test_advise_no_gpu_goes_cloud_big_tier(self):
        s, j, _ = call(self.port, '/v1/advise', {'hardware': {'gpu': 'none', 'ram_gb': 16}})
        self.assertEqual((s, j['mode']), (200, 'cloud'))
        self.assertIn('32b', j['model']['id'])

    def test_advise_classifies_need_text(self):
        cases = (('Please review our supplier contracts for risky clauses', 'legal'),
                 ('客服 FAQ 自动回答', 'support'),
                 ('ask questions about my excel sales data', 'data'),
                 ('summarize research papers with sources', 'research'),
                 ('polish and rewrite my emails', 'writing'),
                 ('an AI for my company documents', 'company'))
        for text, slug in cases:
            s, j, _ = call(self.port, '/v1/advise', {'need_text': text, 'hardware': HW})
            self.assertEqual((s, j['template']), (200, slug), text)

    def test_advise_writing_disables_rag_and_template_overrides_text(self):
        s, j, _ = call(self.port, '/v1/advise',
                       {'need_text': 'review contracts', 'template': 'writing', 'hardware': HW})
        self.assertEqual((s, j['template'], j['rag']), (200, 'writing', False))

    def test_advise_never_echoes_or_stores_need_text(self):
        before = db_count('telemetry') + db_count('feedback')
        s, j, _ = call(self.port, '/v1/advise',
                       {'need_text': 'SECRET-MARKER-123 contracts', 'hardware': HW})
        self.assertEqual(s, 200)
        self.assertNotIn('SECRET-MARKER-123', json.dumps(j))
        self.assertEqual(before, db_count('telemetry') + db_count('feedback'))
        with open(os.environ['BMA_DB'], 'rb') as f:
            self.assertNotIn(b'SECRET-MARKER-123', f.read())

    def test_advise_rejects_document_sized_text(self):
        s, j, _ = call(self.port, '/v1/advise', {'need_text': 'x' * 501, 'hardware': HW})
        self.assertEqual(s, 400)

    def test_advise_advisor_field(self):
        s, j, _ = call(self.port, '/v1/advise', {'template': 'legal', 'hardware': HW})
        self.assertEqual((s, j['advisor']), (200, 'client'))
        s, j, _ = call(self.port, '/v1/advise', {'need_text': 'review contracts', 'hardware': HW})
        self.assertEqual((s, j['advisor']), (200, 'rules'))

    # ---- advise: opt-in local LLM classifier (BMA_ADVISOR_LLM) ----
    def _with_llm(self, url):
        os.environ['BMA_ADVISOR_LLM'] = url
        self.addCleanup(os.environ.pop, 'BMA_ADVISOR_LLM', None)

    def test_advise_llm_classifies(self):
        llm = start_fake_llm(' Legal.\n')  # slug survives whitespace/case/punctuation
        self.addCleanup(llm.shutdown)
        self._with_llm('http://127.0.0.1:%d' % llm.server_address[1])
        s, j, _ = call(self.port, '/v1/advise', {'need_text': 'polish my emails', 'hardware': HW})
        self.assertEqual((s, j['template'], j['advisor']), (200, 'legal', 'llm'))

    def test_advise_llm_garbage_falls_back_to_rules(self):
        llm = start_fake_llm('I would say this is about contracts')
        self.addCleanup(llm.shutdown)
        self._with_llm('http://127.0.0.1:%d' % llm.server_address[1])
        s, j, _ = call(self.port, '/v1/advise', {'need_text': 'polish my emails', 'hardware': HW})
        self.assertEqual((s, j['template'], j['advisor']), (200, 'writing', 'rules'))

    def test_advise_llm_down_falls_back_to_rules(self):
        s0 = socket.socket()
        s0.bind(('127.0.0.1', 0))
        dead = s0.getsockname()[1]
        s0.close()
        self._with_llm('http://127.0.0.1:%d' % dead)
        s, j, _ = call(self.port, '/v1/advise', {'need_text': 'polish my emails', 'hardware': HW})
        self.assertEqual((s, j['template'], j['advisor']), (200, 'writing', 'rules'))

    def test_advise_llm_non_loopback_url_ignored(self):
        # the red line: need_text may only ever be sent to this machine
        self._with_llm('http://evil.example.com:8080')
        s, j, _ = call(self.port, '/v1/advise', {'need_text': 'polish my emails', 'hardware': HW})
        self.assertEqual((s, j['template'], j['advisor']), (200, 'writing', 'rules'))

    def test_advise_llm_need_text_still_never_stored(self):
        llm = start_fake_llm('legal')
        self.addCleanup(llm.shutdown)
        self._with_llm('http://127.0.0.1:%d' % llm.server_address[1])
        s, j, _ = call(self.port, '/v1/advise',
                       {'need_text': 'SECRET-MARKER-456 contracts', 'hardware': HW})
        self.assertEqual((s, j['advisor']), (200, 'llm'))
        self.assertNotIn('SECRET-MARKER-456', json.dumps(j))
        with open(os.environ['BMA_DB'], 'rb') as f:
            self.assertNotIn(b'SECRET-MARKER-456', f.read())

    # ---- license ----
    def test_license_roundtrip(self):
        key = server.mint_license('pro')
        s, j, _ = call(self.port, '/v1/license/verify',
                       {'license_key': key, 'device_fingerprint': 'abc123def456'})
        self.assertEqual((s, j['valid'], j['tier']), (200, True, 'pro'))
        self.assertGreater(j['grace_until'], 0)

    def test_license_tampered_and_garbage(self):
        key = server.mint_license('business')
        bad = key[:-1] + ('0' if key[-1] != '0' else '1')
        for k in (bad, 'BMA-PRO-zzz', '', 'x' * 64):
            s, j, _ = call(self.port, '/v1/license/verify',
                           {'license_key': k, 'device_fingerprint': 'abc123def456'})
            self.assertEqual((s, j['valid']), (200, False), k)

    # ---- privacy red lines: schema whitelist ----
    def test_telemetry_accepts_whitelisted(self):
        s, j, _ = call(self.port, '/v1/telemetry/deploy', {
            'template': 'company', 'model': 'qwen2.5-14b-instruct', 'os': 'win11',
            'gpu': 'nvidia', 'vram_gb': 12, 'ram_gb': 32, 'mode': 'local',
            'success': True, 'duration_s': 1200})
        self.assertEqual((s, j['ok']), (200, True))
        self.assertEqual(db_count('telemetry'), 1)

    def test_telemetry_stage_field(self):
        base = {'template': 'legal', 'model': 'qwen2.5-14b-instruct', 'os': 'win11',
                'gpu': 'nvidia', 'vram_gb': 12, 'ram_gb': 32, 'mode': 'hybrid', 'success': True}
        s, j, _ = call(self.port, '/v1/telemetry/deploy', dict(base, stage='plan_generated'))
        self.assertEqual((s, j['ok']), (200, True))
        import sqlite3
        con = sqlite3.connect(os.environ['BMA_DB'])
        stages = [r[0] for r in con.execute('SELECT stage FROM telemetry').fetchall()]
        con.close()
        self.assertIn('plan_generated', stages)
        s, j, _ = call(self.port, '/v1/telemetry/deploy', dict(base, stage='whatever'))
        self.assertEqual((s, j['error']), (400, 'invalid_field:stage'))

    def test_telemetry_rejects_unknown_and_freetext_fields(self):
        base = {'template': 'company', 'model': 'qwen2.5-14b-instruct', 'os': 'win11',
                'gpu': 'nvidia', 'vram_gb': 12, 'ram_gb': 32, 'mode': 'local', 'success': True}
        for mutation, want in ((dict(base, note='my secret docs'), 'unknown_field:note'),
                               (dict(base, error_code='C:/Users/me/file.pdf'), 'invalid_field:error_code'),
                               (dict(base, model='something free-form here'), 'invalid_field:model'),
                               ({k: v for k, v in base.items() if k != 'success'}, 'missing_field:success')):
            s, j, _ = call(self.port, '/v1/telemetry/deploy', mutation)
            self.assertEqual((s, j['error']), (400, want))

    def test_feedback_rejects_content(self):
        # any shape-limited model id is fine (chat may run models outside the registry)
        for model in ('llama-3.1-8b-instruct', 'Qwen2.5-7B-Instruct'):
            s, j, _ = call(self.port, '/v1/feedback',
                           {'rating': 'up', 'template': 'company', 'model': model})
            self.assertEqual(s, 200, model)
        # but free text can't hide in any field
        for bad, want in (({'rating': 'up', 'template': 'company',
                            'model': 'llama-3.1-8b-instruct', 'comment': 'the answer said...'},
                           'unknown_field:comment'),
                          ({'rating': 'up', 'template': 'company',
                            'model': 'my secret file notes'}, 'invalid_field:model')):
            s, j, _ = call(self.port, '/v1/feedback', bad)
            self.assertEqual((s, j['error']), (400, want))

    # ---- auth: real users table, identity kept out of events.db ----
    def _call_auth(self, path, body=None, token=None, method=None):
        url = 'http://127.0.0.1:%d%s' % (self.port, path)
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data,
                                     method=method or ('POST' if data is not None else 'GET'))
        req.add_header('Content-Type', 'application/json')
        if token:
            req.add_header('Authorization', 'Bearer ' + token)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}')

    def test_auth_signup_login_me_logout_roundtrip(self):
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Ada Lovelace', 'email': 'Ada@Example.com',
            'password': 'correct-horse-9', 'plan': 'pro'})
        self.assertEqual((s, j['ok']), (200, True))
        self.assertRegex(j['token'], r'^[0-9a-f]{48}$')
        self.assertEqual(j['user'], {'name': 'Ada Lovelace', 'email': 'ada@example.com',
                                     'plan': 'pro'})
        s, j = self._call_auth('/v1/auth/me', token=j['token'])
        self.assertEqual((s, j['user']['email']), (200, 'ada@example.com'))

        s, j = self._call_auth('/v1/auth/login',
                               {'email': 'ADA@example.com', 'password': 'correct-horse-9'})
        self.assertEqual((s, j['ok']), (200, True))
        token = j['token']
        s, _ = self._call_auth('/v1/auth/logout', {}, token=token)
        self.assertEqual(s, 200)
        s, j = self._call_auth('/v1/auth/me', token=token)
        self.assertEqual((s, j['error']), (401, 'not_logged_in'))

    def test_auth_duplicate_email_conflict(self):
        body = {'name': 'A', 'email': 'dup@example.com', 'password': 'longenough1'}
        s, _ = self._call_auth('/v1/auth/signup', body)
        self.assertEqual(s, 200)
        s, j = self._call_auth('/v1/auth/signup', dict(body, email='DUP@example.com'))
        self.assertEqual((s, j['error']), (409, 'email_taken'))

    def test_auth_bad_credentials(self):
        self._call_auth('/v1/auth/signup', {'name': 'B', 'email': 'b@example.com',
                                            'password': 'right-password'})
        for email, pw in (('b@example.com', 'wrong-password'),
                          ('nobody@example.com', 'right-password')):
            s, j = self._call_auth('/v1/auth/login', {'email': email, 'password': pw})
            self.assertEqual((s, j['error']), (401, 'bad_credentials'), email)
        s, j = self._call_auth('/v1/auth/me', token='0' * 48)
        self.assertEqual(s, 401)

    def test_auth_rejects_bad_shapes(self):
        base = {'name': 'C', 'email': 'c@example.com', 'password': 'longenough1'}
        for mutation, want in ((dict(base, password='short'), 'invalid_field:password'),
                               (dict(base, email='not-an-email'), 'invalid_field:email'),
                               (dict(base, name='line\nbreak'), 'invalid_field:name'),
                               (dict(base, bio='free text about me'), 'unknown_field:bio'),
                               (dict(base, plan='enterprise'), 'invalid_field:plan')):
            s, j = self._call_auth('/v1/auth/signup', mutation)
            self.assertEqual((s, j['error']), (400, want))

    def test_auth_secrets_never_stored_and_events_db_untouched(self):
        before = db_count('telemetry') + db_count('feedback')
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Secret Keeper', 'email': 'keeper@example.com',
            'password': 'PLAINTEXT-MARKER-789'})
        self.assertEqual(s, 200)
        with open(os.environ['BMA_USERS_DB'], 'rb') as f:
            blob = f.read()
        self.assertNotIn(b'PLAINTEXT-MARKER-789', blob)      # password only as PBKDF2
        self.assertNotIn(j['token'].encode(), blob)          # session stores sha256(token)
        self.assertEqual(before, db_count('telemetry') + db_count('feedback'))
        with open(os.environ['BMA_DB'], 'rb') as f:
            self.assertNotIn(b'keeper@example.com', f.read())  # identity never in events.db

    # ---- transport hardening ----
    def test_cors_localhost_only(self):
        _, _, h = call(self.port, '/v1/health', origin='http://localhost:8931')
        self.assertEqual(h.get('Access-Control-Allow-Origin'), 'http://localhost:8931')
        _, _, h = call(self.port, '/v1/health', origin='https://evil.example.com')
        self.assertIsNone(h.get('Access-Control-Allow-Origin'))

    def test_oversized_body_rejected(self):
        s, j, _ = call(self.port, '/v1/advise',
                       {'need_text': 'x' * 400, 'hardware': HW, 'pad': 'y' * 20000})
        self.assertEqual(s, 413)

    def test_bad_json_rejected(self):
        req = urllib.request.Request('http://127.0.0.1:%d/v1/advise' % self.port,
                                     data=b'{not json', method='POST')
        try:
            urllib.request.urlopen(req)
            self.fail('expected 400')
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)

    def test_unknown_route_404(self):
        s, _, _ = call(self.port, '/v1/nope', {'a': 1})
        self.assertEqual(s, 404)


if __name__ == '__main__':
    unittest.main(verbosity=2)
