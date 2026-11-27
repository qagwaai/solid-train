# Navigation Phase 4: restart notes

Status: historical investigation followed by an offline implementation handoff.
The [closing update](#closing-update-starter-and-navigation-integration)
supersedes earlier descriptions of current wiring. This document does not
authorize database operations or a server restart.

## What to preserve

- The existing navigation state, route estimate, and route-edge batch
  implementations are salvage candidates, not development-runtime code.
  Start with [navigation state](../src/handlers/context/navigation-state-service.js),
  [route estimate](../src/handlers/navigation-route-estimate-message-handler.js),
  and [route-edge batch](../src/handlers/navigation-route-edge-batch-message-handler.js).
  Preserve unrelated and untracked work when recovering or changing wiring.
- The [Phase 3 handoff](./ship-navigation-phase3-session-handoff-2026-11-23.md)
  records the accepted planning behavior and later corrections. Its
  "Subsequent in-place route-consistency correction" supersedes earlier timing
  descriptions in that document.
- Planning is read-only: it does not move or retimestamp the ship. It is not
  flight, docking, a physical clearance guarantee, or authorization to travel.

## Historical integration gap

The current [production socket registry](../src/handlers/socket-handler-registry.js)
registers blocked responses for `solar-system-get`, `navigation-route-estimate`,
and `navigation-route-edge-batch`. The presence of handlers, schemas, or
fixture tests does not mean these operations are available on the production
server. Startup also no longer performs the previous star/system registry and
celestial-body, market, and NPC seeding; do not assume required navigation data
exists or trigger seeding without separate authorization.

Recovering navigation requires connecting the real production admission,
persisted reads, clock, and socket handlers together, while preserving existing
gameplay and startup functionality. Do not solve this by enabling the legacy
test runtime. Reconcile the actual handler outcomes and blocked responses with
the [solar-system OpenAPI](../api/openapi/solarsystem/openapi.yaml), then
coordinate frontend adoption with Nova against the contract actually served
after an owner-controlled restart.

## Planning invariants and decisions

- Route preview may use the approved `bounded-preview-100au` mode with
  `stellar-sol-station-100au-v1`, ignoring drive range and returning
  `flightAuthorized=false`. It is not a substitute for a drive or flight
  authorization. A starter drive profile is a separate progression decision,
  not an assumed prerequisite for bounded preview. Verify actual request,
  persisted-state and validation behavior for a missing profile before claiming
  this works end to end.
- A trustworthy persisted departure placement and position epoch, a supported
  authoritative game clock, and a valid capture are required. Do not synthesize
  a ship position or use client wall time as game time. Missing or unsupported
  inputs must fail explicitly.
- `capture.shipPositionEpochMs` identifies the saved ship-position snapshot;
  `capture.searchStartEpochMs` is the backend bootstrap clock reading used for
  the search. Do not treat them as interchangeable. Route computation does not
  change the saved position or epoch.
- Continuations must remain associated with their original capture. Revalidate
  ship and ownership, position, drive/profile/mode, source and candidate pool,
  and clock generation/lineage as required by the implemented contract.
  Ordinary clock advancement is not itself a capture invalidation. On a
  mismatch, fail rather than mixing captures or silently retrying.
- The direct reference is required even if out of range; an over-limit result
  is ineligible, not a missing result. Report batch and job failures without
  partial results masquerading as complete. Preserve consistent endpoint,
  distance, duration and fuel calculations and the 1 ms timing residual
  described in the Phase 3 handoff.
- The documented 100 AU preview limit and normal per-leg drive-range behavior
  are planning rules, not fuel, life-support, or physical trajectory rules.
  Existing client search limits are policy, not demonstrated performance
  guarantees.

## Historical validation plan

First inspect the complete worktree and any available recovery snapshots; the
tree was already dirty before this session and some untracked files were later
removed. A blanket Git revert cannot reconstruct that prior state. The current
test-only legacy socket runtime dynamically loads the deleted character-add
handler, so affected tests may fail before exercising navigation.

Use isolated fixtures or disposable test storage only. Cover supported and
missing persisted placement; preview with no drive profile; paused and
unavailable clock behavior; capture changes and normal clock advancement;
required direct references; batch/job failures; and actual production socket
registration plus OpenAPI response validation. Verify clock durability and
single-writer assumptions separately rather than treating fixture success as
proof.

Useful focused commands to reassess after the test harness is repaired:

```powershell
node --test test\navigation-route-edge-batch.test.js test\navigation-route-estimate.test.js test\navigation-prediction.test.js
npm run typecheck
```

These commands have not been rerun for this document. Fixture results are not
Mongo-backed end-to-end or live-server validation.

## Nova handoff: no-drive preview and nearest belt station

Verified on 2026-11-26:

- An offline fixture verifies `bounded-preview-100au` with an absent drive profile.
  The original guard already accepted `null`; no production guard change was needed.
- The preview capture includes `driveProfile: null`,
  `driveProfileRevision: null`, and `flightAuthorized: false`.
- Normal `ship-drive-normal` behavior still requires a valid drive profile.
- No route, asteroid, First Target, debris, or seeding behavior was changed.
- `node --test test\navigation-route-edge-batch.test.js`: 17/17 passed.
- `npm run typecheck`: passed.

`market-list-by-location-request` computes and sorts distances from a supplied
position, rather than from the barycenter. It accepts a solar-system ID, radius,
and `locationTypes: ["station"]`. However, it does not accept a route capture
epoch: it uses the context's current timestamp, and station positions are
materialized from host snapshots. It therefore does not establish a
same-game-clock-epoch nearest station.

Do not infer that an asteroid-belt station exists. The current Sol market
catalog defines `sol-ceres-exchange`, `sol-belt-02`, `sol-belt-03`, and
`sol-belt-04` as `free-floating` belt markets. These bundled definitions are
not proof of the current persisted inventory. Navigation accepts only bundled
Sol orbital stations, not those free-floating markets. Do not relabel them or
add new station/asteroid seeding without an explicit owner decision.

For UI selection, retain manual station choice. When a future authoritative
belt station exists, a trustworthy same-epoch evaluation of its position and
the ship's departure position is required for nearest selection. Existing
location discovery does not demonstrate that guarantee.

## Closing update: starter and navigation integration

The current source wires the real solar-system and navigation handlers in
`src/server.js`. Owner-controlled restart and Nova's read-only inspection
confirmed the updated schemas are served; this is not a gameplay or database
readiness test.

- New characters receive a server-issued starter placement in the Sol XY
  2.1–3.3 AU annulus, derived from character ID, and a sampled game-clock epoch.
  Supported starter departure provenance uses `sourceKind: "starter-belt"`,
  not a fabricated purchase or `sourceMarketId`. Untrusted generic writes
  cannot issue placement provenance.
- First Target activation creates ten shared bodies with IDs
  `cb-<characterId>-first-target-a1` through `a10` near the original starter
  location. Existing complete fields are preserved. Mission activation and
  field writes are not transactional: a failure can leave an active mission
  with an incomplete field, which requires reconciliation rather than reseeding.
- Character-and-mission-filtered field reads distinguish `success: false` from
  a successful empty result. A successful empty page or radius/state-filtered
  query does not prove the full field is empty. Fetch all unfiltered
  whole-system pages to inspect matching records; the API does not expose an
  authoritative completeness status or an atomic paginated snapshot.
- Character-add success requires `characterName` and `characterId`; failure
  omits them. An uncertain creation outcome requires checking the roster before
  retrying. The owner approved the narrow baseline correction for this and the
  login success-conditional identity fields.
- The database-backed clock advances in memory without periodic checkpoints.
  Creation checks checkpoint acknowledgement, but crash rollback has no proven
  bound and neither disk durability nor single-writer fencing is established.
- Bounded route preview ignores drive limits and does not authorize flight.
  No persisted supported station or closest belt station has been verified.
  No station or asteroid migration, market-routing expansion, or live data
  operation was performed.

The offline lifecycle fixture uses actual registered handlers and persisted-like
adapters, not MongoDB. Frontend integration must preserve server ship placement
and field IDs and positions, avoid client regeneration/upserts, distinguish
failed reads from empty results, and validate scan, Dart, debris, and visuals.
Real Mongo/restart behavior, partial-field reconciliation, and end-to-end
gameplay remain unverified.

Closing offline checks: the focused 13-file backend suite passed 82/82 tests;
`npm run contract:gate` passed in hard-fail mode with zero drift issues;
`npm run typecheck` and OpenAPI validation passed. Changed-file ESLint reported
no errors and four warnings. These checks do not prove live readiness.
