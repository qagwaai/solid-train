# SW-13 M4 Descriptor Size and Payload Consistency Review Note (Forge)

Status: Complete (Forge scope)
Date: 2026-05-30
Feature: SW-13 External Object Presentation Expansion
Milestone: M4 Descriptor Size and Payload Consistency Review
Scope: Forge review evidence for Nova dense-scene checks, without introducing new runtime behavior

## M4 Review Objective

1. Produce deterministic, repeatable evidence for payload size and descriptor-shape consistency across M1, M2, and M3 fixture bundles.
2. Confirm M0 lock persistence:
- schemaVersion remains sw-13-m0-v1.
- fallbackTier remains hero/standard/minimal.
- legacy fallback fields remain absent.
3. Provide bounded payload envelope guidance for Nova dense-scene planning.

## Forge Evidence Artifacts

1. Review generator
- scripts/sw13/review-descriptor-size-consistency.js computes stable metrics and lock-check summaries.

2. Canonical M4 evidence fixture
- test/fixtures/sw13/sw13-m4-size-consistency-report.json stores deterministic review output for ongoing fixture parity.

3. M4 lock assertions
- test/sw13-descriptor-size-consistency-m4.test.js enforces deterministic report parity and lock-check invariants.

4. Contract-size bounds
- schemas/external-object-descriptor-payload.schema.json adds descriptors.maxItems: 16.
- schemas/external-object-gate-landmark-payload.schema.json adds gates.maxItems: 3.

## Dense-Scene Baseline Summary (Current Fixture State)

1. Payload byte sizes (stable-stringified)
- m1DebrisAsteroids: 3320 bytes
- m2ShipsStations: 3694 bytes
- m3GateLandmarks: 2517 bytes

2. Descriptor counts by domain
- debris: 4
- asteroids: 4
- ships: 5
- stations: 4
- gates: 3

3. Shape and lock consistency
- descriptor field keys are consistent across all fixture bundles.
- gate approach metadata field keys are consistent across all gate entries.
- deterministic descriptorId ordering passes for all bundles.
