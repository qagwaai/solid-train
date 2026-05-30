# SW-01 M0 Contract Lock Execution Checklist (Forge-First)

Status: Complete (M0 closed; M1 kickoff authorized)
Date: 2026-05-30
Repo: solid-train
Feature ID: SW-01
Milestone: M0 Contract baseline lock

## Purpose

Provide a concrete execution checklist for Forge M0 so SW-01 can proceed with a locked canonical status contract before Nova implementation work begins.

## Exit Criteria for M0

M0 is complete only when all items below are checked and evidenced:

1. Canonical status enum and casing are finalized.
2. Legacy status and metadata disposition is finalized.
3. OpenAPI and schema enum constraints are locked.
4. Strict invalid-status failure behavior is specified end-to-end.
5. Negative fixture and CI gate paths are approved.
6. Cross-repo handoff packet is published for Nova.

## Decision Log (Must Fill)

| Decision Area | Decision | Owner | Date | Evidence Link | Notes |
| --- | --- | --- | --- | --- | --- |
| Canonical status set | Finalized: semantic set AVAILABLE/ACTIVE/COMPLETED represented as canonical wire values `available`, `active`, `completed` only | Forge Lead | 2026-05-30 | `src/model/mission.js`, `test/sw01-mission-status-contract-hardening.test.js` | Exact three-value canonical set; no compatibility aliases |
| Canonical casing policy | Lowercase for domain values, payload values, schemas, and tests | Forge Lead | 2026-05-30 | `schemas/mission-list-response.schema.json`, `schemas/mission-upsert-response.schema.json`, `openapi.yaml` | Any non-lowercase variant is non-canonical and rejected |
| Legacy status disposition | Reject on request/read/write; no remap/migrate fallback | Forge + Orion | 2026-05-30 | `src/handlers/mission-list-message-handler.js`, `src/handlers/mission-upsert-message-handler.js`, `src/handlers/context/persistence-bridge.js`, `src/db/service/player-character-service.js` | Explicit rejection with allowed-values diagnostics |
| Legacy metadata disposition | Remove legacy lifecycle fields from SW-01 mission contract; retain only `updatedAt` | Forge + QA | 2026-05-30 | `schemas/mission-upsert-request.schema.json`, `schemas/mission-upsert-response.schema.json`, `test/sw01-mission-status-contract-hardening.test.js` | Legacy fields are contract-incompatible for SW-01 mission payloads |
| Invalid status failure contract | Defined and implemented at request, normalization, persistence, and emission boundaries | Forge Lead | 2026-05-30 | `docs/planning/sw-01/sw-01-m0-nova-handoff.md`, mission handler/db tests | Correlation and actionable diagnostics preserved |
| Negative fixture definition | `test/fixtures/sw01/mission-status-invalid-request.json` (`paused`) with intentional hard-fail command | QA Lead | 2026-05-30 | `scripts/sw01/assert-invalid-mission-status-fixture.js`, `npm run contract:lint:mission-status:negative-fixture` | Command exits non-zero by design and prints failure reason |

## Execution Checklist

### A. Canonical Enum Lock

1. Confirm canonical outbound statuses are:
- available
- active
- completed

2. Confirm there are no additional transitional statuses in outward-facing contracts.

3. Confirm casing strategy for:
- Domain model values
- API/event payload values
- Test fixtures

Evidence required:
- Contract diff showing canonical enum only.
- Reviewer approval note.

Owner: Forge Lead
Due: YYYY-MM-DD
Status: [x]
Evidence: `src/model/mission.js`, `test/sw01-mission-status-contract-hardening.test.js`

### B. Legacy Model and Metadata Disposition

1. Enumerate current legacy statuses and mark each as:
- Removed
- Migrated
- Rejected on read/write

2. Enumerate legacy metadata fields and mark each as:
- Retained with SW-01 meaning
- Redefined
- Removed

3. Confirm no silent remap behavior remains.

Evidence required:
- Mapping/disposition table attached.
- Explicit sign-off from Forge + QA + Orion.

Owner: Forge Lead
Due: YYYY-MM-DD
Legacy status mapping/disposition table:

| Legacy/Non-Canonical Status | Disposition | Boundary | Behavior |
| --- | --- | --- | --- |
| accepted | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |
| paused | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |
| started | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |
| in-progress | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |
| failed | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |
| locked | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |
| abandoned | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |
| turned-in | Rejected | request, persistence, emission | Hard fail with allowed-values diagnostics |

Legacy metadata disposition table:

| Field | Disposition | Rationale |
| --- | --- | --- |
| startedAt | Removed from SW-01 mission contracts | Lifecycle-specific and outside canonical lane contract |
| inProgressAt | Removed from SW-01 mission contracts | Lifecycle-specific and outside canonical lane contract |
| failedAt | Removed from SW-01 mission contracts | Failure lifecycle removed from mission lane contract |
| completedAt | Removed from SW-01 mission contracts | Completion lane represented by status + optional `updatedAt` |
| failureReason | Removed from SW-01 mission contracts | Failure semantics removed from lane-only mission contract |
| statusDetail | Removed from SW-01 mission contracts | Non-canonical detail field and drift risk |
| updatedAt | Retained | Canonical recency metadata for lane-safe mission snapshots |

Status: [x]
Evidence: `test/sw01-mission-status-contract-hardening.test.js`, `src/handlers/context/ship-operations-service.js`

### C. Schema and OpenAPI Lock

1. Update mission response schemas to strict enum constraints.
2. Update OpenAPI surfaces and examples to match exactly.
3. Validate schema examples cannot produce non-canonical status.

Evidence required:
- Schema/OpenAPI diff.
- Validation output summary.

Owner: Forge Lead
Due: YYYY-MM-DD
Status: [x]
Evidence: `schemas/mission-list-request.schema.json`, `schemas/mission-list-response.schema.json`, `schemas/mission-upsert-request.schema.json`, `schemas/mission-upsert-response.schema.json`, `openapi.yaml`, `npm run contract:lint:mission-status`

### D. Failure Semantics (Strict-Mode)

1. Define invalid-status response behavior for inbound request validation.
2. Define invalid-status behavior at normalization boundary.
3. Define invalid-status behavior at persistence boundary.
4. Define invalid-status behavior at outbound emission boundary.
5. Confirm correlation metadata and actionable diagnostics are preserved.

Evidence required:
- Failure path specification document section or ADR note.
- Handler/service test proof for failure semantics.

Owner: Forge Lead
Due: YYYY-MM-DD
Status: [x]
Evidence: `src/handlers/mission-upsert-message-handler.js`, `src/handlers/mission-list-message-handler.js`, `src/handlers/context/persistence-bridge.js`, `src/db/service/player-character-service.js`, `test/mission-upsert-message-handler.test.js`, `test/mission-list-message-handler.test.js`, `test/db-service-extended.test.js`

### E. Negative Fixture and Gate Approval

1. Define one intentional invalid-status fixture.
2. Verify fixture fails contract checks in local path.
3. Verify fixture fails contract checks in CI path.
4. Confirm failure output identifies producer location and owner.

Evidence required:
- Fixture file path(s).
- Local and CI failure screenshots/log links.

Owner: QA Lead
Due: YYYY-MM-DD
Status: [x]
Evidence: `test/fixtures/sw01/mission-status-invalid-request.json`, `scripts/sw01/assert-invalid-mission-status-fixture.js`, `npm run contract:lint:mission-status`, `npm run contract:lint:mission-status:negative-fixture` (expected non-zero hard fail)

### F. Cross-Repo Handoff to Nova

1. Publish M0 handoff packet with:
- Final enum contract
- Metadata disposition summary
- Failure semantics summary
- Gate commands and expected outputs

2. Update both SW-01 cross-repo indexes with M0 status.
3. Confirm Nova acknowledges receipt before M1 execution.

Evidence required:
- Handoff note link.
- Nova acknowledgment comment/link.

Owner: Orion
Due: YYYY-MM-DD
Status: [x]
Evidence: `docs/planning/sw-01/sw-01-m0-nova-handoff.md`, `docs/planning/sw-01/sw-01-cross-repo-index.md`

## Risk Checks Before M0 Close

1. Any unresolved legacy status behavior in producer code.
2. Any unconstrained mission.status schema surfaces.
3. Any consumer assumption mismatch still open.
4. Any gate path that cannot fail intentionally invalid status.

If any risk above is true, M0 cannot be closed.

## Formal Sign-Off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Forge Lead | Forge | 2026-05-30 | Approved | M0 producer contract lock complete |
| Nova Lead | Nova | 2026-05-30 | Approved | Handoff acknowledged in `sw-01-m0-nova-handoff.md` |
| QA Lead | QA | 2026-05-30 | Approved | Negative fixture and gate evidence accepted |
| Orion | Orion | 2026-05-30 | Approved | Cross-repo sequencing approved; M1 authorized |

## M0 Close Statement

M0 closed on 2026-05-30. All checklist sections are complete, evidence is attached, and Forge/Nova/QA/Orion sign-offs are recorded. M1 kickoff is authorized.
