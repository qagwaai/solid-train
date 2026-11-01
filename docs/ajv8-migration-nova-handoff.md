# AJV 8 Validation Migration and Nova Handoff

Status: Forge local validation complete; Nova acknowledgment pending
Date: 2026-11-01
From repo: solid-train (Forge)
To repo: laughing-octo-journey (Nova)
Related PR: #67

## Contract impact

Forge upgrades runtime JSON Schema validation from AJV 6.15.0 to AJV 8.20.0,
with ajv-formats 3.0.1 registered in **full** mode through
[createSchemaValidator](../src/model/schema-validator.js).

This is a validation-behavior change, not a new socket event or payload field.
The migration does not edit the OpenAPI source, JSON schemas, required fields,
enums, correlation-identity rules, or response envelopes.

**Intentional tightening:** validators that previously used AJV 6's default
fast date-time checks now reject impossible calendar dates. For example,
`2026-02-30T12:34:56Z` was accepted by the old default mode and is rejected by
the new full mode. Credit-ledger validation already used full mode, so its
calendar-date checks are preserved rather than newly tightened.

- Valid leap-day timestamps such as `2024-02-29T12:34:56Z` remain accepted.
- Impossible dates, missing timezone offsets, malformed timestamps, and invalid
  UUIDs fail where the relevant schema declares those formats.
- Optional/null fields, opaque correlation IDs where permitted, and
  unknown-but-valid catalog identity pairs retain their existing rules.
- Input is not coerced, populated with defaults, or stripped of extra fields
  by the shared validator. Unknown formats and schema keywords are not ignored.
- AJV's internal error diagnostics use the AJV 8 structure (`instancePath`);
  Nova should rely on the existing documented response envelopes, not AJV internals.

The generated contract artifact is unchanged, and all local contract and
cross-repository preflight gates pass with zero issues. No baseline was updated.
These structural checks do not replace Nova's review of timestamp production
and the intentional calendar-validation tightening.

## Forge implementation

- All production and test validator construction uses the shared factory.
- AJV 6-only options (`format`, `schemaId: 'auto'`, `strictKeywords`) are removed.
- Typed validation functions use existing celestial types and an explicit
  credit-ledger request type, preserving type safety without casts.
- Regression tests cover full calendar validation, UUIDs, finite numbers,
  no input mutation/coercion, independent validators, and unknown-schema failures.

AJV 8 also logs a nonfatal strictTypes diagnostic for the existing
credit-ledger response conditional's `maxItems` annotation. The outer schema
already specifies that `entries` is an array. This diagnostic is not suppressed
and does not disable validation.

## Validation evidence

Final local validation used exact Node 24.22.2 with npm 11.19.1:

| Command                                                                                                                                                       | Result                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts`                                                                                                                                     | Passed; reproducible lockfile installation                                      |
| `npm test`                                                                                                                                                    | Passed; OpenAPI/handler checks and 640 tests, 0 failed, 0 skipped               |
| `npm run security:audit`                                                                                                                                      | Passed; 0 high/critical, 5 moderate ESLint/minimatch dependency findings remain |
| `npm run typecheck`                                                                                                                                           | Passed                                                                          |
| `npm run lint`                                                                                                                                                | Passed                                                                          |
| `npm run contract:gate`                                                                                                                                       | Passed; zero drift issues                                                       |
| `npm run contract:gate:sw01:forge`                                                                                                                            | Passed; zero issues                                                             |
| `npm run contract:preflight:sw01:nova`                                                                                                                        | Passed; zero compatibility issues                                               |
| `npm run contract:gate:sw13:forge`                                                                                                                            | Passed; zero issues                                                             |
| `npm run contract:preflight:sw13:nova`                                                                                                                        | Passed; zero compatibility issues                                               |
| Changed-file Prettier check (PowerShell command below)                                                                                                        | Passed after cleaning generated reports                                         |
| `git diff --check`                                                                                                                                            | Passed                                                                          |
| `git diff --exit-code -- api\artifacts\contracts\contract-artifact.json api\artifacts\contracts\baseline-contract-artifact.json api\openapi.yaml api\schemas` | Passed; contract artifact, baseline, and schema sources unchanged               |

```powershell
$files = @((git --no-pager diff --name-only), (git ls-files --others --exclude-standard)) | ForEach-Object { $_ -replace '/', '\' }
npx --no-install prettier --check @files
```

The full suite includes six new validator regressions. The initial formatting
check also picked up a test-generated report that is not Prettier-formatted;
generated report changes were cleaned rather than committed or reformatted.

This evidence is local, not a claim that #67 is published, merged, deployed,
or acknowledged by Nova. Verify PR/CI and deployment status before rollout.

## Copy/paste prompt for Nova

```text
Nova: review compatibility with solid-train PR #67's AJV 8 validator migration.
Read docs/ajv8-migration-nova-handoff.md in solid-train and its final validation
evidence before implementing changes. This handoff does not claim the PR is
merged; verify its status and the deployed backend version.

Forge now uses AJV 8.20.0 plus ajv-formats 3.0.1 in full mode everywhere.
No new event, payload field, required field, enum, or response envelope is added.
The intentional contract-behavior tightening is calendar-date validation for
previously default/fast validators: impossible dates such as
2026-02-30T12:34:56Z must no longer be sent or treated as valid.
Credit-ledger dates already had full validation.

1. Inspect Nova producers for celestial-body timestamps and other date-time
   fields. Generate valid timezone-qualified instants, preferably canonical
   UTC strings from a valid Date.toISOString() result. Do not silently replace
   invalid user/source dates with defaults.
2. Verify valid leap-day and timezone-offset values remain usable; verify
   impossible dates, missing timezone, and malformed values are surfaced
   through Nova's existing validation/error UX.
3. Preserve nullability, optional fields, exact catalog namespace/key tokens,
   and opaque correlation IDs where the published schema permits them.
   Do not impose UUID-only correlation IDs globally: enforce UUID format only
   on fields whose schemas explicitly require it.
4. Use the existing documented response envelopes rather than interpreting
   raw AJV error objects. No frontend API shape rewrite is expected.
5. Run relevant Nova typecheck, tests, request serialization checks, and
   consumer contract/preflight checks against the approved Forge artifacts.
   Do not update a consumer baseline or relax format checks to hide drift.
6. Return an acknowledgment containing the backend version/PR status checked,
   affected producer files (or evidence that no edits are needed), exact test
   commands and results, remaining incompatibilities, and rollout readiness.

Make only compatibility changes demonstrated by this review. If every producer
already emits valid timestamps and handles existing failures, report that no
Nova code change is required, with supporting validation evidence.
```
