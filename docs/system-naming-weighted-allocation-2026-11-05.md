# Weighted system-naming batch review

Historical proposal snapshot: the JSON report and the review-state statements below describe the pre-assignment input. Subsequent owner approval accepts all 25 frozen source eligibility decisions, assignments and listed aliases, prepared in `data/system-naming-manifest.json` version 2 with `runtimeEnabled: false`. No independent linguistic/cultural certification or legal clearance is claimed. See section 12 of `docs/naming-algorithm-2026-11-05.md` for current technical rollout validation; live publication remains unauthorized.

Status: **offline-weighted-review-proposals-only**. Requested 25 slots; 25 have candidate proposals and 0 remain explicitly unfilled. The five added Earth-remembrance candidate contents are user-approved for this proposal/content-selection gate only; this offline report is not assignment, eligibility or publication approval.

## Weighted allocation

Policy: `system-naming-weighted-allocation-v2`; method: hamilton-largest-remainder-per-batch; tie-break: higher integer remainder first; exact ties use the language order listed in policy. Quotas use integer weight × batch-size division and integer remainders; exact ties follow policy language order.

| Policy language           | Weight | Quota | Filled | Unfilled | Integer remainder / 100 |
| ------------------------- | -----: | ----: | -----: | -------: | ----------------------: |
| English                   |    30% |     8 |      8 |        0 |                  50/100 |
| Mandarin                  |    18% |     5 |      5 |        0 |                  50/100 |
| Russian                   |    12% |     3 |      3 |        0 |                   0/100 |
| Spanish                   |     6% |     2 |      2 |        0 |                  50/100 |
| Arabic                    |     5% |     1 |      1 |        0 |                  25/100 |
| Hindi                     |     5% |     1 |      1 |        0 |                  25/100 |
| Portuguese                |     4% |     1 |      1 |        0 |                   0/100 |
| Japanese                  |     4% |     1 |      1 |        0 |                   0/100 |
| French                    |     4% |     1 |      1 |        0 |                   0/100 |
| Swahili                   |     3% |     1 |      1 |        0 |                  75/100 |
| Indonesian                |     3% |     1 |      1 |        0 |                  75/100 |
| Turkish                   |     2% |     0 |      0 |        0 |                  50/100 |
| Korean                    |     1% |     0 |      0 |        0 |                  25/100 |
| German                    |     1% |     0 |      0 |        0 |                  25/100 |
| Other reviewed traditions |     2% |     0 |      0 |        0 |                  50/100 |

Hamilton rounding is applied independently per batch. No cumulative fairness ledger is used; low-weight languages may remain at zero in repeated identical small batches. Shortages are never redistributed across languages.

The existing `exo-gj-9066` / Copper Vale proposal occupies one of eight English slots. The seven user-approved author-honoring English candidates are prioritized deterministically after that fixed item when available; their recorded rights risk is not legal clearance.

A versioned frozen review plan fixes all 25 selected system IDs and slot indices, and pins every one of the prior 20 candidate-to-system pairings by stable ID. Candidate-bank growth therefore affects only the five previously unfilled Mandarin, Russian and French slots. The three new Mandarin candidates carry the explicit `Mandarin` tag; the earlier two candidates retain their recorded `Chinese` tags.

User approval on 2026-11-05 covers editorial candidate-content selection and the Earth-remembrance lane only. The source record is `docs/naming-algorithm-2026-11-05.md`; Earth references are Mount Tai, Huangshan, Tian Shan, Lake Baikal and Mont Blanc. No independent native-speaker, linguistic, cultural, context, all-ages or legal clearance is claimed. Geographic references do not imply matching destination terrain, and no system assignment or publication was authorized.

## Filled proposals

