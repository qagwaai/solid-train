# Nova prompt: celestial-body paging (P2)

Status: Ready to hand off. Forge implements offset paging on
`solar-system-list`, `star-list` and `celestial-body-list` (P2, D68–D74).
Date: 2026-11-02
From repo: solid-train (Forge)
To repo: laughing-octo-journey (Nova)
Related:
[exoplanet-catalog-import-plan-2026-11-01.md](./exoplanet-catalog-import-plan-2026-11-01.md#paging-p2),
[nova-new-planet-types-2026-11-01.md](./nova-new-planet-types-2026-11-01.md),
[nova-sol-catalog-attribution-prompt.md](./nova-sol-catalog-attribution-prompt.md)

## Purpose

The exoplanet import grows the registry to 4,845 systems and 5,331 stars.
Phase 7 measured the unpaged lists: 3.0 MB and about 0.8 s to render all
systems in Nova. Forge now pages every list response.

Nova already has to take two contract changes: the
[new planet types](./nova-new-planet-types-2026-11-01.md) and the
[attribution addendum](./nova-sol-catalog-attribution-prompt.md). Paging is
the third. **Ship all three prompts together** against one Forge release, so
Nova adapts to the contract once.

This is a **breaking change** (D70). Requests without `offset` and `limit`
used to return everything (or up to 1,000 systems or 5,000 stars). They now
return the **first page of 100**. A caller that reads only one response
silently misses the rest.

## Paging contract

The same rules apply to all three operations.

### Request fields

| Field    | Type    | Default | Rules                                                                                                   |
| -------- | ------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `offset` | integer | `0`     | Zero-based index after filtering and sorting. Negative or non-integer values fail.                      |
| `limit`  | integer | `100`   | Page size. Values above **500** are clamped to 500 (not an error). Zero, negative or non-integer fails. |

An `offset` at or beyond `total` returns `success: true` with an empty list.

### Response fields

Every success response carries these fields next to the item array:

| Field     | Meaning                                                            |
| --------- | ------------------------------------------------------------------ |
| `total`   | Items that match the filters, before paging.                       |
| `offset`  | Effective offset of this page.                                     |
| `limit`   | Effective page size, after defaulting and clamping.                |
| `hasMore` | `true` when `offset + limit < total`. Next page: `offset + limit`. |

Failure responses (`success: false`) return an empty item array with
`total: 0` and `hasMore: false`. Socket-wrapper failures (for example an
invalid session) may omit the paging fields, so treat them as optional when
`success` is false.

Use the response's `limit`, not the requested one, to compute the next
offset; the server may have clamped it.

### Ordering

Ordering is fully deterministic, so pages never overlap within a stable data
set.

| Operation                                       | Order                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `solar-system-list`, `sort: distance` (default) | `distanceParsec` ascending, unknown distances last, then `id`                                 |
| `solar-system-list`, `sort: name`               | `displayName` (case- and accent-insensitive, numeric-aware: "HD 9" before "HD 10"), then `id` |
| `star-list`, `sort: distance` (default)         | `distanceParsec` ascending, unknown last, then `starId`                                       |
| `star-list`, `sort: name`                       | `properName`, else `catalogName`, else `starId`, then `starId`                                |
| `celestial-body-list`, whole system             | `id` (ordinal)                                                                                |
| `celestial-body-list`, radius query             | `distanceKm` ascending, then `id`                                                             |

### Consistency caveat (offset drift)

Offset pages are computed per request; there is no snapshot.

- **Registry lists** (`solar-system-list`, `star-list`) change only when Forge
  restarts after the monthly catalog refresh. A drift mid-browse is rare.
  `catalogSnapshotDate` on exoplanet systems identifies the snapshot.
- **`celestial-body-list`** changes whenever bodies are created, destroyed or
  updated, for example asteroids seeded by another player. A body can move
  between pages while you loop.

Clients must **de-duplicate by `id`** when they merge pages, and treat a
full sweep as best-effort. If an exact result matters (seeding), re-query
after writing rather than trusting a cached sweep.

## Per-operation changes

### `solar-system-list`

New request fields (all optional):

| Field               | Notes                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `minDistanceParsec` | Inclusive lower bound. Excludes systems with unknown distance. Must be ≤ `maxDistanceParsec`. |
| `minPlanetCount`    | Systems with at least this many catalog planets. `1` = "has planets". Non-negative integer.   |
| `spectralClass`     | Primary-star class letter, for example `G` or `M`. Case-insensitive.                          |
| `sort`              | `distance` (default) or `name`. Other values fail.                                            |
| `offset`, `limit`   | As above.                                                                                     |

Existing fields are unchanged: `source` (`curated`, `procedural`,
`exoplanet-catalog`), `search` (substring of `id`, `displayName`,
`catalogName`, primary-star `properName` and `spectralType`) and
`maxDistanceParsec`. The old 1,000-system cap is gone; use paging.

Live enrichment (`asteroidCount`, `marketCount`) is now computed only for the
returned page, so small pages are also cheaper for the server.

### `star-list`

New request fields: `minDistanceParsec`, `sort` (`distance` | `name`),
`offset`, `limit`. Existing filters: `systemId`, `spectralClass`,
`maxDistanceParsec`. The old 5,000-star cap is gone. Nova does not appear to
call `star-list` today; no client change is required unless that changes.

### `celestial-body-list`

No new filters. `limit` keeps its meaning (page size) but now defaults to
**100** instead of unlimited, and `offset` is new. The existing filters
(`states`, `createdByCharacterId`, `missionId`) and both query modes (whole
system, radius) are unchanged.

## Impact on Nova

Found by reading Nova `main` at `fc9e889`:

1. **Viewer system list** (`page/game/viewer.ts`, about line 89) asks for
   `limit: 50, maxDistanceParsec: 50`. It keeps working (first 50 nearest
   systems) but still cannot reach the 4,838 exoplanet systems. Replace the
   fixed list with search, filters and **"Load more"** (or virtual scroll)
   driven by `total` and `hasMore`. This supersedes item 10 of the
   new-planet-types prompt.
2. **Ship-exterior local sweep**
   (`scene/ship-exterior/ship-exterior-bootstrap-controller.ts`) runs a radius
   query with states `unscanned`/`active` and no `limit`. It now gets only
   the nearest 100 bodies. Loop until `hasMore` is false.
3. **Cold-boot resume** in the same controller runs a radius query of
   `DEFAULT_CLUSTER_SPREAD_KM * 2` and passes the result to the seeder as
   `existingBodies`. **If it reads only the first page, the seeder believes
   bodies are missing and seeds duplicates.** Loop until `hasMore` is false,
   de-duplicate by `id`, and only then seed.
4. Any other `celestial-body-list` caller that assumed "everything" must
   either loop or accept the first page explicitly.

Recommended helper: one shared `fetchAllPages(request, itemsKey, { pageSize =
500, maxPages })` that loops on `offset += response.limit` until `hasMore`
is false, merges by `id`, and stops with a logged warning at `maxPages`.

## Prompt for Nova

> Forge now pages `solar-system-list`, `star-list` and `celestial-body-list`
> (P2). This is a breaking change shipped together with the new planet types
> and the attribution addendum; please implement all three prompts in one
> change set. Details: `docs/nova-prompt-celestial-body-paging-2026-11-01.md`
> in solid-train.
>
> 1. Update the request and response models for the three operations: request
>    `offset` (default 0) and `limit` (default 100, max 500, clamped);
>    response `total`, `offset`, `limit` and `hasMore` (required on success,
>    optional on failure).
> 2. Add a shared `fetchAllPages` helper that loops with
>    `offset += response.limit` until `hasMore` is false, de-duplicates by
>    `id`, and stops with a warning after a configurable page cap.
> 3. Use the helper for the ship-exterior local sweep and for the cold-boot
>    resume query in `ship-exterior-bootstrap-controller.ts`. The resume must
>    pass the complete, de-duplicated list as `existingBodies`, otherwise
>    asteroids are seeded twice.
> 4. Rework the viewer system list (`page/game/viewer.ts`): server-side
>    `search`, filters (source, distance band with `minDistanceParsec` and
>    `maxDistanceParsec`, `minPlanetCount: 1` for "has planets",
>    `spectralClass`), a sort toggle (`distance` | `name`), and "Load more"
>    or virtual scrolling driven by `hasMore`. Show "N of total". Reset to
>    offset 0 when any filter or the sort changes, and ignore responses for
>    stale filter states (match `correlationId`). This replaces item 10 of
>    the new-planet-types prompt.
> 5. Show the server `message` when a list request fails (for example an
>    invalid `sort` or `minDistanceParsec` greater than `maxDistanceParsec`).
> 6. Add tests: the helper loops across several pages, stops on
>    `hasMore: false`, honors a clamped `limit`, and de-duplicates a body
>    that appears on two pages; the cold-boot resume does not seed bodies that
>    exist on page 2; the viewer can find a system beyond 50 pc (for example
>    KOI-351) by search and load a second page.

## Acceptance criteria

- No Nova request depends on an unpaged list; every "fetch everything" path
  goes through the paging helper.
- Cold-boot resume in a system with more than 100 nearby bodies seeds no
  duplicates.
- The viewer list shows the first page quickly, can load further pages, and
  can find any exoplanet system by name or filters.
- Changing a filter or sort resets the list without mixing old and new pages.
- Failure responses without paging fields are handled.

## Out of scope

- **Sol `solar-system-get` slimming (F3).** The Sol response is about 6 MB
  because of its asteroid belt. It is not a list operation and is not paged
  here; see the plan's follow-up F3.
- Cursor tokens or snapshot consistency. Offset was chosen for simplicity
  (D68); revisit if offset drift causes real problems.
- Server-side total-count caching. Totals are computed from in-memory
  registries and are cheap today.
