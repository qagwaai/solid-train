# Ship Navigation Phase 3 — Forge session handoff

Date: 2026-11-23

Status: Session implementation and focused contract validation handoff. No commit,
push, server restart or live-data change is authorized or included.

## Subsequent in-place route-consistency correction

The current source contract supersedes the earlier capture/timing description
below. `capture.shipPositionEpochMs` identifies the saved position snapshot,
while `capture.searchStartEpochMs` is the backend bootstrap clock reading used
for direct, replayed jobs and continuations. Planning does not move or
retimestamp the ship. The direct reference and market-target legs use the full
verified host and station pose at rounded arrival; their returned geometry,
distance, duration, fuel and eligibility refer to the same endpoints. The
fixed-speed timing residual is at most 1 ms.

The direct calculation is required, including when outside range: an
out-of-range result is supported and ineligible; unsupported source or numeric
failure fails the batch. Common source, candidate pool, owner, ship, drive,
profile, mode or clock generation/lineage changes invalidate a search. Ordinary
clock advance does not. Failed batches contain null metadata and no jobs.
Individual failed jobs contain no partial legs and make the batch incomplete,
even when all requested jobs have terminal records. `timeoutMs` is a hint, not
an enforced deadline. Nova must explicitly start a new search after
invalidation; no automatic retry.

The correction is in place, not a parallel version. Source files can be updated
while an existing server still runs an older handler; the owner must coordinate
restart and Nova must inspect the served OpenAPI and referenced schemas before
adoption. Full application-wide celestial movement semantics, docked following,
Start Travel and world updates remain separate.

## Implemented contract surfaces

- Additive `navigation-route-edge-batch.v1` Socket.IO operation and request/response
  schemas.
- Legacy behavior remains the default when `profileId` is omitted:
  0.5 AU per-leg eligibility and 3 AU eligible-path planning.
- Additive `stellar-sol-station-100au-v1` profile:
  no per-leg hop cap and exact moving complete-route total at or below
  14959787070 km (100 AU).
- Nova-owned 512-dispatched-job and 30-second search budgets are disclosed as
  Nova policy, separate from server batch completion.
- Ship-normal planning mode uses the owned ship's normalized
  `driveProfile.rangeAu` independently for each exact moving-target leg.
  It does not infer a whole-route total, fuel range or fuel/life-support rule.
- `bounded-preview-100au` ignores ship drive range for preview only and always
  reports `flightAuthorized=false`.
- Capture pins the ship revision, drive profile/revision, navigation mode,
  profile, source revision, clock generation/lineage and position model.
  Continuation revalidates the capture and rejects mode/profile/ship/drive/source
  mismatches.
- Timed body encounter legs expose:
  `bodyId`, `side`, `encounterEpochMs`, body center, calculated waypoint,
  offset, basis, position model and source revision.
- Direct references remain visible and include moving-destination timing.
  Over-profile direct references are explicitly ineligible.
- Existing auth, ownership, Sol basis, source, encounter, clock, hazard,
  5-encounter/6-leg and 32-job/192-logical-leg guards remain unchanged.
- No applied gravity, curved physical flyby, safe/cleared trajectory, ETA,
  flight authorization or execution behavior was added.

## Station seed and live-migration implementation

The owner-authorized bundled seed and test changes set eight intersecting
Sol station orbits to mean radius plus 10000 km periapsis:

| Market              | Semi-major axis km |
| ------------------- | -----------------: |
| `sol-mercury-orbit` | 12824.432989690722 |
| `sol-venus-orbit`   | 16213.939393939394 |
| `sol-earth-orbit`   | 16536.363636363636 |
| `sol-moon-orbit`    | 11976.938775510203 |
| `sol-jupiter-orbit` |          83240.625 |
| `sol-saturn-orbit`  |  70342.26804123711 |
| `sol-uranus-orbit`  |  36083.67346938776 |
| `sol-neptune-orbit` |  35692.78350515464 |

Mars and Pluto were unchanged. The implementation changes eccentricity, period,
plane, phase, epoch and metadata only as needed to preserve those values.
The live migration was separately authorized and performed with conditional
Market updates plus the separate Sol seed-state v3 update. It required no ship,
Player, purchase or attestation change. The full migration artifact was saved
outside the repository in session state.

## Validation

Final focused checks:

- `node --test test/navigation-route-edge-batch.test.js`: 13 tests passed.
- `node --test test/navigation-prediction.test.js test/navigation-route-estimate.test.js test/ship-list-message-handler.test.js`: 27 Phase 2 navigation tests and 44 ship-list tests passed.
- `node --test test/solar-system-market-seed.test.js test/station-market-snapshot.test.js`: 31 station seed/snapshot tests passed.
- `npm run typecheck`: passed.
- `npx --no-install @apidevtools/swagger-cli validate api/openapi.yaml`: passed.
- `git diff --check`: passed.

