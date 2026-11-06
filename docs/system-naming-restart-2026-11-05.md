# System naming: cross-machine restart handoff

Checkpoint: 2026-11-05, after the full-catalog expansion review.

## Current state

The first **25-system pilot is enabled and user-confirmed in Nova**. Preserve these exact assignments, source identities, aliases, and eligibility evidence.

| Item                                               | Verified checkpoint value |
| -------------------------------------------------- | ------------------------: |
| Checked-in registry systems                        |                     4,845 |
| Manifest version                                   |                         2 |
| `runtimeEnabled`                                   |                    `true` |
| Approved/live pilot assignments                    |                        25 |
| Remaining catalog-pattern nominations              |                     4,000 |
| Protected systems                                  |                       162 |
| Additional systems without a recognized nomination |                       658 |
| Full-scope provisional pairings                    |                        94 |
| Full-scope slots without candidate names           |                     3,906 |
| Additional activations from expansion              |                         0 |

The classification is 25 + 4,000 + 162 + 658 = 4,845. A nomination is **not** an eligibility approval. There are currently zero explicitly approved, unassigned systems and zero approved, unused names available for expansion.

The 94 new review-only pairings comprise 86 English, two Turkish, and one each in Arabic, Hindi, Portuguese, Japanese, Swahili, and Indonesian. Their English-heavy composition reflects bank availability, **not** a change to the approved language weights. Missing-language quotas remain unfilled; no cross-language substitution occurred.

The user's last confirmation of the pilot was "we are confirmed in Nova." This is user-reported live consumer confirmation, not evidence that every browser, screen reader, live database count, or saved reference was independently audited.

## What is implemented

- Shared system naming resolver with explicit eligibility, source-evidence digests, proper/component-name protection, collisions, overrides and publication gating.
- Stable canonical system IDs and exact catalog designations; combined labels such as `Copper Vale (GJ 9066)`.
- Additive solar-system summary contract: authoritative `displayName: string`, required nullable `settlementName: string | null`, optional nullable `catalogName`, and required `aliases: string[]`. List/get schemas are modeled independently.
- Shared literal substring search over system labels and aliases: NFC, collapsed whitespace and `en-US` lowercasing. One- and two-character queries work. No invented transliteration or broad accent/script folding.
- Mongo `searchTerms` projection rebuilt through system upserts/full-registry synchronization. Search terms are internal, not new public naming fields.
- Deterministic Hamilton largest-remainder quotas, integer arithmetic, policy-order ties, explicit shortages and no reallocation. Ordinary batches are bounded at 100; full-catalog allocation supports up to 5,000.
- Frozen 25-slot review plan preserving the original 20 pairings and five landmark additions.
- Offline single-pilot, 100-system, weighted-25 and full-catalog review tooling/artifacts.
- Isolated actual-Mongo activation/rollback verification. System-name changes do not change physical/body seed hashes.

Do **not** rename `settlementName` to `assignedName`: that was discussed, but the current contract intentionally retained `settlementName`.

## Decisions and approval boundaries

### Approved language composition

Applies to newly named eligible systems, excluding protected existing proper names. Language is separate from country, ethnicity, expedition sponsor, and off-world origin.

| Language bucket                   |   Weight |
| --------------------------------- | -------: |
| English                           |      30% |
| Chinese, initially Mandarin-based |      18% |
| Russian                           |      12% |
| Spanish                           |       6% |
| Arabic                            |       5% |
| Hindi                             |       5% |
| Portuguese                        |       4% |
| Japanese                          |       4% |
| French                            |       4% |
| Swahili                           |       3% |
| Indonesian                        |       3% |
| Turkish                           |       2% |
| Korean                            |       1% |
| German                            |       1% |
| Other reviewed traditions         |       2% |
| **Total**                         | **100%** |

Policy order above breaks exact remainder ties. Allocation is per batch/scope, not a cumulative fairness ledger. Repeated small batches may give low-weight languages zero slots. Do not silently change this behavior.

### Naming direction