| Slot | Canonical system ID | Exact original designation | Proposed combined display label | Policy / candidate language | Candidate review and rights status                                                               |
| ---: | ------------------- | -------------------------- | ------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
|    1 | `exo-gj-9066`       | GJ 9066                    | Copper Vale (GJ 9066)           | English (English)           | original-fictional; proposal-unreviewed; rights: originality-review-pending                      |
|    2 | `exo-kepler-931`    | Kepler-931                 | Liu Cixin's Signal (Kepler-931) | English (English)           | author-honoring; user-approved; rights: owner-authorized-risk-accepted-not-legally-cleared       |
|    3 | `exo-kepler-1723`   | Kepler-1723                | Le Guin's Horizon (Kepler-1723) | English (English)           | author-honoring; user-approved; rights: owner-authorized-risk-accepted-not-legally-cleared       |
|    4 | `exo-toi-406`       | TOI-406                    | Jemisin Accord (TOI-406)        | English (English)           | author-honoring; user-approved; rights: owner-authorized-risk-accepted-not-legally-cleared       |
|    5 | `exo-hd-221416`     | HD 221416                  | Asimov's Beacon (HD 221416)     | English (English)           | author-honoring; user-approved; rights: owner-authorized-risk-accepted-not-legally-cleared       |
|    6 | `exo-wispit-1`      | WISPIT 1                   | Butler's Reach (WISPIT 1)       | English (English)           | author-honoring; user-approved; rights: owner-authorized-risk-accepted-not-legally-cleared       |
|    7 | `exo-hd-103197`     | HD 103197                  | Bradbury's Hearth (HD 103197)   | English (English)           | author-honoring; user-approved; rights: owner-authorized-risk-accepted-not-legally-cleared       |
|    8 | `exo-hd-133131`     | HD 133131                  | Clarke Meridian (HD 133131)     | English (English)           | author-honoring; user-approved; rights: owner-authorized-risk-accepted-not-legally-cleared       |
|    9 | `exo-kepler-397`    | Kepler-397                 | 星港 (Kepler-397)               | Mandarin (Chinese)          | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   10 | `exo-kepler-214`    | Kepler-214                 | 同行 (Kepler-214)               | Mandarin (Chinese)          | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   11 | `exo-toi-1846`      | TOI-1846                   | 泰山 (TOI-1846)                 | Mandarin (Mandarin)         | earth-remembrance; user-approved; rights: not-assessed-no-clearance-claim                        |
|   12 | `exo-hd-216770`     | HD 216770                  | 天山 (HD 216770)                | Mandarin (Mandarin)         | earth-remembrance; user-approved; rights: not-assessed-no-clearance-claim                        |
|   13 | `exo-kepler-1605`   | Kepler-1605                | 黄山 (Kepler-1605)              | Mandarin (Mandarin)         | earth-remembrance; user-approved; rights: not-assessed-no-clearance-claim                        |
|   14 | `exo-kepler-1633`   | Kepler-1633                | Маяк (Kepler-1633)              | Russian (Russian)           | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   15 | `exo-kepler-1548`   | Kepler-1548                | Заря (Kepler-1548)              | Russian (Russian)           | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   16 | `exo-hd-238914`     | HD 238914                  | Байкал (HD 238914)              | Russian (Russian)           | earth-remembrance; user-approved; rights: not-assessed-no-clearance-claim                        |
|   17 | `exo-hd-86065`      | HD 86065                   | Encuentro (HD 86065)            | Spanish (Spanish)           | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   18 | `exo-hd-164595`     | HD 164595                  | Alborada (HD 164595)            | Spanish (Spanish)           | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   19 | `exo-k2-221`        | K2-221                     | منارة (K2-221)                  | Arabic (Arabic)             | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   20 | `exo-kepler-1999`   | Kepler-1999                | आशा (Kepler-1999)               | Hindi (Hindi)               | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   21 | `exo-kepler-625`    | Kepler-625                 | Travessia (Kepler-625)          | Portuguese (Portuguese)     | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   22 | `exo-k2-133`        | K2-133                     | 木漏れ日 (K2-133)               | Japanese (Japanese)         | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   23 | `exo-hd-66428`      | HD 66428                   | Mont Blanc (HD 66428)           | French (French)             | earth-remembrance; user-approved; rights: not-assessed-no-clearance-claim                        |
|   24 | `exo-k2-196`        | K2-196                     | Pamoja (K2-196)                 | Swahili (Swahili)           | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |
|   25 | `exo-kic-9663113`   | KIC 9663113                | Harapan (KIC 9663113)           | Indonesian (Indonesian)     | multilingual-provisional; provisional-unreviewed; rights: originality-and-context-review-pending |

## Explicitly unfilled slots

| Slot | Canonical system ID | Policy language | Exact original designation | Reason             |
| ---: | ------------------- | --------------- | -------------------------- | ------------------ |
|    — | —                   | —               | —                          | No slots unfilled. |

No slots remain unfilled in this batch.

## Provenance and safeguards

- Registry: 4845 systems; 25 catalog-style nominations selected by the versioned seed. Protected systems are excluded by existing protection/source helpers.
- Candidate names are checked against registry display/catalog/proper/alias names, source component proper names, manifest assignments/overrides/aliases, the existing single-pilot dry-run proposal, and names selected earlier in this batch. Locked prior proposals are checked for collisions by the allocator.
- Each filled row records its exact combined label, stable candidate ID, explicit language tag, bank source/version, review lane/status, rights status, source-evidence SHA-256, catalog-pattern nomination and pending assignment status.
- Five Earth-remembrance contents are user-approved editorial selections with approval date and Earth-reference provenance. Their linguistic/cultural/context and all-ages review remains pending; legal clearance, source eligibility approval and assignment authorization are not asserted.
- No manifest, runtime state, OpenAPI/API contract, catalog, system/body IDs, star/planet data, physical seeds, prior single-pilot report, or 100-system review preview was changed.

Input SHA-256: registry `739d6dd4f9ca305a3622d2e57711c49531366d98bb8a6d25a9461966e6322f45`; manifest `1fee3560053aaa8cb2997779460a1a9df62adb702d4bb1931607a921dd9f57d7`; combined bank `946609f0a3e3207a9a5d69a7218568b0fa6f82833e4becef057af75b497644f7`; base bank `5cbe15c370c9b447ed1196b4b81ebe4b15c352666f0806254b0f3a77466830d0`; landmark supplement `a36ea322ff446df1b4d7de8ac312a75ce3f06b3b623476b36dcafd519adc1890`; frozen batch plan `e60f941192adf16bd598b5abcf89c8bd70ac77463242438d06382b34a7356432`; policy `a5873ee8e3590c65386076e764ad2fd1741f46beccc5c8ba8fd5c33866e7a311`; source evidence `ac2439fbe7b1917c8976ce4d2ecf939d47fa68c715fe12d665e52139a076d828`; preserved prior proposal `5e9bd28ef20e88bd2e0260b60e6da158a0bfcffaff02e11e1b4083567aef3daa`.

## Human review required

1. Review every catalog-style nomination and source/proper-name evidence before any eligibility decision.
2. Have knowledgeable speakers review all five newly selected names for language, meaning, pronunciation, cultural/context appropriateness and all-ages suitability; this review is not recorded here.
3. Reassess author-tribute rights/trademark context; recorded owner risk acceptance is not legal clearance.
4. Do not publish or enable runtime assignments without a separately approved change and validation.