The route contract test suite includes exact 100 AU and ship `rangeAu`
boundaries, two 60 AU legs versus one 60 AU leg, profile compatibility,
target/prefix timed encounters and target-side behavior.

## Remaining limitations

- No live server/API verification was performed after the final implementation.
- No performance benchmark proves 32-job/192-leg/512-dispatched-job/30-second
  behavior; Nova's search limits remain provisional.
- The shared game clock remains subject to the separately documented durable
  authority and crash-recovery limitations. Navigation still fails closed when
  the clock or required capture is unavailable.
- The Sol survey and moving-hazard assessment remain advisory and may report
  unresolved bodies. It is not a physical-clearance guarantee.
- The 100 AU profile has no flight authorization and no applied fuel,
  life-support, transfer or ship-movement behavior.
- Normal ship-drive eligibility uses `rangeAu` as each exact leg limit only.
  No fuel or total-range behavior is inferred.

## Staging guidance

Review and stage only intended Forge source, contract, seed/test and script
changes. Preserve unrelated worktree changes. The following category is likely
to need owner/PR review:

- `src/model/solar-system-market-seed.js`
- `test/solar-system-market-seed.test.js`
- `test/station-market-snapshot.test.js`
- `scripts/sol-station-orbit-dry-run.js`
- `scripts/migrate-sol-station-orbits.js`
- `scripts/inspect-sol-station-orbits-read-only.js`
- Phase 3 route-edge request/response schemas and handlers
- Navigation state drive-profile fields
- Package scripts and strict AJV validator adjustment
- Contract OpenAPI modules and navigation prediction test corrections

Do not stage session artifacts or migration report JSON from outside the
repository. Do not stage live credentials or database output.

## Release gate

At this handoff stage no commit, push or restart had been performed; an
owner-controlled restart was then required before the running Forge server
served the latest contract and implementation. The later integrated live-review
report below records the owner's restart and the limited checks performed
afterward. No commit or push has been made.

## 2026-11-23 ship-drive and final contract closeout

### Ship-drive planning

- Normal planning mode is explicitly `ship-drive-normal`.
- The normalized ship `driveProfile.rangeAu` is the maximum distance for each
  exact moving-target leg.
- The backend does not infer a whole-route drive range.
- Cruise speed remains `12466.489225 km/s`.
- Fuel remains the existing illustrative `1 prototype fuel unit/AU` model.
- Life support and future fuel supply are outside this implementation.
- `bounded-preview-100au` ignores ship drive range, requires
  `stellar-sol-station-100au-v1`, remains preview-only and reports
  `flightAuthorized=false`.
- Legacy omitted profile/mode behavior remains unchanged.

### Capture identity

The planning capture pins and revalidates:

- ship ID and ship revision;
- owned ship drive profile and drive profile revision;
- navigation mode and route profile;
- saved departure position and epoch;
- Sol basis and position model;
- source revision;
- clock generation, lineage and epoch;
- destination, candidate pool and source association.

Continuation is read-only and deterministic only within the matching capture.
Changing ship, mode, profile, destination or drive profile requires a new
bootstrap. `shipRevision` is now part of the public capture response.

### Composition of eligibility

- Normal mode is eligible only when the selected planner profile passes and
  every exact leg is within `rangeAu * 149597870.7 km`.
- Normal mode whose leg range fails sets
  `eligibilityReason=OUTSIDE_SHIP_LEG_RANGE`, taking precedence over a separate
  planner hop/path reason.
- 100 AU preview ignores ship range; it may be under 100 AU while
  `driveEligibility.status=not-applicable`.
- Missing or invalid drive profile in normal mode returns
  `DRIVE_PROFILE_UNAVAILABLE`/operation failure semantics rather than a
  success-shaped route.
- Changed drive profile between bootstrap and continuation fails closed.

### Final validation update

- 13/13 Phase 3 edge/profile/ship-drive/timed-encounter tests pass.
- 27/27 Phase 2 navigation tests pass.
- 44/44 ship-list tests pass.
- 31/31 Sol station seed/snapshot tests pass.
- `npm run typecheck` passes.
- Swagger/OpenAPI validation passes.
- `git diff --check` passes.
- Strict AJV diagnostics were removed from test output by using validator
  strict-schema/type warnings-disabled settings; AJV keywords and formats remain
  enabled.

No live data read/write, migration, purchase or ship mutation occurred during
the Forge implementation closeout. The owner later reported a server restart
for the integrated live review below.

## IMPLEMENT-001 and integrated P4-01/UI-001 closeout

