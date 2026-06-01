# SW-01 Mission Board Status Lanes Runbook (Backend-Led)

Status: Draft (Operational)
Date: 2026-05-26
Repo: solid-train

## 1. Trigger

Use this runbook when SW-01 contract gates fail, mission status payload checks fail, or canary reports non-canonical mission statuses.

## 2. Triage Sequence

1. Capture failing gate and failure identifier.
2. Identify failing contract surface (schema, producer emission, cross-repo compatibility).
3. Reproduce locally using parity commands.
4. Classify issue type: producer bug, schema drift, sequencing mismatch, or canary runtime defect.
5. Execute resolution path and re-run strict checks.

## 3. Local Reproduction Steps

1. Pull latest main branch in solid-train.
2. Regenerate contract artifact.
3. Run strict contract gate command set for SW-01.
4. Run mission status unit and integration tests.
	- `node --test test/server.test.js --test-name-pattern "mission-list integration|mission add stores mission progress|mission-list operation emits only|mission-list responses strictly echo|mission list emits invalid session"`
	- `node --test test/db-service-branch.mongo.integration.test.js`
5. Run negative fixture test injecting invalid mission status.
6. Compare generated artifact against expected canonical enum.
7. If cross-repo drift is reported, validate Nova inventory compatibility.

SW-01 M3 parity command set:

1. `npm run contract:artifact`
2. `npm run contract:lint:mission-status`
3. `npm run contract:compat-check:sw01` (expected pass)
4. `npm run contract:compat-drift:sw01:enum` (expected fail; enum casing drift)
5. `npm run contract:compat-drift:sw01:unsupported-status` (expected fail; unsupported status expectation drift)
6. `npm run contract:compat-drift:sw01:shape` (expected fail; payload shape drift)
7. `npm run contract:compat-check:sw01` (expected pass after drift probes)

Expected hard-fail diagnostics include:

1. Severity and owner.
2. Producer location.
3. Impacted consumer surface.
4. Remediation hint.

SW-01 M4 dual-gate parity command set:

1. `npm run contract:gate:sw01:forge` (expected pass)
2. `npm run contract:preflight:sw01:nova` (expected pass)
3. `npm run contract:gate:sw01:forge:drift:enum` (expected hard fail)
4. `npm run contract:gate:sw01:forge:drift:unsupported-status` (expected hard fail)
5. `npm run contract:gate:sw01:forge:drift:shape` (expected hard fail)
6. `npm run contract:lint:mission-status:negative-fixture` (expected hard fail)
7. `npm run contract:compat-drift:sw01:enum` (expected hard fail)
8. `npm run contract:compat-drift:sw01:unsupported-status` (expected hard fail)
9. `npm run contract:compat-drift:sw01:shape` (expected hard fail)
10. `npm run contract:gate:sw01:forge && npm run contract:preflight:sw01:nova` (expected pass after drift probes)

Dual-gate hard-fail diagnostics must include:

1. Severity and owner.
2. Producer location.
3. Impacted consumer surface.
4. Remediation hint.
5. Correlation-aware request context where request fixtures are involved.

## 4. Resolution Paths

Schema drift fix:

1. Restore canonical enum in producer schema.
2. Re-generate artifacts and re-run gate.
3. Publish updated contract handoff note.

Producer emission fix:

1. Correct mapper/normalizer to emit canonical statuses only.
2. Add or update tests for failing scenario.
3. Re-run integration and contract checks.

Cross-repo sequencing fix:

1. Coordinate merge order with Nova.
2. Ensure both repos point to same schema snapshot.
3. Re-run compatibility checks in both repos.

Canary defect fix:

1. Disable SW-01 canary path if non-canonical emissions occur.
2. Patch producer behavior.
3. Re-enable canary only after clean verification cycle.

## 5. Severity and Escalation

P1:

- Non-canonical mission status emitted in canary/production.
- Immediate disablement of SW-01 path and backend lead escalation.

P2:

- Contract gate fails on PR with no approved remediation path.
- Assign owner same day and resolve within SLA window.

P3:

- Documentation mismatch or non-blocking test coverage gap.
- Resolve in next planned maintenance window.

Escalation chain:

1. Forge lead
2. Nova lead
3. Engineering manager

## 6. Communication Template

- Incident ID:
- Failure category:
- Contract surface:
- Impacted consumer:
- Assigned owner:
- ETA:
- Rollback needed: yes/no
- Verification evidence link:

## 7. Canary Go or No-Go Checklist

1. Zero non-canonical mission status emissions.
2. All strict contract and integration checks green.
3. Cross-repo compatibility verified against current Nova inventory.
4. No unresolved P1/P2 defects in soak window.
5. Rollback procedure validated and documented.

## 8. Post-Incident Checklist

1. Root cause documented.
2. Missing test or rule added.
3. Contract or runbook update completed.
4. Preventive owner and due date assigned.
