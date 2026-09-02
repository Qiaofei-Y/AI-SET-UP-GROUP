#!/usr/bin/env python3
"""Build My AI — outbound transactional email (P0-15).

Zero-dependency: Python 3 stdlib only (smtplib + email) — same philosophy as
server.py (no SDK, no package manager). Two backends, chosen per send at
request time by environment so ops can turn on real mail WITHOUT a code change:

  - dev (default): no SMTP env set → the message is appended to a bounded,
    in-memory OUTBOX and echoed to stdout. Nothing leaves the machine; the
    backend tests read OUTBOX to drive the reset/verify flows end to end.
  - SMTP (BMA_SMTP_HOST set): a real send over STARTTLS. Amazon SES exposes an
    SMTP endpoint, so pointing BMA_SMTP_* at SES is the production path — the
    "SES(env)" implementation from the plan, still stdlib-only.

Privacy note: the only bodies this module sends are one-time links carrying an
opaque token (password reset / email verification). They contain NO account
content beyond the recipient address the user already gave us. In dev mode the
message is visible on the operator's own stdout only (suppress with
BMA_MAIL_QUIET=1); it is never written to either database.

Env:
  BMA_MAIL_FROM     From header (default 'Build My AI <no-reply@localhost>')
  BMA_SITE_URL      base URL for the links in emails (default http://localhost:8931)
  BMA_SMTP_HOST     turn on real SMTP; unset => dev/stdout backend
  BMA_SMTP_PORT     default 587
  BMA_SMTP_USER / BMA_SMTP_PASS   SMTP auth (SES SMTP credentials in prod)
  BMA_SMTP_STARTTLS '0' to disable STARTTLS (default on)
  BMA_MAIL_QUIET    '1' to silence the dev-backend stdout echo (tests set this)
"""
import os

SMTP_TIMEOUT_S = 10           # SES/SMTP is remote but bounded; a stalled send fails, not hangs
OUTBOX_MAX = 100              # dev backend keeps only the most recent messages in memory

# dev/test sink: each entry is {'to','subject','text'}. Bounded so a long-running
# dev process can't grow it without limit; tests inspect and reset it.
OUTBOX = []


def from_addr():
    return os.environ.get('BMA_MAIL_FROM', 'Build My AI <no-reply@localhost>')


def site_url():
    return os.environ.get('BMA_SITE_URL', 'http://localhost:8931').rstrip('/')


def smtp_configured():
    return bool(os.environ.get('BMA_SMTP_HOST'))


def reset_outbox():
    del OUTBOX[:]


def send(to, subject, text):
    """Send a plain-text email. Returns True on success, False on any failure —
    callers treat mail as best-effort (a failed verification email must never
    fail the signup that triggered it)."""
    try:
        if smtp_configured():
            return _send_smtp(to, subject, text)
        return _send_stdout(to, subject, text)
    except Exception:
        return False


def _send_stdout(to, subject, text):
    OUTBOX.append({'to': to, 'subject': subject, 'text': text})
    del OUTBOX[:-OUTBOX_MAX]          # keep the tail; bound memory
    if not os.environ.get('BMA_MAIL_QUIET'):
        print('[mailer:dev] to=%s subject=%s\n%s\n' % (to, subject, text))
    return True


def _send_smtp(to, subject, text):
    import smtplib
    from email.message import EmailMessage
    msg = EmailMessage()
    msg['From'] = from_addr()
    msg['To'] = to
    msg['Subject'] = subject
    msg.set_content(text)
    host = os.environ['BMA_SMTP_HOST']
    port = int(os.environ.get('BMA_SMTP_PORT', '587'))
    user, pw = os.environ.get('BMA_SMTP_USER'), os.environ.get('BMA_SMTP_PASS')
    with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_S) as s:
        if os.environ.get('BMA_SMTP_STARTTLS', '1') != '0':
            s.starttls()
        if user and pw:
            s.login(user, pw)
        s.send_message(msg)
    return True
