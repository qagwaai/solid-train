# SW-08 Contract Safety Gate Requirements (Backend-Led)

Status: Draft
Date: 2026-05-24
Repo: solid-train
Related repo: laughing-octo-journey
Owner: Backend lead (primary), Frontend lead (co-owner), QA lead (validation)

## 1. Purpose

Define and enforce producer-side contract stability so frontend consumers detect breaking changes before merge.

## 2. Scope

In scope:

- Publish and validate backend contracts used by frontend consumers.
- Detect breaking changes in API and socket payload shapes.
- Provide migration-aware failure reporting.

Out of scope:

- UI behavior validation.
- Gameplay balancing.
- Non-contract performance tuning.

## 3. Canonical Contract Surfaces

Primary:

- OpenAPI schemas.
- Socket event request/response contracts.

Critical domains:

- Authentication/session.
- Character/ship.
- Market/ledger.
- Mission progression.
- Item/catalog.
- Celestial/routing/travel.

## 4. Breaking Change Definition

Breaking examples:

- Required field removed or renamed.
- Type incompatibility.
- Endpoint/event removed without compatibility alias.
- Enum narrowing that rejects prior valid values.

Potentially non-breaking examples:

- Optional field addition.
- Backward-compatible endpoint extension.

## 5. Gate Behavior

Execution:

- Run contract safety checks on PR and main branch.
- Provide local command parity.

Modes:

- Phase 1: Report-only.
- Phase 2: Soft fail with approved exception.
- Phase 3: Hard fail with approved exception and expiry enforcement.
- Phase 4: Operational stabilization with weekly metrics and SLA triage discipline.
- Phase 5: Optimization and continuous assurance with trend/recurrence guardrails.

Output requirements:

- Contract producer location.
- Known consumers impacted.
- Severity and owner.
- Suggested compatibility strategy.

## 6. Acceptance Criteria

1. Contract artifact is produced deterministically in CI.
2. Intentional breaking fixture is detected reliably.
3. Failure report identifies impacted frontend surface.
4. Rollout path to hard-fail mode is approved.
5. Runbook and prompt pack are linked and usable.

## 7. Ownership and SLA

Backend lead:

- Owns producer schema correctness and migration windows.

Frontend lead:

- Owns consumer updates and fallback handling.

QA lead:

- Owns mismatch fixture and gate-health validation.

SLA:

- Triage within 1 business day.
- Fix or approved exception within 2 business days.

## 8. Backward Compatibility Policy

Required for breaking changes:

1. Deprecation notice.
2. Compatibility window when feasible.
3. Explicit migration notes.
4. Coordinated merge sequencing across repos.

## 9. Rollout Plan

1. Baseline report-only adoption.
2. Soft fail and controlled exception path.
3. Hard fail after false-positive stabilization.

## 10. Metrics

- Breaking changes caught pre-merge.
- Mean drift resolution time.
- Exception frequency and expiry compliance.
- Downstream regressions caused by contract changes.
- Weekly drift count, MTTR, bypass count, and expired bypass count.
- Rolling 30-day trend by drift class, owner, and repeat offender surfaces.
- False-positive baseline (fixture-noise exclusion rate) for continuous noise reduction.

## 11. Related Documents

- docs/planning/sw-08-contract-safety-gate-implementation-plan.md
- docs/planning/sw-08-contract-safety-gate-runbook.md
- docs/planning/sw-08-contract-safety-gate-prompt-pack.md
