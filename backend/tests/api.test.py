#!/usr/bin/env python3
"""Backend API tests — boots the real server on an ephemeral port and speaks
real HTTP. Zero dependencies (unittest + urllib). Includes the privacy
red-line cases from docs/19 §4: free text and unknown fields must be rejected.

Run: python3 backend/tests/api.test.py
"""
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'api'))
# isolate the db BEFORE importing the server module
os.environ['BMA_DB'] = os.path.join(tempfile.mkdtemp(prefix='bma-test-'), 'events.db')
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
        s, j, _ = call(self.port, '/v1/feedback',
                       {'rating': 'up', 'template': 'company', 'model': 'llama-3.1-8b-instruct'})
        self.assertEqual(s, 200)
        s, j, _ = call(self.port, '/v1/feedback',
                       {'rating': 'up', 'template': 'company',
                        'model': 'llama-3.1-8b-instruct', 'comment': 'the answer said...'})
        self.assertEqual((s, j['error']), (400, 'unknown_field:comment'))

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
