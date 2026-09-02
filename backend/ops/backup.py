#!/usr/bin/env python3
"""Build My AI — database backup + restore drill.

Zero-dependency: Python 3 stdlib only. Uses sqlite3's ONLINE backup API, which
takes a consistent snapshot even while the API server is writing (WAL-safe) — no
need to stop the service. Each run snapshots users.db (+ events.db), verifies the
copy with PRAGMA integrity_check, optionally encrypts it (openssl AES-256, only if
BMA_BACKUP_KEY is set), prunes to a retention window, and — if configured — pushes
it off-box via the aws CLI.

Recovery is not real until it's been rehearsed, so `--selftest` performs a full
backup → (encrypt → decrypt) → restore → integrity-check → row-compare drill on a
throwaway database and exits non-zero if anything fails. CI runs it every push.

Usage:
  python3 backend/ops/backup.py                 # back up now
  python3 backend/ops/backup.py --restore FILE [--to DEST]   # restore/verify a snapshot
  python3 backend/ops/backup.py --selftest      # backup+restore drill (exit 0 = ok)

Scheduling is ops (cron/systemd timer), e.g.:
  */30 * * * *  BMA_BACKUP_DIR=/var/backups/bma python3 /srv/bma/backend/ops/backup.py

Env:
  BMA_USERS_DB / BMA_DB   source db paths (default to ../api/data/{users,events}.db)
  BMA_BACKUP_DIR          destination dir (default ./backups)
  BMA_BACKUP_KEEP         snapshots to retain per db (default 14)
  BMA_BACKUP_KEY          openssl passphrase → encrypt snapshots to .enc (optional)
  BMA_BACKUP_S3           s3://bucket/prefix — upload each snapshot via aws CLI (optional)
"""
import argparse
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
API_DATA = os.path.join(ROOT, '..', 'api', 'data')
USERS_DB = os.environ.get('BMA_USERS_DB', os.path.join(API_DATA, 'users.db'))
EVENTS_DB = os.environ.get('BMA_DB', os.path.join(API_DATA, 'events.db'))
BACKUP_DIR = os.environ.get('BMA_BACKUP_DIR', os.path.join(os.getcwd(), 'backups'))
KEEP = int(os.environ.get('BMA_BACKUP_KEEP', '14'))


def snapshot(src, dst):
    """Consistent online-backup copy of `src` to `dst`, then integrity-check it.
    Raises on a corrupt copy so a bad backup fails loudly instead of silently."""
    con = sqlite3.connect(src)
    try:
        bck = sqlite3.connect(dst)
        try:
            with bck:
                con.backup(bck)             # WAL-safe online snapshot
            res = bck.execute('PRAGMA integrity_check').fetchone()[0]
        finally:
            bck.close()
    finally:
        con.close()
    if res != 'ok':
        raise RuntimeError('integrity_check failed for %s: %s' % (dst, res))
    return dst


