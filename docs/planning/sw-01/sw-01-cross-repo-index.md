# SW-01 Cross-Repo Coordination Index

Status: Draft (Execution Ready)
Date: 2026-05-26
Scope: SW-01 Mission Board Status Lanes across solid-train and laughing-octo-journey

## Purpose

Provide one coordination view for SW-01 so Forge, Nova, and QA can track contract alignment, milestone state, and release readiness.

## Canonical Document Set

Forge documents (solid-train):

1. [Requirements](sw-01-mission-board-status-lanes-requirements.md)
2. [Implementation Plan](sw-01-mission-board-status-lanes-implementation-plan.md)
3. [Pre-Implementation Findings](sw-01-pre-implementation-findings.md)
4. [Runbook](sw-01-mission-board-status-lanes-runbook.md)
5. [Closure Checklist](sw-01-closure-checklist.md)

Nova document (laughing-octo-journey):

1. [Implementation Plan](../../../laughing-octo-journey/docs/planning/sw-01/sw-01-mission-board-status-lanes-implementation-plan.md)

## Shared Delivery Assumptions

1. SW-01 executes as v1-first.
2. Breaking contract cleanup is allowed.
3. Strict fail behavior is required for unknown mission statuses.
4. No legacy compatibility paths are retained.
5. Canary-only release progression before broad rollout.

## Milestone Sync Board

| Milestone | Forge (solid-train) | Nova (laughing-octo-journey) | QA Evidence | Status |
| --- | --- | --- | --- | --- |
| M0 Contract baseline lock | Not started | Not started | Pending | Open |
| M1 Producer emission compliance | Not started | N/A | Pending | Open |
| M2 Lane rendering and filters | N/A | Not started | Pending | Open |
| M3 Strict violation behavior | Shared | Shared | Pending | Open |
| M4 Dual gate enforcement | Shared | Shared | Pending | Open |
| M5 Canary validation | Shared | Shared | Pending | Open |
| M6 Release decision | Shared | Shared | Pending | Open |

## Merge and Release Sequence

1. Forge updates canonical mission status schema and producer behavior.
2. Forge publishes updated contract artifact and migration notes.
3. Nova updates consumer assumptions and strict violation UI path.
4. Both repos pass strict contract checks.
5. Canary enablement starts and soak checks complete.
6. Go/no-go review determines broad release.

## Drift Triage Contract

When SW-01 drift is detected:

1. Assign owner within 1 business day.
2. Reproduce failure in affected repo and confirm cross-repo state.
3. Select resolution path: producer fix, consumer update, or sequencing correction.
4. Re-run strict gates and attach evidence.
5. Close with root-cause and prevention note.

## Status Updates

| Date | Repo | Update | Owner |
| --- | --- | --- | --- |
| 2026-05-26 | solid-train | SW-01 Forge planning set created | Orion |

## Change Log

- 2026-05-26: Added pre-implementation findings to capture current backend gaps before SW-01 execution.
- 2026-05-26: Initial SW-01 cross-repo index created and linked to Forge and Nova plans.