The owner approved an in-place backend contract correction, followed by Nova
adoption. Forge completed the backend contract/evaluator and focused tests; Nova
completed ADOPT-001 and owner-approved UI-001. The owner accepted the integrated
presentation as "looking good". UI-001 hides the historical snapshot-distance /
unavailable block while calculated route choices are available, including an
ineligible direct reference; it remains before planning, after failure and when
no calculated choice is selected. English and Italian calculated-route copy
now acknowledges estimated time/fuel and preserves the existing unvalidated
flight/clearance/transfer/gravity disclaimers. Existing access, docking and
survey warnings were not changed.

### Backend files and validation

Forge changed:

- `api/openapi/solarsystem/openapi.yaml`
- `api/schemas/navigation-route-edge-batch-request.schema.json`
- `api/schemas/navigation-route-edge-batch-response.schema.json`
- `src/handlers/context/navigation-route-edge-batch-service.js`
- `src/handlers/context/navigation-state-service.js`
- `src/handlers/navigation-route-edge-batch-message-handler.js`
- `src/handlers/socket-handler-registry.js`
- `test/navigation-route-edge-batch.test.js`
- `test/socket-handler-registry.test.js`
- This handoff and the Forge-local `.vscode/linked-navigation-state.md`.

The backend focused regression command passed 46 tests:

`node --test test\navigation-route-edge-batch.test.js test\navigation-prediction.test.js test\navigation-position-contract.test.js test\socket-handler-registry.test.js`

Also passed: `npm run typecheck`; targeted ESLint on the six changed
JavaScript/test files; installed `@apidevtools/swagger-parser` validation of
`api/openapi.yaml`; and `git --no-pager diff --check`. The attempted
`npx --no-install swagger-cli validate api\openapi.yaml` could not run because
the local swagger-cli executable is absent; no package was installed.
Formatting was deferred until this session closeout.

### Coordinated live review (reported by owner/Nova)

The owner reported restarting the backend, then authorized an unauthenticated
invalid-request probe. Nova reported that served root and solar-system OpenAPI
and referenced route schemas returned HTTP 200 and that the registry's
unauthorized response validated against the served failed-batch schema. This
checks those exercised contract/error paths only; it is not proof of full live
numerical coherence.

For the owner's approved UI review of the existing active docked ship from Sol
to Mars Orbital Market, Nova reported:

- Normal mode failed explicitly with `drive_profile_unavailable`; there was no
  fallback or drive repair. A retained normal wire validation was unavailable.
- Preview displayed 512 completed jobs, zero rejected, zero unfinished and
  five direct/Mars/Phobos/Earth choices. The UI/client correctly represented
  the capped search and incomplete hazard survey; it did not claim exhaustive
  search, clearance or flight authorization.
- A late passive observer saw seven supported complete batches / 203
  successful jobs (not all 512 response payloads). Within observed responses,
  capture identity and pinned search epoch remained stable; direct/first legs
  used the capture epoch and later legs chained returned positions/epochs.
  Independent endpoint distance/duration checks passed; maximum observed
  moving-leg residual was 0.494140625 ms. Direct result was
  15611901.723408457 km, 1252309 ms and 0.10435911721441674 illustrative fuel
  units, with 0.406494140625 ms residual. Final displayed-choice totals were
  independently checked for distance, duration and fuel.
- Phobos presentation showed the time estimate and retained a calculated route
  when the illustrative curve was unavailable. Survey advisories disclosed
  unresolved counts (378 direct, 756 Phobos) and `flightAuthorized=false`.
- The historical Phase 2 projected saved-epoch/zero-distance block appearing
  beside calculated choices was raised as a presentation concern and addressed
  by accepted UI-001. A normal-mode UI selector failed; the observer attached
  late. There is no independent celestial/station ephemeris oracle, full
  512-response capture, successful normal-mode route, source-reset test, full
  flight test or performance benchmark.

Nova reported ADOPT-001/UI-001 checks passed: 51 targeted service/selection/
hazard-cluster tests; `npm run build`; `npm run typecheck` (app/spec/e2e);
targeted TypeScript ESLint; `git diff --check`; and three focused Playwright
cases including mocked setup. A broader station spec had 6 passing and 4
unrelated failures from ambiguous `details-target-btn` selectors and was left
unchanged. A port-4200 watcher warning was reported; an existing watcher then
returned HTTP 200. No extra authenticated search was initiated. These are
Nova-reported checks, not Forge-run checks.

### Remaining boundaries and deployment

No commit or push was made; those are reserved to the owner. The owner's
restart is reported complete, and Nova's served-contract error-path check is
reported complete. Runtime behavior beyond the exact probes above remains
unverified. Normal live ship planning is currently blocked by the observed
missing drive profile; no repair or assignment was authorized.

Future owner-scoped discussions remain: starter placement lineage and drive
assignment/progression; durable station-following; application-wide
snapshot-versus-current-versus-predicted celestial movement semantics; survey
completeness; and Start Travel, saves and pause behavior. No scope for those
items is implied by P4-01 or UI-001. Do not start new work from this closeout.
