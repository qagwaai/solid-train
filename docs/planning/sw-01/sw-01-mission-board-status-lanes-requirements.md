# SW-01 Mission Board Status Lanes Requirements (Backend-Led)

Status: Draft (Execution Ready)
Date: 2026-05-26
Repo: solid-train
Related repo: laughing-octo-journey
Owner: Forge lead (primary), Nova lead (co-owner), QA lead (validation)

## 1. Purpose

Define producer-side requirements for SW-01 so Mission Board statuses are canonical, contract-valid, and safe for strict lane rendering in Nova.

## 2. Scope

In scope:

- Canonical mission status semantics in producer contracts.
- Mission list payload guarantees for Available/Active/Completed lane mapping.
- Strict rejection of non-canonical status values.
- Cross-repo contract validation with Nova consumer assumptions.

Out of scope:

- Frontend layout and style details.
- Mission board interaction design beyond status semantics.
- Legacy compatibility behavior for pre-SW-01 status shapes.

## 3. Canonical Contract Surface

Primary source-of-truth:

1. openapi.yaml mission payload schemas in solid-train.
2. Mission list response contracts consumed by Nova mission board flows.

Status enum (SW-01 canonical):

1. available
2. active
3. completed

Canonical data values are lowercase. Any title-case labels are presentation-only.

## 4. Breaking Change Policy (SW-01)

SW-01 explicitly allows breaking contract cleanup.

Required producer actions:

1. Remove ambiguous or legacy status values from outbound payloads.
2. Remove producer-side fallback mapping that preserves deprecated semantics.
3. Fail validation on any status outside canonical enum.

Forbidden producer behavior:

1. Emitting unknown status with best-effort fallback.
2. Silent remapping that hides drift from contract gates.
3. Reintroducing legacy statuses for backward compatibility.

## 5. Functional Requirements

1. Mission status emission
- All mission list producers emit only available, active, or completed.

2. Deterministic lane semantics
- Status values must map one-to-one with Nova lane model.

3. Validation-first behavior
- Invalid status values are rejected before outbound emission.

4. Consistent filtering support
- Producer filtering/query semantics align with lane categories.

5. Observability
- Invalid status attempt logs include operation name, entity key, and correlation metadata.

## 6. Non-Functional Requirements

1. Determinism
- Contract artifacts and mission status ordering are deterministic across runs.

2. Reliability
- Contract checks run in CI and local parity commands.

3. Latency safety
- Validation logic does not regress mission list latency beyond agreed threshold.

4. Operability
- Gate failures provide actionable producer location and remediation path.

## 7. Gate and Verification Requirements

1. Producer contract gate
- Hard-fail PR checks when mission status enum drifts from canonical set.

2. Consumer compatibility gate
- Hard-fail when Nova consumer inventory disagrees with producer status schema.

3. Dual gate enforcement
- Forge producer gate and Nova preflight gate must both be active and blocking in PR workflow.
- Local parity commands must match CI pass/fail behavior.

4. Negative fixture coverage
- Intentional invalid status fixture must fail reliably in CI.

5. Canary validation
- SW-01 release promotion blocked if canary sees non-canonical status emissions.

## 8. Acceptance Criteria

1. Producer payloads emit only canonical statuses.
2. Contract artifacts reflect canonical enum and pass strict checks.
3. Intentional invalid-status fixture fails in local and CI paths.
4. Cross-repo checks pass with aligned Nova assumptions.
5. No legacy compatibility path remains in producer status logic.

## 9. Ownership and SLA

Forge lead:

- Own producer schema and status emission correctness.

Nova lead:

- Own strict consumer mapping and visible violation behavior.

QA lead:

- Own negative fixtures and canary validation evidence.

SLA:

1. Triage status-contract failures within 1 business day.
2. Fix or approved rollback action within 2 business days.

## 10. Related Documents

1. docs/planning/sw-01/sw-01-mission-board-status-lanes-implementation-plan.md
2. docs/planning/sw-01/sw-01-mission-board-status-lanes-runbook.md
3. docs/planning/sw-01/sw-01-cross-repo-index.md
4. ../../../laughing-octo-journey/docs/planning/sw-01/sw-01-mission-board-status-lanes-implementation-plan.md
