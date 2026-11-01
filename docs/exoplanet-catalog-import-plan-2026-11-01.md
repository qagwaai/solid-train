# Exoplanet catalog import plan (2026-11-01)

Extend the celestial catalog with every confirmed exoplanet in the
[NASA Exoplanet Catalog](https://science.nasa.gov/exoplanets/exoplanet-catalog/)
(6,451 planets across 4,847 stars as of 2026-11-01). Merge host stars with
[HYG](https://codeberg.org/astronexus/hyg) records, group stars into solar
systems (including binary and higher-order multiples), and refresh the data
monthly. This follows the same pattern as the Sol catalog import
([import-sol-catalog-data.js](../scripts/import-sol-catalog-data.js),
[sol-catalog-data.md](./sol-catalog-data.md)).

Paging is out of scope here and is planned as **phase 2**. This plan does not
protect Nova from the larger payloads. The goal is to measure how much
performance degrades, then change the contract based on that data.

---

## Progress dashboard

Update this table as work progresses. Each phase links to its step checklist
below.

**Status legend:** ⬜ Not started · 🟦 In progress · ✅ Done · ⛔ Blocked · ⏸ Deferred

| Phase | Title                                                                                    | Status | Owner | Started    | Completed  | Notes                                             |
| ----: | ---------------------------------------------------------------------------------------- | :----: | ----- | ---------- | ---------- | ------------------------------------------------- |
|     0 | [Source discovery and spikes](#phase-0--source-discovery-and-spikes)                     |   ✅   |       | 2026-11-01 | 2026-11-01 | See [findings](#phase-0-findings); Q6–Q8 resolved |
|     1 | [Exoplanet archive importer](#phase-1--exoplanet-archive-importer)                       |   ⬜   |       |            |            |                                                   |
|     2 | [HYG host slice and cross-match](#phase-2--hyg-host-slice-and-cross-match)               |   ⬜   |       |            |            |                                                   |
|     3 | [Solar-system grouping (multi-star)](#phase-3--solar-system-grouping-multi-star)         |   ⬜   |       |            |            |                                                   |
|     4 | [Catalog-constrained procedural model](#phase-4--catalog-constrained-procedural-model)   |   ⬜   |       |            |            |                                                   |
|     5 | [Registry, seeding, and contract](#phase-5--registry-seeding-and-contract)               |   ⬜   |       |            |            |                                                   |
|     6 | [Monthly refresh automation](#phase-6--monthly-refresh-automation)                       |   ⬜   |       |            |            |                                                   |
|     7 | [Performance baseline and Nova handoff](#phase-7--performance-baseline-and-nova-handoff) |   ⬜   |       |            |            |                                                   |
|    P2 | Paging (separate plan)                                                                   |   ⏸    |       |            |            | Starts after phase 7 results                      |

### Snapshot metrics

Record one row per import run, including manual runs during development. These
metrics show catalog growth and changes in match quality over time.

| Snapshot date | Planets | Host stars | Systems |           Multi-star systems | HYG matched (auto / review / manual)                       | Unmatched hosts |                Approx. orbits | Snapshot size | Notes                  |
| ------------- | ------: | ---------: | ------: | ---------------------------: | ---------------------------------------------------------- | --------------: | ----------------------------: | ------------: | ---------------------- |
| 2026-11-01    |   6,451 |      4,847 |       — | 432 hosts with `sy_snum` > 1 | 1,697 (35.0%) AT-HYG ID or 5″ cone; spike only, no scoring |           3,150 | 5,192 lack the full e/i/ω set |    ~6 MB est. | Phase 0 spike baseline |

---

## Decisions

| #   | Topic                      | Decision                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Data source                | NASA Exoplanet Archive TAP, `pscomppars` table (one composite row per confirmed planet). This archive powers the science.nasa.gov catalog.                                                                                                                                                                                                                                                                            |
| D2  | Snapshot storage           | Checked-in compact JSON (minified, records sorted by stable ID) so diffs and reviews stay deterministic.                                                                                                                                                                                                                                                                                                              |
| D3  | HYG scope                  | Import only HYG rows that cross-match exoplanet hosts and their companions. Source: HYG and AT-HYG on Codeberg (D16). See D11 for which systems are included.                                                                                                                                                                                                                                                         |
| D4  | Cross-matching             | Use tiered, evidence-scored matching with a ≥ 95% posterior threshold for automatic merges. See [matching design](#cross-match-design).                                                                                                                                                                                                                                                                               |
| D5  | Multi-star grouping        | Use archive `sy_snum` and host-name component suffixes, enriched with HYG companion fields (`base`, `comp`, `comp_primary`).                                                                                                                                                                                                                                                                                          |
| D6  | Rendering and data volume  | Use catalog-constrained procedural generation. Store compact facts and derive render detail deterministically. See [phase 4](#phase-4--catalog-constrained-procedural-model).                                                                                                                                                                                                                                         |
| D7  | Missing orbital elements   | Fill visualization defaults and mark each defaulted field as approximate, like S/2009 S 1 in the Sol catalog.                                                                                                                                                                                                                                                                                                         |
| D8  | Runtime seeding            | Seed lazily per system on first access. Version each system by the hash of its own snapshot records.                                                                                                                                                                                                                                                                                                                  |
| D9  | Refresh cadence            | Run a monthly GitHub Actions workflow that opens a PR when snapshots change, mirroring `refresh-sol-catalog.yml`.                                                                                                                                                                                                                                                                                                     |
| D10 | Nova protection            | None. Ship the data, measure the impact, and change the contract in the paging phase.                                                                                                                                                                                                                                                                                                                                 |
| D11 | Catalog inclusion (Q1)     | HYG is used only to provide host stars and companions for exoplanets. An HYG system enters the catalog only if at least one confirmed exoplanet attaches to it. Existing curated systems (Sol, Alpha Centauri, Cygnus X-1) and fixture systems (Sirius, Barnard's Star, Lalande 21185, Wolf 359) are grandfathered, and fixture systems without planets stay procedural.                                              |
| D12 | Moons and rings (Q2)       | Catalog planets get no moons. Gas and ice giants may get **rings only**, generated procedurally from the `planetId` seed and flagged approximate.                                                                                                                                                                                                                                                                     |
| D13 | Gap filling (Q3)           | None. In systems with catalog planets, the real planets fully replace procedural planets.                                                                                                                                                                                                                                                                                                                             |
| D14 | Review queue (Q4)          | The reviewer of the monthly refresh PR triages the queue. Triage does **not block merging**: hosts in the queue ship as separate archive-only stars, and the reviewer resolves them through overrides before the next monthly run.                                                                                                                                                                                    |
| D15 | Candidate planets (Q5)     | Only confirmed planets are imported. IDs, the snapshot schema, and the contract leave room for candidates (for example, a `status` field) so they can be added in a later phase.                                                                                                                                                                                                                                      |
| D16 | HYG variant (EX-0.3)       | Match against the full **AT-HYG v4.0** (Gaia DR3, HIP, and HD IDs; 2.56M stars). Take multiplicity (`base`, `comp`) from **HYG v4.4** through AT-HYG's `hyg` link. Both are downloaded at build time only from Codeberg's `/media/` LFS endpoint and cached by SHA-256. Store both `atHygId` and `hygId` on matched stars.                                                                                            |
| D17 | Controversial planets (Q6) | Include the 58 planets with `pl_controv_flag = 1`. Expose a `controversial: true` flag in the snapshot and contract so Nova can label them.                                                                                                                                                                                                                                                                           |
| D18 | Derived-data license (Q7)  | Accepted. Checked-in snapshot files containing HYG- or AT-HYG-derived values are licensed under **CC BY-SA 4.0**, with a `data/LICENSE-exoplanet-catalog.md` notice that gives attribution and describes the changes. Code licensing is unaffected.                                                                                                                                                                   |
| D19 | Literature references (Q8) | Keep references simple and small. Store a deduplicated reference table, `[bibcode, label]` (2,243 entries, about 104 KB). Each planet stores a `refs` array of table indexes with the discovery reference first (average 2.85, maximum 7, about 78 KB total). Do **not** store which parameter each reference supports; that would add about 0.5 MB. Labels are plain text and URLs are rebuilt from the ADS bibcode. |

---

## Target architecture

```text
NASA Exoplanet Archive TAP (pscomppars) ──┐
                                          ├─► scripts/import-exoplanet-catalog-data.js
HYG (Codeberg, full CSV, build-time only) ┘        │
                                                   ├─ parse + validate
data/exoplanet-overrides.json (manual) ───────────►├─ cross-match hosts ↔ HYG
                                                   ├─ group into systems
                                                   ▼
                       data/exoplanet-planets.json      (compact facts)
                       data/exoplanet-hosts.json        (stars + HYG merge result)
                       data/exoplanet-systems.json      (system grouping)
                       data/exoplanet-match-report.json (audit; review queue)
                                                   │
                                   runtime (no network)
                                                   ▼
        solar-system-registry ─► lazy per-system seed ─► procedural generator
                                                         (catalog-constrained)
```

At runtime, the server reads only checked-in files, as it does for Sol. The
full HYG CSV is downloaded only during the import and is never committed.

### Estimated snapshot sizes

| File                        | Records |  Est. compact size |
| --------------------------- | ------: | -----------------: |
| exoplanet-planets.json      |   6,451 | 2.35 MB (measured) |
| exoplanet-hosts.json        |   4,847 | 2.03 MB (measured) |
| exoplanet-systems.json      |  ~4,800 |            ~0.5 MB |
| exoplanet-match-report.json |  ~4,847 |              ~1 MB |

Phase 0 measured the planet and host files from the full export and estimated
the other two. The total is about 6 MB, below the 10 MB threshold, so D2 is
confirmed.

---

## Cross-match design

No single field reliably links archive hosts to HYG. Faint Kepler, K2, and TESS
hosts lack HIP or HD IDs, names differ across catalogs, and positions use
different epochs. Expect a minority of hosts to match HYG. Nearby and bright
hosts usually match, but most transit hosts are fainter than the HYG limit.
Unmatched hosts are a normal outcome, not an error. Phase 0 measured a 35%
match rate against AT-HYG; only 4 of the 3,150 unmatched hosts have V ≤ 11.

The match source is **AT-HYG v4.0**, which provides Gaia DR3, HIP, and HD IDs.
AT-HYG's `hyg` column links each star back to **HYG v4.4**, which supplies the
`base`, `comp`, and `comp_primary` multiplicity fields (D16).

### Tiers (evaluated in order; first decisive tier wins)

1. **Manual override.** An entry in `data/exoplanet-overrides.json` forces a
   match, forces a non-match, or assigns a system. Overrides always win and are
   recorded in the match report.
2. **Shared catalog identifier.** Compare HIP to HIP, HD to HD, and Gaia DR3
   to Gaia DR3. Check Gaia first: it covers 92.4% of hosts, while HIP covers
   16.6%. A shared ID is accepted only if it also passes a **sanity gate**:
   proper-motion-corrected separation < 60″ and a distance ratio within ±30%
   when both distances are known. An ID match that fails the sanity gate goes
   to the review queue, which catches catalog errors. An **HD-only** match for
   a host with a component suffix (`A`, `B`) is ambiguous because components
   can share one HD number, as in `HD 133131 A/B`. Send these matches to
   tier 3 for scoring instead of auto-accepting them.
3. **Scored probabilistic match.** For remaining hosts, select HYG candidates
   within a cone after propagating AT-HYG positions to J2016 with proper
   motion. The cone radius is max(15″, |µ| × 30 yr) because AT-HYG position
   epochs vary by source (`pos_src`). Score each candidate with a Fellegi–Sunter–style
   log-likelihood ratio built from these features:
   - Angular separation, normalized by combined positional uncertainty
   - Fractional parallax or distance difference
   - V-magnitude difference (`sy_vmag` compared with HYG `mag`)
   - Proper-motion vector difference
   - Normalized-name agreement: Greek letters, constellation abbreviations,
     `GJ` and `Gliese`, catalog prefixes, and component suffixes
   - Spectral class agreement as a weak feature
4. **Decision rule.**
   - Posterior ≥ **0.95** and the margin over the second-best candidate is
     ≥ 0.20: **automatic match**
   - Posterior from 0.80 to < 0.95, or an insufficient margin: **review
     queue**. The import does not merge the host. It writes the host to the
     match report.
   - Posterior < 0.80: **unmatched**. Create a new star record from archive
     data.
   - Enforce a one-to-one assignment across hosts. Resolve conflicts by highest
     posterior. Companions are exempt because they are grouped in phase 3.

### Calibration and verification of the 95% target

- Treat tier-2 matches that pass the sanity gate as a labeled positive set.
  Generate negatives by pairing hosts with the nearest non-identical HYG stars.
- Fit feature likelihoods on 80% of the labeled set. On the held-out 20%,
  measure **precision ≥ 0.95** for automatic matches and report recall.
- Commit the fitted parameters as constants with the calibration date. Do not
  refit them during monthly runs, so match results stay stable between runs.
  Refit only through an intentional PR.
- During each monthly run, compare automatic-match, review, and unmatched
  counts with the previous snapshot. Fail if the automatic-match rate changes
  by more than 2 percentage points.

---

## Attribution register

This register tracks every attribution, license, and citation obligation
introduced by this feature. **It is the source of truth for the Nova
attribution UI.** EX-7.3 turns it into a Nova handoff prompt. Update it
whenever a phase adds a data source or changes how data is used.

**Status legend:** 🟢 Wording confirmed from the source · 🟡 Needs owner or
legal sign-off · ⚪ Recommended, not strictly required

| ID  | Source                                                     | Used for                                                               | License or terms                                                       | Required text or action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Nova UI placement                          | Status |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | :----: |
| A1  | NASA Exoplanet Archive (`pscomppars`)                      | All exoplanets and host-star parameters                                | NASA public data; acknowledgment requested                             | "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program." Cite Christiansen et al. (2025), _PSJ_, [doi:10.3847/PSJ/ade3c2](https://iopscience.iop.org/article/10.3847/PSJ/ade3c2). Source: [acknowledge.html](https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html).                                                                                 | Global data-credits panel                  |   🟢   |
| A2  | Literature references within the archive                   | Discovery and supporting references for each planet's parameters       | Archive requests direct acknowledgment of the specific references used | Per D19, show a short reference list per planet (discovery reference first, then the others), each as a plain-text label and an ADS link built from the bibcode (`https://ui.adsabs.harvard.edu/abs/<bibcode>/abstract`). References are not mapped to individual parameters. The archive provides HTML anchors: parse them at import time and never render them as HTML.                                                                                                                                                                     | Planet detail view (per planet)            |   🟢   |
| A3  | HYG v4.4 (David Nash / astronexus)                         | Star multiplicity (`base`, `comp`) and classic IDs for matched hosts   | **CC BY-SA 4.0**                                                       | Attribute "HYG Database v4.4, astronexus (codeberg.org/astronexus/hyg)", link to the license, and state any changes ("cross-matched and subset by Stellar"). **Share-alike:** checked-in files containing HYG-derived values are distributed under CC BY-SA 4.0 (accepted, D18). The Nova credits panel must show the license name and link.                                                                                                                                                                                                  | Global data-credits panel; license link    |   🟢   |
| A4  | AT-HYG v4.0 (David Nash / astronexus)                      | Host-star cross-match, positions, distances, and IDs for matched hosts | **CC BY-SA 4.0**                                                       | Attribute "AT-HYG v4.0, astronexus (codeberg.org/astronexus/athyg)" with the license link and a change notice. The share-alike obligations in A3 apply.                                                                                                                                                                                                                                                                                                                                                                                       | Global data-credits panel; license link    |   🟢   |
| A5  | ESA Gaia DR3 (through AT-HYG and archive IDs)              | Distances, positions, and IDs for most matched hosts                   | Gaia data license; acknowledgment requested                            | "This work has made use of data from the European Space Agency (ESA) mission _Gaia_ (https://www.cosmos.esa.int/gaia), processed by the _Gaia_ Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the _Gaia_ Multilateral Agreement." Source: [Gaia DR3 credits](https://gea.esac.esa.int/archive/documentation/GDR3/Miscellaneous/sec_credit_and_citation_instructions/). | Global data-credits panel                  |   🟢   |
| A6  | ESA Hipparcos and Tycho-2 (through AT-HYG/HYG)             | Positions and IDs for bright hosts                                     | Acknowledgment                                                         | "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200." Source: AT-HYG `ACKNOWLEDGMENTS.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Global data-credits panel                  |   🟢   |
| A7  | Yale Bright Star and Gliese–Jahreiß catalogs (through HYG) | Classic IDs and names                                                  | Citation                                                               | Hoffleit, _Catalogue of Bright Stars_, 5th ed. (1991); Gliese & Jahreiß (1991), "Preliminary Version of the Third Catalogue of Nearby Stars." Source: AT-HYG `ACKNOWLEDGMENTS.md`.                                                                                                                                                                                                                                                                                                                                                            | Global data-credits panel (secondary list) |   ⚪   |
| A8  | IAU Working Group on Star Names (through HYG)              | Proper star names                                                      | Citation                                                               | "Star names from the IAU Working Group on Star Names."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Global data-credits panel (secondary list) |   ⚪   |
| A9  | Stellar-derived values                                     | Defaulted orbital elements (D7), procedural rings (D12), planet class  | n/a (our data)                                                         | Not an attribution, but a required disclosure: every value with `approximate: true` must be visually distinguishable, with an explanatory note such as "Approximate. Not all orbital elements are published for this planet."                                                                                                                                                                                                                                                                                                                 | Planet detail view; legend                 |   🟢   |

Notes:

- The existing Sol credits (MPC and NASA/JPL SSD) are documented in
  [sol-catalog-data.md](./sol-catalog-data.md). The Nova credits panel should
  show them alongside A1–A8.
- Attribution must stay correct after monthly refreshes. The importer writes
  source URLs, versions, and the snapshot date into each snapshot file's
  metadata, as the Sol snapshots do, so Nova can show "Data as of
  YYYY-MM-DD".

---

## Phase 0 — Source discovery and spikes

- [x] **EX-0.1** Confirm the `pscomppars` column list through TAP
      (`TAP_SCHEMA.columns`). Pin the exact identifier columns, such as
      `hip_name`, `hd_name`, `gaia_dr3_id`, and `tic_id`, plus system columns
      such as `sy_snum`, `sy_pnum`, and `cb_flag`.
- [x] **EX-0.2** Fetch a full CSV or JSON export. Record row and host counts and
      reconcile them with the counts on the science.nasa.gov page.
- [x] **EX-0.3** Choose a HYG variant. Compare HYG v4.x, which has HIP, HD, HR,
      GL, `base`, and `comp`, with AT-HYG, which adds Gaia IDs and better
      positions. Decide whether the D3 slice comes from one variant or both.
- [x] **EX-0.4** Run a quick ID-only cross-match to estimate the HYG match rate.
- [x] **EX-0.5** Measure null rates for orbital elements (`pl_orbsmax`,
      `pl_orbeccen`, `pl_orbincl`, `pl_orblper`, and `pl_tranmid`) and physical
      fields to size the scope of D7.
- [x] **EX-0.6** Review licensing. HYG uses CC BY-SA 4.0, so determine the
      share-alike implications for the checked-in derived slice. Add the NASA
      Exoplanet Archive acknowledgment. Results are in the
      [attribution register](#attribution-register). Owner sign-off is pending
      under Q7.
- [x] **EX-0.7** Validate the snapshot-size estimates and confirm D2.

**Exit criteria:** Pin column lists, choose the HYG variant, record a
baseline match rate, and estimate snapshot sizes.

### Phase 0 findings

The spikes ran on 2026-11-01. The scripts and raw downloads are kept outside
the repository in `C:\Development\Assets\solid-train`:
`spike-pscomppars.js`, `spike-crossmatch.js`, and
`spike-crossmatch-detail.js`. They are one-off measurements; the phase 1–2
importer replaces them.

**Archive (EX-0.1, EX-0.2, EX-0.5)**

- The TAP query against `pscomppars` returns **6,451 planets and 4,847 hosts**,
  which matches science.nasa.gov exactly. Planet names are unique. Downloading
  52 columns takes about 3 seconds and returns 7.7 MB of raw JSON.
- Pinned columns: `pl_name`, `pl_letter`, `hostname`, `hd_name`, `hip_name`,
  `tic_id`, `gaia_dr2_id`, `gaia_dr3_id`, `sy_snum`, `sy_pnum`, `sy_mnum`,
  `cb_flag`, `pl_controv_flag`, `ra`, `dec`, `sy_dist`, `sy_plx`, `sy_pmra`,
  `sy_pmdec`, `sy_vmag`, `sy_gaiamag`, `st_spectype`, `st_teff`, `st_rad`,
  `st_mass`, `st_lum`, `st_met`, `st_age`, `pl_orbper`, `pl_orbsmax`,
  `pl_orbeccen`, `pl_orbincl`, `pl_orblper`, `pl_orbtper`, `pl_tranmid`,
  `pl_rade`, `pl_bmasse`, `pl_bmassprov`, `pl_dens`, `pl_eqt`, `pl_insol`,
  `disc_year`, `discoverymethod`, `disc_facility`, `disc_refname`, and the
  `*_reflink` columns listed in Q8.
- `pscomppars` has **no row-update timestamp**. Detect changes by diffing
  normalized record content. Per-system content hashes (D8) already do this.
- Host ID coverage is: Gaia DR3 92.4%, TIC 93.9%, HIP 16.6%, and HD 15.5%.
- Host `sy_snum` values: 4,415 hosts have one star, 381 have two, 50 have
  three, and 1 has four. 119 host names carry a component suffix, such as
  `WASP-94 A` and `WASP-94 B`. There are 53 circumbinary planets
  (`cb_flag = 1`) and 58 planets flagged as controversial (`pl_controv_flag`)
  (Q6).
- 6,444 planets have a period or semi-major axis. Only **1,259** have the full
  a, e, i, and ω set, so D7 defaults will apply to about 80% of planets. Null
  rates: `pl_orbsmax` 7.7%, `pl_orbeccen` 16.6%, `pl_orbincl` 24.8%,
  `pl_orblper` 67.2%, `pl_tranmid` 20.1%, `pl_rade` 0.8%, and `pl_bmasse`
  0.5%. Only 7 planets have neither a radius nor a mass.
- Discovery methods: Transit 4,785, Radial Velocity 1,204, Microlensing 292,
  Imaging 98, and others 72.
- Host distances: 62 within 10 pc, 1,088 within 100 pc, and 2,020 beyond
  500 pc.

**HYG variant (EX-0.3, EX-0.4)**

| Source             |     Stars | Gaia match    | HIP match   | HD match    | Any ID        | 5″ cone (no PM) | Any           |
| ------------------ | --------: | ------------- | ----------- | ----------- | ------------- | --------------- | ------------- |
| HYG v4.4           |   119,614 | n/a           | 801 (16.5%) | 695 (14.3%) | 856 (17.7%)   | 658 (13.6%)     | 869 (17.9%)   |
| AT-HYG v4.0 (full) | 2,558,654 | 1,672 (34.5%) | 801 (16.5%) | 752 (15.5%) | 1,689 (34.8%) | 1,458 (30.1%)   | 1,697 (35.0%) |

- **Recommendation (D16):** Use the full AT-HYG v4.0 for matching and HYG v4.4
  for multiplicity, linked through AT-HYG's `hyg` column. AT-HYG doubles the
  match rate. Its subsets (`reduced_m11`, `hyg_ids`) would lose matches.
- Of the 3,150 hosts AT-HYG cannot match, only **4 have V ≤ 11**, and 345 have
  no Gaia ID. These hosts are fainter than Tycho-2 completeness, so the
  unmatched rate is structural. Tier-3 scoring can recover only a small
  number of them.
- Downloads: Codeberg stores the files in Git LFS. The `/raw/` URL returns a
  133-byte pointer, so use `/media/branch/main/...` instead. AT-HYG is
  200 MB gzipped (about 11 seconds to stream and scan); HYG v4.4 is 13.6 MB.
  The monthly workflow should cache both files by LFS SHA-256 because they
  rarely change.
- Separation of Gaia-ID matches: the raw median is 1.1″ (p99 35.7″). After
  proper-motion propagation from J2000 to J2016, the median is **0.08″**
  (p90 0.32″, p99 9.6″). 40 high-proper-motion nearby M dwarfs remain above
  5″, such as GJ 1002 and YZ Cet, because AT-HYG position epochs vary with
  `pos_src`. This supports the 60″ sanity gate and the proper-motion-scaled
  cone in the cross-match design.
- For confirmed Gaia matches, the fractional distance difference is p50 0%,
  p90 2%, and p99 9%. The V-magnitude difference is p50 0.08 and p99 0.6.
  These values seed the tier-3 likelihoods.
- One-to-one assignment: no AT-HYG star is claimed by two hosts. Four hosts
  match more than one star through different IDs, such as `HD 133131 A` and
  `HD 178911 B`; all are components sharing an HD number.
- Fixture reconciliation: Proxima Cen and Barnard's Star match by both Gaia
  and HIP. The archive's `GJ 411` is Lalande 21185, matched by HIP and HD, so
  name-only matching would miss it. Sirius and Wolf 359 are not archive hosts,
  which confirms that D11's grandfathering is needed.
- Multiplicity: 432 hosts have `sy_snum` > 1, and 278 of them match AT-HYG,
  but only **28** link to an HYG `base` group. Most companion stars will
  therefore be declared but unresolved (EX-3.3). Phase 3 should consider
  common-proper-motion neighbor detection in AT-HYG as an optional
  enhancement.

**Snapshot size (EX-0.7)**

The measured compact sizes are 2.35 MB for planets and 2.03 MB for hosts. With
systems, the match report, and references (D19, about 0.18 MB), the total is
about 6 MB. D2 is confirmed.

## Phase 1 — Exoplanet archive importer

- [ ] **EX-1.1** Add `scripts/import-exoplanet-catalog-data.js` with pure,
      exported parsers, mirroring the Sol importer structure.
- [ ] **EX-1.2** Build a TAP query with an explicit column list that never uses
      `select *`. Request CSV or JSON, and handle timeouts and retries.
- [ ] **EX-1.3** Normalize records into a compact planet shape with a stable
      `planetId` slug derived from `pl_name`, host reference, orbital and
      physical facts, discovery method and year, and per-field
      `approximate: true` flags. Include `status: 'confirmed'` on every record
      so candidates can be added later without a schema break (D15). Do not
      encode confirmation status in `planetId`. Carry `controversial: true`
      when `pl_controv_flag = 1` (D17).
- [ ] **EX-1.3a** Parse `disc_refname` and the `*_reflink` anchors into the
      deduplicated reference table `data/exoplanet-references.json`, with
      entries `[bibcode, label]` (D19). Store a per-planet `refs` index array,
      discovery reference first. Use Cheerio text extraction, as the Sol
      importer does. Add tests for anchor parsing, non-ADS URLs, and
      de-duplication.
- [ ] **EX-1.3b** Write `data/LICENSE-exoplanet-catalog.md` (D18) covering
      CC BY-SA 4.0, attribution for A3 and A4, a change notice, and the A1, A5,
      and A6 acknowledgments. Write source URLs, versions, and the snapshot
      date into each snapshot's metadata.
- [ ] **EX-1.4** Add validation gates: minimum counts (≥ 6,000 planets and
      ≥ 4,500 hosts initially), unique `planetId`, finite numbers, and valid
      ranges such as 0 ≤ e < 1 and P > 0.
- [ ] **EX-1.5** Add a shrinkage guard. Fail if more than 2% of previously known
      planets disappear unless an override is acknowledged. The archive rarely
      retracts planets, but retractions do happen.
- [ ] **EX-1.6** Add the `catalog:exoplanet:refresh` npm script.
- [ ] **EX-1.7** Add unit tests for parsers and gates using small fixtures in
      `test/`. Tests must not make network calls.

**Exit criteria:** Running the script locally produces
`data/exoplanet-planets.json`, and all gates and tests pass.

## Phase 2 — HYG host slice and cross-match

- [ ] **EX-2.1** Download and stream-parse the full HYG CSV at build time. Use a
      quoted-CSV-aware parser because the current fixture splitter is not
      sufficient.
- [ ] **EX-2.2** Implement tiers 1–3 from the
      [cross-match design](#cross-match-design) as pure functions.
- [ ] **EX-2.3** Add a calibration script and commit the fitted constants.
      Record precision and recall in this document.
- [ ] **EX-2.4** Emit `data/exoplanet-hosts.json`, which includes merged stars
      with both `hygId` and archive IDs. Unmatched hosts are archive-only stars.
- [ ] **EX-2.5** Emit `data/exoplanet-match-report.json`, containing each host's
      tier, posterior, top candidates, and decision.
- [ ] **EX-2.6** Add `data/exoplanet-overrides.json` and validate it with a
      schema.
- [ ] **EX-2.7** Reconcile with the existing [hyg-fixture.csv](../data/hyg-fixture.csv)
      and the curated systems Sol, Alpha Centauri, and Cygnus X-1. Proxima Cen b
      and d must attach to the existing `alpha-centauri` system and must not
      create a duplicate. Attach Barnard's Star and Lalande 21185 planets to
      their existing fixture systems in the same way. Sirius, Wolf 359, and
      Cygnus X-1 remain grandfathered (D11).
- [ ] **EX-2.9** Apply the inclusion rule (D11). Keep in the host slice only
      HYG rows that are matched hosts or companions of matched hosts. Add a
      test that a planetless HYG system that is not grandfathered is never
      emitted.
- [ ] **EX-2.8** Add tests covering known hard cases: Proxima Cen, 55 Cnc,
      Kepler-16 (circumbinary), TRAPPIST-1, a star found only by Gaia, a name
      collision, and an ID match that fails the sanity gate.

**Exit criteria:** Held-out automatic-match precision is ≥ 0.95, the match
report is reviewable, and curated systems contain no duplicates.

## Phase 3 — Solar-system grouping (multi-star)

- [ ] **EX-3.1** Derive a system key from the host name with the component
      suffix removed, such as `Kepler-444 A` → `kepler-444`. Union this with
      HYG `base` groupings for matched stars.
- [ ] **EX-3.2** Assign star roles (`primary`, `secondary`, `tertiary`, …) by
      component letter, falling back to mass or brightness.
- [ ] **EX-3.3** Handle `sy_snum` > known stars. Record `declaredStarCount`
      and `resolvedStarCount`. Add companion stars only when HYG or the archive
      provides real data. Do not create placeholder stars.
- [ ] **EX-3.4** Attach circumbinary planets (`cb_flag = 1` or host `AB`) to
      the system barycenter, not to a single star.
- [ ] **EX-3.5** Generate stable system IDs. Existing IDs such as
      `alpha-centauri` win. New IDs are slugs, with collisions resolved
      deterministically.
- [ ] **EX-3.6** Emit `data/exoplanet-systems.json`.
- [ ] **EX-3.7** Add tests for single-star, binary, triple, circumbinary, and
      wide-binary systems where planets orbit each star.

**Exit criteria:** Each planet belongs to exactly one system, and each host
star belongs to exactly one system.

## Phase 4 — Catalog-constrained procedural model

This phase addresses the rendering and data-volume concern. Real planets are
not stored as fully specified render assets. The snapshot stores only
**compact catalog facts**, such as period, semi-major axis, eccentricity,
radius, mass, equilibrium temperature, and host. The existing
[procedural-system-generator.js](../src/model/procedural-system-generator.js)
uses those facts as **constraints** and derives everything else
deterministically from a seed, which is a hash of `planetId`. That derived
data includes planet class (rocky, gas, or ice), visual parameters, color,
default orbital angles, and phase.

Effects:

- **No new renderers.** Catalog planets use the same body types and renderers
  as procedural planets. They differ only in where their constraints come from.
- **Small snapshots.** The snapshot stores only facts. Render detail is never
  persisted.
- **Real where known, plausible where not.** Each derived field is marked
  `approximate` so that clients and attribution can distinguish the two.

Steps:

- [ ] **EX-4.1** Refactor the generator to accept an optional list of
      constrained planets per system. When a list is present, generate only
      those planets: real planets replace procedural planets, with no gap
      filling (D13).
- [ ] **EX-4.2** Classify planets from catalog facts. Use radius or mass
      thresholds for rocky, super-Earth, Neptune, and gas giant classes, and
      use equilibrium temperature for subtypes such as hot Jupiter and ice
      giant. Fall back to the seeded RNG only when facts are missing.
- [ ] **EX-4.3** Derive missing elements. Calculate a from P and M\* using
      Kepler's third law, and default e, i, ω, Ω, and mean anomaly as flagged
      approximations (D7).
- [ ] **EX-4.4** Bump `PROCEDURAL_SEED_VERSION`. Existing purely procedural
      systems with no catalog planets must produce **identical** output; add a
      regression test to prove it.
- [ ] **EX-4.5** Generate rings only, never moons, for catalog planets
      classified as gas or ice giants (D12). Ring presence and parameters
      come from the `planetId` seed and are flagged approximate. Add a test
      that no catalog planet produces moons and that ring output is
      deterministic.

**Exit criteria:** Catalog planets render through existing body types, and
procedural-only systems are unchanged.

## Phase 5 — Registry, seeding, and contract

- [ ] **EX-5.1** Extend [solar-system-registry.js](../src/model/solar-system-registry.js)
      to load `exoplanet-systems.json`. Add `source: 'exoplanet-catalog'`
      alongside `curated` and `procedural`.
- [ ] **EX-5.2** Version seeds per system by hashing that system's records
      instead of the whole snapshot. A monthly refresh then reseeds only
      changed systems, unlike the global hash used by
      [solar-system-celestial-seed.js](../src/model/solar-system-celestial-seed.js).
- [ ] **EX-5.3** Update Mongo models (`star-model`, `solar-system-model`, and
      `celestial-model`) and indexes for the new identifier fields: archive
      IDs, `hygId`, match tier, and approximation flags. Update
      [MONGODB_SCHEMA.md](../MONGODB_SCHEMA.md).
- [ ] **EX-5.4** Add contract fields only as additive changes: `catalogSource`,
      `catalogIds`, `approximateFields`, `declaredStarCount`, and
      `discovery`, and a planet `status`, which is always `confirmed` for now
      (D15). Update `api/schemas/*`, `api/openapi*`, and
      [celestial-body-contract.md](./celestial-body-contract.md). Follow the
      SW-08 producer checklist.
- [ ] **EX-5.5** Leave list endpoints such as `solar-system-list` and
      `star-list` unpaged (D10). Return all systems.
- [ ] **EX-5.6** Add handler tests for get and list across exoplanet-backed,
      multi-star, and curated systems.

**Exit criteria:** All exoplanet systems are reachable through existing
messages, and the contract artifacts and SW-08 gate pass.

## Phase 6 — Monthly refresh automation

- [ ] **EX-6.1** Add `.github/workflows/refresh-exoplanet-catalog.yml` with
      `cron: '0 9 1 * *'` and `workflow_dispatch`, mirroring
      [refresh-sol-catalog.yml](../.github/workflows/refresh-sol-catalog.yml).
- [ ] **EX-6.2** Run refresh, tests, typecheck, eslint, and prettier for the
      importer and model files. Open a PR only when files under `data/exoplanet-*`
      change.
- [ ] **EX-6.3** Include in the PR body the snapshot counts and the
      review-queue entries, each with host name, top candidate, and
      posterior. The PR reviewer triages them (D14). Merging is not blocked;
      the reviewer resolves entries through `data/exoplanet-overrides.json`
      before the next monthly run. The PR body also lists entries still
      unresolved from the previous run.
- [ ] **EX-6.4** Create `docs/exoplanet-catalog-data.md` as a counterpart to
      [sol-catalog-data.md](./sol-catalog-data.md), covering sources,
      acknowledgments, the refresh process, and matching behavior.

**Exit criteria:** A manual `workflow_dispatch` run opens a valid PR.

## Phase 7 — Performance baseline and Nova handoff

- [ ] **EX-7.1** Record server-side baselines for payload bytes and latency of
      `solar-system-list`, `star-list`, and `solar-system-get` for the largest
      system, plus server memory after the registry loads.
- [ ] **EX-7.2** Record client-side baselines in Nova: time to first render,
      memory, and frame rate for the list view and a large system view.
- [ ] **EX-7.3** Write a Nova handoff prompt covering the new fields, data
      attribution, and expected breakage, following the existing handoff docs.
      Generate the attribution section from the
      [attribution register](#attribution-register): global credits panel,
      per-planet references, license links, and approximate-value disclosure.
- [ ] **EX-7.4** Summarize the findings and draft paging requirements for the
      phase-2 plan, including cursor or page size and spatial or
      distance-ordered queries.

**Exit criteria:** Baseline numbers are recorded and the paging plan is ready
to start.

---

## Risks

| Risk                                                           | Mitigation                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| False-positive merges corrupt curated or HYG systems           | ≥ 0.95 threshold with a margin rule, sanity gate on ID matches, overrides, curated-system tests |
| Archive schema or column changes break the monthly run         | Explicit column list, schema check in validation, workflow fails loudly                         |
| Planet renames or retractions change `planetId`                | Shrinkage guard and a rename map in overrides                                                   |
| HYG CC BY-SA share-alike obligations for the checked-in slice  | Accepted (D18); license notice file (EX-1.3b) and credits in Nova (A3, A4)                      |
| Snapshot growth makes repo diffs unwieldy                      | Compact sorted JSON and a size check; revisit D2 above 10 MB                                    |
| Nova degrades or breaks with full lists (accepted, D10)        | Phase 7 baselines inform the paging phase                                                       |
| Changing the procedural generator alters existing systems      | Regression test proving identical output for unconstrained systems                              |
| Review queue grows because triage does not block merging (D14) | PR body lists entries carried over from earlier runs; review the trend in snapshot metrics      |
| Inclusion rule silently drops systems (D11)                    | Grandfathered system list is a tested constant; snapshot metrics track the system count         |

## Resolved questions

All questions were resolved on 2026-11-01. Each answer is recorded as a
decision.

| #   | Question                                                             | Resolution                                                                                                                                                    | Decision |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | Should HYG systems with no known exoplanets keep procedural planets? | HYG supplies only host and companion stars. A system without a matched exoplanet is excluded for now. Current curated and fixture systems are grandfathered.  | D11      |
| Q2  | Moons or rings for catalog planets?                                  | Rings only, procedural and flagged approximate, for gas and ice giants. No moons.                                                                             | D12      |
| Q3  | Procedural planets in gaps of systems with real planets?             | No. Real planets fully replace procedural planets.                                                                                                            | D13      |
| Q4  | Who triages the review queue, and what is the service-level target?  | The refresh PR reviewer. Triage is non-blocking; queued hosts ship as archive-only stars and are resolved before the next run.                                | D14      |
| Q5  | Are candidate planets (TOIs or KOIs) in scope?                       | Not now. The schema and contract are designed so candidates can be added in a later phase.                                                                    | D15      |
| Q6  | Include the 58 controversial planets?                                | Include them, with a `controversial` flag for Nova to label.                                                                                                  | D17      |
| Q7  | Accept CC BY-SA 4.0 for the checked-in HYG-derived data?             | Accepted, with a data license notice file.                                                                                                                    | D18      |
| Q8  | Literature reference scope?                                          | Discovery reference plus supporting references, kept simple: a deduplicated table and a per-planet index list (about 0.18 MB), with no per-parameter mapping. | D19      |

## Open questions

None at this time. Q6–Q8 were resolved on 2026-11-01 (see the resolved
questions table).

## Change log

| Date       | Change                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-01 | Initial plan created.                                                                                                                                                                                            |
| 2026-11-01 | Resolved Q1–Q5 and added decisions D11–D15. Updated EX-1.3, EX-2.7, EX-4.1, EX-4.5, EX-5.4, and EX-6.3; added EX-2.9 and two risks.                                                                              |
| 2026-11-01 | Phase 0 complete. Recorded findings and the snapshot-metrics baseline; added D16 (AT-HYG and HYG v4.4) and refined cross-match tiers 2–3 with measured statistics; added the attribution register; opened Q6–Q8. |
| 2026-11-01 | Resolved Q6–Q8 and added D17–D19. Added EX-1.3a (references) and EX-1.3b (data license notice); attribution rows A2–A4 confirmed.                                                                                |