def _openssl(args, passphrase):
    # -pbkdf2 + -salt: modern KDF, per-file salt. Passphrase via stdin, never argv.
    p = subprocess.run(['openssl'] + args + ['-pass', 'stdin'],
                       input=(passphrase + '\n').encode(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError('openssl failed: ' + p.stderr.decode(errors='replace')[:200])


def encrypt(path, key):
    out = path + '.enc'
    _openssl(['enc', '-aes-256-cbc', '-pbkdf2', '-salt', '-in', path, '-out', out], key)
    os.remove(path)                          # keep only the ciphertext
    return out


def decrypt(path, key, out):
    _openssl(['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-in', path, '-out', out], key)
    return out


def integrity_ok(db_path):
    con = sqlite3.connect(db_path)
    try:
        return con.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    finally:
        con.close()


def prune(dirpath, stem, keep):
    """Keep the newest `keep` snapshots whose name starts with `stem`; delete the rest."""
    snaps = sorted((f for f in os.listdir(dirpath) if f.startswith(stem)), reverse=True)
    removed = []
    for f in snaps[keep:]:
        os.remove(os.path.join(dirpath, f))
        removed.append(f)
    return removed


def upload(path):
    dest = os.environ.get('BMA_BACKUP_S3')
    if not dest or not shutil.which('aws'):
        return None
    p = subprocess.run(['aws', 's3', 'cp', path, dest.rstrip('/') + '/' + os.path.basename(path)],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return dest if p.returncode == 0 else None


def run_backup(stamp=None):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    key = os.environ.get('BMA_BACKUP_KEY')
    stamp = stamp or time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    made = []
    for src in (USERS_DB, EVENTS_DB):
        if not os.path.exists(src):
            continue
        stem = os.path.splitext(os.path.basename(src))[0] + '-'   # e.g. "users-"
        out = os.path.join(BACKUP_DIR, stem + stamp + '.db')
        snapshot(src, out)
        if key:
            out = encrypt(out, key)
        upload(out)
        prune(BACKUP_DIR, stem, KEEP)
        made.append(out)
    return made


def run_restore(path, dest=None):
    """Decrypt (if .enc), integrity-check, and — if `dest` given — write the db there.
    Returns the path to the verified plaintext db."""
    key = os.environ.get('BMA_BACKUP_KEY')
    if path.endswith('.enc'):
        if not key:
            raise SystemExit('encrypted snapshot needs BMA_BACKUP_KEY to restore')
        plain = dest or (path[:-4] + '.restored')
        decrypt(path, key, plain)
    else:
        plain = dest or (path + '.restored')
        shutil.copyfile(path, plain)
    if not integrity_ok(plain):
        raise SystemExit('restored db failed integrity_check: ' + plain)
    return plain


def selftest():
    """Full backup → (encrypt → decrypt) → restore → integrity → row-compare drill."""
    tmp = tempfile.mkdtemp(prefix='bma-backup-drill-')
    ok = True
    try:
        src = os.path.join(tmp, 'sample.db')
        con = sqlite3.connect(src)
        con.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
        con.executemany('INSERT INTO t (v) VALUES (?)', [('alpha',), ('beta',), ('gamma',)])
        con.commit()
        con.execute('PRAGMA journal_mode=WAL')  # snapshot must survive WAL, like production
        con.execute("INSERT INTO t (v) VALUES ('delta')")
        con.commit()
        con.close()

        # 1) plain snapshot + integrity
        snap = snapshot(src, os.path.join(tmp, 'snap.db'))
        assert integrity_ok(snap), 'snapshot integrity failed'

        # 2) encrypted round-trip (only if openssl is available)
        if shutil.which('openssl'):
            enc = encrypt(shutil.copyfile(snap, snap + '.copy') and snap + '.copy', 'drill-pass-123')
            back = decrypt(enc, 'drill-pass-123', os.path.join(tmp, 'dec.db'))
            assert integrity_ok(back), 'decrypted snapshot integrity failed'
        else:
            back = snap

        # 3) restore + row-compare against the source
        restored = run_restore(back, os.path.join(tmp, 'restored.db'))
        con = sqlite3.connect(restored)
        rows = [r[0] for r in con.execute('SELECT v FROM t ORDER BY id')]
        con.close()
        assert rows == ['alpha', 'beta', 'gamma', 'delta'], 'row mismatch: %r' % rows
        print('backup selftest OK: snapshot + %s + restore + integrity + row-compare passed'
              % ('encrypt/decrypt' if shutil.which('openssl') else 'no-openssl(skipped enc)'))
    except Exception as e:
        ok = False
        print('backup selftest FAILED: %s' % e, file=sys.stderr)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return ok


def main():
    ap = argparse.ArgumentParser(description='Build My AI database backup + restore drill')
    ap.add_argument('--restore', metavar='FILE', help='restore/verify a snapshot file')
    ap.add_argument('--to', metavar='DEST', help='write the restored db here')
    ap.add_argument('--selftest', action='store_true', help='run the backup+restore drill and exit')
    args = ap.parse_args()
    if args.selftest:
        raise SystemExit(0 if selftest() else 1)
    if args.restore:
        print('restored + verified: ' + run_restore(args.restore, args.to))
        return
    made = run_backup()
    print('backup complete: ' + (', '.join(made) if made else 'no source databases found'))


if __name__ == '__main__':
    main()
