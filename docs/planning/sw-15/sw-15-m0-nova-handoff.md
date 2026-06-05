# SW-15 M0 Nova Handoff Packet

Status: Ready for Nova Acknowledgment
Date: 2026-06-05
From repo: solid-train (Forge)
To repo: laughing-octo-journey (Nova)
Feature ID: SW-15
Milestone: M0 — Descriptor and Persistence Baseline Lock

---

## 1. Purpose

Transmit SW-15 M0 contract baseline from Forge to Nova so cross-repo implementation can proceed without descriptor drift.

This packet completes the Forge side of the M0 Orion gate. Nova acknowledgment is required before M1 implementation starts.

## 2. OpenAPI Contract Reference

Contract source of truth: `openapi.yaml` in `solid-train` repo.

New `Bust` tag groups all bust endpoints.

### Playable-Character Bust Endpoints

| operationId | Path |
|---|---|
| `socketCharacterBustCreate` | `/socket/character-bust-create` |
| `socketCharacterBustRead` | `/socket/character-bust-read` |
| `socketCharacterBustUpdate` | `/socket/character-bust-update` |

Request schemas use `characterId` to identify the target playable character. All bust operations are character-scoped.

### NPC Bust Endpoints

| operationId | Path |
|---|---|
| `socketNpcBustCreate` | `/socket/npc-bust-create` |
| `socketNpcBustRead` | `/socket/npc-bust-read` |
| `socketNpcBustUpdate` | `/socket/npc-bust-update` |

NPC bust create/update requests use `deterministicSeed` for baseline generation. Optional `overrides` field supports admin-tool manual field overrides.

## 3. Core Schema Components

| Component | Description |
|---|---|
| `BustDescriptor` | Normalized descriptor with all 6 domain fields + `schemaVersion` + `presetVersion` |
| `BustValidationErrorResponse` | Hard-reject shape: `success: false`, `validationErrors[]` with `field`/`reason`/`rejectedValue` |

All bust response schemas embed `BustDescriptor` as the `descriptor` field.

## 4. Descriptor Domain Enum Summary

Nova selector controls must map to these canonical values only. Unknown values are hard-rejected by Forge.

| Domain | Canonical Values |
|---|---|
| `faceShape` | `oval`, `round`, `square`, `angular`, `narrow` |
| `skinTone` | `pale`, `light`, `medium`, `tan`, `dark`, `deep` |
| `hairStyle` | `short-crop`, `mid-fade`, `long-loose`, `braided`, `shaved`, `slicked` |
| `hairColor` | `black`, `brown`, `auburn`, `blonde`, `silver`, `white`, `red` |
| `eyeStyle` | `narrow`, `wide`, `almond`, `hooded`, `round` |
| `eyeColor` | `brown`, `hazel`, `green`, `blue`, `grey`, `amber`, `violet` |
| `expressionPreset` | `neutral`, `focused`, `smirk`, `stern`, `warm`, `weary` |
| `apparelAccent` | `none`, `collar`, `hood`, `visor`, `goggles`, `headband` |

## 5. Fixture Pass Evidence

Fixture: `test/fixtures/sw15/character-bust-canonical-pass.json`

Run: `node --test test/sw15-m0-contract-hardening.test.js`

Expected result: `✔ SW-15 canonical character bust fixture passes schema validation`

Fixture content:
```json
{
  "schemaVersion": "sw-15-m0-v1",
  "presetVersion": "v1",
  "faceShape": "oval",
  "skinTone": "medium",
  "hairStyle": "short-crop",
  "hairColor": "brown",
  "eyeStyle": "almond",
  "eyeColor": "green",
  "expressionPreset": "neutral",
  "apparelAccent": "none"
}
```

## 6. Mismatch Hard-Fail Evidence

Fixture: `test/fixtures/sw15/character-bust-mismatch-fail.json`

Expected result: `✔ SW-15 mismatch character bust fixture hard-fails schema validation`

The fixture uses `faceShape: "triangle"` (not a valid enum value). The test asserts validation fails and the `rejectedValue` is `"triangle"`. This confirms the no-silent-correction policy.

## 7. NPC Seed Replay Evidence

Fixture: `test/fixtures/sw15/npc-bust-seed-replay.json`

Expected result: `✔ SW-15 NPC seed replay fixture has required deterministicSeed`

Seed: `faction:trade|role:merchant|id:001` → deterministic descriptor with `faceShape: round`, `expressionPreset: warm`, etc.

## 8. Persistence Shape Confirmation

- Playable-character bust: embedded under `Player.characters[].bust` (players collection).
- NPC bust: `npc_busts` collection keyed by `npcId`.
- Both shapes include `schemaVersion: sw-15-m0-v1` and `presetVersion`.
- NPC bust additionally stores `deterministicSeed` and `appliedOverrides[]`.
- Full schema documented in `MONGODB_SCHEMA.md` under "SW-15 Bust Persistence Model".

## 9. Nova Action Checklist

1. Align selector control values to canonical enum domains above.
2. Ensure preview renderer only consumes canonical descriptor values from `BustDescriptor`.
3. Wire save/cancel/reset flows against `character-bust-create`, `character-bust-update`, `character-bust-read` endpoints.
4. Surface `validationErrors[]` from `BustValidationErrorResponse` in UX (blocked-save reason display).
5. Confirm NPC rendering path consumes `deterministicSeed` output from `npc-bust-read` response.
6. Do not introduce additional descriptor fields or ad hoc payload shapes outside this contract.
7. Attach Nova M0-V fixture compatibility verification evidence in the SW-15 cross-repo coordination index.

## 10. Handoff Rule

Nova M1 implementation starts only after Nova M0-V acknowledgment is recorded and Orion signs the M0 gate.

## 11. Acknowledgment

Nova acknowledgment status: Pending.

Acknowledgment notes:
- Add Nova M0-V confirmation, fixture compatibility evidence, and any deviations here.
