# SW-13 M3 Orion Decision Lock Note (Forge)

Status: Locked
Date: 2026-05-30
Feature: SW-13 External Object Presentation Expansion
Milestone: M3 Jump Gate Landmark Pass
Scope: Forge contract and payload evidence alignment before Nova M3 evidence pass

## Decision Lock Summary

1. Route-smoke gate coverage
- Every route-smoke run must exercise all three gate families.
- Required per-run families: ring-gate, segmented-arch, relay-spindle.
- Aggregate suite-only coverage is not sufficient for M3 sign-off.

2. hazardCue interpretation
- hazardCue value medium is mandatory warning escalation in M3 evidence criteria.
- medium is not informational-only in this milestone.

3. Numeric tolerance guidance
- Orion will publish tolerance guidance before Nova finalizes threshold assertions.
- recommendedStandOffKm and approachWindowKm min/max checks should use Orion-published tolerances.

4. approachCue to landmarkFraming matrix
- A required mapping matrix is not needed for M3.
- Enum validation plus fixture alignment is sufficient for this milestone.

## Forge Evidence Mapping

1. OpenAPI source of truth
- openapi.yaml component registration for ExternalObjectGateLandmarkPayload is authoritative.

2. Canonical M3 payload fixture
- test/fixtures/sw13/external-object-gate-landmark-m3.json is deterministic and includes all three gate families per payload run.

3. M3 lock assertions
- test/sw13-external-object-descriptor-m3-gate-landmark.test.js enforces:
  - all-family per-run gate coverage,
  - medium hazard mandatory warning escalation,
  - complete and bounded approach metadata semantics.
