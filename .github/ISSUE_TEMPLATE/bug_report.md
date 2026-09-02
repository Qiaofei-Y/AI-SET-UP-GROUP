---
name: Bug report
about: Report something that doesn't work as documented
title: ""
labels: bug
assignees: ""
---

<!-- For a suspected security vulnerability, do NOT open an issue — see SECURITY.md. -->

## Which surface

- [ ] Backend API (`backend/`)
- [ ] Frontend site / wizard / chat (`frontend/`)
- [ ] Installer contract (`installer/`)
- [ ] Deploy / self-hosting (`deploy/`, Docker, reverse proxy)
- [ ] Docs
- [ ] Other:

## Steps to reproduce

1.
2.
3.

## Expected behavior

<!-- What you thought would happen. -->

## Actual behavior

<!-- What actually happened. Include the exact error, log line, or screenshot. -->

## Did you run the tests?

- [ ] `python3 backend/tests/api.test.py`
- [ ] `bash frontend/tests/run.sh`
- [ ] `python3 backend/ops/backup.py --selftest`
- [ ] Not applicable / didn't run

<!-- Paste relevant failing output if any. -->

## Environment

- OS / arch:
- Python version (`python3 --version`):
- How you ran it (local dev / Docker dev / Docker HTTPS / bare metal):
- Commit or branch:
