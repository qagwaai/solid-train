# Exoplanet catalog data

The exoplanet catalog adds every confirmed planet in the
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) to the
game. The 2026-11-01 snapshot holds **6,451 planets** around **4,847 host
stars**, grouped into **4,841 solar systems**. Three of those systems
(Alpha Centauri, Barnard's Star, and Lalande 21185) were already in the game
and are merged rather than duplicated. These counts change with each monthly
refresh; the [snapshot metrics](#snapshot-metrics) table records every run.

The design, decisions (D1–D62), and open follow-ups are in the
[import plan](./exoplanet-catalog-import-plan-2026-11-01.md).

## Data sources and acknowledgments

| Source                                                                                                                | Used for                                                        | License                                    |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `pscomppars` table (TAP)                         | Planets, host-star parameters, and literature references        | NASA public data; acknowledgment requested |
| [AT-HYG v4.0](https://codeberg.org/astronexus/athyg) and [HYG v4.4](https://codeberg.org/astronexus/hyg) (David Nash) | Host-star cross-match, positions, distances, and companions     | CC BY-SA 4.0                               |
| ESA Gaia DR3, Hipparcos, and Tycho-2 (through AT-HYG)                                                                 | Distances, positions, and identifiers                           | Acknowledgment requested                   |
| [IAU NameExoWorlds 2015](https://www.nameexoworlds.iau.org/)                                                          | Game display names for 29 planets (`data/exoplanet-names.json`) | IAU naming; reuse terms to confirm         |

The required acknowledgment wording, the share-alike obligations, and the
list of changes made to the source data are in
[LICENSE-exoplanet-catalog.md](../data/LICENSE-exoplanet-catalog.md). The
[attribution register](./exoplanet-catalog-import-plan-2026-11-01.md#attribution-register)
is the source of truth for the Nova credits UI. Per-planet literature
references are stored as plain text plus an ADS bibcode or URL and must never
be rendered as HTML.

## Pipeline

`npm run catalog:exoplanet:refresh` runs three scripts in order. Runtime
seeding reads only the checked-in files and never makes network requests.

1. **Import** ([import-exoplanet-catalog-data.js](../scripts/import-exoplanet-catalog-data.js))
   downloads `pscomppars` and writes `exoplanet-planets.json`,
   `exoplanet-hosts.json`, and `exoplanet-references.json`. It fails when more
   than 2% of the previous planet IDs disappear (override with
   `EXOPLANET_ALLOW_SHRINK=1`).
2. **Match** ([match-exoplanet-hosts.js](../scripts/match-exoplanet-hosts.js))
   links each host to an AT-HYG star by Gaia DR3 ID, then Hipparcos ID, then a
   scored position and magnitude match. Scored matches are accepted at a
   posterior of at least 0.95 with a clear margin over the next candidate;
   uncertain hosts go to the review queue. Hosts without a match keep their
   archive values, and their distance is resolved deterministically (D31).
   The script writes `exoplanet-hyg-stars.json` and
   `exoplanet-match-report.json`, and fails when the auto-match rate moves by
   more than 2 points (override with `EXOPLANET_ALLOW_MATCH_DRIFT=1`). The
   190 MB AT-HYG file is downloaded once into `.cache/exoplanet` (or
   `EXOPLANET_CACHE_DIR`) and verified against its Git LFS SHA-256.
3. **Systems** ([build-exoplanet-systems.js](../scripts/build-exoplanet-systems.js))
   groups hosts with their HYG companions into solar systems, synthesizes
   companion stars the archive declares but HYG lacks, and writes
   `exoplanet-systems.json`.

Hand-maintained inputs that the refresh never overwrites:

- [exoplanet-overrides.json](../data/exoplanet-overrides.json): manual host
  matches (`hostMatches`) and system assignments (`systemAssignments`). This
  is where review-queue entries are resolved.
- [exoplanet-names.json](../data/exoplanet-names.json): game display names,
  keyed by system ID, star ID, and planet ID. A test fails if any key stops
  resolving or if a script references the file.

At runtime, each catalog-fed system gets its own seed version from a hash of
its records, so a refresh reseeds only the systems whose data changed. The
`stars` and `solar_systems` collections are synchronized at startup and skip
the write when nothing changed.

## Unit test coverage

Run `npm run test:coverage` for the repository-wide unit coverage floor, and
`npm run test:coverage:exoplanet` for the stricter core exoplanet floor. The
[testing guide](../README.md#test) describes thresholds, scope, reports, and CI.

The coverage review added regression tests for per-system seed-hash changes
(system, host, HYG record, planet, display names, references, and default
distance), unrelated-planet isolation, cache reset behavior, absent systems,
distance and companion-name fallbacks, mass-radius regimes, stellar temperature
boundaries, and exact planet-classification cutoffs. Existing tests also verify
full-snapshot finite values and determinism, procedural golden hashes, curated
system precedence, circumbinary anchors, runtime schemas, and catalog sync.

With the added tests, the three core runtime modules measure **99.80% lines,
94.36% branches, and 100% functions** on Node 24.22.1, above the aggregate
95% / 90% / 95% floor. Coverage is not a scientific-accuracy guarantee or a
per-file guarantee: the catalog adapter still has lower branch coverage than
the other two modules. Mongo round-trip checks remain integration tests and are
not counted toward the unit floor.

The repository-wide unit run passes **703 tests**, measuring **85.92% lines,
80.14% branches, and 86.94% functions**, above its 85% / 75% / 85% floor.
The focused exoplanet gate passes 85 tests. Eleven regression tests were added
across the cache, star-fact, and generator suites.

## Monthly refresh

[refresh-exoplanet-catalog.yml](../.github/workflows/refresh-exoplanet-catalog.yml)
runs at 09:00 UTC on the 2nd of each month (one day after the quarterly Sol
refresh) and on `workflow_dispatch`. It:

1. Restores the HYG/AT-HYG download cache, keyed on the upstream LFS pointer
   hashes.
2. Runs `npm run catalog:exoplanet:refresh`. If a guard trips, it reruns with
   both overrides so the change can still be reviewed.
3. Runs [exoplanet-refresh-report.js](../scripts/exoplanet-refresh-report.js),
   which compares the snapshot with the default branch, runs both unit coverage
   gates, typecheck, eslint, and prettier, appends a row to the metrics table
   below, and writes the PR body.
4. Opens a pull request only when snapshot records changed (the snapshot date
   alone does not count). The PR is a **draft labeled `needs-review`** when a
   guard tripped, a check failed, or a names-file key no longer resolves.

The PR body lists added and removed planets and systems, the review queue
(host, top AT-HYG candidate, and posterior), and the entries carried over from
earlier runs. Merging is not blocked by the review queue; resolve entries in
`exoplanet-overrides.json` before the next run. Repository settings must allow
GitHub Actions to create pull requests. PRs opened with `GITHUB_TOKEN` do not
trigger other workflows, so the SW-08 and security gates do not run on refresh
PRs; the checks listed in the PR body are the validation.

To run the same steps locally:

```sh
npm run catalog:exoplanet:refresh
npm run catalog:exoplanet:report -- --pr-body pr-body.md
```

## Snapshot metrics

One row per refresh. Rows up to Phase 3 were recorded by hand in the import
plan; later rows are appended by the refresh workflow.

| Snapshot date | Planets | Host stars | Systems | Multi-star systems         | HYG matched (auto / review / manual) | Unmatched hosts | Approx. orbits           | Snapshot size | Notes            |
| ------------- | ------: | ---------: | ------: | -------------------------- | ------------------------------------ | --------------: | ------------------------ | ------------: | ---------------- |
| 2026-11-01    |   6,451 |      4,847 |   4,841 | 432 (43 with circumbinary) | 1,694 (34.95%) / 6 / 0               |           3,147 | 8 lack a semi-major axis |       9.75 MB | Phase 3 baseline |

<!-- snapshot-metrics:end -->
