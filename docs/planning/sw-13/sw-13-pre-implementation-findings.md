# SW-13 Pre-Implementation Findings (Forge)

Status: Draft
Date: 2026-05-30
Repo: solid-train
Feature ID: SW-13

## 1. Assessment Goal

Identify backend contract and producer gaps that must be closed before SW-13 execution begins.

## 2. Key Findings

1. Descriptor contract surface is not yet standardized for SW-13 domains.
- Impact: Nova cannot safely depend on stable external-object family semantics.
- Required action: add canonical descriptor domains and strict schema validation.

2. Producer emission paths may contain implicit mapping assumptions.
- Impact: unknown/legacy values can leak to consumers.
- Required action: enforce validation-first producer emission with hard-fail on non-canonical descriptor values.

3. Cross-repo gate path does not yet include SW-13-specific drift fixtures.
- Impact: descriptor drift could pass PR checks undetected.
- Required action: add SW-13 compatibility checks and intentional drift scenarios.

4. Asteroid variation support is not explicitly represented in producer descriptor taxonomy.
- Impact: rocky-to-cinematic variance cannot be guaranteed by contract.
- Required action: include `asteroid` style domain with canonical style constraints.

5. Legacy compatibility assumptions may still exist in edge mapping code.
- Impact: full-cutover requirement may be violated silently.
- Required action: remove legacy fallback mappings and gate against reintroduction.

## 3. Readiness Decision

Current readiness: Conditional Go for M0.

Go conditions:

1. SW-13 descriptor schema baseline lands and passes hard-fail contract lint.
2. Initial drift fixtures are in place (enum mismatch, unsupported domain, shape mismatch).
3. Nova receives M0 handoff packet and acknowledges contract baseline.

## 4. Evidence Plan

1. Contract schema diff for descriptor domains.
2. Negative fixtures and expected-fail command outputs.
3. Cross-repo alignment report linked in SW-13 index.
4. M0 checklist sign-offs (Forge, Nova, QA, Orion).