- Settlement, landscape metaphor, aspiration, original hopeful sci-fi motifs, author tributes, and Earth remembrance.
- All-ages/G-rated intent. English possessives are welcome but optional, not imposed on every language.
- Preserve native-script names where approved; supporting transliterations and meanings are separate. Do not pretend unverified glosses are authentic translations.
- Early Chinese, US and Soviet exploration heritage may inform future lore. No alternate-history timeline or country ranking has been settled.
- Martian/lunar/orbital communities can use any language; they are not additional language-percentage buckets.
- Possible non-human languages/scripts and distance-based encounters remain open future design. Multiple communities may independently name one system; humans need not adopt an earlier discoverer's name. No current gameplay ownership/discovery model is implied.
- Planet naming is future scope: proper names and systematic names may coexist, e.g. Earth / Sol III. Do not rename planets, convert discovery letters into orbital ordinals, or regenerate bodies.

### What may be activated

The user explicitly authorized full-catalog expansion **only for systems with approved eligibility and approved unused content**. Provisional candidates and undecided nominations remain review-only. Preserve the active 25. This authorization is not permission to fabricate approvals, automatically approve regex matches, reuse occupied names, or fill shortages from English.

The seven author tributes have owner-approved wording and English-language all-ages review; the owner accepted unresolved rights risk, **not legal clearance**. Landmark and multilingual approvals are recorded with their actual scope; independent linguistic/cultural verification must not be invented.

The five pilot landmark names are 泰山, 天山, 黄山, Байкал, and Mont Blanc. They are already occupied in the active 25 and cannot fill expansion slots again.

## Files to read first

All links are repository-relative so this handoff works on another machine.

1. [Main naming plan](naming-algorithm-2026-11-05.md), especially Sections 12 and 13. Earlier sections contain historical proposal-only/disabled states; later dated status supersedes them.
2. [Active manifest](../data/system-naming-manifest.json).
3. [Frozen weighted proposal](../data/system-naming-weighted-batch-v1.json), [batch plan](../data/system-naming-weighted-batch-plan-v2.json), and [weighted report](system-naming-weighted-allocation-2026-11-05.md). Artifact filename `v1` does not mean the internal revision stayed at 1.
4. [Language policy](../data/system-naming-weight-policy-v2.json).
5. [Full-catalog review report](system-naming-full-catalog-review-2026-11-05.md) and [full evidence/pairings JSON](../data/system-naming-full-catalog-review-v1.json). The JSON is several MB: inspect targeted sections, not an unrestricted dump.
6. [Original review bank](../data/system-naming-review-bank-v1.json), [author bank](../data/system-naming-candidates.json), [pilot landmark supplement](../data/system-naming-weighted-landmark-supplement-v1.json), and [new provisional landmark sketches](../data/system-naming-full-catalog-review-candidates-v1.json).
7. [Resolver](../src/model/system-naming.js), [weighted allocator](../src/model/system-naming-weighted-allocation.js), and [full-catalog generator](../scripts/dry-run-system-naming-full-catalog.js).

Historical reports and their inputs are preserved snapshots. Do not regenerate them against the active manifest and call the resulting changes incidental. Historical tests use [the proposal manifest fixture](../test/fixtures/system-naming-proposal-manifest-v1.json).

## Next useful work

1. Inspect the 94 provisional pairings and the 4,000 source-evidence-backed nominations. Separate source eligibility decisions from candidate-content review.
2. Grow **non-English** banks toward the approved quotas. The 18 newest landmark phrases are English constructions, not substitutes for Chinese/Russian/French or other language quotas.
3. Record only actual reviewer/owner decisions. Approve explicit source-backed batches and unused content before preparing more runtime assignments.
4. Preserve all 25 live pairings and report every prospective assignment diff.
5. Before another activation, repeat source/collision validation and isolated Mongo activation/rollback checks. Coordinate any normal dev restart with the user.

No new naming-history or non-human-language decisions are prerequisites for growing review banks. The bottleneck is approved, suitable content and explicit eligibility, not another allocation algorithm.

## Cross-machine setup and operational safety

