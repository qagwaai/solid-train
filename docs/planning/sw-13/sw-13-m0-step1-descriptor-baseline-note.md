# SW-13 M0 Step 1 Decision Note (Forge)

Status: Draft (Step 1 complete)
Date: 2026-05-30
Feature: SW-13 External Object Presentation Expansion
Milestone: M0 Descriptor Baseline Lock
Scope: Step 1 only (canonical descriptor schema + enum taxonomy)

## Decision Summary

The SW-13 descriptor contract is locked as a deterministic, descriptor-first schema with explicit fields and domain-scoped family enums.

Canonical domains included in this step:

1. debris
2. ships
3. gates
4. stations
5. asteroids

## Why Each Top-Level Field Exists

1. descriptorId
- Stable identity key for fixtures, telemetry correlation, and drift diagnostics.

2. schemaVersion
- Hard pins the contract baseline (`sw-13-m0-v1`) so drift detection remains explicit.

3. domain
- Declares the object domain used to drive domain-specific family constraints.

4. objectFamily
- Canonical visual taxonomy selector; constrained by domain to avoid ambiguous shape choices.

5. roleCue
- Encodes gameplay-readable role intent (salvage, military, navigation, etc.) for selector logic.

6. factionCue
- Encodes ownership/alignment identity cue for cross-team consistency in presentation semantics.

7. fallbackTier
- Deterministic fallback reference (`hero`, `standard`, `minimal`) for balanced-performance policy.

8. displayLabel
- Human-readable diagnostic label for debugging and optional overlays without adding fallback mappings.

9. silhouetteProfile
- Explicit readability cue for distance and motion-safe recognition.

10. materialProfile
- Explicit material identity cue to avoid ad hoc polymorphic styling decisions.

11. emissiveProfile
- Explicit brightness/navigation cue for landmark readability.

## Guardrails Applied in Step 1

1. Descriptor-first contract is source of truth.
2. Explicit required fields with `additionalProperties: false`.
3. Domain-specific family enums are hard constrained via schema conditionals.
4. No legacy mapping fallback fields introduced.
5. No Step 2 fixture additions included in this pass.

## Orion Decision Lock (Applied Before Step 2)

Date locked: 2026-05-30

1. Fallback tier naming
- Locked values remain exactly: `hero`, `standard`, `minimal`.
- No cross-feature naming normalization in M0.

2. Gate family values
- Locked values for `sw-13-m0-v1`: `ring-gate`, `segmented-arch`, `relay-spindle`.
- No reserved expansion value in this version.
- Any expansion requires a schemaVersion bump.

3. Faction cue policy
- `unknown` is allowed for unattributed objects, including canary fixtures.
- No forced `neutral` substitution policy.

4. schemaVersion mismatch behavior (Step 2)
- Fixtures must hard-fail any schemaVersion other than `sw-13-m0-v1`.
- No prerelease suffix policy in this milestone.

5. displayLabel policy
- Required for all production descriptors.
- Required for canonical pass fixtures.
- May be omitted only in intentional negative mismatch fixtures.
