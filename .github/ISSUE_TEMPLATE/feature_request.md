---
name: Feature request
about: Suggest an improvement or new capability
title: ""
labels: enhancement
assignees: ""
---

## Problem

<!-- What are you trying to do, and where does the current behavior fall short? -->

## Proposal

<!-- What you'd like to see. Concrete is better than abstract. -->

## Alternatives considered

<!-- Optional: other approaches you weighed. -->

## Does it respect the project invariants?

This project stays zero-dependency, single-egress, and honest by design
(enforced by `frontend/tests/security.test.js`; see `docs/19` and AGENTS.md).
Please confirm your proposal fits, or explain the trade-off:

- [ ] **Zero dependencies** — needs no new package, SDK, bundler, build step, or CDN.
- [ ] **Single egress** — no new network call outside `frontend/assets/local-llm.js`; the browser still only talks to `127.0.0.1` / same origin.
- [ ] **Honesty** — describes only behavior the code can actually deliver.

<!-- If it can't meet one of these, say which and why it's still worth it. -->
