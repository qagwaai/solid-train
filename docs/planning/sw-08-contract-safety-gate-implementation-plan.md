# SW-08 Contract Safety Gate Implementation Plan (Backend-Led)

Status: Completed (Maintenance Mode)
Date: 2026-05-24
Completed: 2026-05-25
Repo: solid-train

## 1. Objective

Implement producer-side contract governance and CI enforcement to prevent backend changes from silently breaking frontend consumers.

## 2. Workstreams

1. Contract artifact publication

- Ensure deterministic generation of API and event contracts.
- Version and expose artifact for consumer checks.

2. Drift detection

- Compare current artifact with consumer expectations.
- Classify compatibility impact.

3. Compatibility handling

- Define alias/deprecation strategy for breaking changes.
- Require migration note for all contract-impacting PRs.
- Support approved bypasses for soft-fail drift with expiry and rollback metadata.

4. CI integration

- Add report-only and fail modes.
- Upload diagnostics artifacts.
- Stage 3 PR path runs in hard-fail mode with audited bypass support.
- Stage 4 weekly metrics output tracks drift count, MTTR, bypass count, and expired bypass count.
- Stage 5 adds trend reporting, repeat-drift escalation, and PR hygiene checks for migration-note discipline.

5. Cross-repo coordination

- Document handoff workflow for frontend updates.
- Align release sequencing.

## 3. Milestones

1. M1: Stable artifact generation.
2. M2: Drift report-only in CI.
3. M3: Soft fail and exception gate.
4. M4: Hard fail with SLA enforcement and weekly metrics.
5. M5: Optimization and continuous assurance with recurrence guardrails.

## 4. Team Responsibilities

Backend:

- Maintain canonical contracts.
- Provide migration guidance.

Frontend:

- Update consumers for approved changes.
- Validate no regressions in critical pages.

QA:

- Validate fixture coverage and failure messaging.

## 5. Dependencies

Required:

- Contract generation scripts.
- CI integration access.
- Agreed mismatch taxonomy.

Optional:

- Typed client generation.
- Contract changelog automation.

## 6. Risks and Mitigations

Risk: Artifact instability causes noisy diffs.
Mitigation: Deterministic ordering and normalization.

Risk: Breaking changes merged under pressure.
Mitigation: Exception policy with expiry and rollback requirements.

Risk: Cross-repo timing mismatch.
Mitigation: Coordinated change ticket and merge sequence checklist.

## 7. Deliverables

- Contract publication job.
- Drift detection checks.
- CI gate stages.
- Migration note template.
- Approved bypass template and handoff note.
- Runbook and prompt pack.

## 8. Done Criteria

- Intentional breaks are blocked in hard-fail mode on PRs to protected branches.
- Failure output identifies affected frontend consumers.
- Teams can reproduce and resolve locally.
- Exception path audited, time-bound, and rejected automatically when expired or incomplete.
- Weekly metrics are generated and published without affecting PR gate runtime.
- Weekly + rolling 30-day trend reports are generated with repeat-offender escalation.
- Contract-impacting PRs include producer checklist and migration-note evidence before merge.
