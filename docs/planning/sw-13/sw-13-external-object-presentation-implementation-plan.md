# SW-13 External Object Presentation Expansion Implementation Plan (Forge-Led)

Status: Draft (Execution Ready)
Date: 2026-05-30
Repo: solid-train
Related repo: laughing-octo-journey
Feature ID: SW-13
Priority Reference: Visual readability and world identity expansion with balanced performance

## 1. Objective

Deliver backend descriptor contracts and producer behavior for SW-13 so Nova can render clearer external object identity for debris, ships, jump gates, stations, and asteroid style variation.

This plan adopts:

1. v1-first delivery.
2. Breaking contract cleanup.
3. Strict fail on unknown descriptor values.
4. Canary-only release progression.
5. No legacy compatibility support.

## 2. Implementation Boundaries

In scope:

1. Producer schema updates in `openapi.yaml` and related response models for external-object descriptors.
2. Descriptor normalization and emission constraints in services/handlers.
3. CI gates for producer contract and cross-repo descriptor alignment.
4. Canary validation hooks for readability and drift safety.

Out of scope:

1. Nova renderer implementation details.
2. Full 3D asset pipeline overhaul.
3. Scene architecture rewrite.

## 3. Contract-First Delivery Sequence

1. Update producer contract first
- Canonicalize descriptor domains (`debris`, `ship`, `jump_gate`, `station`, `asteroid`) and asteroid styles (`rocky`, `hero_cinematic`).

2. Update producer emitters second
- Ensure all external-object producers emit canonical descriptor values only.

3. Update validation gates third
- Enforce hard-fail on drift or invalid descriptor values in PR path.

4. Cross-repo alignment fourth
- Confirm Nova consumer inventory matches producer descriptor contract.

5. Canary rollout fifth
- Validate runtime readability correctness before full release.

## 4. Workstreams

### W1. Schema and Contract Updates

Tasks:

1. Update external-object descriptor schema in `openapi.yaml`.
2. Remove deprecated descriptor values from producer contract definitions.
3. Regenerate derived schema artifacts and verify deterministic output.

Deliverables:

1. Updated producer contract with canonical descriptor domains.
2. Contract diff notes for Nova handoff.

### W2. Producer Runtime Enforcement

Tasks:

1. Add descriptor normalization/validation in external-object domain service boundary.
2. Prevent outbound response emission for non-canonical descriptor values.
3. Ensure domain mapping cannot silently coerce unknown values.

Deliverables:

1. Producer logic that emits only canonical descriptor values.
2. Structured error path for invalid descriptor states.

### W3. Verification and Gates

Tasks:

1. Add unit tests for descriptor validation and mapping.
2. Add integration tests for external-object payload contract compliance.
3. Add contract test for intentional invalid-descriptor rejection.
4. Wire strict gate checks to PR pipeline.

Deliverables:

1. Passing strict test suite for canonical descriptors.
2. Failing suite for intentional invalid fixtures.
3. Hard-fail CI gate for descriptor drift.

Architecture and testing best-practice requirements:

1. Keep descriptor contract schema, producer normalization, and API emission concerns in separate modules.
2. Keep normalization and enum/style resolution logic in pure, independently testable functions.
3. Keep contract constants centralized to avoid duplicated enum literals across handlers/services.
4. Enforce dependency direction from transport handlers -> domain services -> schema/validation utilities.
5. Prevent reverse dependencies from domain modules back into transport-layer concerns.

Recommended SW-13 test matrix:

1. Unit tests
- Descriptor normalization and canonical domain enforcement.
- Asteroid style policy decisions (`rocky` vs `hero_cinematic`).

2. Integration tests
- External-object response generation with canonical descriptor payloads.
- Failure semantics for invalid descriptor injection.

3. Contract tests
- Canonical pass fixtures.
- Drift hard-fail fixtures: enum/domain mismatch, unsupported value, and payload shape mismatch.

4. Cross-repo compatibility tests
- Nova consumer inventory alignment against Forge contract artifact.

5. Regression safeguards
- Legacy fallback reintroduction checks.
- Deterministic artifact generation and parity checks.

### W4. Cross-Repo Coordination

Tasks:

1. Publish producer contract update and migration note to Nova.
2. Verify Nova consumer contract inventory compatibility.
3. Resolve drift findings before canary enablement.

Deliverables:

1. Signed producer-consumer descriptor alignment.
2. Linked evidence in SW-13 cross-repo index.

### W5. Canary Rollout and Readiness

Tasks:

1. Enable SW-13 path in canary only.
2. Monitor descriptor drift and external-object readability signals.
3. Run rollback drill for gate and producer rollback path.

Deliverables:

1. Canary validation report.
2. Go/no-go recommendation.

## 5. Verification Milestones

M0: Baseline contract lock

1. Producer descriptor schema updated and reviewed.
2. Contract diff approved.
3. Known invalid fixture fails as expected.

M1: Producer emission compliance

1. External-object payloads contain canonical descriptor values only.
2. Unit tests pass for valid mappings.
3. Injected invalid descriptor fails emission path.

M2: Integration contract confidence

1. External-object integration tests pass on canonical values.
2. Contract tests fail on non-canonical descriptors.
3. Local parity commands match CI outcomes.

M3: Cross-repo gate alignment

1. Nova consumer inventory and Forge producer descriptor contract are aligned.
2. PR with descriptor drift fails hard in gate path.
3. Remediation output is actionable for both teams.

M4: Dual gate enforcement

1. Forge descriptor compliance gate is hard-fail and active in PR path.
2. Nova descriptor preflight gate is hard-fail and active in PR path.
3. Intentional descriptor drift scenarios fail in both gate layers with actionable diagnostics.

M5: Canary quality gate

1. Canary runtime shows zero non-canonical descriptor emissions.
2. No P1 or P2 defects in agreed soak window.
3. Rollback drill completed successfully.

M6: Release decision

1. Go/no-go decision recorded.
2. Closure checklist complete.
3. SW-13 status moves to maintenance mode.

## 6. Risks and Mitigations

1. Risk: descriptor contract drift across repos.
- Mitigation: strict dual-gate contract checks and drift fixtures.

2. Risk: visual ambiguity persists despite descriptor updates.
- Mitigation: canonical descriptor domains plus readability-focused acceptance criteria in canary.

3. Risk: scope creeps into renderer rewrite.
- Mitigation: enforce producer-contract-only boundary in Forge scope.

4. Risk: maintainability degradation through contract duplication.
- Mitigation: centralize schema constants, enforce layering rules, and require migration notes for contract changes.

## 7. Architecture Governance

1. Record architecture decisions (ADR-style note) when adding or changing descriptor domains.
2. Require code-review checks for separation of concerns and dependency direction.
3. Treat contract drift failures as source-of-truth violations; fix producer schema/emission first.
4. Require test evidence updates alongside any contract-surface change.

## 8. Exit Criteria

1. All milestones M0-M6 closed with evidence.
2. Producer payloads emit canonical descriptor values only.
3. Cross-repo alignment remains green under strict gates.
4. No legacy compatibility path remains in producer descriptor flow.
5. Architecture governance checks are satisfied with no unresolved layering exceptions.
