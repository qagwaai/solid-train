# SW-01 M0 Nova Handoff Packet (Forge)

Status: Nova acknowledgment posted (M0 handoff complete)
Date: 2026-05-30
Repo: solid-train
Feature ID: SW-01
Milestone: M0 Contract baseline lock

## 1. Final Enum Contract

Semantic status set:
- AVAILABLE
- ACTIVE
- COMPLETED

Canonical wire/domain/test casing policy:
- Mission status values are lowercase strings only: `available`, `active`, `completed`.
- Any value outside that exact lowercase set is non-canonical and rejected.

Contract sources:
- `src/model/mission.js`
- `schemas/mission-list-request.schema.json`
- `schemas/mission-list-response.schema.json`
- `schemas/mission-upsert-request.schema.json`
- `schemas/mission-upsert-response.schema.json`
- `openapi.yaml` (`/socket/mission-list`, `/socket/mission-upsert`)

## 2. Failure Semantics Summary

Request boundary:
- `mission-upsert` rejects non-canonical `status` with:
  - `status must be one of: available, active, completed`
- `mission-list` rejects non-canonical `statuses` entries with:
  - `statuses contains unsupported values: ... Allowed values: available, active, completed`

Normalization boundary:
- Mission response formatting validates normalized mission status against canonical set.
- Non-canonical normalized statuses trigger terminal failure messages:
  - `mission normalization produced unsupported status: ...`

Persistence boundary:
- Mission write operations reject non-canonical values before DB/cache mutation:
  - `Mission persistence rejected unsupported status: ...`
- Enforced in both handler persistence bridge and DB player-character mission service.

Emission boundary:
- Persisted mission rows with non-canonical statuses are rejected on read with diagnostic failure:
  - `mission data contains unsupported status values: ...`
  - `existing mission data has unsupported status: ...`

Observability/correlation:
- Validation failures continue emitting actionable diagnostics with `operation`, `entityType`, `containerId`, and `correlationId` in logs.

## 3. Legacy Disposition

Legacy statuses:
- Disposition for non-canonical values (`accepted`, `paused`, `started`, `in-progress`, `failed`, `locked`, `abandoned`, `turned-in`): rejected on request/read/write; no remap or fallback.

Legacy metadata fields in mission contract:
- Removed from SW-01 mission request/response contracts: `statusDetail`, `startedAt`, `inProgressAt`, `failedAt`, `completedAt`, `failureReason`.
- `updatedAt` retained as canonical mission recency metadata.

## 4. Gate Commands and Expected Outputs

Passing producer contract lint:
- `npm run contract:lint:mission-status`
- Expected: all tests pass.

Intentional negative fixture hard fail:
- `npm run contract:lint:mission-status:negative-fixture`
- Expected: exits non-zero with
  - `[sw01-negative-fixture] Expected failure confirmed...`

Fixture:
- `test/fixtures/sw01/mission-status-invalid-request.json`

## 5. Evidence Bundle

Key tests:
- `test/sw01-mission-status-contract-hardening.test.js`
- `test/mission-upsert-message-handler.test.js`
- `test/mission-list-message-handler.test.js`
- `test/db-service-extended.test.js`
- `test/db-service-branch.mongo.integration.test.js`

## 6. Nova Action Required Before M1

1. Confirm Nova mission lane mapping accepts only lowercase `available|active|completed`.
2. Confirm Nova invalid-status UX path treats any other status as terminal producer contract violation.
3. Acknowledge this handoff in SW-01 cross-repo tracking before M1 starts.

## 7. Nova Acknowledgment

Acknowledgment status: Complete
Acknowledged by: Nova
Date: 2026-05-30
Decision: Accepted for SW-01 M1 kickoff sequencing

Acknowledgment notes:
1. Nova confirms lane mapping accepts only lowercase `available`, `active`, `completed`.
2. Nova confirms non-canonical statuses are treated as terminal contract violations with visible UI handling.
3. Nova confirms M0 handoff requirements are complete and M1 can begin.
