# Ship Navigation Phase 3 — Forge session handoff

Date: 2026-11-23

Status: Session implementation and focused contract validation handoff. No commit,
push, server restart or live-data change is authorized or included.

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

| Market | Semi-major axis km |
| --- | ---: |
| `sol-mercury-orbit` | 12824.432989690722 |
| `sol-venus-orbit` | 16213.939393939394 |
| `sol-earth-orbit` | 16536.363636363636 |
| `sol-moon-orbit` | 11976.938775510203 |
| `sol-jupiter-orbit` | 83240.625 |
| `sol-saturn-orbit` | 70342.26804123711 |
| `sol-uranus-orbit` | 36083.67346938776 |
| `sol-neptune-orbit` | 35692.78350515464 |

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

No commit, push or server restart was performed. An owner-controlled restart is
required before the running Forge server serves the latest contract and
implementation. Before restart, review the final diff and run the documented
focused checks. Live UI/API validation remains a separate owner-approved step.

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

No live data read/write, migration, purchase, ship mutation or restart occurred
during this closeout.
