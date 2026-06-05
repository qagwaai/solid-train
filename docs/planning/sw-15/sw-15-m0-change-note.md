# SW-15 M0 Change Note (Forge)

Status: Complete
Date: 2026-06-05
Feature: SW-15 Minimal Character Bust Builder v0
Milestone: M0 — Descriptor and Persistence Baseline Lock
Repo: solid-train (Forge)
Contract source of truth: openapi.yaml

---

## 1. Impacted Endpoints

All endpoints are new additions. No existing endpoints were modified.

| Path | operationId | Tag |
|---|---|---|
| `/socket/character-bust-create` | `socketCharacterBustCreate` | Bust |
| `/socket/character-bust-read` | `socketCharacterBustRead` | Bust |
| `/socket/character-bust-update` | `socketCharacterBustUpdate` | Bust |
| `/socket/npc-bust-create` | `socketNpcBustCreate` | Bust |
| `/socket/npc-bust-read` | `socketNpcBustRead` | Bust |
| `/socket/npc-bust-update` | `socketNpcBustUpdate` | Bust |

## 2. Schema Component Names

All schema components are new additions under `components/schemas`.

| Component Name | Schema File |
|---|---|
| `BustDescriptor` | `schemas/bust-descriptor.schema.json` |
| `BustValidationErrorResponse` | `schemas/bust-validation-error-response.schema.json` |
| `CharacterBustCreateRequest` | `schemas/character-bust-create-request.schema.json` |
| `CharacterBustCreateResponse` | `schemas/character-bust-create-response.schema.json` |
| `CharacterBustReadRequest` | `schemas/character-bust-read-request.schema.json` |
| `CharacterBustReadResponse` | `schemas/character-bust-read-response.schema.json` |
| `CharacterBustUpdateRequest` | `schemas/character-bust-update-request.schema.json` |
| `CharacterBustUpdateResponse` | `schemas/character-bust-update-response.schema.json` |
| `NpcBustCreateRequest` | `schemas/npc-bust-create-request.schema.json` |
| `NpcBustCreateResponse` | `schemas/npc-bust-create-response.schema.json` |
| `NpcBustReadRequest` | `schemas/npc-bust-read-request.schema.json` |
| `NpcBustReadResponse` | `schemas/npc-bust-read-response.schema.json` |
| `NpcBustUpdateRequest` | `schemas/npc-bust-update-request.schema.json` |
| `NpcBustUpdateResponse` | `schemas/npc-bust-update-response.schema.json` |

## 3. Descriptor Domains and Enum Values

The `BustDescriptor` schema (`bust-descriptor.schema.json`) defines these constrained enum domains:

| Field | Enum Values |
|---|---|
| `faceShape` | `oval`, `round`, `square`, `angular`, `narrow` |
| `skinTone` | `pale`, `light`, `medium`, `tan`, `dark`, `deep` |
| `hairStyle` | `short-crop`, `mid-fade`, `long-loose`, `braided`, `shaved`, `slicked` |
| `hairColor` | `black`, `brown`, `auburn`, `blonde`, `silver`, `white`, `red` |
| `eyeStyle` | `narrow`, `wide`, `almond`, `hooded`, `round` |
| `eyeColor` | `brown`, `hazel`, `green`, `blue`, `grey`, `amber`, `violet` |
| `expressionPreset` | `neutral`, `focused`, `smirk`, `stern`, `warm`, `weary` |
| `apparelAccent` | `none`, `collar`, `hood`, `visor`, `goggles`, `headband` |

Runtime taxonomy is declared in `src/model/bust-descriptor.js`.

## 4. Validation and Error Behavior

- All descriptor domain fields are constrained enums. Unknown values are hard-rejected.
- Invalid payloads receive a `422` response with `BustValidationErrorResponse` shape (never silently corrected).
- `BustValidationErrorResponse` contains `success: false`, a human-readable `message`, and a `validationErrors` array with at least one entry per invalid field.
- Each `validationErrors` entry provides: `field` (dot-notation path), `reason` (human-readable), `rejectedValue` (exact rejected value).
- `additionalProperties: false` is enforced on `BustDescriptor` and `BustValidationErrorResponse`.

## 5. Entity Ownership Model

- Bust records are character-scoped. They belong to playable-character records or NPC records.
- No global player-level bust profile exists. A player interacts with busts only through the currently selected playable character.
- Playable-character bust: embedded under `Player.characters[].bust` in the players collection.
- NPC bust: stored in a dedicated `npc_busts` collection keyed by `npcId`.

## 6. presetVersion and schemaVersion Notes

- `schemaVersion` is `sw-15-m0-v1` for all records created under this contract baseline.
- Any schema update in a future milestone requires a version bump before new writes proceed.
- `presetVersion` is caller-supplied on character bust create/update. It is stored verbatim and returned on read for reproducibility.
- NPC busts also store `deterministicSeed` — the seed used to derive the baseline descriptor. Replaying the same seed must produce the same descriptor output.
- No migration is required for existing character records; the `bust` subdocument is absent until first write.
- The `npc_busts` collection is new in SW-15 M0.

## 7. Runtime Model File

Enum constants are exported from `src/model/bust-descriptor.js`. Contract hardening test `test/sw15-m0-contract-hardening.test.js` asserts that schema JSON enums remain aligned with runtime constants.
