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
4. [M0 Contract Lock Execution Checklist](sw-01-m0-contract-lock-execution-checklist.md)
5. [Runbook](sw-01-mission-board-status-lanes-runbook.md)
6. [Closure Checklist](sw-01-closure-checklist.md)

Nova document (laughing-octo-journey):

1. [Implementation Plan](../../../laughing-octo-journey/docs/planning/sw-01/sw-01-mission-board-status-lanes-implementation-plan.md)

## Shared Delivery Assumptions

1. SW-01 executes as v1-first.
2. Breaking contract cleanup is allowed.
3. Strict fail behavior is required for unknown mission statuses.
4. No legacy compatibility paths are retained.
5. Canary-only release progression before broad rollout.
6. Canonical mission status values are lowercase: `available`, `active`, `completed`.

## Milestone Sync Board

| Milestone | Forge (solid-train) | Nova (laughing-octo-journey) | QA Evidence | Status |
| --- | --- | --- | --- | --- |
| M0 Contract baseline lock | Complete | Acknowledged | Evidence accepted | Closed |
| M1 Producer emission compliance | Complete | N/A | Evidence accepted | Closed |
| M2 Integration contract confidence | Complete | N/A | Evidence accepted | Closed |
| M3 Cross-repo gate alignment | Complete | Shared inventory validated | Evidence accepted | Closed |
| M4 Dual gate enforcement | Ready | Ready | M3 recommendation approved | Ready |
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
| 2026-05-30 | solid-train | SW-01 M3 cross-repo gate alignment complete: hard alignment pass plus deterministic hard-fail drift checks for enum casing, unsupported status, and payload shape; actionable diagnostics verified | Forge |
| 2026-05-30 | solid-train | SW-01 M4 recommendation: go for canary quality gate execution based on stable M0-M3 evidence chain | Orion |
| 2026-05-30 | solid-train | SW-01 M2 integration contract confidence complete with server + persistence + contract gate evidence; closure recommended | Forge |
| 2026-05-30 | solid-train | SW-01 M1 producer emission compliance complete with canonical mission-list emission and strict invalid-status rejection evidence | Forge |
| 2026-05-30 | solid-train | SW-01 M0 closed with Forge/Nova/QA/Orion sign-offs; M1 kickoff authorized | Orion |
| 2026-05-30 | solid-train | SW-01 M0 contract lock implemented; Nova handoff packet published for acknowledgment | Forge |
| 2026-05-26 | solid-train | SW-01 Forge planning set created | Orion |

## Change Log

- 2026-05-30: M3 closed with SW-01 mission-list-specific cross-repo compatibility fixtures and hard-fail drift commands; alignment pass and drift diagnostics (owner, severity, producer location, impacted consumer surface, remediation hint) verified locally.
- 2026-05-30: M4 recommendation marked go based on deterministic M0-M3 gate chain and post-drift re-pass evidence.
- 2026-05-30: M2 closed: mission-list integration paths validated green on canonical statuses, non-canonical integration/contract paths fail intentionally with clear diagnostics, and local parity commands match CI intent.
- 2026-05-30: M1 closed: mission-list producer emission paths verified canonical (`available`, `active`, `completed`), invalid injection hard-fail behavior validated, and diagnostics/correlation evidence captured.
- 2026-05-30: Nova acknowledgment posted in `sw-01-m0-nova-handoff.md`; M0 checklist sign-offs recorded and M1 kickoff authorized.
- 2026-05-30: Canonical mission status values updated to lowercase (`available`, `active`, `completed`) across SW-01 planning artifacts.
- 2026-05-30: SW-01 M0 Nova handoff packet published (`sw-01-m0-nova-handoff.md`) with strict failure semantics and gate commands.
- 2026-05-30: Added Forge-first M0 contract lock execution checklist as the active SW-01 start artifact.
- 2026-05-26: Added pre-implementation findings to capture current backend gaps before SW-01 execution.
- 2026-05-26: Initial SW-01 cross-repo index created and linked to Forge and Nova plans.