- Backend repository: `qagwaai/solid-train`. Branch at this checkpoint: `main`. Work was uncommitted with many new/untracked naming files. The user intends to commit/push after this handoff; do not assume that has happened. Verify the transferred commit and working tree before changing anything.
- Frontend/Nova is a **separate repository**, `qagwaai/laughing-octo-journey`. Backend push does not transfer frontend edits. Ensure its corresponding consumer changes are also committed/pushed and pulled separately.
- Local Mongo data, authentication/session state, processes, installed packages, screenshots, and Copilot session artifacts do not transfer through Git. No absolute path from the previous machine is required.
- Follow repository dependency/setup guidance on the new machine. Run validation first; install/restore dependencies only if missing or dependency manifests changed. Do not add packages merely for this handoff.
- **The manifest is already enabled.** Normal server startup on another machine can synchronize its configured database and initialize world data. Confirm the intended environment/database before starting. Do not mistake activation being enabled on disk for proof a new machine's server/database is ready.
- No full database drop is needed. Never drop or reseed the current game dataset for naming.
- Startup sync must receive the **full canonical registry**, never the 25-row subset: catalog synchronization removes IDs missing from its input.
- Manifest JSON is cached per process. Changes need a human-coordinated normal restart; registry cache clearing alone is insufficient. Do not stop a shared process yourself.
- Rollback: set `runtimeEnabled: false`, coordinate normal restart/full-registry sync, and verify original labels/null settlement names plus stable identities/body/save data. Retain provenance and approved aliases. Alias matches alone do not prove active labels.
- Run Prettier **once, only at the end**, on files changed during the new session.

### Nova status and contract

Nova implemented independent response types, authoritative-label rendering, RTL isolation/wrapping, short-query support, and tests. A reviewed substring-collision bug was fixed in the separate frontend repository: catalog suppression now uses exact catalog-only or exact structured combined-label equality, not `displayName.includes(catalogName)`. Its 12 component tests and typecheck passed.

User confirmed live pilot rendering in Nova. Earlier frontend validation reported 38 focused Vitest tests, typecheck/build, and six authenticated Playwright cases across Chromium/Firefox/WebKit on Windows; three native clipboard cases were skipped. Native OS clipboard, screen-reader speech, real Safari, macOS/Linux/mobile coverage are not established by that evidence.

Authoritative contract sources:

- Workspace [index](../api/openapi.yaml), [solar-system module](../api/openapi/solarsystem/openapi.yaml), [get schema](../api/schemas/solar-system-get-response.schema.json), [list schema](../api/schemas/solar-system-list-response.schema.json), and [list request schema](../api/schemas/solar-system-list-request.schema.json).
- When running locally: `/openapi/solarsystem/openapi.yaml` and `/openapi/schemas/solar-system-{get-response,list-response,list-request}.schema.json` on the configured backend origin. Prior origin was `http://localhost:3000`; verify the new machine rather than assuming it is running.
- Root index references modules and need not repeat naming fields. Previous served/workspace checks matched; recheck after transfer as appropriate. Prior ETags are not portable acceptance criteria.
- [Nova follow-up prompt](nova-prompt-naming-readiness-2026-11-05.md). No new contract change was introduced by the full-catalog expansion.

## Validation evidence and reproduction

Evidence belongs to particular checkpoints; do not present old suite counts as a fresh run:

- Pilot activation: full `npm test` **792 passed**, focused tests **48 passed**, actual isolated Mongo **1 passed**; typecheck/lint passed. Activation changed exactly 25 labels; rollback restored baseline. IDs, source/physical data, seed hashes, 5,140 persisted bodies and saved references were unchanged in the isolated test. Unique test databases were ownership-checked and cleaned; the shared game database was not written by the assistant.
- Initial full-catalog work: `npm run test:unit` **734 passed** before the final provisional-pairing additions.
- Final full-catalog focused run: the four-file command below **11 passed**. After final formatting, the same subset without the 100-preview test **10 passed**. Changed-file ESLint, typecheck, and whitespace checks passed.
- Broad suites can rewrite tracked contract-report absolute paths. Inspect diffs and restore only known test-generated changes; do not revert unrelated work. These generated changes were cleaned at this checkpoint.
- No new validation was needed for this documentation-only handoff.

Run from the backend repository root (PowerShell examples):

```powershell
git --no-pager status --short
node -e "const m=require('./data/system-naming-manifest.json'); const r=require('./src/model/solar-system-registry').getSolarSystemRegistry(); console.log({enabled:m.runtimeEnabled,approved:Object.keys(m.approvedAssignments).length,systems:r.length,active:r.filter(s=>s.settlementName!==null).length});"
node --test test\system-naming-full-catalog.test.js test\system-naming-weighted-allocation.test.js test\system-naming-approved.test.js test\system-naming-100-review-preview.test.js
npm run typecheck
```

