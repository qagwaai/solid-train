# SW-15 M1 Forge Verification Note

Date: 2026-06-05
Branch: feature/sw-15-m1
Scope: Forge M1-A, M1-B, M1-C

## Summary

SW-15 M1 persistence lifecycle is implemented for both character-scoped playable-character busts and NPC busts.

Implemented outcomes:
- Playable-character bust create/read/update lifecycle is wired through socket handlers and persisted in player character records.
- NPC bust create/read/update lifecycle is wired through socket handlers and persisted in a dedicated npc bust collection.
- Write paths enforce strict validation and normalization.
- Invalid writes are hard-rejected with validationErrors entries containing field, reason, and rejectedValue.
- schemaVersion and presetVersion are persisted on writes and returned on reads.

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

## Test Evidence

Command:
- node --test test/sw15-m0-contract-hardening.test.js test/sw15-m1-persistence-lifecycle.mongo.integration.test.js

Result:
- tests: 19
- pass: 19
- fail: 0

M1 integration tests added:
- test/sw15-m1-persistence-lifecycle.mongo.integration.test.js

Covered assertions:
- Playable-character save -> read round-trip.
- Playable-character update -> read round-trip.
- NPC save -> read round-trip.
- NPC update -> read round-trip with deterministicSeed and appliedOverrides.
- Negative invalid-write rejection for character descriptor enum mismatch with expected validationErrors evidence.
- Negative invalid-write rejection for NPC override enum mismatch with expected validationErrors evidence.

## Contract Drift Status

No OpenAPI shape drift was introduced.

openapi.yaml was not modified in this M1 implementation.

## Decision Lock Compliance

- Character-scoped ownership preserved. No account-scoped bust source-of-truth introduced.
- Persistence payload remains normalized descriptor plus presetVersion and schemaVersion.
- Invalid payload handling remains hard-reject with explicit validationErrors.
- Deterministic NPC seed behavior remains reproducible and fixture-verifiable (canonical seed mapping retained and validated in integration tests).

## Handoff Note

Ready for Nova M1-V adapter integration.

Endpoint and schema signatures for M1-A and M1-B remained stable during this implementation.

## PR Link Status

PR has not been opened from this workspace execution. Current implementation is prepared on branch feature/sw-15-m1 for PR creation.
