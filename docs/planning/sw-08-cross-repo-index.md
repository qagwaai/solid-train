# SW-08 Cross-Repo Coordination Index

Status: Active
Date: 2026-05-24
Scope: Contract Safety Gate across solid-train and laughing-octo-journey

## Purpose

Provide a single coordination view for SW-08 so backend, frontend, and QA teams track rollout state, ownership, and drift incidents consistently.

## Canonical Document Set

Backend repo documents:

1. [Requirements](sw-08-contract-safety-gate-requirements.md)
2. [Implementation Plan](sw-08-contract-safety-gate-implementation-plan.md)
3. [Runbook](sw-08-contract-safety-gate-runbook.md)
4. [Prompt Pack](sw-08-contract-safety-gate-prompt-pack.md)

Frontend repo documents:

1. [laughing-octo-journey Requirements](../../../laughing-octo-journey/docs/planning/sw-08-contract-safety-gate-requirements.md)
2. [laughing-octo-journey Implementation Plan](../../../laughing-octo-journey/docs/planning/sw-08-contract-safety-gate-implementation-plan.md)
3. [laughing-octo-journey Runbook](../../../laughing-octo-journey/docs/planning/sw-08-contract-safety-gate-runbook.md)
4. [laughing-octo-journey Prompt Pack](../../../laughing-octo-journey/docs/planning/sw-08-contract-safety-gate-prompt-pack.md)

## Shared Rollout Stages

1. Stage 1: Report-only (warn)
2. Stage 2: Soft fail with approved bypass
3. Stage 3: Hard fail on PR path
4. Stage 4: Operational stabilization with weekly metrics

## Current Status

| Repo                  | Stage   | PR Gate   | Notes                                                                     |
| --------------------- | ------- | --------- | ------------------------------------------------------------------------- |
| solid-train           | Stage 4 | Hard fail | Weekly metrics enabled; approved exceptions remain audited and time-bound |
| laughing-octo-journey | Stage 4 | Hard fail | Mirror consumer triage, update path, and SLA timing                       |

## Shared Status Board Template

Use this table in sprint reviews and incident triage:

| Date       | Stage            | Repo                  | CI Status | Drift Count | Open Exceptions | Owner         | ETA        | Notes |
| ---------- | ---------------- | --------------------- | --------- | ----------- | --------------- | ------------- | ---------- | ----- |
| YYYY-MM-DD | Report/Soft/Hard | solid-train           | Green/Red | 0           | 0               | Backend Lead  | YYYY-MM-DD |       |
| YYYY-MM-DD | Report/Soft/Hard | laughing-octo-journey | Green/Red | 0           | 0               | Frontend Lead | YYYY-MM-DD |       |

## Drift Triage Contract (Shared)

When a drift is detected:

1. Assign owner within 1 business day.
2. Reproduce locally in both repos.
3. Decide fix path: frontend update, backend compatibility, or coordinated sequence.
4. If bypass is required, attach expiry and rollback plan.
5. Close incident with root-cause note and preventive action.

## Exception Governance

Bypass requires:

1. Frontend lead approval.
2. Backend lead approval.
3. Expiry date.
4. Rollback strategy.
5. Follow-up ticket ID.

## Metrics to Review Weekly

1. Drift failures per week.
2. Mean time to resolve drift.
3. Number of bypasses and expiry compliance.
4. Contract-related regressions that escaped CI.

## Change Log

- 2026-05-24: Initial cross-repo index and shared status board template created.
- 2026-05-24: Stage 3 hard-fail rollout recorded for solid-train.
- 2026-05-24: Stage 4 stabilization recorded with weekly metrics and tighter ops guidance.
