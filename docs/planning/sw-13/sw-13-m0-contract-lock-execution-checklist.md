# SW-13 M0 Contract Lock Execution Checklist (Forge)

Status: Draft (Ready for Execution)
Date: 2026-05-30
Repo: solid-train
Feature ID: SW-13

## 1. Objective

Lock SW-13 descriptor contract baseline before implementation milestones begin.

## 2. Entry Conditions

1. SW-13 requirements and implementation plan are reviewed.
2. Pre-implementation findings are accepted.
3. Nova alignment session is scheduled.

## 3. Contract Lock Tasks

1. Define canonical descriptor domains in producer contract:
- `debris`
- `ship`
- `jump_gate`
- `station`
- `asteroid`

2. Define canonical asteroid style domain:
- `rocky`
- `hero_cinematic`

3. Remove legacy descriptor mappings from producer contract surface.
4. Add strict validation constraints for descriptor domains and shapes.
5. Regenerate contract artifacts and record deterministic output hash.

## 4. Validation Tasks

1. Run canonical contract lint (expected pass).
2. Run negative fixture: unsupported domain (expected hard-fail).
3. Run negative fixture: enum casing mismatch (expected hard-fail).
4. Run negative fixture: payload shape mismatch (expected hard-fail).
5. Run cross-repo compatibility check against Nova inventory.

## 5. Evidence Attachments

1. Contract diff summary.
2. Command output snippets for pass/fail fixtures.
3. Artifact paths for generated reports.
4. Linked status update in cross-repo index.

## 6. M0 Exit Criteria

1. Canonical contract domains accepted by Forge and Nova.
2. All planned M0 validation tasks complete with expected outcomes.
3. Hard-fail behavior confirmed for intentional drift fixtures.
4. M1 kickoff authorized.

## 7. Sign-Off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Forge lead | TBD | YYYY-MM-DD | Pending | |
| Nova lead | TBD | YYYY-MM-DD | Pending | |
| QA lead | TBD | YYYY-MM-DD | Pending | |
| Orion | TBD | YYYY-MM-DD | Pending | |
