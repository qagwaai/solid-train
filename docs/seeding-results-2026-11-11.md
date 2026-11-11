# Non-Sol seeding results - 2026-11-11

## Purpose and evidence

Load the previously delivered non-Sol celestial systems and markets into this
checkout's intended database: `mongodb://localhost:27017/solid-train`.

This report covers the failures, incorrect assumptions, workflow friction and
implementation corrections observed in this session. Evidence comes from the
operator's pasted commands/errors, the implementation changes, isolated tests,
read-only target inspections and local deployment receipts inspected at the end.
It is not a database backup or a verification of gameplay/UI behavior.

Related runbooks:

- [Non-Sol systems delivery](seed-non-Sol-systems-2026-11-07.md).
- [Market density and deployment sequence](seed-market-density-2026-11-07.md).

## Final recorded outcome

The latest receipts support successful bulk and density deployment to
**`solid-train`**, after the corrections below:

| Stage | Recorded outcome |
| --- | --- |
| Bulk target dry-run | Target `solid-train`; no blocked systems. |
| Bulk apply | 4,843 systems verified; `protectedDataUnchanged: true`. |
| Bulk readback | 4,843 systems verified; `protectedDataUnchanged: true`. |
| Corrected density target dry-run | Target `solid-train`; 4,843 results; zero blocked systems. |
| Corrected density apply | 4,843 systems verified; `existingDataUnchanged: true`. |
| Corrected density readback | 4,843 systems verified; `existingDataUnchanged: true`. |
| Corrected offline density plan | 15,311 proposed market additions; 20,157 selected total markets; zero placement holds. |

Density totals describe the reviewed cohort, not a fresh count of every market
in the database. They exclude Sol and the separately protected Copper Vale
sequence. This session does not establish Copper Vale completion or independent
travel, mining, trading or Nova UI acceptance.

Final evidence locations:

- Bulk: `artifacts/non-sol-bulk-v1-delivery/`, including its current
  `target-dry-run.json`, `apply-result.json` and `readback-result.json`.
- Corrected density:
  `artifacts/non-sol-market-density-v2-source-b45c82063fc6d33d10e540a3129b9e8ee7df1f0218ffec2438da505f2fad042e/`.
- In that corrected directory, apply and readback result files were last written
  on 2026-11-11 at approximately 14:36 and 14:59, respectively, as displayed by
  this environment's filesystem clock.

The original extracted density directory also contains successful receipts
from the delivered archive. Those alone must not be mistaken for proof of this
environment's new deployment. The final outcome above uses the newly generated
source-specific directory, its `solid-train` receipt and its new result files.

## What did not go to plan

