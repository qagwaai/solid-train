# Contract Variance Mitigation Plan

Date: 2026-11-01
Workflow: [SW-08 Contract Safety Gate](https://github.com/qagwaai/solid-train/actions/workflows/sw-08-contract-safety-gate.yml)
Status: In progress

## Goal

Resolve the intentional contract variance behind repeated SW-08 pull request failures without bypassing or weakening the contract safety gate. Update the baseline only after the intended changes and their consumer impact have been reviewed and coordinated.

## Findings

- Recent dependency pull requests pass dependency installation, PR hygiene, deterministic artifact generation, and Stage 3 tests. They fail at PR hard-fail drift detection.
- The latest `main` push reports the same drift in report-only mode. The dependency updates expose existing contract variance; they do not introduce it.
- The hard gate reports 47 issues: 46 removed or no-longer-required fields and one type change.
- The six affected schemas are `CelestialBodyUpsertRequest` (9 findings), `LaunchItemResponse` (8), `ShipListResponse` (8), `ItemUpsertRequest` (8), `Item` (8), and `CreditLedgerListResponse` (6).
- The type change is `CelestialBodyUpsertRequest.properties.celestialBody.properties.motion.properties.angularVelocityRadPerSec`, from `object` to `null | object`.
- The report identifies `laughing-octo-journey` as an impacted consumer. Confirm its ownership and whether this generated consumer identifier is the correct consumer to coordinate with.
- The checked-in `api/artifacts/contracts/contract-artifact.json` is stale relative to current contract sources. Comparing that stored file to the baseline incorrectly yielded zero issues. Regenerating the artifact from current sources and comparing it to the baseline reproduced all 47 findings. Use a freshly generated artifact for all subsequent triage and verification.
- Provenance review attributes 40 findings (the four spatial fields and their required-list entries across five schemas) to commit `81a4914` (`contract change to support new rendering types`). That change replaced inline spatial object schemas with `./spatial-state.schema.json` references; the shared schema still defines all four properties as required. The drift checker compares the baseline's inline shape to the current `$ref` without resolving it, so these 40 findings are false positives, not removed contract fields.
- The six `CreditLedgerListResponse.requestIdentity` findings trace to `dddf3f2` (`feat: Implement credit ledger functionality with new message handler and schema`). The response was intentionally changed from a constrained identity object to an exact echoed request value, including extra properties and malformed/null values; successful responses reference the request schema in the conditional branch. The ledger contract tests cover exact echoes, including malformed metadata.
- The `angularVelocityRadPerSec` change traces to `81a4914`: the schema deliberately broadened its type from `object` to `object | null`.
- The drift artifact now includes resolved local schema definitions, and the checker compares nullable `anyOf`/`oneOf` schemas against their matching structural branch. A fresh comparison reduces the original 47 findings to seven: the six intentional ledger response echo-shape findings and the nullable angular-velocity change. The spatial properties remain required; they no longer appear as removals.
- The confirmed consumer is [`qagwaai/laughing-octo-journey`](https://github.com/qagwaai/laughing-octo-journey). Nova approved treating null angular velocity as absent, retaining optional `Triple` internally, and preserving strict numeric vector validation. The consumer parser now excludes null and arrays before reading vector components, with tests for null, valid, and malformed values.
- For ledger responses, the consumer type permits `requestIdentity: CreditLedgerListRequestIdentity | null` and allows extra identity properties. Normal valid requests and responses are compatible: the consumer supplies and matches the required basic identity fields, and backend failures caused by valid requests echo those same fields. The six remaining findings are specifically the error-response schema allowing `requestIdentity: null` or unconstrained values for malformed requests. The approved policy is to deliver only failures with a matching correlation ID when their echoed identity is missing or unusable; successes and failures with a usable but mismatched identity still require strict identity matching.
- On 2026-11-01, the user approved updating the generated artifact and baseline together. The approved migration outcome classifies the 40 spatial reports as checker false positives, and the seven remaining differences as intentional supported compatibility: nullable angular velocity is normalized as absent by the consumer, while malformed ledger failures are delivered by correlation ID only when echoed identity is unusable. The baseline must be copied from the freshly generated current artifact, not hand-edited.

## Progress tracker

- [x] Review recent SW-08 failures, successful `main` runs, workflow steps, and the SW-08 runbook.
- [x] Reproduce the 47 findings from a freshly generated contract artifact; confirm the six-schema distribution and type mismatch.
- [x] Trace each finding to the intended producer change and verify it against the current contract source.
- [x] Resolve local schema references during artifact generation and compare union schemas against their matching structural branch; verify the 40 spatial false positives are eliminated without losing the seven remaining findings.
- [x] Confirm the impacted consumer repository is `qagwaai/laughing-octo-journey`.
- [x] Obtain Nova approval for the null-safe angular-velocity consumer change.
- [x] Update the consumer parser and add focused null, valid-vector, and malformed-vector tests; verify application/spec types.
- [x] Confirm normal valid ledger request/response identity behavior is compatible between producer and consumer.
- [x] Decide malformed ledger error behavior: deliver failures with unusable/missing echoed identity by matching correlation ID alone; retain strict identity checks for successes and well-formed identities.
- [x] Implement the consumer correlation-only failure fallback and test null, missing, and unusable identities, while confirming successful responses and well-formed mismatches remain strict.
- [x] Verify producer handling of null/missing identity requests returns a schema-valid `invalid-request` response that echoes the correlation ID and null identity.
- [x] Decide and document the migration outcome for each variance: the 40 spatial reports are eliminated as checker false positives; the remaining seven are intentional and supported by the verified consumer behavior.
- [x] Record the approved compatibility outcome and regenerate the contract artifact. The current source schemas already express the reviewed contract, so no additional schema edits were needed.
- [x] Regenerate and review the baseline alongside the coordinated migration; the user approved copying the freshly generated current artifact as the new baseline.
- [x] Add a contract-variance preflight to every server startup path. It builds a fresh artifact and checks the approved baseline before database initialization or listening; any variance blocks startup with actionable findings. The user approved the fail-closed policy. `start`, `start:host`, `start:dev`, `dev`, and direct `node src/server.js` all route through this check.
- [x] Verify the local hard-fail gate passes and the drift fixtures still reject unintended breaking changes. PR/workflow verification remains pending.
- [x] Confirm main-branch reporting and rerun affected dependency PR checks after the migration is merged. Main report and trend guardrail are clean; SW-08 hard gates pass on affected PRs #73 and #74.

## Mitigation sequence

1. **Establish change provenance.** Map each reported field change to its producer schema and originating change. Validate that the current OpenAPI sources express the intended new contract.
2. **Coordinate consumers.** Contact the confirmed owner of the affected consumer(s), share the field-level variance and rollout sequence, and verify that each consumer can handle the new requiredness and nullable type. The consumer parser treats `angularVelocityRadPerSec: null` as absent. Ledger failures with unusable/missing identity are delivered by matching correlation ID only, per the approved policy; successes and usable identities remain strictly matched.
3. **Choose the compatibility path.** Restore fields or preserve aliases when consumers still depend on the old contract. For intentional removals or nullable changes, document and sequence the consumer migration. Use an exception only if policy requirements, approvals, ownership, expiry, rollback steps, and follow-up tracking are satisfied.
4. **Align generated artifacts and baseline.** Regenerate the contract artifact from source. Once compatibility and migration evidence are approved, update the baseline and migration documentation in the same coordinated change. Do not waive the gate for dependency updates or accept the baseline solely to make CI green.
5. **Check variance on every server start.** Completed: all supported server entry points run a fail-closed in-memory artifact comparison against the approved baseline before initialization/listening.
6. **Verify and close.** Completed for the main-branch SW-08 workflow and affected dependency PR contract gates. The separate dependency-vulnerability gate on those PRs is still failing and should be handled as its own security/dependency follow-up.

## Verification commands

Run from the repository root:

```powershell
npm run contract:artifact
npm run contract:gate:hard
node --test test/sw08-contract-stage3.test.js
```

The commands above are the local reproduction steps. On the merged main commit, `npm run contract:gate:hard` passed with zero drift, and the SW-08 Stage 3 suite passed. Post-merge workflow and trend results are recorded below.

## Progress notes

- 2026-11-01: Initial triage and local reproduction complete. Fresh generation reproduced the workflow's 47 findings; no contract or baseline changes were made pending provenance and consumer confirmation.
- 2026-11-01: Provenance traced. Forty findings came from unexpanded spatial `$ref`s. Added local-reference resolution to generated artifacts and union-aware shape comparison to the drift checker; the fresh comparison now reports seven variances (six ledger echo-shape findings and one nullable angular-velocity change). The approved baseline and checked-in generated artifact were not changed.
- 2026-11-01: `node --test test/sw08-contract-drift-check.test.js test/sw08-contract-stage3.test.js test/credit-ledger-contract.test.js` passed (14 tests). The hard-fail check against a freshly generated temporary artifact remains red as expected, enforcing all seven remaining variances.
- 2026-11-01: Confirmed `laughing-octo-journey` is `qagwaai/laughing-octo-journey`. Consumer-source review found a null dereference risk in angular-velocity parsing and a response correlation policy that drops malformed ledger identity echoes.
- 2026-11-01: At this point in triage, Nova approved treating null angular velocity as absent while retaining optional `Triple` and the existing numeric checks. Updated `src/app/model/ship-item.ts` in `qagwaai/laughing-octo-journey` to exclude null/arrays and added tests in `src/app/model/ship-list.vitest.ts` for null, valid vectors, and malformed vectors. `npx vitest run --config vitest.config.mts src/app/model/ship-list.vitest.ts` passed (27 tests); `npm run typecheck` passed; `npx eslint src/app/model/ship-item.ts src/app/model/ship-list.vitest.ts` passed; `npx prettier --check src/app/model/ship-item.ts src/app/model/ship-list.vitest.ts` passed. No consumer type, server schema, or baseline changes were made in that consumer fix.
- 2026-11-01: Initial ledger review confirmed valid typed requests carry required identity and are correlated normally, including typed failures. Only malformed/missing identities were dropped by the consumer matcher. The policy decision and implementation are recorded in the later ledger progress entry.
- 2026-11-01: Approved ledger policy: deliver an unsuccessful response by matching correlation ID alone only when its echoed identity is missing or unusable. Implemented the fallback and focused consumer tests for null, missing, blank, wrong-correlation, successful-null, and well-formed mismatched identities. `npx vitest run --config vitest.config.mts src/app/services/credit-ledger.service.vitest.ts` passed (7 tests); `npm run typecheck`, targeted ESLint, Prettier check, and `git diff --check` passed in `qagwaai/laughing-octo-journey`. Added producer socket coverage proving null and omitted request identities produce schema-valid `invalid-request` failures with correlation IDs and null echoes; `node --test test/credit-ledger-contract.test.js` passed (7 tests). No server schema or baseline changes were made.
- 2026-11-01: User approved updating the baseline and generated artifact after compatibility review. Regenerated the artifact; the pre-update hard gate confirmed exactly seven known differences. Copied the generated artifact to `baseline-contract-artifact.json`. A subsequent artifact regeneration preserved identical SHA-256 hashes for current and baseline (`7AD894C618C5720EA1A05FA69CA517A4473F438E2150559F19C3345DD14E0A38`); `npm run contract:gate:hard` passed with zero issues. Updated the drift regression test so it remains valid after baseline alignment: it verifies raw references would create spatial false positives, resolved schemas eliminate them, and nullable type drift remains detected. Focused drift/ledger tests passed (9 tests), and the SW-08 Stage 3 tests passed (5 tests).
- 2026-11-01: User approved blocking server startup on variance. Added `scripts/sw08/startup-preflight.js`, invoked at the beginning of `startServer()` before MongoDB initialization/listening. It compares a freshly built in-memory artifact against the approved baseline, fails explicitly for a missing baseline or drift, and logs success when clean. All npm startup scripts route through `src/server.js`; direct execution uses the same guarded path. Made schema-reference resolution independent of the caller's working directory and deferred Prettier loading so runtime preflight does not require the formatter. Startup preflight tests (4 tests), actual `startServer` integration test, typecheck, targeted ESLint/Prettier, and combined SW-08/ledger regression tests (17 tests) passed; preflight also passed when invoked from outside the repository directory. README startup documentation is updated.
- 2026-11-01: Post-merge verification completed on `main` commit `3d974684f3d8f6c97ea1e0909d3ce06a2ac9dd12`. [SW-08 run 41323136535](https://github.com/qagwaai/solid-train/actions/runs/41323136535) succeeded: artifact generation, Stage 3 validation, main report-only drift detection, and recurrence guardrail all passed. Its uploaded drift report has 0 issues; weekly and rolling-30 metrics each considered one report with 0 drift, 0 open incidents, and no recurrence escalation. Updated the two affected open dependency PR branches to this main commit; [#73 SW-08 run 41323284040](https://github.com/qagwaai/solid-train/actions/runs/41323284040) and [#74 SW-08 run 41323283647](https://github.com/qagwaai/solid-train/actions/runs/41323283647) both passed the PR hard-fail gate plus SW-01/SW-13 contract gates. Their separate CodeQL checks passed. The separate Secrets/Dependencies workflow failed `npm audit --audit-level=high` on both PRs due to high findings in `body-parser` (GHSA-27r3-jxmh-p828) and `follow-redirects` (GHSA-mrwp-f3q8-3g9p); moderate `minimatch` and `qs` findings were also reported. Contract-security assertions in that workflow were skipped after the audit failure. These are separate dependency-security follow-ups, outside SW-08.

## Nova review prompt

Copy this prompt to Nova to review and approve the consumer-side change before implementation:

```text
Review the proposed nullable angular-velocity compatibility change in qagwaai/laughing-octo-journey. Do not edit files yet; provide an approval decision and any blocking concerns first.

Context:
- The SW-08 contract gate identified an intentional change to CelestialBodyUpsertRequest.celestialBody.motion.angularVelocityRadPerSec from `object` to `object | null`.
- The producer-side contract and baseline are not being changed as part of this consumer review.
- In `src/app/model/ship-item.ts`, the parser checks `typeof m['angularVelocityRadPerSec'] === 'object'` and then reads `x`, `y`, and `z`. Since `typeof null === 'object'`, a null value can throw.
- `ShipMotion.angularVelocityRadPerSec` in `src/app/model/ship-list.ts` is currently optional `Triple`, not nullable.

Review the smallest safe consumer change:
1. Treat null angular velocity as absent in the parser, without throwing.
2. Keep normalized `ShipMotion.angularVelocityRadPerSec` as optional `Triple` unless you identify a specific reason the internal model must preserve null.
3. Preserve validation of non-null values: only accept an object with numeric x, y, and z; do not weaken the existing checks.
4. Add or update focused tests for null (no throw and no angular vector), a valid vector (preserved), and malformed vectors (rejected/omitted).

Please inspect the actual parser, types, and existing tests before deciding. Return:
- APPROVE or BLOCK, with concise reasoning;
- any required adjustment to the proposed behavior;
- the exact files and focused test/type-check commands that should be used if approved.

Do not address the separate malformed credit-ledger error-echo question; that decision is deferred. Do not change server schemas, the SW-08 baseline, or gate policy as part of this review.
```
