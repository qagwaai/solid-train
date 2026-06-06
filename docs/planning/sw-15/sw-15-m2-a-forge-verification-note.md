# SW-15 M2-A Forge Verification Note

Date: 2026-06-05
Branch: feature/sw-15-m1
Scope: Forge M2-A response semantics lock

## Summary

SW-15 M2-A response semantics are now locked for:
- Hard-reject validation error responses.
- Blocked-save reason responses.
- Normalized payload echo responses after create/update operations.

Implemented outcomes:
- Added canonical blocked-save response structure with typed reason and retryable flag.
- Locked canonical blocked-save reason enum values for SW-15 bust create/update save paths.
- Preserved hard-reject validation behavior with explicit validationErrors (field, reason, rejectedValue).
- Kept normalized create/update success payloads deterministic and schema-conformant.
- Preserved character-scoped and npc-scoped ownership model with no account-level bust source-of-truth.

## Canonical Blocked-Save Semantics (Locked)

Blocked-save payload shape:
- success: false
- message: string
- correlationId: uuid
- requestIdentity: { operation, entityType, containerId }
- blockedSave: { reason, retryable }

Canonical blockedSave.reason enum:
- PLAYER_NOT_REGISTERED
- CHARACTER_NOT_FOUND
- CHARACTER_BUST_NOT_FOUND
- NPC_BUST_NOT_FOUND
- DATABASE_ERROR

retryable policy:
- retryable: true only for DATABASE_ERROR.
- retryable: false for ownership/state precondition blocks.

## Endpoints Exercised

- /socket/character-bust-create
- /socket/character-bust-read
- /socket/character-bust-update
- /socket/npc-bust-create
- /socket/npc-bust-read
- /socket/npc-bust-update

## Schema and Component Names Exercised

- BustDescriptor
- BustValidationErrorResponse
- BustBlockedSaveResponse
- CharacterBustCreateRequest
- CharacterBustCreateResponse
- CharacterBustReadRequest
- CharacterBustReadResponse
- CharacterBustUpdateRequest
- CharacterBustUpdateResponse
- NpcBustCreateRequest
- NpcBustCreateResponse
- NpcBustReadRequest
- NpcBustReadResponse
- NpcBustUpdateRequest
- NpcBustUpdateResponse
- bust-blocked-save-response.schema.json

## Test Evidence

Command:
- node --test test/sw15-m0-contract-hardening.test.js test/sw15-m1-persistence-lifecycle.mongo.integration.test.js

Result:
- tests: 22
- pass: 22
- fail: 0

M2-A semantic lock coverage added:
- Contract tests:
  - OpenAPI includes BustBlockedSaveResponse component.
  - Blocked-save schema has success=false and locked blockedSave.reason enum.
  - Create/update response schemas include blocked-save variant.
- Integration tests:
  - Blocked-save response emitted with deterministic reason and retryable semantics.
  - Hard-reject invalid writes still emit validationErrors and no blockedSave.
  - Successful create/update payloads remain normalized and do not carry blockedSave/validationErrors.

Intentional mismatch hard-reject evidence:
- Character descriptor enum mismatch (faceShape=triangle) hard-rejects with validationErrors.
- NPC override enum mismatch (hairStyle=spiky) hard-rejects with validationErrors.

## Contract Drift Status

OpenAPI shape change introduced intentionally for M2-A semantic lock:
- Added BustBlockedSaveResponse component reference.
- Added blocked-save semantics and examples to bust create/update endpoint docs.
- Updated create/update response schemas to include typed blocked-save variant.

Source-fix policy honored:
- Runtime response semantics and OpenAPI/schema artifacts were aligned in-source.
- No downstream compensating behavior was introduced.

## Decision Lock Compliance

- Character-scoped ownership preserved; no account-scoped bust source-of-truth introduced.
- Persistence payload shape remains normalized descriptor plus presetVersion/schemaVersion.
- Invalid payload behavior remains hard-reject with explicit validationErrors.
- Endpoint and schema naming stability preserved; only explicit contract additions for M2-A were made.

## PR Link Status

Merged

## Handoff Note

Ready-for-Nova-M2-A handoff is confirmed.

Nova M2-A can proceed against locked response semantics for:
- Validation hard-reject responses,
- Blocked-save reason responses,
- Normalized create/update payload echoes.