| # | Problem observed | Cause and impact | Correction / disposition |
| --- | --- | --- | --- |
| 1 | The initially supplied "source hash" was not usable as `--approve-source`. | The assistant supplied the accepted old source guard rather than distinguishing it from a migration approval. The document also contained a later deployed guard. This started an avoidable cycle of hash clarification. | Distinguished source guard, migration approval and target receipt hashes. The old guard is not passed as migration approval. |
| 2 | The documented migration candidate did not match this checkout. | `b35b...600f` bound a different current source guard. Local source bytes produced a different migration tuple, so bulk validation refused before connecting to MongoDB. | Calculated and verified the checkout-specific candidate offline. The operator authorized it. No accepted generation plans or old guards were rewritten. |
| 3 | Relative artifact paths resolved under `C:\Windows\System32`. | The first PowerShell wrapper used `Path.GetFullPath` on relative inputs, which relied on the process current directory rather than the visible PowerShell location. Bulk failed opening `header.json`. | Anchored relative artifacts to the script's repository root and used absolute Node entry-point paths. |
| 4 | The archive was extracted one directory too deep. | The ZIP already contained `artifacts/...`; extracting inside `artifacts` created `artifacts/artifacts/...`. Correcting the working directory alone would not have found the expected default paths. | Added explicit detection/warnings for that layout. The operator re-extracted at the repository root; expected header, offline report and replay files were confirmed present. |
| 5 | The first wrapper covered only bulk, not the complete market density stage. | The requested bulk commands seed initial markets, but did not execute the separate density-v2 market expansion. | Added density dry-run, optional apply, density readback and final bulk readback to the wrapper. |
| 6 | Repeated manual hash entry was confusing and error-prone. | A successful bulk dry-run produced a target receipt, but the source migration hash was pasted at the target receipt prompt. The wrapper stopped before apply. Repeated explanations did not address the operator's request for automation. | Removed hash-entry prompts. The wrapper reads each fresh receipt and passes its hash directly to the matching CLI. Write decisions remain simple `APPLY` / `READBACK` choices. |
| 7 | Work was initially directed to the wrong database. | Examples and commands used `solid-train-dev`, whereas the intended full-load target was `solid-train`. Bulk loading into the development database did not satisfy the actual goal. | The operator clarified the target and reported deleting `solid-train-dev`. Full-load instructions were changed to explicit `solid-train`; later receipts confirm that target. No database deletion was performed by the assistant. |
| 8 | Archived density plans failed the current-source guard after bulk had succeeded. | The archive's density report was stamped with guard `7ac8...fb4b`; this checkout then had guard `253d...00bc`. Bulk source migration approval did not automatically make stale density reports compatible. | Added exact offline generation replay and density-v2 preparation into a new source-suffixed directory. Preserved archived plans. Added `-MarketsOnly` to avoid repeating completed bulk work. |
| 9 | The new development target lacked three required legacy baseline markets. | Density-v2 counted `ac-belt-01`, `ac-proxima-station` and `bs-main-station` as preserved pre-existing markets. Their absence blocked Alpha Centauri and Barnard's Star. The package was a plan delivery, not a complete database backup. | Added an insert-only baseline prerequisite helper using the delivered identities and canonical initial market payloads. It inserts only missing records, preserves existing data and requires a fresh receipt and stopped writers. |
| 10 | The intended `solid-train` target had those markets, but their snapshot epochs/positions differed. | Exact comparison against the other environment's captured snapshot rejected `ac-belt-01`; read-only inspection also showed different station snapshot positions. Orbital dimensions and identities matched. The missing-record helper alone did not solve this portability problem. | Initial baseline validation now accepts valid environment-specific snapshot differences while requiring matching identity, anchor, dimensions and orbital phase elements. Stations retain their fixed orbit epoch; the free-floating belt's orbit and snapshot epochs must agree. |
| 11 | The snapshot-portability correction needed durable ownership, not just a looser initial comparison. | Accepting different snapshots without binding the target values would leave later readback/resume unable to detect baseline mutations. Runtime reconciliation also used the archived baseline, so changing only the wrapper would have been incomplete. | Density checkpoints now capture the target's exact preserved baseline identities/placements. Subsequent checkpoint reconciliation requires exact equality. Full-target receipt fingerprints still detect changes between dry-run and apply. |
| 12 | Corrections to guarded runtime/lifecycle code created another source migration. | The snapshot fix necessarily changed guarded files. A fixed default migration hash would become stale again and block the next attempt. | Moved replay/preparation before bulk in the wrapper. It displays the updated replay-verified migration candidate and accepts `APPLY`, supplying the new hash automatically. |
| 13 | One regression test failed during the snapshot fix. | The geometry rejection remained correct, but its changed error wording did not match the existing `/geometry drift/` assertion. | Restored compatible error wording and reran the relevant suites successfully. |
| 14 | The operator considered dropping the database to escape the repeated failures. | Accumulated portability assumptions and wrapper shortcomings made a straightforward environment load appear to require starting over. Dropping the successful bulk target would not have corrected the market prerequisites. | Advised against dropping the database and continued additively from completed bulk readback. |

## Hash history and meaning

These are historical identifiers, not interchangeable approvals:

