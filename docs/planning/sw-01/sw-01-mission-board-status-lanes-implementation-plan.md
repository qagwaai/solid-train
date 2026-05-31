# SW-01 Mission Board Status Lanes Implementation Plan (Backend-Led)

Status: Complete (Closed)
Date: 2026-05-26
Completed: 2026-05-30
Repo: solid-train
Related repo: laughing-octo-journey
Feature ID: SW-01
Priority Reference: High value, low implementation risk

## 1. Objective

Deliver backend contract and producer behavior for Mission Board Status Lanes so Nova can render Available, Active, and Completed lanes with strict, no-fallback semantics.

This plan adopts:

1. v1-first delivery.
2. Breaking contract cleanup.
3. Strict fail on unknown statuses.
4. Canary-only release progression.
5. No legacy compatibility support.

## 2. Implementation Boundaries

In scope:

1. Producer schema updates in openapi.yaml and related response models.
2. Mission status normalization and emission constraints in services/handlers.
3. CI gates for producer contract and cross-repo alignment.
4. Canary validation hooks and rollback readiness.

Out of scope:

1. Nova UI implementation details.
2. Feature expansion beyond lane semantics.
3. Compatibility windows for legacy status variants.

## 3. Contract-First Delivery Sequence

1. Update producer contract first
- Canonicalize mission status enum to available, active, completed.

2. Update producer emitters second
- Ensure all mission list producers emit canonical enum only.

3. Update validation gates third
- Enforce hard-fail on drift or invalid status in PR path.

4. Cross-repo alignment fourth
- Confirm Nova consumer inventory matches producer contract.

5. Canary rollout fifth
- Validate runtime correctness before full release.

## 4. Workstreams

### W1. Schema and Contract Updates

Tasks:

1. Update mission status schema in openapi.yaml.
2. Remove deprecated status values from producer contract definitions.
3. Regenerate any derived schema artifacts and verify deterministic output.

Deliverables:

1. Updated producer contract with canonical enum.
2. Contract diff notes for Nova handoff.

### W2. Producer Runtime Enforcement

Tasks:

1. Add status normalization/validation in mission domain service boundary.
2. Prevent outbound response emission for non-canonical statuses.
3. Ensure domain mapping cannot silently coerce unknown values.

Deliverables:

1. Producer logic that emits only canonical statuses.
2. Structured error path for invalid status states.

### W3. Verification and Gates

Tasks:

1. Add unit tests for status validation and mapping.
2. Add integration tests for mission-list payload contract compliance.
3. Add contract test for intentional invalid-status rejection.
4. Wire strict gate checks to PR pipeline.

Deliverables:

1. Passing strict test suite for valid statuses.
2. Failing suite for intentionally invalid fixture.
3. Hard-fail CI gate for drift.

### W4. Cross-Repo Coordination

Tasks:

1. Publish producer contract update and migration note to Nova.
2. Verify Nova consumer contract inventory compatibility.
3. Resolve any drift findings before canary enablement.

Deliverables:

1. Signed off producer-consumer contract alignment.
2. Linked evidence in SW-01 cross-repo index.

### W5. Canary Rollout and Readiness

Tasks:

1. Enable SW-01 path in canary only.
2. Monitor invalid status emission count and mission payload errors.
3. Run rollback drill for gate and producer rollback path.

Deliverables:

1. Canary validation report.
2. Go/no-go recommendation.

## 5. Verification Milestones

M0: Baseline contract lock

1. Producer schema enum updated and reviewed.
2. Contract diff approved.
3. Known invalid fixture fails as expected.

M1: Producer emission compliance

1. Mission list payloads contain canonical enum only.
2. Unit tests pass for valid mappings.
3. Injected invalid status fails emission path.

Status update (2026-05-30): Complete.
Evidence:
1. `src/handlers/mission-list-message-handler.js`
2. `test/mission-list-message-handler.test.js`
3. `test/sw01-mission-status-contract-hardening.test.js`
4. `npm run contract:lint:mission-status` (pass)
5. `npm run contract:lint:mission-status:negative-fixture` (expected fail)

M2: Integration contract confidence

1. Mission list integration tests pass on canonical values.
2. Contract tests fail on non-canonical enum.
3. Local parity commands match CI outcomes.

Status update (2026-05-30): Complete.
Evidence:
1. `test/server.test.js` (`mission-list` integration coverage)
2. `test/db-service-branch.mongo.integration.test.js` (persistence boundary integration coverage)
3. `test/sw01-mission-status-contract-hardening.test.js` (schema/OpenAPI strict enum checks)
4. `node --test test/server.test.js --test-name-pattern "mission-list integration|mission add stores mission progress|mission-list operation emits only|mission-list responses strictly echo|mission list emits invalid session"` (pass)
5. `node --test test/db-service-branch.mongo.integration.test.js` (pass)
6. `npm run contract:lint:mission-status` (pass)
7. `npm run contract:lint:mission-status:negative-fixture` (expected fail, exit 1)

M3: Cross-repo gate alignment

1. Nova consumer inventory and Forge producer contract are aligned.
2. PR with drift fails hard in gate path.
3. Remediation output is actionable for both teams.

Status update (2026-05-30): Complete.
Evidence:
1. `scripts/sw01/run-cross-repo-gate.js` (prints actionable owner/severity/producer/surface/remediation hints)
2. `test/fixtures/sw01/m3/nova-consumer-inventory-aligned.json` (Nova-aligned mission-list inventory)
3. `test/fixtures/sw01/m3/mission-list-drift-enum-mismatch.json` (intentional enum casing drift)
4. `test/fixtures/sw01/m3/nova-consumer-inventory-legacy-status.json` (intentional unsupported `accepted` status expectation)
5. `test/fixtures/sw01/m3/mission-list-drift-shape-mismatch.json` (intentional payload shape drift)
6. `npm run contract:compat-check:sw01` (pass, hard-fail mode with zero drift)
7. `npm run contract:compat-drift:sw01:enum` (expected fail, actionable diagnostics)
8. `npm run contract:compat-drift:sw01:unsupported-status` (expected fail, actionable diagnostics)
9. `npm run contract:compat-drift:sw01:shape` (expected fail, actionable diagnostics)
10. `npm run contract:compat-check:sw01` after drift checks (pass re-confirmation)

