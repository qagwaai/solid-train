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
|     1 | [Exoplanet archive importer](#phase-1--exoplanet-archive-importer)                       |   ✅   |       | 2026-11-01 | 2026-11-01 | See [findings](#phase-1-findings); D20–D23        |
|     2 | [HYG host slice and cross-match](#phase-2--hyg-host-slice-and-cross-match)               |   ✅   |       | 2026-11-02 | 2026-11-02 | See [findings](#phase-2-findings); D25–D30        |
|     3 | [Solar-system grouping (multi-star)](#phase-3--solar-system-grouping-multi-star)         |   ✅   |       | 2026-11-02 | 2026-11-02 | See [findings](#phase-3-findings); D32–D37        |
|     4 | [Catalog-constrained procedural model](#phase-4--catalog-constrained-procedural-model)   |   ⬜   |       |            |            |                                                   |
|     5 | [Registry, seeding, and contract](#phase-5--registry-seeding-and-contract)               |   ⬜   |       |            |            |                                                   |
|     6 | [Monthly refresh automation](#phase-6--monthly-refresh-automation)                       |   ⬜   |       |            |            |                                                   |
|     7 | [Performance baseline and Nova handoff](#phase-7--performance-baseline-and-nova-handoff) |   ⬜   |       |            |            |                                                   |
|    P2 | Paging (separate plan)                                                                   |   ⏸    |       |            |            | Starts after phase 7 results                      |
|    N1 | Settler naming (separate plan)                                                           |   ⏸    |       |            |            | Hook only in this plan (D24)                      |
|    F1 | [Review-queue resolution](#f1--review-queue-resolution)                                  |   ⏸    |       |            |            | 6 review hosts + 2 distance misses; next refresh  |

### Snapshot metrics

Record one row per import run, including manual runs during development. These
metrics show catalog growth and changes in match quality over time.

| Snapshot date | Planets | Host stars | Systems |           Multi-star systems | HYG matched (auto / review / manual)                       | Unmatched hosts |                           Approx. orbits | Snapshot size | Notes                                          |
| ------------- | ------: | ---------: | ------: | ---------------------------: | ---------------------------------------------------------- | --------------: | ---------------------------------------: | ------------: | ---------------------------------------------- |
| 2026-11-01    |   6,451 |      4,847 |       — | 432 hosts with `sy_snum` > 1 | 1,697 (35.0%) AT-HYG ID or 5″ cone; spike only, no scoring |           3,150 |            5,192 lack the full e/i/ω set |    ~6 MB est. | Phase 0 spike baseline                         |
| 2026-11-01    |   6,451 |      4,847 |       — | 432 hosts with `sy_snum` > 1 | — (phase 2)                                                |               — | 8 still lack a semi-major axis after D20 |       5.69 MB | Phase 1 first snapshot; 2,452 references       |
| 2026-11-01    |   6,451 |      4,847 |       — | 432 hosts with `sy_snum` > 1 | 1,694 (34.95%) / 6 / 0                                     |           3,147 | 8 still lack a semi-major axis after D20 |       7.47 MB | Phase 2 match; 1,727 HYG stars (33 companions) |
| 2026-11-01    |   6,451 |      4,847 |   4,841 |   432 (43 with circumbinary) | 1,694 (34.95%) / 6 / 0                                     |           3,147 | 8 still lack a semi-major axis after D20 |       9.75 MB | Phase 3 systems; 446 synthesized stars         |

---

## Decisions

| #   | Topic                            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Data source                      | NASA Exoplanet Archive TAP, `pscomppars` table (one composite row per confirmed planet). This archive powers the science.nasa.gov catalog.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D2  | Snapshot storage                 | Checked-in compact JSON (minified, records sorted by stable ID) so diffs and reviews stay deterministic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D3  | HYG scope                        | Import only HYG rows that cross-match exoplanet hosts and their companions. Source: HYG and AT-HYG on Codeberg (D16). See D11 for which systems are included.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D4  | Cross-matching                   | Use tiered, evidence-scored matching with a ≥ 95% posterior threshold for automatic merges. See [matching design](#cross-match-design).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D5  | Multi-star grouping              | Use archive `sy_snum` and host-name component suffixes, enriched with HYG companion fields (`base`, `comp`, `comp_primary`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D6  | Rendering and data volume        | Use catalog-constrained procedural generation. Store compact facts and derive render detail deterministically. See [phase 4](#phase-4--catalog-constrained-procedural-model).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D7  | Missing orbital elements         | Fill visualization defaults and mark each defaulted field as approximate, like S/2009 S 1 in the Sol catalog.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D8  | Runtime seeding                  | Seed lazily per system on first access. Version each system by the hash of its own snapshot records.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D9  | Refresh cadence                  | Run a monthly GitHub Actions workflow that opens a PR when snapshots change, mirroring `refresh-sol-catalog.yml`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D10 | Nova protection                  | None. Ship the data, measure the impact, and change the contract in the paging phase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D11 | Catalog inclusion (Q1)           | HYG is used only to provide host stars and companions for exoplanets. An HYG system enters the catalog only if at least one confirmed exoplanet attaches to it. Existing curated systems (Sol, Alpha Centauri, Cygnus X-1) and fixture systems (Sirius, Barnard's Star, Lalande 21185, Wolf 359) are grandfathered, and fixture systems without planets stay procedural.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D12 | Moons and rings (Q2)             | Catalog planets get no moons. Gas and ice giants may get **rings only**, generated procedurally from the `planetId` seed and flagged approximate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D13 | Gap filling (Q3)                 | None. In systems with catalog planets, the real planets fully replace procedural planets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D14 | Review queue (Q4)                | The reviewer of the monthly refresh PR triages the queue. Triage does **not block merging**: hosts in the queue ship as separate archive-only stars, and the reviewer resolves them through overrides before the next monthly run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D15 | Candidate planets (Q5)           | Only confirmed planets are imported. IDs, the snapshot schema, and the contract leave room for candidates (for example, a `status` field) so they can be added in a later phase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D16 | HYG variant (EX-0.3)             | Match against the full **AT-HYG v4.0** (Gaia DR3, HIP, and HD IDs; 2.56M stars). Take multiplicity (`base`, `comp`) from **HYG v4.4** through AT-HYG's `hyg` link. Both are downloaded at build time only from Codeberg's `/media/` LFS endpoint and cached by SHA-256. Store both `atHygId` and `hygId` on matched stars.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D17 | Controversial planets (Q6)       | Include the 58 planets with `pl_controv_flag = 1`. Expose a `controversial: true` flag in the snapshot and contract so Nova can label them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D18 | Derived-data license (Q7)        | Accepted. Checked-in snapshot files containing HYG- or AT-HYG-derived values are licensed under **CC BY-SA 4.0**, with a `data/LICENSE-exoplanet-catalog.md` notice that gives attribution and describes the changes. Code licensing is unaffected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D19 | Literature references (Q8)       | Keep references simple and small. Store a deduplicated reference table, `[bibcode, label]` (2,243 entries, about 104 KB). Each planet stores a `refs` array of table indexes with the discovery reference first (average 2.85, maximum 7, about 78 KB total). Do **not** store which parameter each reference supports; that would add about 0.5 MB. Labels are plain text and URLs are rebuilt from the ADS bibcode. _Phase 1 refinement:_ the key is an ADS bibcode or, for the roughly 8 non-ADS sources such as "Calculated Value" and ExoFOP, an absolute URL. References now come from 21 columns covering every stored value (2,452 entries, 125 KB; average 4.92 per planet, maximum 11).                                                                                                                                                                                                                                                                                                                                             |
| D20 | Derived orbits (Phase 1)         | When only one of the orbital period and semi-major axis is known, the importer calculates the other with Kepler's third law, using the host's `st_mass` plus the planet's mass. Because this is a game, derived values are **not** flagged as approximate. Other gaps stay empty for phase 4, where D7 defaults still apply and are still flagged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D21 | Snapshot layout (Phase 1)        | Each snapshot has pretty-printed metadata and **one minified record per line**, giving compact files with readable git diffs. Files: `exoplanet-planets.json`, `exoplanet-hosts.json` (archive host facts; phase 2 adds HYG matches), and `exoplanet-references.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D22 | Stable IDs (Phase 1)             | Planets use `exo-<slug(pl_name)>`, such as `exo-proxima-cen-b`. Hosts use `exo-host-<slug(hostname)>`. The prefixes keep catalog IDs from colliding with curated IDs. Reference indexes are append-only: existing entries keep their index across refreshes, and new entries are appended in key order.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D23 | Shrinkage override               | Run the import with `--allow-shrink` or set `EXOPLANET_ALLOW_SHRINK=1` to acknowledge a loss of more than 2% of planets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D24 | Settler names (Q9)               | The game is set about 100 years in the future, so systems, host stars, and **planets** can carry human-readable settler names drawn from all cultures, like North American towns named after settlers. **This plan adds only the hook**; naming content is a separate later plan (N1). Rules: (1) IDs never change; names are not identity. (2) The existing contract `displayName` is the game name; each body and system also gets an additive `catalogName` (for example `24 Boo`), and stars keep `properName`. (3) Names live in a checked-in `data/exoplanet-names.json`, keyed by system, host, and planet ID, and the monthly refresh **never writes to it**. (4) Where no name has been assigned, `displayName` falls back to the catalog name, so the hook works before N1 exists. (5) Curated systems and well-known stars (Sol, Alpha Centauri, Cygnus X-1, IAU-named stars and planets) keep their real names.                                                                                                                   |
| D25 | Match pipeline (Phase 2)         | The refresh runs two steps: the importer, then `scripts/match-exoplanet-hosts.js` (`npm run catalog:exoplanet:match`). HYG v4.4 and AT-HYG v4.0 are cached in the git-ignored `.cache/exoplanet/` (override with `EXOPLANET_CACHE_DIR`). Each file's SHA-256 comes from its Codeberg Git LFS pointer: a matching cache is reused, a new file is downloaded and verified, and a SHA change is **recorded** in the match report (`changedSinceLastRun`) rather than failing the run. If the pointer cannot be fetched, the cache is used with a warning. Outputs: a `match` block on each host in `exoplanet-hosts.json`, `exoplanet-hyg-stars.json` (matched host stars plus HYG `base` companions, D11), and `exoplanet-match-report.json`.                                                                                                                                                                                                                                                                                                   |
| D26 | Value precedence (Phase 2)       | For matched hosts, the archive wins for stellar physics (spectral type, Teff, mass, radius, luminosity), and AT-HYG/HYG wins for position, distance, and names. HYG `lum` fills luminosity only when the archive has none. Unmatched hosts use archive values. Implemented as `resolveHostStar`; phases 3 and 5 consume it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D27 | Epochs and sanity gate           | AT-HYG position epochs are mixed, and `pos_src` does not identify them (no row has a Gaia source; high proper-motion Tycho rows appear at both J2000 and J2016). Separation is therefore the **minimum** over the catalog position and the position propagated J2000→J2016. The sanity gate compares distance with both `sy_dist` and `1000 / sy_plx`, because TICv8 `sy_dist` is wrong for some nearby stars (GJ 411 is listed at 5.68 pc, while its parallax gives 2.55 pc). A position miss of 60″ or more is still accepted when distance and proper motion both agree within 5%, because Gliese-sourced positions can be off by arcminutes. The report notes these as `position-offset-accepted`.                                                                                                                                                                                                                                                                                                                                        |
| D28 | Tier-3 companion guards          | Naive Bayes over-counts the agreement in distance and proper motion of co-moving companions. So tier 3 auto-matches only when the best candidate's normalized separation is < 5″ and its V magnitude is within 1 mag of the host; otherwise the match goes to review (`wide-separation`, `magnitude-mismatch`). The prior counts every training host's cone candidates, including hosts without IDs, so it stays conservative for faint hosts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D29 | Match drift override             | The refresh fails when the auto-match rate (matched excluding overrides, divided by hosts) moves by more than 2 points from the previous report. Acknowledge with `--allow-match-drift` or `EXOPLANET_ALLOW_MATCH_DRIFT=1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D30 | Reconcile by HIP                 | HYG v4.4 row IDs differ from the `hygId` values in the fixture and curated catalogs (for example, Proxima is 70666 in v4.4 but 70890 in the fixture). Existing Forge stars are matched by **HIP**, and the matched host carries `existingStarId` and `existingSystemId` for phase 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D31 | Resolved host distance           | Every host gets a deterministic `resolvedDistance` `{distancePc, source, approximate?}`, used to place systems. The first applicable rule wins: (1) `at-hyg`, the AT-HYG distance of a matched host. (2) `parallax`, 1000 / `sy_plx`, when the parallax is ≥ 5 mas and disagrees with `sy_dist` by more than 10% (the nearby TICv8 errors). (3) `archive`, `sy_dist`. (4) `parallax`, when there is no `sy_dist`. (5) `photometric`, from V (else Gaia G) and log L (else R²·(Teff/5772 K)⁴), with M = 4.83 − 2.5·log L and d = 10^((m − M + 5)/5). (6) `default`, the median `sy_dist` of the hosts that ship as archive-only stars, recomputed each run. **Non-scientific assumptions, accepted for game placement:** parallax is inverted with no bias correction; the photometric estimate applies the Sun's bolometric correction to every star and ignores extinction; the default ignores sky position and discovery method. Sources 5 and 6 are flagged `approximate`, and Nova should label them like other approximate values (A9). |
| D32 | Synthesized companions (Phase 3) | Supersedes the "no placeholder stars" rule in EX-3.3. When a system declares more stars (`sy_snum`, or 2 for a circumbinary planet) than real data provides, the missing companions are **synthesized deterministically**. Each is seeded from `<systemId>:<letter>`, so adding one star never changes another. A companion is a main-sequence star whose mass is a fraction of a reference star's (0.1–0.9, or 1.0–1.5 when it takes a letter before the host's). Luminosity, radius, Teff, and spectral class come from simple mass relations, and position is offset by a log-uniform separation. A circumbinary partner sits at 0.05–0.5 AU and at most a quarter of the innermost circumbinary planet's orbit. Any other companion sits at 10–1,000 AU or more, and at least 5× the system's widest planetary orbit. Synthesized stars have `source: 'synthesized'` and `approximate: true`. Systems reconciled to an existing Forge system are never synthesized, because they already own their stars.                                 |
| D33 | Planet anchors                   | Each star lists the `planetIds` of its own (S-type) planets. Circumbinary (P-type) planets are listed at the system level as `circumbinaryPlanets: [{planetIds, starIds}]` and orbit the barycenter of the host and its letter-adjacent partner (A↔B; a B host pairs with C, else A). A planet is circumbinary when `cb_flag = 1` or its host name has a two-letter suffix (`AB`, `BC`, `ABC`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D34 | System IDs                       | New systems use `exo-<slug(base name)>`, such as `exo-kepler-16` or `exo-55-cnc`. A reconciled existing system ID (D30), such as `alpha-centauri`, wins. If two groups share a slug, each takes `exo-<slug(primary host name)>`, and the build fails if that still collides. Star IDs: an existing Forge star ID, or `exo-star-<slug(host name)>` for hosts, `exo-star-athyg-<atHygId>` for HYG companions, and `<systemId>-star-<letter>` for synthesized stars.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| D35 | System position and name         | A system's position, distance, and distance source come from its primary star (letter A, or the first role). Each star keeps its own position. `catalogName` is the primary host's name without its component suffix (`Kepler-16`, `55 Cnc`), `properName` is the primary star's HYG proper name, and settler names stay in the D24 hook. Reconciled existing systems omit the system-level name and position, because the curated catalog owns them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D36 | Grouping and letters             | Hosts are grouped with union-find over: the host name without its component suffix; a shared HYG `base`, or an HYG companion linked to several hosts; a shared existing Forge system; and `systemAssignments` overrides (`join` with another host, or `detach`). Letters: host suffixes claim their letter first (`Aa` → A, `AB` → A, `BC` → B, no suffix → A). Collisions and unlettered HYG companions take the lowest free letters in brightness order, and synthesized stars take the letters that remain. Roles follow letter order (primary, secondary, tertiary, quaternary). Stars in reconciled existing systems keep their existing role.                                                                                                                                                                                                                                                                                                                                                                                           |
| D37 | Slim system records              | To keep the snapshot under the D2 budget, archive-host and HYG-companion stars in `exoplanet-systems.json` carry only links (`starId`, `letter`, `role`, `source`, `hostId`, `atHygId`, `existing`, `planetIds`). Phase 5 seeding re-derives their position and physics with `resolveHostStar` from the hosts and HYG-star snapshots, using the report's `defaultDistancePc`, exactly as the build does. Synthesized stars exist nowhere else, so they carry full approximate physics and a 1e-6 pc position. Systems keep `positionPc`, `distancePc`, and `distanceApproximate` from their primary for spatial queries, and reconciled systems carry `existing: true` instead of a separate ID field. Supersedes "each star keeps its own position" in D35.                                                                                                                                                                                                                                                                                  |

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
| exoplanet-planets.json      |   6,451 | 3.21 MB (measured) |
| exoplanet-hosts.json        |   4,847 | 2.93 MB (measured) |
| exoplanet-hyg-stars.json    |   1,727 | 0.83 MB (measured) |
| exoplanet-systems.json      |   4,841 | 1.99 MB (measured) |
| exoplanet-match-report.json |   4,847 | 0.67 MB (measured) |
| exoplanet-references.json   |   2,452 | 0.13 MB (measured) |

Phase 0 measured the planet and host files from the full export and estimated
the others; phases 1–3 replaced the estimates with measured sizes. The hosts
file grew with the Phase 2 `match` and D31 `resolvedDistance` blocks. The
systems file was 3.46 MB with full star records, which pushed the total past
10 MB, so D37 slims real stars to links only. The total is 9.75 MB, just below
the 10 MB threshold, so D2 holds, but with little headroom: monthly growth will
cross it within a few refreshes. Phase 6 should add the size check (risk table)
and revisit D2 (for example gzip, or dropping reproducible fields from the
hosts file) before then.

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
3. **Scored probabilistic match.** For remaining hosts, select AT-HYG candidates
   within a cone around the host. Each candidate is compared at both its
   catalog position and its position propagated from J2000 to J2016 (D27). The
   cone radius is max(15″, |µ| × 30 yr). Score each candidate with a Fellegi–Sunter–style
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
   - Companion guards (D28): a best candidate whose normalized separation is
     ≥ 5″ or whose V magnitude differs by more than 1 mag goes to review even
     when its posterior is ≥ 0.95.
   - Enforce a one-to-one assignment across hosts. The strongest claim wins
     (override > Gaia > HIP > HD > scored by posterior); the others go to review
     with `claimed-by`. Companions are exempt because they are grouped in phase 3.

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

| ID  | Source                                                     | Used for                                                                                                                                   | License or terms                                                       | Required text or action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Nova UI placement                          | Status |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | :----: |
| A1  | NASA Exoplanet Archive (`pscomppars`)                      | All exoplanets and host-star parameters                                                                                                    | NASA public data; acknowledgment requested                             | "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program." Cite Christiansen et al. (2025), _PSJ_, [doi:10.3847/PSJ/ade3c2](https://iopscience.iop.org/article/10.3847/PSJ/ade3c2). Source: [acknowledge.html](https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html).                                                                                 | Global data-credits panel                  |   🟢   |
| A2  | Literature references within the archive                   | Discovery and supporting references for each planet's parameters                                                                           | Archive requests direct acknowledgment of the specific references used | Per D19, show a short reference list per planet (discovery reference first, then the others), each as a plain-text label and an ADS link built from the bibcode (`https://ui.adsabs.harvard.edu/abs/<bibcode>/abstract`). When the key is already an absolute URL (non-ADS sources such as "Calculated Value" or ExoFOP), link to it directly. References are not mapped to individual parameters. The archive provides HTML anchors: parse them at import time and never render them as HTML.                                                | Planet detail view (per planet)            |   🟢   |
| A3  | HYG v4.4 (David Nash / astronexus)                         | Star multiplicity (`base`, `comp`) and classic IDs for matched hosts                                                                       | **CC BY-SA 4.0**                                                       | Attribute "HYG Database v4.4, astronexus (codeberg.org/astronexus/hyg)", link to the license, and state any changes ("cross-matched and subset by Stellar"). **Share-alike:** checked-in files containing HYG-derived values are distributed under CC BY-SA 4.0 (accepted, D18). The Nova credits panel must show the license name and link.                                                                                                                                                                                                  | Global data-credits panel; license link    |   🟢   |
| A4  | AT-HYG v4.0 (David Nash / astronexus)                      | Host-star cross-match, positions, distances, and IDs for matched hosts                                                                     | **CC BY-SA 4.0**                                                       | Attribute "AT-HYG v4.0, astronexus (codeberg.org/astronexus/athyg)" with the license link and a change notice. The share-alike obligations in A3 apply.                                                                                                                                                                                                                                                                                                                                                                                       | Global data-credits panel; license link    |   🟢   |
| A5  | ESA Gaia DR3 (through AT-HYG and archive IDs)              | Distances, positions, and IDs for most matched hosts                                                                                       | Gaia data license; acknowledgment requested                            | "This work has made use of data from the European Space Agency (ESA) mission _Gaia_ (https://www.cosmos.esa.int/gaia), processed by the _Gaia_ Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the _Gaia_ Multilateral Agreement." Source: [Gaia DR3 credits](https://gea.esac.esa.int/archive/documentation/GDR3/Miscellaneous/sec_credit_and_citation_instructions/). | Global data-credits panel                  |   🟢   |
| A6  | ESA Hipparcos and Tycho-2 (through AT-HYG/HYG)             | Positions and IDs for bright hosts                                                                                                         | Acknowledgment                                                         | "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200." Source: AT-HYG `ACKNOWLEDGMENTS.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Global data-credits panel                  |   🟢   |
| A7  | Yale Bright Star and Gliese–Jahreiß catalogs (through HYG) | Classic IDs and names                                                                                                                      | Citation                                                               | Hoffleit, _Catalogue of Bright Stars_, 5th ed. (1991); Gliese & Jahreiß (1991), "Preliminary Version of the Third Catalogue of Nearby Stars." Source: AT-HYG `ACKNOWLEDGMENTS.md`.                                                                                                                                                                                                                                                                                                                                                            | Global data-credits panel (secondary list) |   ⚪   |
| A8  | IAU Working Group on Star Names (through HYG)              | Proper star names                                                                                                                          | Citation                                                               | "Star names from the IAU Working Group on Star Names."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Global data-credits panel (secondary list) |   ⚪   |
| A9  | Stellar-derived values                                     | Defaulted orbital elements (D7), procedural rings (D12), planet class, approximate host distances (D31), synthesized companion stars (D32) | n/a (our data)                                                         | Not an attribution, but a required disclosure: every value with `approximate: true` must be visually distinguishable, with an explanatory note such as "Approximate. Not all orbital elements are published for this planet."                                                                                                                                                                                                                                                                                                                 | Planet detail view; legend                 |   🟢   |

Notes:

- The existing Sol credits (MPC and NASA/JPL SSD) are documented in
  [sol-catalog-data.md](./sol-catalog-data.md). The Nova credits panel should
  show them alongside A1–A8.
- Attribution must stay correct after monthly refreshes. The importer writes
  source URLs, versions, and the snapshot date into each snapshot file's
  metadata, as the Sol snapshots do, so Nova can show "Data as of
  YYYY-MM-DD".
- Phase 2 added `data/exoplanet-hyg-stars.json`, plus AT-HYG/HYG rows in
  `test/fixtures/exoplanet/`. Both are AT-HYG/HYG-derived and fall under A3
  and A4 (CC BY-SA 4.0). The file's metadata carries the license, source
  versions, and SHA-256 values. Nova needs no new credit beyond A3–A6, but
  the A3/A4 change notice should read "cross-matched with the NASA Exoplanet
  Archive and subset by Stellar".

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

- [x] **EX-1.1** Add `scripts/import-exoplanet-catalog-data.js` with pure,
      exported parsers, mirroring the Sol importer structure.
- [x] **EX-1.2** Build a TAP query with an explicit column list that never uses
      `select *`. Request CSV or JSON, and handle timeouts and retries.
      _Done: JSON, 180-second timeout, three attempts with backoff._
- [x] **EX-1.3** Normalize records into a compact planet shape with a stable
      `planetId` slug derived from `pl_name`, host reference, orbital and
      physical facts, discovery method and year, and per-field
      `approximate: true` flags. Include `status: 'confirmed'` on every record
      so candidates can be added later without a schema break (D15). Do not
      encode confirmation status in `planetId`. Carry `controversial: true`
      when `pl_controv_flag = 1` (D17). _Done with D20–D22: IDs are
      `exo-…`; no approximate flags at import because derived orbits are not
      flagged and other gaps are left for phase 4. Hosts are also written to
      `exoplanet-hosts.json`._
- [x] **EX-1.3a** Parse `disc_refname` and the `*_reflink` anchors into the
      deduplicated reference table `data/exoplanet-references.json`, with
      entries `[bibcode, label]` (D19). Store a per-planet `refs` index array,
      discovery reference first. Use Cheerio text extraction, as the Sol
      importer does. Add tests for anchor parsing, non-ADS URLs, and
      de-duplication.
- [x] **EX-1.3b** Write `data/LICENSE-exoplanet-catalog.md` (D18) covering
      CC BY-SA 4.0, attribution for A3 and A4, a change notice, and the A1, A5,
      and A6 acknowledgments. Write source URLs, versions, and the snapshot
      date into each snapshot's metadata.
- [x] **EX-1.4** Add validation gates: minimum counts (≥ 6,000 planets and
      ≥ 4,500 hosts initially), unique `planetId`, finite numbers, and valid
      ranges such as 0 ≤ e < 1 and P > 0.
- [x] **EX-1.5** Add a shrinkage guard. Fail if more than 2% of previously known
      planets disappear unless an override is acknowledged. The archive rarely
      retracts planets, but retractions do happen. _Override per D23._
- [x] **EX-1.6** Add the `catalog:exoplanet:refresh` npm script.
- [x] **EX-1.7** Add unit tests for parsers and gates using small fixtures in
      `test/`. Tests must not make network calls.
      _`test/import-exoplanet-catalog-data.test.js`, 20 tests._

**Exit criteria:** Running the script locally produces
`data/exoplanet-planets.json`, and all gates and tests pass. ✅

### Phase 1 findings

- **Run results (2026-11-01):** 6,451 planets, 4,847 hosts, and 2,452
  references in about 7 seconds. The files are `exoplanet-planets.json`
  (3.21 MB), `exoplanet-hosts.json` (2.35 MB), and
  `exoplanet-references.json` (0.13 MB), 5.69 MB in total.
- **Deterministic output:** A fresh build and an incremental rebuild produce
  byte-identical files. The first version chose a reference label by row
  order. When rows disagree, the importer now picks the most common label,
  breaking ties alphabetically.
- **Angle gate:** The range gate caught three planets with an argument of
  periapsis above 360° (HIP 65891 b, tau Cet g, TRAPPIST-1 f). The importer
  now wraps these angles into the 0–360° range.
- **D20 orbit derivation:** 487 planets gained a semi-major axis and 340
  gained a period. Only 8 planets still lack a semi-major axis because their
  host has no mass.
- **Host value conflicts:** Host values are repeated on each planet row of
  `pscomppars` and sometimes disagree between rows. Disagreements per field:
  `massSolar` 200, `radiusSolar` 192, `teffK` 192, `metallicityDex` 153,
  `ageGyr` 86, `logLuminositySolar` 25, and `spectralType` 8. The importer
  uses the most common value. ID fields never conflicted.
- **Verified flags:** 58 controversial planets (D17) and 53 circumbinary
  planets carry their flags.

## Phase 2 — HYG host slice and cross-match

- [x] **EX-2.1** Download and stream-parse the full HYG CSV at build time. Use a
      quoted-CSV-aware parser because the current fixture splitter is not
      sufficient. Implemented in `scripts/lib/exoplanet-hyg-sources.js`
      (LFS-pointer-verified cache, gzip stream, one AT-HYG pass of about 14 s).
- [x] **EX-2.2** Implement tiers 1–3 from the
      [cross-match design](#cross-match-design) as pure functions
      (`scripts/lib/exoplanet-crossmatch.js`).
- [x] **EX-2.3** Add a calibration script and commit the fitted constants.
      Record precision and recall in this document.
      `npm run catalog:exoplanet:calibrate` writes
      `scripts/lib/exoplanet-crossmatch-calibration.json`; results are in the
      [findings](#phase-2-findings).
- [x] **EX-2.4** Emit `data/exoplanet-hosts.json`, which includes merged stars
      with both `hygId` and archive IDs. Unmatched hosts are archive-only stars.
      Each host has a `match` block; the matched AT-HYG rows are in
      `data/exoplanet-hyg-stars.json` (D25), and value precedence follows D26.
- [x] **EX-2.5** Emit `data/exoplanet-match-report.json`, containing each host's
      tier, posterior, top candidates, and decision.
- [x] **EX-2.6** Add `data/exoplanet-overrides.json` and validate it with a
      schema (`scripts/schemas/exoplanet-overrides.schema.json`, ajv).
- [x] **EX-2.7** Reconcile with the existing [hyg-fixture.csv](../data/hyg-fixture.csv)
      and the curated systems Sol, Alpha Centauri, and Cygnus X-1. Proxima Cen b
      and d must attach to the existing `alpha-centauri` system and must not
      create a duplicate. Attach Barnard's Star and Lalande 21185 planets to
      their existing fixture systems in the same way. Sirius, Wolf 359, and
      Cygnus X-1 remain grandfathered (D11). Reconciled by HIP (D30): Proxima
      Cen → `alpha-centauri-star-tertiary`, Barnard's Star →
      `barnards-star-star-primary`, GJ 411 → `lalande-21185-star-primary`.
      Phase 3 attaches the planets to these systems.
- [x] **EX-2.9** Apply the inclusion rule (D11). Keep in the host slice only
      HYG rows that are matched hosts or companions of matched hosts. Add a
      test that a planetless HYG system that is not grandfathered is never
      emitted.
- [x] **EX-2.8** Add tests covering known hard cases: Proxima Cen, 55 Cnc,
      Kepler-16 (circumbinary), TRAPPIST-1, a star found only by Gaia, a name
      collision, and an ID match that fails the sanity gate. The tests are in
      `test/exoplanet-crossmatch.test.js` (24 tests) and use real catalog rows
      extracted to `test/fixtures/exoplanet/`.

**Exit criteria:** Held-out automatic-match precision is ≥ 0.95, the match
report is reviewable, and curated systems contain no duplicates. ✅

### Phase 2 findings

- **Run results:** Of the 4,847 hosts, 1,694 (34.95%) matched
  automatically: 1,670 by Gaia DR3, 16 by HIP, and 8 by scoring. Another 6 are
  in review and 3,147 are unmatched, which agrees with the Phase 0 estimate
  (35.0%). Of the unmatched hosts, 3,142 have no AT-HYG star within their cone
  and only 2 have V ≤ 11. A full match run takes about 14 seconds. Output is
  byte-identical on rerun.
- **Calibration:** Trained on 1,378 positive and 1,907 negative pairs. On the
  held-out 20% (308 hosts), automatic-match **precision is 1.00** and recall
  is 0.971 (299 of 308; the other 9 go to review). When the true star is
  removed from the pool (a stand-in for faint hosts), the false-auto rate is
  0.97%. The remaining false-auto cases are co-moving companions in the same
  system.
- **Companion over-confidence:** The first prior counted only cone pools of
  ID-matched hosts (log-odds 3.96), which gave a 3% false-auto rate with the
  truth removed. Counting every training host's cone candidates lowered it
  (log-odds 3.46). Even so, tier 3 auto-matched the wide binary companions
  HAT-P-1, TOI-858 B, and WASP-94 B at 11–15″. The D28 guards send these
  cases to review without lowering held-out recall.
- **Epochs (D27):** AT-HYG `pos_src` is T, T_X, HIP_X, or GJ, never Gaia. High
  proper-motion stars showed that a single assumed epoch fails in both
  directions:
  - Barnard's Star needs J2000.
  - GJ 273 and GJ 411 already sit at J2016.
  - Gliese-sourced positions such as LHS 475 can be off by about 110″ at any
    epoch.
- **Archive distance errors:** 66 hosts have a `sy_dist` more than 10% away
  from `1000 / sy_plx` (TICv8). Of these, 5 are matched, so AT-HYG supplies
  their distance under D26. The other 61 (60 unmatched, plus Kepler-907 in
  review) all have parallax < 5 mas, more than 200 pc away. At that range
  `sy_dist` is the better estimate, so D31 keeps it. The clear TICv8 errors
  (GJ 273, GJ 411, Gl 725 B) were all nearby stars.
- **Resolved distances (D31):** Every host now has a `resolvedDistance`
  block:

  | Source        | Hosts |
  | ------------- | ----: |
  | `at-hyg`      | 1,692 |
  | `archive`     | 3,130 |
  | `photometric` |    15 |
  | `default`     |    10 |

  Two matched hosts (Kepler-14 and Kepler-449) have no AT-HYG distance and
  fall back to the archive. The default is 664.568 pc. Known misses from the
  D31 assumptions, both fixable later with a distance override:
  - Luhman 16 A is really about 2 pc but receives the default.
  - SPECULOOS-3, an ultracool dwarf, is estimated at 113 pc against a true
    distance of about 17 pc, because the solar bolometric correction does
    not suit it.

- **Review queue (6), deferred as [F1](#f1--review-queue-resolution):**
  - HAT-P-1, TOI-858 B, and WASP-94 B: wide binaries, where the candidate is
    the companion (`wide-separation`).
  - HD 41004 A: claimed by HD 41004 B, because B's Gaia ID points to the only
    AT-HYG row for the pair.
  - Kepler-907 and WASP-20: Gaia matches with separations of 0.2″ or less, but
    the distances differ by 36–40%.

  These ship as archive-only stars (D14). The match report marks them
  `carriedOver`.

- **ID disagreements:** 4 hosts have Gaia and HIP/HD IDs that point to
  different AT-HYG rows (HD 133131 A, HD 135344 A, HD 178911 B, TOI-5811 B).
  Gaia wins, and the report records `ids-disagree`.
- **Multiplicity:** The HYG `base` field adds 33 companion stars to the slice.
  No HYG companion is missing from AT-HYG.

## Phase 3 — Solar-system grouping (multi-star)

- [x] **EX-3.1** Derive a system key from the host name with the component
      suffix removed, such as `Kepler-444 A` → `kepler-444`. Union this with
      HYG `base` groupings for matched stars.
- [x] **EX-3.2** Assign star roles (`primary`, `secondary`, `tertiary`, …) by
      component letter, falling back to mass or brightness.
- [x] **EX-3.3** Handle `sy_snum` > known stars. Record `declaredStarCount`,
      `resolvedStarCount`, and `synthesizedStarCount`. Add real companion
      stars when HYG or the archive provides data; otherwise synthesize them
      deterministically and flag them approximate (D32, which replaces the
      original "no placeholder stars" rule).
- [x] **EX-3.4** Attach circumbinary planets (`cb_flag = 1` or host `AB`) to
      the system barycenter, not to a single star.
- [x] **EX-3.5** Generate stable system IDs. Existing IDs such as
      `alpha-centauri` win. New IDs are slugs, with collisions resolved
      deterministically.
- [x] **EX-3.6** Emit `data/exoplanet-systems.json`.
- [x] **EX-3.7** Add tests for single-star, binary, triple, circumbinary, and
      wide-binary systems where planets orbit each star.

**Exit criteria:** Each planet belongs to exactly one system, and each host
star belongs to exactly one system. ✅ `validateSystems` enforces both on every
build, and the build fails on any violation.

### Phase 3 findings

- **Implementation:** `scripts/lib/exoplanet-systems.js` (grouping, letters,
  synthesis, anchors, validation) and `scripts/build-exoplanet-systems.js`
  (`npm run catalog:exoplanet:systems`, now the last step of
  `catalog:exoplanet:refresh`). The build reads only checked-in snapshots, so
  it needs no network or cache, and runs in about 1 s. Rebuilds are
  byte-identical. `test/exoplanet-systems.test.js` adds 14 tests (708 total).
- **Overrides:** `exoplanet-overrides.json` gained `systemAssignments`
  (`join` with `withHostId`, or `detach`), validated by the schema. None are
  needed today.
- **Systems:** 4,847 hosts form 4,841 systems. Six systems hold two archive
  hosts (for example, WASP-94 A/B and 55 Cnc with 55 Cnc B). Three hosts
  reconcile to existing Forge systems (`alpha-centauri` via Proxima,
  `barnards-star`, `lalande-21185`). There are 0 ID collisions.
- **Multiplicity:** 432 systems have more than one star: 4,408 declare one
  star, 380 two, 52 three, and 1 four. Only 33 multi-star systems are fully
  real. The rest need 446 synthesized stars, 11 of which are the primary
  (B-only hosts such as `GJ 3305 B`). 33 real stars come from HYG companions.
- **Circumbinary:** 43 systems carry 53 circumbinary planets at a barycenter.
  Each one's partner is a synthesized close binary below 0.5 AU. The other 403
  synthesized companions sit at 10 AU to 543,500 AU (median 104 AU). The
  extreme is GJ 900, whose planet orbits at about 12,000 AU, so the D32 rule of
  5× the widest orbit pushes its companions to 0.5–2.6 pc. That is acceptable
  for placement but is worth a look in Phase 4.
- **Approximate placement:** 36 systems take an approximate distance from
  D31, and all 446 synthesized stars are `approximate` (A9).
- **Size:** With full star records the file was 3.46 MB, which pushed the
  total past 10 MB. D37 slims real stars to links, which brings the file to
  1.99 MB and the total to 9.75 MB.

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
- [ ] **EX-5.4a** Add the settler-name hook (D24). Add an additive
      `catalogName` to systems and bodies, and populate `displayName` from
      `data/exoplanet-names.json`, falling back to the catalog name. Create the
      names file with only the curated and well-known entries, add a loader
      test, and add a refresh test proving the importer never writes the file.
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
      [attribution register](#attribution-register) as an addendum to
      [nova-sol-catalog-attribution-prompt.md](./nova-sol-catalog-attribution-prompt.md):
      global credits panel, per-planet references, license links, and
      approximate-value disclosure.
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
| Monthly refresh overwrites hand-assigned settler names (D24)   | Names live in a separate file the importer never writes; a test enforces this                   |
| Archive renames a host or planet that has a settler name       | Names are keyed by ID; the rename map in overrides carries the name across to the new ID        |

## Resolved questions

All questions were resolved on 2026-11-01. Each answer is recorded as a
decision.

| #   | Question                                                             | Resolution                                                                                                                                                                                                 | Decision |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | Should HYG systems with no known exoplanets keep procedural planets? | HYG supplies only host and companion stars. A system without a matched exoplanet is excluded for now. Current curated and fixture systems are grandfathered.                                               | D11      |
| Q2  | Moons or rings for catalog planets?                                  | Rings only, procedural and flagged approximate, for gas and ice giants. No moons.                                                                                                                          | D12      |
| Q3  | Procedural planets in gaps of systems with real planets?             | No. Real planets fully replace procedural planets.                                                                                                                                                         | D13      |
| Q4  | Who triages the review queue, and what is the service-level target?  | The refresh PR reviewer. Triage is non-blocking; queued hosts ship as archive-only stars and are resolved before the next run.                                                                             | D14      |
| Q5  | Are candidate planets (TOIs or KOIs) in scope?                       | Not now. The schema and contract are designed so candidates can be added in a later phase.                                                                                                                 | D15      |
| Q6  | Include the 58 controversial planets?                                | Include them, with a `controversial` flag for Nova to label.                                                                                                                                               | D17      |
| Q7  | Accept CC BY-SA 4.0 for the checked-in HYG-derived data?             | Accepted, with a data license notice file.                                                                                                                                                                 | D18      |
| Q8  | Literature reference scope?                                          | Discovery reference plus supporting references, kept simple: a deduplicated table and a per-planet index list (about 0.18 MB), with no per-parameter mapping.                                              | D19      |
| Q9  | Settler names for systems, stars, and planets 100 years out?         | Add the hook now (`catalogName` beside `displayName`, a names file the refresh never writes) and plan the naming content separately as N1. Planets can be renamed; curated and well-known names stay real. | D24      |

## Open questions

None at this time. Q6–Q9 were resolved on 2026-11-01 (see the resolved
questions table).

## Deferred follow-ups

### F1 — Review-queue resolution

Deferred on 2026-11-02 because no reliable way to resolve these hosts was
found yet. They ship as archive-only stars (D14), and their distance comes
from D31. Each refresh marks hosts still in review with `carriedOver: true`
and records the total as `reviewCarriedOver` in the match report. Revisit at
the next refresh to see whether new archive or AT-HYG data, or a better rule,
resolves them.

| Host       | Reason                                  | Idea to try next time                                                                 |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| HAT-P-1    | Wide binary; candidate is the companion | Treat a co-moving pair as one system and accept the system match without a star match |
| TOI-858 B  | Wide binary; candidate is the companion | Same as HAT-P-1                                                                       |
| WASP-94 B  | Wide binary; candidate is the companion | Same as HAT-P-1                                                                       |
| HD 41004 A | Claimed by HD 41004 B (one AT-HYG row)  | Allow an unresolved close pair to share a row and split it in phase 3                 |
| Kepler-907 | Gaia match; distance differs by 40%     | Check whether a newer AT-HYG release fixes the distance                               |
| WASP-20    | Gaia match; distance differs by 36%     | Same as Kepler-907 (WASP-20 is a known close binary, which can skew the distance)     |

**Distance misses under D31** (flagged on 2026-11-02; the host is placed, but
at the wrong distance):

| Host        | Resolved distance         | True distance | Cause                                                            | Idea to try next time                                            |
| ----------- | ------------------------- | ------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Luhman 16 A | 664.568 pc (`default`)    | about 2 pc    | Archive row has no distance, parallax, or magnitude              | A `distance` override in `data/exoplanet-overrides.json`         |
| SPECULOOS-3 | 113.46 pc (`photometric`) | about 17 pc   | The Sun's bolometric correction does not suit an ultracool dwarf | A `distance` override, or a Teff-dependent bolometric correction |

## Change log

| Date       | Change                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-01 | Initial plan created.                                                                                                                                                                                                                                                                          |
| 2026-11-01 | Resolved Q1–Q5 and added decisions D11–D15. Updated EX-1.3, EX-2.7, EX-4.1, EX-4.5, EX-5.4, and EX-6.3; added EX-2.9 and two risks.                                                                                                                                                            |
| 2026-11-01 | Phase 0 complete. Recorded findings and the snapshot-metrics baseline; added D16 (AT-HYG and HYG v4.4) and refined cross-match tiers 2–3 with measured statistics; added the attribution register; opened Q6–Q8.                                                                               |
| 2026-11-01 | Resolved Q6–Q8 and added D17–D19. Added EX-1.3a (references) and EX-1.3b (data license notice); attribution rows A2–A4 confirmed.                                                                                                                                                              |
| 2026-11-01 | Phase 1 complete. Added the importer, tests, the first live snapshot, and the data license notice. Added D20–D23 and refined D19 and A2.                                                                                                                                                       |
| 2026-11-01 | Resolved Q9: added D24 (settler-name hook), EX-5.4a, deferred plan N1, and two naming risks.                                                                                                                                                                                                   |
| 2026-11-02 | Phase 2 complete. Added the HYG cross-match, calibration, overrides, match report, and HYG star slice. Added D25–D30, Phase 2 findings, and measured file sizes; refined cross-match tier 3 and attribution A3–A4.                                                                             |
| 2026-11-02 | Added D31 (deterministic resolved host distance) and deferred follow-up F1 for the 6 review-queue hosts; the match report now flags carried-over review hosts.                                                                                                                                 |
| 2026-11-02 | Phase 3 complete. Added solar-system grouping (D32–D36), synthesized companions, circumbinary anchors, `systemAssignments` overrides, and `exoplanet-systems.json`; added D37 (slim records) and Phase 3 findings; flagged Luhman 16 A and SPECULOOS-3 in F1; A9 now covers synthesized stars. |