| Identifier | Value |
| --- | --- |
| Accepted generation source guard | `6e51ce5b2abe35c19e13f5b5979c0182cd7c6d5d0bb74932132ac3a1be5705e0` |
| Archived density source guard | `7ac8b1dfa0461a7e09257c62ac8960e236d767a9265d9e88a68e4d072444fb4b` |
| Initially suggested documented migration candidate | `b35bffe0e0c1bd28208388d80789f42d3b1b44e684b1a9b19a2557073df8600f` |
| Initial checkout source guard | `253df2156c26edfcf99477ae9364f935dd9cb64a576c134aa8dcac627c4e00bc` |
| Operator-authorized initial checkout migration | `1ad335a985c782e2b7c6acc13e4feeea38094b6af9e6967303b08c4a6ad720fe` |
| Corrected snapshot-compatible source guard | `b45c82063fc6d33d10e540a3129b9e8ee7df1f0218ffec2438da505f2fad042e` |
| Corrected migration candidate passed by the wrapper upon approval | `9286b7e786c5609e28b9f21277dba3fe42f533e32df918d9ae181fecfcbbe27b` |
| Corrected density target receipt for `solid-train` | `c1b8d930466a80c3affee8726a0752a05bb2f74167aefcf76b544d6ac162df86` |
| Accepted bulk report | `8aa5b6fc33a6c1998a5a843b5159f9743009931dde86c24c35112a67d3f1652c` |
| Corrected density offline report | `6029a894852d8d368f52478baff40f950458331a4c412fa82db79318c8cf89b0` |

A source migration binds the accepted guard, current guard and accepted journal
tail. A target receipt additionally binds the target and database fingerprint.
Neither hash should be reused blindly after changing source, artifacts or the
database. The wrapper automates passing hashes; it does not remove these checks.

## Implementation and validation

Relevant implementation:

- [PowerShell runner](../scripts/run-non-sol-bulk-seed.ps1).
- [Missing baseline market helper](../scripts/non-sol-density-baseline-seed.js).
- [Density lifecycle](../scripts/lib/non-sol-market-density-lifecycle.js).
- [Runtime baseline/checkpoint reconciliation](../src/model/non-sol-market-density-reconciliation.js).
- [Baseline integration tests](../test/non-sol-density-baseline-seed.mongo.integration.test.js).

Recorded validation:

- Initial baseline restore: seven isolated Mongo integration tests passed,
  including missing-market insertion, preservation of existing inventory and
  refusal of incompatible/cross-system identities.
- Final relevant test command:

  ```powershell
  node --no-warnings --test --test-concurrency=1 test\non-sol-density-baseline-seed.mongo.integration.test.js test\non-sol-market-density-v2.mongo.integration.test.js test\non-sol-market-density-v2.test.js test\non-sol-market-density.mongo.integration.test.js
  ```

  **Passed: 18 tests, zero failures.** Coverage included new-environment
  snapshot acceptance, exact checkpoint binding, subsequent mutation refusal,
  both density lifecycle versions and preservation of evolved gameplay fields.
- ESLint on the changed JavaScript helper, lifecycle, reconciliation and test
  files: passed.
- `npm run typecheck`: passed.
- PowerShell parser validation and `git diff --check`: passed.
- Exact offline replay: all 4,843 accepted generation plans matched, including
  pilot preservation; fresh density preparation produced zero holds.
- Read-only checks of the actual `solid-train` baseline and the two previously
  blocked systems passed after the snapshot correction. Those checks made no
  database writes.
- The assistant did not execute persistent apply against the operator database.
  Deployment success is evidenced by the operator-run receipts described above;
  integration-test writes were confined to isolated test databases.

## Remaining limitations and lessons

1. The delivery is not a portable Mongo backup. It contains accepted plans and
   historical evidence; it does not reproduce another environment's live stock,
   transactions, custom fields or every prerequisite automatically.
2. Baseline insertion uses canonical initial inventory, empty ledgers and
   default ship listings. Existing market economy is not reset.
3. Delivered legacy placements retain documented invalid/unknown geometry:
   `ac-belt-01` has an unresolved anchor, and the existing Proxima/Barnard
   station orbits have documented surface-clearance defects. This exercise
   preserves them; it does not repair or certify them.
4. Copper Vale remains separately protected and outside generic bulk/density
   loading. No completion claim for that prerequisite is made here.
5. Future environment loads should confirm the explicit database name, extraction
   root, current-source replay and baseline portability before starting writes.
   Receipt hash handling should be automated from the outset, not delegated to
   repeated manual copying.
6. Successful seeding and readback do not replace gameplay or UI validation.
   No such acceptance was supplied in this session.
