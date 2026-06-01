# SW-13 Closure Checklist (Forge)

Status: Draft
Date: 2026-05-30
Repo: solid-train

## 1. Contract Completion

1. External-object descriptor domains in producer schema are canonical only.
2. Deprecated or ambiguous descriptor values are removed.
3. Contract artifacts regenerated and deterministic.
4. Contract diff reviewed and approved.

## 2. Producer Logic Completion

1. Descriptor mapper emits canonical values only.
2. Invalid descriptor path rejects emission and records telemetry.
3. Legacy fallback/remap logic removed.

## 3. Verification Completion

1. Unit tests for descriptor validation and mapping pass.
2. Integration tests for external-object payload contracts pass.
3. Negative fixtures with invalid descriptor values fail as expected.
4. PR hard-fail gates block descriptor drift.
5. Legacy fallback reintroduction checks fail as expected.
6. Cross-repo compatibility tests pass with deterministic outputs.

## 3A. Architecture and Maintainability Completion

1. Separation-of-concerns boundaries are preserved (schema, normalization, emission).
2. Descriptor constants are centralized and no duplicated canonical enums remain.
3. Module dependencies follow approved direction with no reverse-layer coupling.
4. Any architecture exception is documented with owner and follow-up action.

## 4. Cross-Repo Alignment

1. Nova consumer inventory aligned with Forge descriptor contract artifact.
2. Cross-repo compatibility checks pass.
3. Shared milestone board updated in index document.

## 5. Canary Readiness and Evidence

1. Canary enabled with SW-13 path.
2. No non-canonical descriptor emissions during soak window.
3. No open P1/P2 defects.
4. Rollback drill executed successfully.

## 6. Operational Readiness

1. Runbook updated for discovered edge cases.
2. Ownership and on-call contacts confirmed.
3. Post-release monitoring query/alerts validated.
4. Contract drift incident playbook exercised with at least one dry-run scenario.

## 7. Sign-Off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Forge lead | TBD | YYYY-MM-DD | Pending | |
| Nova lead | TBD | YYYY-MM-DD | Pending | |
| QA lead | TBD | YYYY-MM-DD | Pending | |
| Orion | TBD | YYYY-MM-DD | Pending | |

## 8. Final Exit Criteria

1. All sections above complete and evidenced.
2. SW-13 marked complete in sprint board and index.
3. Any deferred follow-up work logged with owners and dates.
4. Architecture quality controls and maintainability checks are explicitly signed off.
