# SW-13 External Object Presentation Runbook (Forge)

Status: Draft (Execution Ready)
Date: 2026-05-30
Repo: solid-train
Feature ID: SW-13

## 1. Purpose

Provide operational procedures for triaging and resolving SW-13 descriptor drift, producer contract failures, and canary readiness blockers.

## 2. Trigger Conditions

Run this playbook when:

1. SW-13 contract or compatibility gate fails.
2. Nova reports unreadable external-object identity due to descriptor mismatch.
3. Canary shows non-canonical descriptor emissions.
4. Rollback readiness is requested for SW-13.

## 3. Canonical Descriptor Policy

Allowed descriptor domains:

1. `debris`
2. `ship`
3. `jump_gate`
4. `station`
5. `asteroid`

Allowed asteroid styles:

1. `rocky`
2. `hero_cinematic`

Hard rules:

1. No legacy descriptor domains.
2. No silent remap/fallback behavior.
3. Any non-canonical value is a hard-fail.

## 4. Triage Workflow

1. Assign owner within 1 business day.
2. Reproduce failure locally using the same gate mode as CI.
3. Classify root cause:
- producer schema drift
- producer emission bug
- consumer inventory drift
- merge sequencing error
4. Apply producer fix first when schema/emission is at fault.
5. Re-run strict gates and attach evidence.
6. Update SW-13 cross-repo index with status.

Architecture triage checks (required):

1. Verify no transport-layer logic leaked into descriptor normalization modules.
2. Verify no consumer-renderer assumptions leaked into producer schema/domain logic.
3. Verify fallback policy is centralized and not duplicated across handlers.

## 5. Drift Classes

1. Enum/domain mismatch
- Example: `jumpGate` emitted instead of `jump_gate`.

2. Unsupported descriptor value
- Example: `derelict_station` emitted without canonical contract addition.

3. Shape mismatch
- Example: descriptor field type changed from enum/string union to open string.

## 6. Canary Readiness Checklist

1. Descriptor contract gates are green in Forge and Nova.
2. No non-canonical descriptor emissions in canary telemetry.
3. No unresolved P1/P2 SW-13 issues.
4. Rollback procedure validated and documented.

5. Architecture and maintainability checks are green:
- Layering boundaries validated in review.
- No duplicated canonical descriptor constants in producer modules.

6. Test quality checks are green:
- Unit, integration, contract, and cross-repo compatibility suites are all passing.
- Drift fixtures fail deterministically with actionable diagnostics.

## 7. Rollback Procedure (Contract Safety First)

1. Disable SW-13 canary flag.
2. Revert to last known-good contract artifact and producer emission path.
3. Re-run hard-fail gates.
4. Confirm canonical descriptor emissions are restored.
5. Post incident update in SW-13 index.

## 8. Escalation Matrix

1. Forge lead: producer schema/emission issues.
2. Nova lead: consumer mapping and rendering inventory issues.
3. QA lead: fixture reliability and canary evidence quality.
4. Orion: cross-repo sequencing and go/no-go decision.

## 9. Evidence Quality Standard

Every SW-13 milestone update must include:

1. Commands executed and expected pass/fail intent.
2. Artifact/report references for any drift or canary incidents.
3. Explicit statement on separation-of-concerns impact (none/controlled/change approved).
4. Contract drift posture summary and remediation owner when failures occur.