Expected inspection: enabled `true`, approved `25`, systems `4845`, active `25`. Stop and investigate if source snapshot or approvals differ; do not force the old counts onto a legitimately changed catalog.

The existing isolated-Mongo check requires a reachable local Mongo service and creates/cleans only its unique owned test database:

```powershell
node --test test-support\system-naming-rollout.mongo.js
```

It is not a request to drop any existing database. Read its isolation guards first.

To intentionally regenerate the current full-scope review artifacts, after understanding their inputs:

```powershell
node scripts\dry-run-system-naming-full-catalog.js
```

That writes the full-catalog JSON/Markdown only, not runtime assignments. Review the diff afterward; do not regenerate historical pilot/100/25 artifacts unnecessarily.

Pilot searches for checking an already running authorized environment:

| Search                            | Expected label        | ID                |
| --------------------------------- | --------------------- | ----------------- |
| `Copper Vale` / `GJ 9066`         | Copper Vale (GJ 9066) | `exo-gj-9066`     |
| `星港` / `Xingang` / `Kepler-397` | 星港 (Kepler-397)     | `exo-kepler-397`  |
| `Маяк` / `Mayak` / `Kepler-1633`  | Маяк (Kepler-1633)    | `exo-kepler-1633` |
| `Mont Blanc` / `HD 66428`         | Mont Blanc (HD 66428) | `exo-hd-66428`    |

## Copy/paste restart prompt

```text
Forge — resume the system-naming project in qagwaai/solid-train on this machine.

First read repository guidance and docs/system-naming-restart-2026-11-05.md,
then the main naming plan Sections 12–13, the active manifest, and the
full-catalog review summary. Inspect git status and confirm the transferred
commit; do not rely on the previous machine's absolute paths or session state.
Inspect large JSON artifacts with bounded reads.

Current checkpoint: 4,845 checked-in systems; manifest v2 is ENABLED with
exactly 25 approved assignments, user-confirmed live in Nova. Preserve those
25 pairs. Full-catalog review has 4,000 undecided catalog-pattern nominations,
94 provisional pairings, 3,906 candidate shortages, 162 protected systems,
and 658 additional non-nominated systems. ZERO further names were activated.
No approved unused content or approved unassigned eligibility is available.

Language policy is approved: English30, Mandarin18, Russian12, Spanish6,
Arabic5, Hindi5, Portuguese4, Japanese4, French4, Swahili3, Indonesian3,
Turkish2, Korean1, German1, Other reviewed traditions2 percent. Hamilton
integer rounding; exact ties use policy order. No shortage reallocation.
Language is not country or expedition origin. Preserve native scripts.

The next work is growing reviewed non-English content and reviewing explicit
source eligibility/pairings, NOT manufacturing thousands of approved names.
Use the 94-pair review report as input; the English-heavy available bank does
not override language quotas. New landmark phrases and other provisional
names remain unapproved. The owner authorizes expansion only when BOTH
explicit eligibility AND unused candidate content are actually approved.
Do not fabricate linguistic/cultural review, legal clearance, or approval.
Ask through a selectable form with a free-text field for new substantive
content/approval decisions; do not treat this restart prompt as blanket consent.

Keep settlementName unchanged and displayName authoritative. Do not alter
the frontend/API contract, publish provisional names, refresh source catalogs,
change identities/astronomical data, drop the game database, regenerate planets,
or restart shared services. Startup on this machine may write its configured
database because the manifest is enabled: confirm the environment first.
All sync operations require the FULL registry, never the pilot subset.
Frontend Nova changes live in separate qagwaai/laughing-octo-journey; check its
transfer separately before assuming UI readiness on this machine.

Begin with the read-only status/projection checks and focused tests documented
in the handoff. Report any mismatch before making new approvals or activations.
Historical reports are frozen snapshots. Use isolated owned test databases
for rollout/rollback validation. Preserve unrelated work. Run Prettier only
once at the very end on changed files. Do not commit or push unless I ask.

After confirming the checkpoint, summarize the remaining content/eligibility
blockers and offer a concrete multilingual review batch for my decision.
```