M4: Dual gate enforcement

1. Forge mission-status compliance gate is hard-fail and active in PR path.
2. Nova contract/preflight compatibility gate is hard-fail and active in PR path.
3. Intentional drift scenarios fail in both gate layers with actionable diagnostics.

Status update (2026-05-30): Complete.
Evidence:
1. `.github/workflows/sw-08-contract-safety-gate.yml` (PR steps run Forge hard gate and Nova preflight hard gate)
2. `package.json` (`contract:gate:sw01:forge`, `contract:preflight:sw01:nova`, `contract:gate:sw01:dual`, `contract:gate:sw01:forge:drift:enum`, `contract:gate:sw01:forge:drift:unsupported-status`, `contract:gate:sw01:forge:drift:shape`)
3. `npm run contract:gate:sw01:forge` (pass)
4. `npm run contract:preflight:sw01:nova` (pass)
5. `npm run contract:gate:sw01:forge:drift:enum` (expected hard fail)
6. `npm run contract:gate:sw01:forge:drift:unsupported-status` (expected hard fail)
7. `npm run contract:gate:sw01:forge:drift:shape` (expected hard fail)
8. `npm run contract:lint:mission-status:negative-fixture` (expected hard fail)
9. `npm run contract:compat-drift:sw01:enum` (expected hard fail)
10. `npm run contract:compat-drift:sw01:unsupported-status` (expected hard fail)
11. `npm run contract:compat-drift:sw01:shape` (expected hard fail)
12. `npm run contract:gate:sw01:forge && npm run contract:preflight:sw01:nova` after drift checks (pass re-confirmation)
13. `artifacts/contracts/sw01-m4-forge-pass-report.json`
14. `artifacts/contracts/sw01-m4-forge-drift-enum-report.json`
15. `artifacts/contracts/sw01-m4-forge-drift-unsupported-status-report.json`
16. `artifacts/contracts/sw01-m4-forge-drift-shape-report.json`
17. `artifacts/contracts/sw01-m4-nova-preflight-report.json`

M5: Canary quality gate

1. Canary runtime shows zero non-canonical status emissions.
2. No P1 or P2 defects in agreed soak window.
3. Rollback drill completed successfully.

Recommendation (2026-05-30): Go for M5 execution.
Rationale:
1. Forge and Nova hard-fail gates are now active in PR path with deterministic local parity.
2. Enum, unsupported status, and payload shape drifts fail with actionable ownership/remediation diagnostics.
3. Canonical pass path remains green after drift probes.

Status update (2026-05-30): Closed.
Evidence summary:
1. Canary validation completed with no non-canonical mission status emissions observed.
2. No P1/P2 defects remained open during the agreed soak window.
3. Rollback drill completed and canonical post-drill checks re-passed.
4. Cross-repo Nova and Forge reports aligned on closure recommendation.

M6 recommendation (2026-05-30): Go.
Rationale:
1. M0-M5 evidence chain is complete with hard-fail gate integrity maintained.
2. Canary and rollback criteria for SW-01 were satisfied.
3. No contract or lane-semantics blockers remain for release decision review.

M6: Release decision gate

1. Go/no-go decision recorded.
2. Closure checklist complete.
3. SW-01 status moves to maintenance mode.

Status update (2026-05-30): Closed.
Decision: Go.
Evidence summary:
1. M0-M5 milestones closed with accepted evidence.
2. Canary validation and rollback readiness criteria satisfied.
3. Cross-repo Forge/Nova indexes and closure checklists updated to complete state.

## 6. Test Matrix

Unit tests:

1. Status enum validator accepts only canonical values.
2. Domain-to-contract mapper emits deterministic status values.
3. Invalid internal status path raises structured error.

Integration tests:

1. Mission list endpoints return canonical status for all seeded missions.
2. Filtered mission queries align with status lanes.
3. Error path instrumentation includes required metadata.

Contract tests:

1. Schema snapshot contains canonical enum only.
2. Intentional mismatch fixture fails hard.
3. Cross-repo compatibility check passes when aligned.

## 7. CI/CD Gate Design

PR path (required):

1. Contract artifact generation.
2. Contract hard-fail check.
3. Invalid fixture assertion.
4. Cross-repo compatibility check.

Main path (required):

1. Repeat PR checks.
2. Publish contract artifact for Nova sync.
3. Record SW-01 metrics (pass/fail, drift count, runtime violations).

## 8. Risks and Mitigations

Risk: Hidden legacy statuses in old mission records.
Mitigation: Add migration/normalization guard at read boundary and fail test on unrecognized values.

Risk: Producer-consumer merge sequence mismatch.
Mitigation: Enforce cross-repo index sign-off before canary enablement.

Risk: False confidence from shape-only checks.
Mitigation: Keep semantic enum assertions and negative fixtures mandatory.

Risk: Canary drift under real load.
Mitigation: Runtime telemetry alert on first non-canonical emission.

## 9. Done Criteria

1. Producer contract enumerates only available, active, completed.
2. Producer runtime emits canonical statuses only.
3. Strict CI gates fail on any drift or invalid status.
4. Cross-repo alignment with Nova is documented and validated.
5. Canary passes without critical defects and rollback path is proven.
