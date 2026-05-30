# SW-01 Closure Checklist (Forge)

Status: Draft
Date: 2026-05-26
Repo: solid-train

## 1. Contract Completion

1. Mission status enum in producer schema is canonical only:
- available
- active
- completed

2. Deprecated or ambiguous status values removed.
3. Contract artifact regenerated and deterministic.
4. Contract diff reviewed and approved.

## 2. Producer Logic Completion

1. Mission status mapper emits canonical values only.
2. Invalid status path rejects emission and records telemetry.
3. Legacy fallback/remap logic removed.

## 3. Verification Completion

1. Unit tests for status validation and mapping pass.
2. Integration tests for mission list payloads pass.
3. Negative fixture with invalid status fails as expected.
4. PR hard-fail gate blocks drift.

## 4. Cross-Repo Alignment

1. Nova consumer inventory aligned with Forge contract artifact.
2. Cross-repo compatibility checks pass.
3. Shared milestone board updated in index document.

## 5. Canary Readiness and Evidence

1. Canary enabled with SW-01 path.
2. No non-canonical emissions during soak window.
3. No open P1/P2 defects.
4. Rollback drill executed successfully.

## 6. Operational Readiness

1. Runbook updated for any discovered edge cases.
2. Ownership and on-call contacts confirmed.
3. Post-release monitoring query/alerts validated.

## 7. Sign-Off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Forge lead | TBD | YYYY-MM-DD | Pending | |
| Nova lead | TBD | YYYY-MM-DD | Pending | |
| QA lead | TBD | YYYY-MM-DD | Pending | |
| Orion | TBD | YYYY-MM-DD | Pending | |

## 8. Final Exit Criteria

1. All sections above complete and evidenced.
2. SW-01 marked complete in sprint board and index.
3. Any deferred follow-up work logged with owners and dates.
