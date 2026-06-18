---
Owner: Project Maintainers
Last Verified: 2026-05-08
Status: Living
---

# TODO - Active Backlog

Purpose: keep this file focused on actionable, not-yet-done work.

## Completed Work Archive

Completed remediation and cleanup work was moved out of the active TODO flow.

- Test quality completion details:
  - [docs/history/2026-05-07_test-quality-review.md](docs/history/2026-05-07_test-quality-review.md)
- Maintainability completion details:
  - [MAINTAINABILITY_REVIEW.md](MAINTAINABILITY_REVIEW.md)
- Backend bug closures:
  - 2026-05-25: M-11 socket response channel misrouting closed (see docs/planning/forge-bug-mission-channel-misrouting-2026-05-25.md)

## Current Non-Feature Backlog (Lower Priority)

Legend: P1 high value, P2 quality-of-life

### P1

1. M-03 - Hash and verify passwords via injectable hasher
   - Introduce password hashing (bcrypt/argon2) behind an abstraction.
   - Migrate register/login flows and tests to hashed credentials.
   - Add configuration guardrails for production auth settings.

### P2

1. M-10 - Constants and naming polish
   - Centralize cross-file constants (distance thresholds, stock/reward tuning, physics constants).
   - Move fallback anchor coordinate data out of logic modules and into model data.
   - Document cache-write-through invariants in CODEBASE.
   - Apply async/cache naming convention cleanup where safe.

## Feature Intake Queue

Use this section for net-new gameplay/product functionality.

1. FX-14 - Market ship listing discoverability contract
  - Goal: expose seeded/persisted ship listings through a read surface so clients can render available ships before purchase.
  - API/events touched: market list/inventory read surfaces (candidate: market-inventory-list or new market-ship-list event).
  - Files touched: OpenAPI market module + response schemas + corresponding market read handler.
  - Tests added/changed: contract/schema tests and handler tests covering available/sold listing states.
  - Behavioral impact: clients can discover ship listings without implicit knowledge of seeded catalog ids.
  - Notes: follow-up to ship purchase slice; keep strict canonical itemType and ownership semantics.

## Tracking Template

```
FX-XX <feature title>
- Goal:
- API/events touched:
- Files touched:
- Tests added/changed:
- Behavioral impact:
- Notes:
```
