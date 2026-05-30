# SW-01 Pre-Implementation Findings (Forge)

Status: Draft
Date: 2026-05-26
Repo: solid-train
Feature ID: SW-01

## Purpose

Capture the backend gaps identified during SW-01 planning review so they are resolved deliberately before implementation begins.

## Summary

SW-01 requires a strict, contract-first mission status model with three canonical outbound statuses only:

1. `available`
2. `active`
3. `completed`

The current solid-train implementation does not meet that target yet. The items below should be treated as required pre-implementation work, not optional cleanup.

## Findings To Address Before Implementation

### 1. Mission status enum is broader than the SW-01 contract

Current state:

- `src/model/mission.js` defines legacy lifecycle statuses including `available`, `started`, `in-progress`, `failed`, `completed`, `locked`, `abandoned`, `paused`, and `turned-in`.

Why this matters:

- SW-01 requires the producer contract to emit only `available`, `active`, and `completed`.
- The current enum is the primary source for validation and filtering behavior, so leaving it unchanged would preserve drift at the root.

Action needed before implementation:

- Decide the canonical internal enum strategy for SW-01.
- Update mission domain constants so producer logic cannot continue validating or emitting removed lifecycle states.

### 2. Mission list filtering currently drops unknown statuses instead of failing hard

Current state:

- `src/handlers/mission-list-message-handler.js` sanitizes requested `statuses` by filtering out unknown values.

Why this matters:

- SW-01 explicitly requires strict failure behavior for unknown mission statuses.
- Silent filtering hides producer-consumer drift instead of surfacing it in tests, gates, and runtime diagnostics.

Action needed before implementation:

- Replace best-effort status sanitization with explicit validation and terminal failure behavior.
- Ensure correlation metadata and actionable diagnostics are preserved on the failure path.

### 3. Mission response schemas do not constrain status values

Current state:

- `schemas/mission-list-response.schema.json` leaves mission entries effectively unconstrained.
- `schemas/mission-upsert-response.schema.json` defines `mission.status` as an unconstrained string.
- The corresponding `openapi.yaml` surfaces inherit that looseness.

Why this matters:

- SW-01 is contract-first. If the schema allows any string, the contract cannot enforce lane-safe mission statuses.
- Shape-only validation would create false confidence while allowing semantic drift.

Action needed before implementation:

- Add strict schema enums for canonical mission statuses.
- Update OpenAPI examples and descriptions so the contract and examples match exactly.

### 4. Mission upsert logic is built around legacy lifecycle states

Current state:

- `src/handlers/mission-upsert-message-handler.js` validates against the broad legacy enum.
- Timestamp side effects currently depend on states such as `started`, `in-progress`, `failed`, and `completed`.

Why this matters:

- SW-01 narrows the contract to three statuses, which means current state-transition and timestamp rules need explicit redesign.
- Leaving lifecycle-specific branches in place would preserve dead compatibility logic that SW-01 explicitly rejects.

Action needed before implementation:

- Define the allowed SW-01 state transitions.
- Decide which existing timestamp fields remain meaningful under the new three-status model.
- Remove legacy-only transition logic rather than remapping it silently.

### 5. Mission normalization and persistence boundaries do not yet enforce the new contract

Current state:

- Shared mission normalization paths currently pass mission status through as generic strings.
- Persistent mission subdocuments still reflect the legacy lifecycle shape.

Why this matters:

- SW-01 needs validation at a central boundary, not only at one response handler.
- Without a read/write boundary decision, invalid persisted states can leak back into outbound mission payloads.

Action needed before implementation:

- Choose the canonical enforcement boundary for persisted mission status values.
- Add strict validation at normalization or persistence boundaries so invalid statuses cannot round-trip.

### 6. Test coverage is not yet aligned to SW-01 strictness

Current state:

- Existing mission tests primarily cover the legacy status set and current handler behavior.
- Current schema/tests do not hard-fail because the contract is still permissive.

Why this matters:

- SW-01 requires unit, integration, and contract coverage that proves only canonical statuses pass.
- The plan also requires a negative fixture that fails reliably for invalid status input.

Action needed before implementation:

- Identify the unit tests to rewrite around canonical status validation.
- Add integration coverage for mission-list emission under the new enum.
- Add a negative contract fixture that fails on any non-canonical mission status.

### 7. Legacy metadata fields need an explicit SW-01 disposition

Current state:

- Mission payloads currently expose optional fields such as `startedAt`, `inProgressAt`, `failedAt`, `completedAt`, `failureReason`, and `statusDetail`.

Why this matters:

- The planning docs define the target statuses but do not fully specify whether all legacy lifecycle metadata remains valid.
- This is the main unresolved modeling question that could otherwise lead to accidental half-migrations.

Action needed before implementation:

- Decide which metadata fields remain part of the SW-01 contract.
- Remove or redefine fields whose meaning depended on statuses that SW-01 removes.

## Recommended Pre-Implementation Checklist

1. Confirm the exact canonical status enum and casing for both internal and outbound models.
2. Resolve the fate of legacy lifecycle timestamps and failure metadata.
3. Define strict invalid-status behavior for request validation, normalization, persistence, and emission.
4. Lock schema/OpenAPI changes before touching handler logic.
5. Identify the negative fixture and gate path that will enforce the contract in CI.

## Suggested Execution Order

1. Contract/schema decision and metadata disposition.
2. Domain enum and normalization boundary update.
3. Handler validation and emission changes.
4. Unit, integration, and contract test updates.
5. Cross-repo Nova alignment and canary readiness.