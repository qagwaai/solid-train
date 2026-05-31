# SW-13 M4 Orion Decision Lock Note (Forge)

Status: Locked
Date: 2026-05-30
Feature: SW-13 External Object Presentation Expansion
Milestone: M4 Descriptor Size and Payload Consistency Review
Scope: Forge contract and payload evidence alignment before Nova M4 evidence pass

## Decision Lock Summary

1. Size budget and runtime guardrails
- Nova must consume the M4 size budget from the stable fixture report.
- Nova must enforce runtime guardrails with the same authoritative envelope limits.
- Authoritative envelope limits:
  - descriptor entries maxItems: 16
  - gate entries maxItems: 3

2. Numerical thresholds
- Nova dense-scene tests must use hard numerical thresholds tied to the committed M4 report.
- Relative regression checks alone are insufficient for M4 sign-off.
- Explicit threshold enforcement must include gate descriptor max bytes of 328.

3. Artifact-to-fixture parity
- Artifact-to-fixture parity against artifacts/contracts/sw13-m4-size-consistency-report.json and test/fixtures/sw13/sw13-m4-size-consistency-report.json is required for M4 sign-off.
- The M4 report is authoritative evidence, not informational-only context.

## Forge Evidence Mapping

1. M4 review generator
- scripts/sw13/review-descriptor-size-consistency.js

2. M4 threshold and runtime guardrail assertions
- test/sw13-descriptor-size-consistency-m4.test.js

3. M4 artifact-to-fixture parity gate
- scripts/sw13/assert-size-review-parity.js
- npm run contract:review:sw13:size:parity
