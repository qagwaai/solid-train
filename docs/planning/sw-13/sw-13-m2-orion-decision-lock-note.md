# SW-13 M2 Orion Decision Lock Note (Forge)

Status: Locked
Date: 2026-05-30
Feature: SW-13 External Object Presentation Expansion
Milestone: M2 Ship and Station Family Pass
Scope: Forge contract/payload evidence alignment before Nova M2 evidence pass

## Decision Lock Summary

1. Recognition check coverage
- Canonical M2 baseline must include all 9 descriptors in `test/fixtures/sw13/external-object-descriptor-m2-ships-stations.json`.
- Route-smoke subsets are allowed, but full-9 evidence is required for M2 sign-off.

2. fallbackTier treatment in Nova evidence
- `fallbackTier` is treated as data plus behavior for M2.
- M2 evidence must include tier-behavior assertions for `hero`, `standard`, and `minimal`.

3. API surface requirement
- OpenAPI component-level contract surfacing is sufficient for M2 handoff.
- No dedicated descriptor retrieval API surface is required in this milestone.

4. Faction mapping lock
- Current Forge mappings for `frigate`, `interceptor`, and `naval-outpost` are accepted for M2 readability baseline.
- Orion will require a formal faction matrix before M3; this is not an M2 blocker.

## Forge Evidence Mapping

1. OpenAPI source of truth
- `openapi.yaml` component registration for `ExternalObjectDescriptor` and `ExternalObjectDescriptorPayload` is authoritative.

2. Canonical M2 payload fixture
- `test/fixtures/sw13/external-object-descriptor-m2-ships-stations.json` is deterministic, schema-version-locked baseline coverage.

3. M2 lock assertions
- `test/sw13-external-object-descriptor-m2-ship-station.test.js` enforces:
  - full-9 descriptor coverage,
  - ships/stations-only domain scope for M2,
  - fallback tier coverage + tier-behavior assertions.
