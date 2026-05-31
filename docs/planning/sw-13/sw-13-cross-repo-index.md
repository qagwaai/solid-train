# SW-13 Cross-Repo Coordination Index

Status: Draft (Execution Ready)
Date: 2026-05-30
Scope: SW-13 External Object Presentation Expansion across solid-train and laughing-octo-journey

## Purpose

Provide one coordination view for SW-13 so Forge, Nova, and QA can track descriptor alignment, milestone state, and release readiness.

## Canonical Document Set

Forge documents (solid-train):

1. [Requirements](sw-13-external-object-presentation-requirements.md)
2. [Implementation Plan](sw-13-external-object-presentation-implementation-plan.md)
3. [Pre-Implementation Findings](sw-13-pre-implementation-findings.md)
4. [M0 Contract Lock Execution Checklist](sw-13-m0-contract-lock-execution-checklist.md)
5. [Runbook](sw-13-external-object-presentation-runbook.md)
6. [Closure Checklist](sw-13-closure-checklist.md)
7. [M0 Nova Handoff](sw-13-m0-nova-handoff.md)
8. [M2 Orion Decision Lock Note](sw-13-m2-orion-decision-lock-note.md)
9. [M3 Orion Decision Lock Note](sw-13-m3-orion-decision-lock-note.md)

Nova documents (laughing-octo-journey):

1. [Implementation Plan](../../../laughing-octo-journey/docs/planning/sw-13/sw-13-external-object-presentation-implementation-plan.md)
2. [Brainstorming Findings](../../../laughing-octo-journey/docs/planning/stellar-brainstorming-findings-2026-05-24.md)

## Shared Delivery Assumptions

1. SW-13 executes as v1-first.
2. Breaking contract cleanup is allowed.
3. Strict fail behavior is required for unknown descriptor values.
4. No legacy compatibility paths are retained.
5. Canary-only release progression before broad rollout.
6. Asteroid style range must support both `rocky` and `hero_cinematic` outputs.

## Milestone Sync Board

| Milestone | Forge (solid-train) | Nova (laughing-octo-journey) | QA Evidence | Status |
| --- | --- | --- | --- | --- |
| M0 Contract baseline lock | Planned | Planned | Pending | Open |
| M1 Producer emission compliance | Planned | N/A | Pending | Open |
| M2 Integration contract confidence | Complete (Forge scope) | Planned | Forge evidence attached; Nova evidence pending | In Progress |
| M3 Cross-repo gate alignment | Planned | Planned | Pending | Open |
| M4 Dual gate enforcement | Planned | Planned | Pending | Open |
| M5 Canary validation | Planned | Planned | Pending | Open |
| M6 Release decision | Pending | Pending | Pending | Open |

## Merge and Release Sequence

1. Forge updates canonical external-object descriptor schema and producer behavior.
2. Forge publishes updated contract artifact and migration notes.
3. Nova updates consumer assumptions and rendering taxonomy behavior.
4. Both repos pass strict descriptor contract checks.
5. Canary enablement starts and soak checks complete.
6. Go/no-go review determines broad release.

## Drift Triage Contract

When SW-13 drift is detected:

1. Assign owner within 1 business day.
2. Reproduce failure in affected repo and confirm cross-repo state.
3. Select resolution path: producer fix, consumer update, or sequencing correction.
4. Re-run strict gates and attach evidence.
5. Close with root-cause and prevention note.

## Status Updates

| Date | Repo | Update | Owner |
| --- | --- | --- | --- |
| 2026-05-30 | solid-train | SW-13 Forge planning set created (requirements, implementation, findings, runbook, closure, M0 artifacts) | Orion |
| 2026-05-30 | solid-train | Orion M2 decision lock captured: full-9 ship/station coverage, fallback tier behavior assertions, no additional API surface required for M2 | Orion |
| 2026-05-30 | solid-train | M2 Forge evidence pass recorded: deterministic full-9 ship/station payload fixture, tier-behavior assertions (hero/standard/minimal), OpenAPI component-level contract surface confirmed, and SW-13 lint/gate checks green | Forge |
| 2026-05-30 | solid-train | Orion M3 decision lock captured and enforced in Forge tests: all-family per-run gate coverage and medium hazard mandatory warning escalation | Orion |

## Change Log

- 2026-05-30: Initial SW-13 Forge cross-repo index created and linked to Forge and Nova artifacts.
- 2026-05-30: Added M2 Orion decision lock note and linked Forge evidence targets for Nova M2 pass.
- 2026-05-30: Updated M2 milestone board row to Complete (Forge scope) with Nova evidence pending.
- 2026-05-30: Added M3 Orion decision lock note and linked gate-landmark evidence assertions.
