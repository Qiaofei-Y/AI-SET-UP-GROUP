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
# the suite makes many auth-bucket calls in one window; the rate-limit tests
# override this with tiny windows and clean up after themselves
os.environ['BMA_RATE_AUTH'] = '300/60'
# dev mailer: keep its stdout echo out of the test output (OUTBOX is still populated)
os.environ['BMA_MAIL_QUIET'] = '1'
# structured request logging is on by default in prod; mute it so it doesn't
# interleave with the test runner's own output (log_record is unit-tested directly)
os.environ['BMA_LOG'] = '0'
import server  # noqa: E402


def outbox_token_for(email, prefix):
    """Pull the most recent one-time link token the dev mailer captured for a
    recipient. `prefix` is the page the link points at (reset-password / verify-email)."""
    import re
    for entry in reversed(server.mailer.OUTBOX):
        if entry['to'] == email and prefix in entry['text']:
            m = re.search(prefix + r'\?token=([0-9a-f]{48})', entry['text'])
            if m:
                return m.group(1)
    return None


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
            self.assertTrue(m.get('best_for'), '%s: best_for must be recorded' % m['id'])
            self.assertTrue(set(m['best_for']) <= set(server.TEMPLATES),
                            '%s: best_for must use template slugs' % m['id'])
            # guided-installer tag: full quant pin, never a re-pointable short tag
            self.assertRegex(m.get('ollama', ''), r'^[a-z0-9.]+:[a-z0-9.\-]+-q\d[a-zA-Z0-9_]*$',
                             '%s: ollama must be a full pinned quant tag' % m['id'])
        # every template has at least one specialist somewhere in the registry
        covered = set(t for m in models for t in m['best_for'])
        self.assertEqual(covered, set(server.TEMPLATES))

    # ---- advise: rule tiers mirror frontend pickModel ----
    def test_advise_tiers(self):
        for vram, expect in ((24, '32b'), (12, '14b'), (8, '8b')):
            s, j, _ = call(self.port, '/v1/advise',
                           {'hardware': {'gpu': 'nvidia', 'vram_gb': vram, 'ram_gb': 32}})
            self.assertEqual(s, 200)
            self.assertIn(expect, j['model']['id'])
            self.assertEqual(j['mode'], 'local')

    def test_advise_matches_template_to_model(self):
        # need-aware pick: in-tier specialists win, a much bigger generalist still takes over
        cases = ((24, 'legal', 'qwen2.5-32b-instruct'),
                 (24, 'writing', 'qwen2.5-32b-instruct'),   # top tier: generalist out-scores the bonus
                 (12, 'data', 'qwen2.5-14b-instruct'),
                 (12, 'writing', 'llama-3.1-8b-instruct'),  # specialist beats the bigger generalist
                 (12, 'support', 'qwen2.5-7b-instruct'),
                 (8, 'support', 'qwen2.5-7b-instruct'),
                 (8, 'data', 'qwen2.5-7b-instruct'),
                 (8, 'company', 'llama-3.1-8b-instruct'),
                 (6, 'company', 'mistral-7b-instruct-v0.3'))
        for vram, template, expect in cases:
            s, j, _ = call(self.port, '/v1/advise',
                           {'template': template,
                            'hardware': {'gpu': 'nvidia', 'vram_gb': vram, 'ram_gb': 32}})
            self.assertEqual((s, j['model']['id']), (200, expect), '%s@%dGB' % (template, vram))

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

    def test_telemetry_install_method_field(self):
        base = {'template': 'company', 'model': 'qwen2.5-14b-instruct', 'os': 'win11',
                'gpu': 'nvidia', 'vram_gb': 12, 'ram_gb': 32, 'mode': 'local', 'success': True,
                'stage': 'plan_generated'}
        s, j, _ = call(self.port, '/v1/telemetry/deploy', dict(base, install_method='ollama_guided'))
        self.assertEqual((s, j['ok']), (200, True))
        s, j, _ = call(self.port, '/v1/telemetry/deploy', dict(base, install_method='sneaky free text'))
        self.assertEqual((s, j['error']), (400, 'invalid_field:install_method'))

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
            'password': 'correct-horse-9', 'plan': 'pro', 'accept_tos': True})
        self.assertEqual((s, j['ok']), (200, True))
        self.assertRegex(j['token'], r'^[0-9a-f]{48}$')
        # P0-3: the requested plan never becomes the actual plan at signup;
        # P0-15: a fresh account starts unverified until the emailed link is clicked
        self.assertEqual(j['user'], {'name': 'Ada Lovelace', 'email': 'ada@example.com',
                                     'plan': 'free', 'email_verified': False})
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

    def test_auth_plan_is_server_authoritative(self):
        # P0-3: client-reported plan lands as intent only; entitlements start free
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Plan Probe', 'email': 'planprobe@example.com',
            'password': 'longenough1', 'plan': 'business', 'accept_tos': True})
        self.assertEqual((s, j['user']['plan']), (200, 'free'))
        import sqlite3
        con = sqlite3.connect(os.environ['BMA_USERS_DB'])
        row = con.execute('SELECT plan, plan_intent FROM users WHERE email = ?',
                          ('planprobe@example.com',)).fetchone()
        con.close()
        self.assertEqual(row, ('free', 'business'))
        # the only upgrade path is the server-side set_plan()
        self.assertTrue(server.set_plan('planprobe@example.com', 'pro'))
        s, j = self._call_auth('/v1/auth/login',
                               {'email': 'planprobe@example.com', 'password': 'longenough1'})
        self.assertEqual((s, j['user']['plan']), (200, 'pro'))
        s, j = self._call_auth('/v1/auth/me', token=j['token'])
        self.assertEqual((s, j['user']['plan']), (200, 'pro'))
        # guardrails: unknown user / bogus tier change nothing
        self.assertFalse(server.set_plan('nobody@example.com', 'pro'))
        self.assertFalse(server.set_plan('planprobe@example.com', 'enterprise'))

    def test_account_password_change_revokes_other_sessions(self):
        self._call_auth('/v1/auth/signup', {'name': 'PW', 'email': 'pw@example.com',
                                            'password': 'old-password-1', 'accept_tos': True})
        s, j = self._call_auth('/v1/auth/login', {'email': 'pw@example.com', 'password': 'old-password-1'})
        tok_a = j['token']
        s, j = self._call_auth('/v1/auth/login', {'email': 'pw@example.com', 'password': 'old-password-1'})
        tok_b = j['token']
        # wrong current password -> 403; unauthenticated -> 401
        s, j = self._call_auth('/v1/account/password',
                               {'current_password': 'wrong-password-x', 'new_password': 'new-password-2'},
                               token=tok_a)
        self.assertEqual((s, j['error']), (403, 'bad_credentials'))
        s, _ = self._call_auth('/v1/account/password',
                               {'current_password': 'old-password-1', 'new_password': 'new-password-2'})
        self.assertEqual(s, 401)
        # real change via session A: EVERY pre-change token dies (incl. A's own —
        # a stolen copy must not outlive the password); a fresh token is returned
        s, j = self._call_auth('/v1/account/password',
                               {'current_password': 'old-password-1', 'new_password': 'new-password-2'},
                               token=tok_a)
        self.assertEqual((s, j['ok']), (200, True))
        self.assertGreaterEqual(j['revoked_sessions'], 2)
        self.assertRegex(j['token'], r'^[0-9a-f]{48}$')
        for dead in (tok_a, tok_b):
            s, _ = self._call_auth('/v1/auth/me', token=dead)
            self.assertEqual(s, 401)
        s, _ = self._call_auth('/v1/auth/me', token=j['token'])
        self.assertEqual(s, 200)
        # old password dead, new one works
        s, _ = self._call_auth('/v1/auth/login', {'email': 'pw@example.com', 'password': 'old-password-1'})
        self.assertEqual(s, 401)
        s, _ = self._call_auth('/v1/auth/login', {'email': 'pw@example.com', 'password': 'new-password-2'})
        self.assertEqual(s, 200)

    def test_account_logout_all(self):
        s, j = self._call_auth('/v1/auth/signup', {'name': 'LA', 'email': 'la@example.com',
                                                   'password': 'longenough1', 'accept_tos': True})
        tok_a = j['token']
        s, j = self._call_auth('/v1/auth/login', {'email': 'la@example.com', 'password': 'longenough1'})
        tok_b = j['token']
        # strict whitelist even on an empty-body endpoint
        s, j = self._call_auth('/v1/account/logout-all', {'sneaky': 'field'}, token=tok_a)
        self.assertEqual((s, j['error']), (400, 'unknown_field:sneaky'))
        s, j = self._call_auth('/v1/account/logout-all', {}, token=tok_a)
        self.assertEqual((s, j['ok'], j['revoked_sessions']), (200, True, 2))
        for tok in (tok_a, tok_b):
            s, _ = self._call_auth('/v1/auth/me', token=tok)
            self.assertEqual(s, 401)

    def test_account_export(self):
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Export Me', 'email': 'export@example.com', 'password': 'longenough1',
            'company': 'ACME', 'plan': 'pro', 'accept_tos': True})
        tok = j['token']
        s, _ = self._call_auth('/v1/account/export')
        self.assertEqual(s, 401)
        s, j = self._call_auth('/v1/account/export', token=tok)
        self.assertEqual((s, j['ok']), (200, True))
        u = j['user']
        self.assertEqual((u['email'], u['company'], u['plan'], u['plan_intent'], u['tos_accepted']),
                         ('export@example.com', 'ACME', 'free', 'pro', server.TOS_VERSION))
        self.assertGreater(u['created_ts'], 0)
        self.assertTrue(any(sess['current'] for sess in j['sessions']))
        # security material never leaves: no token hashes, no password fields
        blob = json.dumps(j)
        self.assertNotIn('token_hash', blob)
        self.assertNotIn('pw_', blob)
        self.assertNotIn(server._token_hash(tok), blob)
        self.assertIn('anonymous', j['note'])

    def test_account_delete_erases_at_file_level(self):
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Erase Me Fully', 'email': 'erase-me@example.com',
            'password': 'longenough1', 'accept_tos': True})
        tok = j['token']
        s, j = self._call_auth('/v1/account/delete', {'password': 'wrong-password-x'}, token=tok)
        self.assertEqual((s, j['error']), (403, 'bad_credentials'))
        s, j = self._call_auth('/v1/account/delete', {'password': 'longenough1'}, token=tok)
        self.assertEqual((s, j['deleted']), (200, True))
        # account gone: token dead, login dead
        s, _ = self._call_auth('/v1/auth/me', token=tok)
        self.assertEqual(s, 401)
        s, _ = self._call_auth('/v1/auth/login', {'email': 'erase-me@example.com', 'password': 'longenough1'})
        self.assertEqual(s, 401)
        # file-level erasure: secure_delete + VACUUM leave no trace in the db bytes
        with open(os.environ['BMA_USERS_DB'], 'rb') as f:
            blob = f.read()
        self.assertNotIn(b'erase-me@example.com', blob)
        self.assertNotIn(b'Erase Me Fully', blob)

    def test_auth_duplicate_email_conflict(self):
        body = {'name': 'A', 'email': 'dup@example.com', 'password': 'longenough1', 'accept_tos': True}
        s, _ = self._call_auth('/v1/auth/signup', body)
        self.assertEqual(s, 200)
        s, j = self._call_auth('/v1/auth/signup', dict(body, email='DUP@example.com'))
        self.assertEqual((s, j['error']), (409, 'email_taken'))

    def test_auth_bad_credentials(self):
        self._call_auth('/v1/auth/signup', {'name': 'B', 'email': 'b@example.com',
                                            'password': 'right-password', 'accept_tos': True})
        for email, pw in (('b@example.com', 'wrong-password'),
                          ('nobody@example.com', 'right-password')):
            s, j = self._call_auth('/v1/auth/login', {'email': email, 'password': pw})
            self.assertEqual((s, j['error']), (401, 'bad_credentials'), email)
        s, j = self._call_auth('/v1/auth/me', token='0' * 48)
        self.assertEqual(s, 401)

    def test_auth_rejects_bad_shapes(self):
        base = {'name': 'C', 'email': 'c@example.com', 'password': 'longenough1', 'accept_tos': True}
        for mutation, want in ((dict(base, password='short'), 'invalid_field:password'),
                               (dict(base, email='not-an-email'), 'invalid_field:email'),
                               (dict(base, name='line\nbreak'), 'invalid_field:name'),
                               (dict(base, bio='free text about me'), 'unknown_field:bio'),
                               (dict(base, plan='enterprise'), 'invalid_field:plan'),
                               (dict(base, accept_tos=False), 'invalid_field:accept_tos'),
                               ({k: v for k, v in base.items() if k != 'accept_tos'},
                                'missing_field:accept_tos')):
            s, j = self._call_auth('/v1/auth/signup', mutation)
            self.assertEqual((s, j['error']), (400, want))

    def test_auth_signup_records_tos_acceptance(self):
        # clickwrap record (P0-5): accepted policy version stamped on the user row
        s, _ = self._call_auth('/v1/auth/signup', {
            'name': 'Click Wrap', 'email': 'clickwrap@example.com',
            'password': 'longenough1', 'accept_tos': True})
        self.assertEqual(s, 200)
        import sqlite3
        con = sqlite3.connect(os.environ['BMA_USERS_DB'])
        row = con.execute('SELECT tos, ts FROM users WHERE email = ?',
                          ('clickwrap@example.com',)).fetchone()
        con.close()
        self.assertEqual(row[0], server.TOS_VERSION)
        self.assertGreater(row[1], 0)

    def test_auth_secrets_never_stored_and_events_db_untouched(self):
        before = db_count('telemetry') + db_count('feedback')
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Secret Keeper', 'email': 'keeper@example.com',
            'password': 'PLAINTEXT-MARKER-789', 'accept_tos': True})
        self.assertEqual(s, 200)
        with open(os.environ['BMA_USERS_DB'], 'rb') as f:
            blob = f.read()
        self.assertNotIn(b'PLAINTEXT-MARKER-789', blob)      # password only as PBKDF2
        self.assertNotIn(j['token'].encode(), blob)          # session stores sha256(token)
        self.assertEqual(before, db_count('telemetry') + db_count('feedback'))
        with open(os.environ['BMA_DB'], 'rb') as f:
            self.assertNotIn(b'keeper@example.com', f.read())  # identity never in events.db

    # ---- email: dev mailer + password reset + verification (P0-15) ----
    def test_mailer_dev_backend_uses_outbox(self):
        # no SMTP env in the test env → dev backend, nothing leaves the machine
        self.assertFalse(server.mailer.smtp_configured())
        server.mailer.reset_outbox()
        self.assertTrue(server.mailer.send('sink@example.com', 'Subj', 'Body here'))
        self.assertEqual(server.mailer.OUTBOX[-1],
                         {'to': 'sink@example.com', 'subject': 'Subj', 'text': 'Body here'})

    def test_signup_sends_verification_and_starts_unverified(self):
        server.mailer.reset_outbox()
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Verify Me', 'email': 'verify@example.com',
            'password': 'longenough1', 'accept_tos': True})
        self.assertEqual((s, j['user']['email_verified']), (200, False))
        token = j['token']
        # a verification email was queued with a one-time link token
        vtok = outbox_token_for('verify@example.com', 'verify-email.html')
        self.assertRegex(vtok or '', r'^[0-9a-f]{48}$')
        # me/login reflect the unverified state
        s, j = self._call_auth('/v1/auth/me', token=token)
        self.assertEqual(j['user']['email_verified'], False)
        # verifying flips it, and the token is single-use
        s, j = self._call_auth('/v1/auth/verify', {'token': vtok})
        self.assertEqual((s, j['ok'], j['verified']), (200, True, True))
        s, j = self._call_auth('/v1/auth/me', token=token)
        self.assertEqual(j['user']['email_verified'], True)
        s, j = self._call_auth('/v1/auth/verify', {'token': vtok})   # replay
        self.assertEqual((s, j['error']), (400, 'invalid_token'))

    def test_verify_rejects_bad_token(self):
        for bad, want in (({'token': '0' * 48}, 'invalid_token'),       # well-shaped, unknown
                          ({'token': 'nothex'}, 'invalid_field:token'),  # wrong shape
                          ({'wat': 1}, 'unknown_field:wat')):
            s, j = self._call_auth('/v1/auth/verify', bad)
            self.assertEqual((s, j['error']), (400, want), bad)

    def test_forgot_password_no_account_enumeration(self):
        server.mailer.reset_outbox()
        self._call_auth('/v1/auth/signup', {'name': 'Real', 'email': 'real@example.com',
                                            'password': 'old-password-1', 'accept_tos': True})
        # both a real and an unknown address get the exact same 200 {ok:true}
        for email in ('real@example.com', 'ghost@example.com'):
            s, j = self._call_auth('/v1/auth/forgot', {'email': email})
            self.assertEqual((s, j), (200, {'ok': True}), email)
        # ...but a reset email is only actually sent for the real one
        recipients = [e['to'] for e in server.mailer.OUTBOX
                      if 'reset-password.html' in e['text']]
        self.assertIn('real@example.com', recipients)
        self.assertNotIn('ghost@example.com', recipients)

    def test_forgot_dispatches_email_off_request_thread(self):
        # No enumeration by *timing*: in SMTP mode the token mint + synchronous
        # send (done only for a real account) must not run on the request thread,
        # or a real address would answer measurably slower than an unknown one.
        # Prove it structurally — with the send wedged open, the request still
        # returns promptly, so it isn't inline. Were it inline, this would hang.
        import time
        server.mailer.reset_outbox()
        self._call_auth('/v1/auth/signup', {'name': 'Async', 'email': 'async@example.com',
                                            'password': 'longenough1', 'accept_tos': True})
        release, started = threading.Event(), threading.Event()
        orig_send, orig_cfg = server.send_reset_email, server.mailer.smtp_configured
        server.mailer.smtp_configured = lambda: True          # pretend prod SMTP is on
        def blocking_send(email, token):
            started.set()
            release.wait(5)                                    # hold the "network" send open
        server.send_reset_email = blocking_send
        try:
            t0 = time.time()
            s, j = self._call_auth('/v1/auth/forgot', {'email': 'async@example.com'})
            elapsed = time.time() - t0
            self.assertEqual((s, j), (200, {'ok': True}))
            self.assertTrue(started.wait(2), 'reset email was never dispatched')
            self.assertFalse(release.is_set())                 # send still open on a bg thread
            self.assertLess(elapsed, 3, 'forgot blocked on the email send (timing oracle)')
        finally:
            release.set()
            server.send_reset_email, server.mailer.smtp_configured = orig_send, orig_cfg

    def test_reset_password_flow_and_revokes_sessions(self):
        server.mailer.reset_outbox()
        self._call_auth('/v1/auth/signup', {'name': 'Reset Me', 'email': 'reset@example.com',
                                            'password': 'old-password-1', 'accept_tos': True})
        # an existing session that must die when the password is reset
        s, j = self._call_auth('/v1/auth/login', {'email': 'reset@example.com', 'password': 'old-password-1'})
        old_tok = j['token']
        # request + spend the reset link
        self._call_auth('/v1/auth/forgot', {'email': 'reset@example.com'})
        rtok = outbox_token_for('reset@example.com', 'reset-password.html')
        self.assertRegex(rtok or '', r'^[0-9a-f]{48}$')
        s, j = self._call_auth('/v1/auth/reset', {'token': rtok, 'new_password': 'new-password-2'})
        self.assertEqual((s, j['ok']), (200, True))
        # old session revoked; old password dead; new password works
        s, _ = self._call_auth('/v1/auth/me', token=old_tok)
        self.assertEqual(s, 401)
        s, _ = self._call_auth('/v1/auth/login', {'email': 'reset@example.com', 'password': 'old-password-1'})
        self.assertEqual(s, 401)
        s, j = self._call_auth('/v1/auth/login', {'email': 'reset@example.com', 'password': 'new-password-2'})
        self.assertEqual((s, j['ok']), (200, True))
        # spending the reset link also verified the email (inbox ownership proven)
        self.assertEqual(j['user']['email_verified'], True)
        # the token is single-use
        s, j = self._call_auth('/v1/auth/reset', {'token': rtok, 'new_password': 'third-password-3'})
        self.assertEqual((s, j['error']), (400, 'invalid_token'))

    def test_reset_rejects_bad_shapes(self):
        for bad, want in (({'token': '0' * 48, 'new_password': 'short'}, 'invalid_field:new_password'),
                          ({'token': 'nothex', 'new_password': 'longenough1'}, 'invalid_field:token'),
                          ({'token': '0' * 48}, 'missing_field:new_password'),
                          ({'token': '0' * 48, 'new_password': 'longenough1'}, 'invalid_token')):
            s, j = self._call_auth('/v1/auth/reset', bad)
            self.assertEqual((s, j['error']), (400, want), bad)

    def test_reset_token_never_stored_in_cleartext(self):
        # like sessions, only sha256(token) is persisted — a leaked users.db can't be replayed
        server.mailer.reset_outbox()
        self._call_auth('/v1/auth/signup', {'name': 'Hash Me', 'email': 'hashme@example.com',
                                            'password': 'longenough1', 'accept_tos': True})
        self._call_auth('/v1/auth/forgot', {'email': 'hashme@example.com'})
        rtok = outbox_token_for('hashme@example.com', 'reset-password.html')
        with open(os.environ['BMA_USERS_DB'], 'rb') as f:
            self.assertNotIn(rtok.encode(), f.read())

    # ---- account: change email (re-auth + re-verify, P1 settings) ----
    def test_account_email_change_flow(self):
        server.mailer.reset_outbox()
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Mover', 'email': 'old@example.com',
            'password': 'longenough1', 'accept_tos': True})
        tok = j['token']
        # verify the original address so we can prove the change resets it
        vtok = outbox_token_for('old@example.com', 'verify-email.html')
        self._call_auth('/v1/auth/verify', {'token': vtok})
        s, j = self._call_auth('/v1/auth/me', token=tok)
        self.assertEqual(j['user']['email_verified'], True)
        # wrong password -> 403; unauthenticated -> 401
        s, j = self._call_auth('/v1/account/email',
                               {'password': 'wrong-password-x', 'new_email': 'new@example.com'}, token=tok)
        self.assertEqual((s, j['error']), (403, 'bad_credentials'))
        s, _ = self._call_auth('/v1/account/email',
                               {'password': 'longenough1', 'new_email': 'new@example.com'})
        self.assertEqual(s, 401)
        # real change (mixed case normalises): email updated, back to unverified,
        # a verification link mailed to the NEW address
        s, j = self._call_auth('/v1/account/email',
                               {'password': 'longenough1', 'new_email': 'New@Example.com'}, token=tok)
        self.assertEqual((s, j['ok'], j['email'], j['email_verified']), (200, True, 'new@example.com', False))
        self.assertRegex(outbox_token_for('new@example.com', 'verify-email.html') or '', r'^[0-9a-f]{48}$')
        # me reflects the new email + unverified; the session stays valid
        s, j = self._call_auth('/v1/auth/me', token=tok)
        self.assertEqual((j['user']['email'], j['user']['email_verified']), ('new@example.com', False))
        # login works with the new email, not the old one
        s, _ = self._call_auth('/v1/auth/login', {'email': 'old@example.com', 'password': 'longenough1'})
        self.assertEqual(s, 401)
        s, j = self._call_auth('/v1/auth/login', {'email': 'new@example.com', 'password': 'longenough1'})
        self.assertEqual((s, j['ok']), (200, True))

    def test_account_email_rejects_taken_and_bad_shapes(self):
        self._call_auth('/v1/auth/signup', {'name': 'A', 'email': 'taken@example.com',
                                            'password': 'longenough1', 'accept_tos': True})
        s, j = self._call_auth('/v1/auth/signup', {'name': 'B', 'email': 'mover2@example.com',
                                                   'password': 'longenough1', 'accept_tos': True})
        tok = j['token']
        # moving to an address already in use -> 409, and the old email still works
        s, j = self._call_auth('/v1/account/email',
                               {'password': 'longenough1', 'new_email': 'taken@example.com'}, token=tok)
        self.assertEqual((s, j['error']), (409, 'email_taken'))
        s, j = self._call_auth('/v1/auth/me', token=tok)
        self.assertEqual(j['user']['email'], 'mover2@example.com')
        for bad, want in (({'password': 'longenough1', 'new_email': 'not-an-email'}, 'invalid_field:new_email'),
                          ({'password': 'short', 'new_email': 'ok@example.com'}, 'invalid_field:password'),
                          ({'new_email': 'ok@example.com'}, 'missing_field:password'),
                          ({'password': 'longenough1', 'new_email': 'ok@example.com', 'x': 1}, 'unknown_field:x')):
            s, j = self._call_auth('/v1/account/email', bad, token=tok)
            self.assertEqual((s, j['error']), (400, want), bad)

    # ---- structured ops/security logging (P1: body-free) ----
    def test_log_record_is_body_free_and_leveled(self):
        r = server.log_record('POST', '/v1/advise?secret=SECRET-MARKER', 200, 5, '1.2.3.4')
        # query is dropped, and the record's keys are a fixed body-free set
        self.assertEqual(r['path'], '/v1/advise')
        self.assertEqual((r['method'], r['status'], r['level'], r['ip']),
                         ('POST', 200, 'info', '1.2.3.4'))
        self.assertEqual(set(r), {'ts', 'level', 'event', 'method', 'path', 'status', 'ms', 'ip'})
        # by construction it cannot carry request content
        self.assertNotIn('SECRET-MARKER', json.dumps(r))
        # levels: 5xx -> error, auth/abuse -> warn, else info
        self.assertEqual(server.log_record('GET', '/v1/health', 503, 1, 'x')['level'], 'error')
        for code in (401, 403, 429):
            self.assertEqual(server.log_record('POST', '/v1/auth/login', code, 1, 'x')['level'], 'warn')
        self.assertEqual(server.log_record('GET', '/v1/health', 200, 1, 'x')['level'], 'info')

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

    def test_bad_content_length_rejected(self):
        # a negative value used to reach rfile.read(-n) and swallow the socket
        import http.client
        for cl in ('-5', 'abc'):
            c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
            c.putrequest('POST', '/v1/advise')
            c.putheader('Content-Type', 'application/json')
            c.putheader('Content-Length', cl)
            c.endheaders()
            r = c.getresponse()
            self.assertEqual(r.status, 400, cl)
            self.assertEqual(json.loads(r.read())['error'], 'bad_content_length')
            c.close()

    def test_rate_limit_auth_bucket(self):
        # tiny window via env (read per request), isolated counters before/after
        server._RATE.clear()
        os.environ['BMA_RATE_AUTH'] = '3/60'
        self.addCleanup(os.environ.pop, 'BMA_RATE_AUTH', None)
        self.addCleanup(server._RATE.clear)
        body = {'email': 'rate@example.com', 'password': 'wrong-password!'}
        codes = [self._call_auth('/v1/auth/login', body)[0] for _ in range(4)]
        self.assertEqual(codes[:3], [401, 401, 401])
        self.assertEqual(codes[3], 429)
        # buckets are independent: events endpoints still answer
        s, j, _ = call(self.port, '/v1/feedback',
                       {'rating': 'up', 'template': 'company', 'model': 'llama-3.1-8b-instruct'})
        self.assertEqual((s, j['ok']), (200, True))

    def test_rate_limit_events_bucket(self):
        server._RATE.clear()
        os.environ['BMA_RATE_EVENTS'] = '2/60'
        self.addCleanup(os.environ.pop, 'BMA_RATE_EVENTS', None)
        self.addCleanup(server._RATE.clear)
        body = {'rating': 'down', 'template': 'company', 'model': 'llama-3.1-8b-instruct'}
        codes = [call(self.port, '/v1/feedback', body)[0] for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])

    # ---- billing (P0-1/2/3): Stripe payment loop -------------------------------
    def _webhook(self, event, secret='whsec_test', ts=None):
        """POST a raw Stripe-style event with a valid-by-default signature header."""
        import hashlib
        import hmac
        import time as _t
        raw = json.dumps(event).encode()
        ts = str(int(_t.time())) if ts is None else str(ts)
        sig = hmac.new(secret.encode(), (ts + '.').encode() + raw, hashlib.sha256).hexdigest()
        req = urllib.request.Request('http://127.0.0.1:%d/v1/billing/webhook' % self.port,
                                     data=raw, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Stripe-Signature', 't=%s,v1=%s' % (ts, sig))
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}')

    def test_billing_migration_columns_exist(self):
        import sqlite3
        con = sqlite3.connect(os.environ['BMA_USERS_DB'])
        cols = {r[1] for r in con.execute('PRAGMA table_info(users)')}
        con.close()
        self.assertLessEqual({'stripe_customer_id', 'subscription_status', 'plan_period_end'}, cols)

    def test_billing_checkout_requires_login(self):
        s, j = self._call_auth('/v1/billing/checkout', {'plan': 'pro', 'accept_terms': True})
        self.assertEqual((s, j['error']), (401, 'not_logged_in'))

    def test_billing_checkout_requires_consent(self):
        # P0-4: no recurring subscription without the auto-renewal clickwrap
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'No Consent', 'email': 'noconsent@example.com',
            'password': 'longenough1', 'accept_tos': True})
        tok = j['token']
        s, j = self._call_auth('/v1/billing/checkout', {'plan': 'pro'}, token=tok)
        self.assertEqual((s, j['error']), (400, 'missing_field:accept_terms'))
        s, j = self._call_auth('/v1/billing/checkout',
                               {'plan': 'pro', 'accept_terms': False}, token=tok)
        self.assertEqual((s, j['error']), (400, 'invalid_field:accept_terms'))

    def test_billing_checkout_records_consent(self):
        # accepting the disclosure is recorded (version + time) even if billing is
        # un-provisioned — there is always proof the terms were shown and accepted
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Consenter', 'email': 'consent@example.com',
            'password': 'longenough1', 'accept_tos': True})
        tok = j['token']
        s, j = self._call_auth('/v1/billing/checkout',
                               {'plan': 'pro', 'accept_terms': True}, token=tok)
        self.assertEqual((s, j['error']), (503, 'billing_unavailable'))  # beta: no keys
        s, j = self._call_auth('/v1/account/export', token=tok)
        self.assertEqual(j['user']['billing_consent'], server.BILLING_TOS_VERSION)
        self.assertGreater(j['user']['billing_consent_ts'], 0)

    def test_billing_checkout_unprovisioned_503(self):
        # no BMA_STRIPE_SECRET/price in the test env → honest 503, not a half-checkout
        self.assertEqual(os.environ.get('BMA_STRIPE_SECRET', ''), '')
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Buyer One', 'email': 'buyer1@example.com',
            'password': 'longenough1', 'accept_tos': True})
        s, j = self._call_auth('/v1/billing/checkout',
                               {'plan': 'pro', 'accept_terms': True}, token=j['token'])
        self.assertEqual((s, j['error']), (503, 'billing_unavailable'))

    def test_billing_checkout_rejects_bad_plan(self):
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Buyer Two', 'email': 'buyer2@example.com',
            'password': 'longenough1', 'accept_tos': True})
        s, j = self._call_auth('/v1/billing/checkout', {'plan': 'free'}, token=j['token'])
        self.assertEqual((s, j['error']), (400, 'invalid_field:plan'))

    def test_billing_portal_without_customer_409(self):
        os.environ['BMA_STRIPE_SECRET'] = 'sk_test_dummy'  # provisioned...
        try:
            s, j = self._call_auth('/v1/auth/signup', {
                'name': 'No Sub', 'email': 'nosub@example.com',
                'password': 'longenough1', 'accept_tos': True})
            # ...but this user never checked out, so there's no customer to manage
            s, j = self._call_auth('/v1/billing/portal', {}, token=j['token'])
            self.assertEqual((s, j['error']), (409, 'no_customer'))
        finally:
            del os.environ['BMA_STRIPE_SECRET']

    def test_billing_webhook_rejects_bad_signature(self):
        os.environ['BMA_STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
        try:
            raw = json.dumps({'type': 'checkout.session.completed'}).encode()
            req = urllib.request.Request('http://127.0.0.1:%d/v1/billing/webhook' % self.port,
                                         data=raw, method='POST')
            req.add_header('Stripe-Signature', 't=1,v1=deadbeef')
            try:
                urllib.request.urlopen(req)
                self.fail('expected 400')
            except urllib.error.HTTPError as e:
                self.assertEqual(e.code, 400)
        finally:
            del os.environ['BMA_STRIPE_WEBHOOK_SECRET']

    def test_verify_stripe_signature_accepts_any_v1_during_rotation(self):
        """Stripe includes one v1 signature per active secret during a signing-secret
        rotation; verification must accept the event if ANY v1 matches — not only the
        last one in the header. A valid v1 followed by a bogus v1 must still verify."""
        import hashlib
        import hmac
        import time as _t
        secret, raw = 'whsec_test', b'{"type":"x"}'
        ts = str(int(_t.time()))
        good = hmac.new(secret.encode(), (ts + '.').encode() + raw, hashlib.sha256).hexdigest()
        # good signature is FIRST, a bogus one is LAST (the old last-wins parse rejected this)
        hdr = 't=%s,v1=%s,v1=%s' % (ts, good, 'deadbeef' * 8)
        self.assertTrue(server.verify_stripe_signature(raw, hdr, secret))
        # sanity: the single-signature happy path and an all-bogus header still behave
        self.assertTrue(server.verify_stripe_signature(raw, 't=%s,v1=%s' % (ts, good), secret))
        self.assertFalse(server.verify_stripe_signature(raw, 't=%s,v1=%s' % (ts, 'ff' * 32), secret))

    def test_billing_webhook_drives_plan_lifecycle(self):
        """The webhook is the ONLY thing that moves a paying user's plan (P0-3):
        checkout completes → pro; subscription canceled → back to free."""
        os.environ['BMA_STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
        os.environ['BMA_STRIPE_PRICE_PRO'] = 'price_pro_123'
        try:
            s, j = self._call_auth('/v1/auth/signup', {
                'name': 'Pay Ing', 'email': 'paying@example.com',
                'password': 'longenough1', 'accept_tos': True})
            token = j['token']
            self.assertEqual(j['user']['plan'], 'free')
            cust = 'cus_test_paying'

            # 1) checkout completes → account linked to the customer + upgraded to pro
            s, j = self._webhook({'type': 'checkout.session.completed', 'data': {'object': {
                'client_reference_id': 'paying@example.com', 'customer': cust,
                'metadata': {'plan': 'pro'}}}})
            self.assertEqual(s, 200)
            s, j = self._call_auth('/v1/auth/me', token=token)
            self.assertEqual(j['user']['plan'], 'pro')

            # 2) a bad-signature copy of the SAME event must not move anything
            raw = json.dumps({'type': 'customer.subscription.deleted',
                              'data': {'object': {'customer': cust}}}).encode()
            req = urllib.request.Request('http://127.0.0.1:%d/v1/billing/webhook' % self.port,
                                         data=raw, method='POST')
            req.add_header('Stripe-Signature', 't=1,v1=0000')
            try:
                urllib.request.urlopen(req)
            except urllib.error.HTTPError as e:
                self.assertEqual(e.code, 400)
            s, j = self._call_auth('/v1/auth/me', token=token)
            self.assertEqual(j['user']['plan'], 'pro', 'forged event must not downgrade')

            # 3) subscription canceled → entitlement drops back to free
            s, j = self._webhook({'type': 'customer.subscription.deleted', 'data': {'object': {
                'customer': cust, 'status': 'canceled', 'current_period_end': 1900000000}}})
            self.assertEqual(s, 200)
            s, j = self._call_auth('/v1/auth/me', token=token)
            self.assertEqual(j['user']['plan'], 'free')
        finally:
            del os.environ['BMA_STRIPE_WEBHOOK_SECRET']
            del os.environ['BMA_STRIPE_PRICE_PRO']

    def test_billing_webhook_stale_timestamp_rejected(self):
        os.environ['BMA_STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
        try:
            # correctly signed but 10 minutes old → outside tolerance (replay lid)
            s, j = self._webhook({'type': 'checkout.session.completed', 'data': {'object': {}}},
                                 ts=1000000000)
            self.assertEqual((s, j['error']), (400, 'bad_signature'))
        finally:
            del os.environ['BMA_STRIPE_WEBHOOK_SECRET']

    def test_billing_webhook_subscription_created_maps_price_and_propagates_period(self):
        """customer.subscription.created: the price id maps to a plan and the
        subscription's status + current_period_end are mirrored into users.db so
        the app can gate offline without a round-trip to Stripe."""
        os.environ['BMA_STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
        os.environ['BMA_STRIPE_PRICE_PRO'] = 'price_pro_123'
        os.environ['BMA_STRIPE_PRICE_BUSINESS'] = 'price_biz_456'
        try:
            s, j = self._call_auth('/v1/auth/signup', {
                'name': 'Sub Create', 'email': 'subcreate@example.com',
                'password': 'longenough1', 'accept_tos': True})
            token = j['token']
            cust = 'cus_subcreate'
            # link the customer first (checkout completed with no plan metadata)
            s, _ = self._webhook({'type': 'checkout.session.completed', 'data': {'object': {
                'client_reference_id': 'subcreate@example.com', 'customer': cust}}})
            self.assertEqual(s, 200)
            # subscription.created carries the price -> plan mapping and a period end
            period = 1999999999
            s, _ = self._webhook({'type': 'customer.subscription.created', 'data': {'object': {
                'customer': cust, 'status': 'active',
                'items': {'data': [{'price': {'id': 'price_biz_456'}}]},
                'current_period_end': period}}})
            self.assertEqual(s, 200)
            s, j = self._call_auth('/v1/auth/me', token=token)
            self.assertEqual(j['user']['plan'], 'business')   # price_biz_456 -> business
            import sqlite3
            con = sqlite3.connect(os.environ['BMA_USERS_DB'])
            row = con.execute('SELECT subscription_status, plan_period_end FROM users '
                              'WHERE stripe_customer_id = ?', (cust,)).fetchone()
            con.close()
            self.assertEqual(row, ('active', period), 'status + current_period_end must mirror')
        finally:
            for k in ('BMA_STRIPE_WEBHOOK_SECRET', 'BMA_STRIPE_PRICE_PRO', 'BMA_STRIPE_PRICE_BUSINESS'):
                os.environ.pop(k, None)

    def test_billing_webhook_past_due_and_unpaid_drop_to_free(self):
        """A subscription that goes past_due/unpaid loses its paid entitlement even
        though its price still maps to a plan — only active/trialing keeps it — while
        the real subscription status is preserved for support/ops."""
        os.environ['BMA_STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
        os.environ['BMA_STRIPE_PRICE_PRO'] = 'price_pro_123'
        try:
            s, j = self._call_auth('/v1/auth/signup', {
                'name': 'Past Due', 'email': 'pastdue@example.com',
                'password': 'longenough1', 'accept_tos': True})
            token = j['token']
            cust = 'cus_pastdue'
            self._webhook({'type': 'checkout.session.completed', 'data': {'object': {
                'client_reference_id': 'pastdue@example.com', 'customer': cust}}})
            # active first -> pro
            self._webhook({'type': 'customer.subscription.updated', 'data': {'object': {
                'customer': cust, 'status': 'active',
                'items': {'data': [{'price': {'id': 'price_pro_123'}}]}}}})
            s, j = self._call_auth('/v1/auth/me', token=token)
            self.assertEqual(j['user']['plan'], 'pro')
            # each dunning state drops entitlement to free but records the true status
            for status in ('past_due', 'unpaid'):
                self._webhook({'type': 'customer.subscription.updated', 'data': {'object': {
                    'customer': cust, 'status': status,
                    'items': {'data': [{'price': {'id': 'price_pro_123'}}]}}}})
                s, j = self._call_auth('/v1/auth/me', token=token)
                self.assertEqual(j['user']['plan'], 'free', '%s must lose entitlement' % status)
                import sqlite3
                con = sqlite3.connect(os.environ['BMA_USERS_DB'])
                got = con.execute('SELECT subscription_status FROM users WHERE stripe_customer_id = ?',
                                  (cust,)).fetchone()[0]
                con.close()
                self.assertEqual(got, status)
        finally:
            os.environ.pop('BMA_STRIPE_WEBHOOK_SECRET', None)
            os.environ.pop('BMA_STRIPE_PRICE_PRO', None)

    def test_billing_webhook_unknown_price_active_is_noop(self):
        """An active subscription whose price maps to no configured plan must not
        change the account (apply_subscription rejects plan=None) — a mis-configured
        or foreign price can't silently up/down-grade someone."""
        os.environ['BMA_STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
        os.environ['BMA_STRIPE_PRICE_PRO'] = 'price_pro_123'
        try:
            s, j = self._call_auth('/v1/auth/signup', {
                'name': 'Unknown Price', 'email': 'unkprice@example.com',
                'password': 'longenough1', 'accept_tos': True})
            token = j['token']
            cust = 'cus_unkprice'
            self._webhook({'type': 'checkout.session.completed', 'data': {'object': {
                'client_reference_id': 'unkprice@example.com', 'customer': cust}}})
            s, j = self._call_auth('/v1/auth/me', token=token)
            self.assertEqual(j['user']['plan'], 'free')
            s, _ = self._webhook({'type': 'customer.subscription.updated', 'data': {'object': {
                'customer': cust, 'status': 'active',
                'items': {'data': [{'price': {'id': 'price_unknown_999'}}]}}}})
            self.assertEqual(s, 200)   # acked, but nothing moved
            s, j = self._call_auth('/v1/auth/me', token=token)
            self.assertEqual(j['user']['plan'], 'free')
        finally:
            os.environ.pop('BMA_STRIPE_WEBHOOK_SECRET', None)
            os.environ.pop('BMA_STRIPE_PRICE_PRO', None)

    # ---- migrations: forward-only version tracking (SQLite hardening) -----------
    def test_run_migrations_forward_only_no_downgrade_or_rerun(self):
        """schema_version is a high-water mark: an older build opening a DB a newer
        build already migrated must NOT lower the recorded version (which would make
        the next newer-build launch re-run already-applied steps)."""
        import shutil
        import sqlite3
        d = tempfile.mkdtemp(prefix='bma-mig-')
        path = os.path.join(d, 'mig.db')
        con = server.connect_db(path)
        try:
            con.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)')
            migs = (('ALTER TABLE t ADD COLUMN a TEXT',),
                    ('ALTER TABLE t ADD COLUMN b TEXT',))
            server.run_migrations(con, migs)
            ver = lambda: con.execute('SELECT version FROM schema_version').fetchone()[0]
            self.assertEqual(ver(), 2)
            server.run_migrations(con, migs)           # idempotent: no re-run, no error
            self.assertEqual(ver(), 2)
            # an OLDER build (fewer known migrations) must not downgrade the record
            server.run_migrations(con, (migs[0],))
            self.assertEqual(ver(), 2, 'older build must not lower schema_version')
            # so the newer build re-running finds nothing to do (proves no re-run)
            server.run_migrations(con, migs)
            self.assertEqual(ver(), 2)
            # a genuinely new step still applies and moves the version forward
            server.run_migrations(con, migs + (('ALTER TABLE t ADD COLUMN c TEXT',),))
            self.assertEqual(ver(), 3)
            cols = {r[1] for r in con.execute('PRAGMA table_info(t)')}
            self.assertLessEqual({'a', 'b', 'c'}, cols)
        finally:
            con.close()
            shutil.rmtree(d, ignore_errors=True)

    # ---- one-time link tokens: expiry + single-use + cross-account -------------
    def test_reset_endpoint_rejects_expired_token(self):
        """An expired reset token is rejected (expires must be strictly in the
        future) and leaves the password unchanged — the TTL boundary is real."""
        import time as _t
        self._call_auth('/v1/auth/signup', {'name': 'Expiry', 'email': 'expired-reset@example.com',
                                            'password': 'orig-password-1', 'accept_tos': True})
        con = server.users_con()
        try:
            uid = con.execute('SELECT id FROM users WHERE email = ?',
                              ('expired-reset@example.com',)).fetchone()[0]
            tok = 'c' * 48
            now = int(_t.time())
            con.execute('INSERT INTO password_resets (token_hash, user_id, ts, expires) VALUES (?,?,?,?)',
                        (server._token_hash(tok), uid, now - 7200, now - 3600))  # expired an hour ago
            con.commit()
        finally:
            con.close()
        s, j = self._call_auth('/v1/auth/reset', {'token': tok, 'new_password': 'brand-new-pass-2'})
        self.assertEqual((s, j['error']), (400, 'invalid_token'))
        # password never changed: the original still logs in, the attempted new one does not
        s, _ = self._call_auth('/v1/auth/login',
                               {'email': 'expired-reset@example.com', 'password': 'orig-password-1'})
        self.assertEqual(s, 200)
        s, _ = self._call_auth('/v1/auth/login',
                               {'email': 'expired-reset@example.com', 'password': 'brand-new-pass-2'})
        self.assertEqual(s, 401)

    def test_link_token_single_use_and_cross_account(self):
        """consume_link_token resolves to the exact minting user (never a neighbour)
        and is single-use: the row is deleted on first spend."""
        import time as _t
        for email in ('linka@example.com', 'linkb@example.com'):
            self._call_auth('/v1/auth/signup', {'name': 'L', 'email': email,
                                                'password': 'longenough1', 'accept_tos': True})
        con = server.users_con()
        try:
            uid_a = con.execute('SELECT id FROM users WHERE email = ?', ('linka@example.com',)).fetchone()[0]
            uid_b = con.execute('SELECT id FROM users WHERE email = ?', ('linkb@example.com',)).fetchone()[0]
            self.assertNotEqual(uid_a, uid_b)
            tok_a = server.new_link_token(con, 'password_resets', uid_a, server.RESET_TTL_S)
            con.commit()
            # resolves to A only, then is gone (single-use)
            self.assertEqual(server.consume_link_token(con, 'password_resets', tok_a), uid_a)
            con.commit()
            self.assertIsNone(server.consume_link_token(con, 'password_resets', tok_a))
            # an unknown token never resolves to some other account
            self.assertIsNone(server.consume_link_token(con, 'password_resets', 'd' * 48))
        finally:
            con.close()

    # ---- account email: same-address casing is a true no-op --------------------
    def test_account_email_same_address_different_casing_is_noop(self):
        """Re-submitting the SAME address in different casing must not reset the
        verified flag or send a fresh verification email (no busy-work, no downgrade)."""
        server.mailer.reset_outbox()
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Same Addr', 'email': 'Same@Example.com',
            'password': 'longenough1', 'accept_tos': True})
        tok = j['token']
        vtok = outbox_token_for('same@example.com', 'verify-email.html')
        self._call_auth('/v1/auth/verify', {'token': vtok})
        server.mailer.reset_outbox()
        s, j = self._call_auth('/v1/account/email',
                               {'password': 'longenough1', 'new_email': 'SAME@example.COM'}, token=tok)
        self.assertEqual((s, j['ok'], j['email'], j['email_verified']),
                         (200, True, 'same@example.com', True))
        self.assertIsNone(outbox_token_for('same@example.com', 'verify-email.html'),
                          'a no-op email change must not queue a verification mail')

    # ---- mailer: SMTP config toggle + URL helpers ------------------------------
    def test_mailer_smtp_config_toggle_and_url_helpers(self):
        self.assertFalse(server.mailer.smtp_configured())   # test env has no SMTP
        os.environ['BMA_SMTP_HOST'] = 'smtp.example.com'
        self.addCleanup(os.environ.pop, 'BMA_SMTP_HOST', None)
        self.assertTrue(server.mailer.smtp_configured())
        os.environ['BMA_SITE_URL'] = 'https://buildmyai.example/'
        self.addCleanup(os.environ.pop, 'BMA_SITE_URL', None)
        self.assertEqual(server.mailer.site_url(), 'https://buildmyai.example')  # trailing slash stripped
        os.environ['BMA_MAIL_FROM'] = 'BMA <hi@example.com>'
        self.addCleanup(os.environ.pop, 'BMA_MAIL_FROM', None)
        self.assertEqual(server.mailer.from_addr(), 'BMA <hi@example.com>')

    # ---- entitlements / plan gate (P0-3) ---------------------------------------
    def test_entitlements_reflect_plan_and_gate_flips_with_it(self):
        """The plan gate is server-authoritative and honest: a free user is denied
        the one live Pro capability with a 402 that names the plan to buy; the same
        user, once moved to pro (the webhook's job), passes — no client say-so."""
        s, j = self._call_auth('/v1/auth/signup', {
            'name': 'Gate User', 'email': 'gate@example.com',
            'password': 'longenough1', 'accept_tos': True})
        token = j['token']
        # /v1/auth/me carries the capability set the frontend shows/hides against
        self.assertEqual(j['user']['plan'], 'free')
        s, j = self._call_auth('/v1/auth/me', token=token)
        caps = j['entitlements']['capabilities']
        self.assertIn('local_chat', caps)
        self.assertNotIn('advanced_rag', caps)          # coming-of-Pro, not free
        # the dedicated manifest endpoint agrees
        s, j = self._call_auth('/v1/entitlements', token=token)
        self.assertEqual((s, j['entitlements']['plan']), (200, 'free'))
        # the gated Pro resource: free user gets an honest upgrade prompt, not data
        s, j = self._call_auth('/v1/pro/rag-manifest', token=token)
        self.assertEqual((s, j['error'], j['required_plan']), (402, 'upgrade_required', 'pro'))

        # upgrade the ONLY way plans move (server-side), then re-check the gate
        self.assertTrue(server.set_plan('gate@example.com', 'pro'))
        s, j = self._call_auth('/v1/auth/me', token=token)
        self.assertIn('advanced_rag', j['entitlements']['capabilities'])
        s, j = self._call_auth('/v1/pro/rag-manifest', token=token)
        self.assertEqual((s, j['ok'], j['citations']), (200, True, True))

    def test_entitlements_requires_login(self):
        for path in ('/v1/entitlements', '/v1/pro/rag-manifest'):
            s, j = self._call_auth(path)
            self.assertEqual((s, j['error']), (401, 'not_logged_in'), path)

    def test_default_secret_refuses_public_bind(self):
        # P0-17 fail-closed: the check fires before any socket is opened
        self.assertEqual(server.LICENSE_SECRET, 'dev-secret-change-me')
        with self.assertRaises(SystemExit):
            server.create_server(port=0, host='0.0.0.0')

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
