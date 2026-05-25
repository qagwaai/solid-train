# SW-08 Closure Checklist

Status: Draft
Date: 2026-05-24
Repo: solid-train

## Purpose

Confirm SW-08 moved from implementation to operational maintenance.

## Completion Criteria

Mark each item when verified:

- [ ] Stage 3 hard-fail enforcement is active and stable on PR path.
- [ ] Stage 4 operational hardening completed (exception hygiene + actionable diagnostics).
- [ ] Stage 5 optimization completed (trend reporting + repeat-drift escalation).
- [ ] Exception policy is enforced and auditable (expiry, approvals, rollback, owner, ticket).
- [ ] Local reproduction commands match CI behavior.
- [ ] Runbook reflects current failure signatures and triage process.
- [ ] Weekly status board updates are running.
- [ ] Cross-repo owner mapping is current (backend/frontend/QA).

## Operational Metrics Review

Verify recent data exists for:

- [ ] Drift failures per week
- [ ] Mean time to resolve drift
- [ ] Bypass count and expiry compliance
- [ ] Contract-related regression escapes
- [ ] Repeat drift classes by surface

## Sign-Off

- Backend Lead: _____________________  Date: __________
- Frontend Lead: ____________________  Date: __________
- QA Lead: __________________________  Date: __________

## Transition Decision

- [ ] SW-08 complete: move to maintenance mode
- [ ] SW-08 not complete: continue implementation stage ____

## Related Documents

1. [Requirements](sw-08-contract-safety-gate-requirements.md)
2. [Implementation Plan](sw-08-contract-safety-gate-implementation-plan.md)
3. [Runbook](sw-08-contract-safety-gate-runbook.md)
4. [Prompt Pack](sw-08-contract-safety-gate-prompt-pack.md)
5. [Cross-Repo Index](sw-08-cross-repo-index.md)
