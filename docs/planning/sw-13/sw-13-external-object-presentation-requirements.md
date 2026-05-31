# SW-13 External Object Presentation Expansion Requirements (Forge-Led)

Status: Draft (Execution Ready)
Date: 2026-05-30
Repo: solid-train
Related repo: laughing-octo-journey
Owner: Forge lead (primary), Nova lead (co-owner), QA lead (validation)

## 1. Purpose

Define producer-side requirements for SW-13 so external-object descriptors are canonical, contract-valid, and safe for Nova rendering across debris, ships, jump gates, stations, and asteroid variants.

## 2. Scope

In scope:

- Canonical external-object descriptor semantics in producer contracts.
- Descriptor payload guarantees for visual family selection in Nova.
- Strict rejection of non-canonical descriptor values.
- Cross-repo contract validation with Nova consumer assumptions.

Out of scope:

- Full renderer rewrite.
- Full 3D asset overhaul.
- Legacy compatibility behavior for pre-SW-13 descriptor shapes.

## 3. Canonical Contract Surface

Primary source-of-truth:

1. `openapi.yaml` object descriptor schemas in solid-train.
2. External-object payload contracts consumed by Nova ship-external flows.

Descriptor family domains (SW-13 canonical):

1. `debris`
2. `ship`
3. `jump_gate`
4. `station`
5. `asteroid`

Asteroid style domain:

1. `rocky`
2. `hero_cinematic`

Cutover rule:

- SW-13 is full cutover. Legacy descriptor domains and legacy mapping paths are forbidden.

## 4. Breaking Change Policy (SW-13)

SW-13 explicitly allows breaking contract cleanup.

Required producer actions:

1. Remove deprecated external-object descriptor values from outbound payloads.
2. Remove producer-side fallback mapping that preserves deprecated semantics.
3. Fail validation on any descriptor outside canonical domains.

Forbidden producer behavior:

1. Emitting legacy descriptor domain with best-effort fallback.
2. Silent remapping that hides drift from contract gates.
3. Reintroducing legacy descriptor variants for backward compatibility.

## 5. Functional Requirements

1. Descriptor emission
- Object descriptor producers emit only canonical domains and style values.

2. Deterministic rendering semantics
- Descriptor values map one-to-one with Nova rendering taxonomy.

3. Validation-first behavior
- Invalid descriptor values are rejected before outbound emission.

4. Asteroid variety support
- Producer payloads must support both rocky and hero-cinematic asteroid style selection.

5. Observability
- Invalid descriptor attempts include operation name, entity key, and correlation metadata.

## 6. Non-Functional Requirements

1. Determinism
- Contract artifacts and descriptor ordering are deterministic across runs.

2. Reliability
- Contract checks run in CI and local parity commands.

3. Latency safety
- Descriptor validation logic does not regress critical external-object response latency beyond agreed threshold.

4. Operability
- Gate failures provide actionable producer location and remediation path.

5. Separation of concerns
- Contract schema, descriptor normalization, and transport emission must remain separate layers.
- Business/domain logic must not depend on consumer renderer implementation details.

6. Testability
- Descriptor mapping and validation paths must be executable through pure or near-pure modules.
- Deterministic fixtures must exist for canonical and drift scenarios.

7. Maintainability
- Descriptor domains and style enums must be centrally defined to avoid duplication.
- Any schema evolution requires explicit migration notes and ownership assignment.

## 7. Gate and Verification Requirements

1. Producer contract gate
- Hard-fail PR checks when descriptor schema drifts from canonical set.

2. Consumer compatibility gate
- Hard-fail when Nova consumer inventory disagrees with producer descriptor schema.

3. Dual gate enforcement
- Forge producer gate and Nova preflight gate are both active and blocking in PR workflow.
- Local parity commands must match CI pass/fail behavior.

4. Negative fixture coverage
- Intentional invalid descriptor fixture must fail reliably in CI.

5. Canary validation
- SW-13 release promotion is blocked if canary shows descriptor drift or unreadable object identity regressions.

6. Legacy fallback prevention gate
- PR checks must fail if legacy descriptor fallback/remap logic is reintroduced.

7. Test-layer minimum coverage
- Unit: descriptor validation and normalization rules.
- Integration: producer emission with canonical descriptor payloads.
- Contract: drift fixtures for casing, unsupported values, and shape mismatches.

## 8. Acceptance Criteria

1. Producer payloads emit only canonical descriptor domains.
2. Contract artifacts reflect canonical descriptor domains and pass strict checks.
3. Intentional invalid descriptor fixtures fail in local and CI paths.
4. Cross-repo checks pass with aligned Nova assumptions.
5. No legacy compatibility path remains in producer descriptor logic.

## 9. Ownership and SLA

Forge lead:

- Own producer schema and descriptor emission correctness.

Nova lead:

- Own strict consumer mapping and visible fallback-free rendering behavior.

QA lead:

- Own negative fixtures and canary validation evidence.

SLA:

1. Triage descriptor-contract failures within 1 business day.
2. Fix or approved rollback action within 2 business days.

## 10. Related Documents

1. docs/planning/sw-13/sw-13-external-object-presentation-implementation-plan.md
2. docs/planning/sw-13/sw-13-pre-implementation-findings.md
3. docs/planning/sw-13/sw-13-cross-repo-index.md
4. ../../../laughing-octo-journey/docs/planning/sw-13/sw-13-external-object-presentation-implementation-plan.md
