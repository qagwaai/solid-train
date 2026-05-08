# TODO — Test Quality Remediation

Derived from [TEST_QUALITY_REVIEW.md](TEST_QUALITY_REVIEW.md) (2026-05-07).
Items are roughly ordered by risk × effort. Each item lists the suggested
deliverable so it can be picked up independently.

Legend: **P0** must-do before 2026-06-30 legacy cutover · **P1** high value · **P2** quality-of-life

---

## P0 — Block before legacy-shape cutover (2026-06-30)

### ~~TQ-01~~ ✅ Add legacy-shape rejection tests at request boundaries
- **Completed**: 2026-05-07
- Both upsert handlers already had full rejection test coverage:
  - `celestial-body-upsert`: rejects `location`, `kinematics`, root `solarSystemId`
  - `ship-upsert`: rejects `location`, `kinematics`
- No changes required.

### ~~TQ-02~~ ✅ Migrate fixture leaks off the backward-compat reader
- **Completed**: 2026-05-07
- **Production code migrated**:
  - `src/handlers/mission-upsert-message-handler.js` — `createStarterMissionAsteroidField()` rewritten to canonical `spatial`/`motion`/`physical`/`observability` shape
  - `src/handlers/launch-item-message-handler.js` — `resolveYieldQuantity()` updated to read `physical.estimatedMassKg` (was `kinematics.estimatedMassKg`)
  - `src/db/service.js` — `findCelestialBodiesNearPosition()` MongoDB query and result mapping updated from `solarSystemId`/`location.positionKm` to `spatial.solarSystemId`/`spatial.positionKm`
  - `src/handlers/message-handler-context.js` — Removed all 4 backward-compat converter methods (`convertLegacyShipToSpatial`, `convertLegacyShipToMotion`, `convertLegacyCelestialBodyToSpatial`, `convertLegacyCelestialBodyToMotionAndPhysical`) and their call sites in `normalizeShip` / `normalizeCelestialBody`
- **Test fixtures migrated**:
  - `test/launch-item-message-handler.test.js` — `createSeedTarget()` rewritten to canonical shape
  - `test/db-service-core.test.js` — `CelestialBody.find` stub updated to canonical shape; assertion updated to `capturedFindQuery['spatial.solarSystemId']`
  - `test/market-buy-sell-message-handler.test.js` — ship fixture replaced with `createShip()`
  - `test/market-ledger-list-message-handler.test.js` — ship fixture replaced with `createShip()`
  - `test/celestial-body-upsert-message-handler.test.js` — local `createCelestialBody` removed; shared helper imported (also closes TQ-08 partial — see below)

---

## P1 — Highest test-quality leverage

### ~~TQ-03~~ ✅ Resolve `MissionAddMessageHandler` orphan
- **Completed**: 2026-05-07 — deleted
- **Deleted**:
  - `src/handlers/mission-add-message-handler.js`
  - `src/model/mission-add.js`
  - `test/mission-add-message-handler.test.js` (was actually testing `MissionUpsertMessageHandler`; fully covered by `test/mission-upsert-message-handler.test.js`)
- `test/server.test.js` import updated: `MISSION_ADD_REQUEST_EVENT` / `MISSION_ADD_RESPONSE_EVENT` now destructured from `mission-upsert` model constants
- README + CODEBASE.md updated to reflect `mission-upsert-request` as canonical event name; `add-mission-request` noted as alias
- Event `add-mission-request` itself is unchanged — still handled by `MissionUpsertMessageHandler`

### TQ-04 Cover money-flow branches (market buy / sell / quote)
- **Why**: 36.84% / 38.89% / 47.37% branch coverage on the most consequential
  handlers in the system. See [TEST_QUALITY_REVIEW.md](TEST_QUALITY_REVIEW.md) §2.1.
- **Add tests for**:
  - Insufficient market stock
  - Market not found / wrong `solarSystemId`
  - Catalog miss (`itemId` not in `MARKET_CATALOG_BY_ID`)
  - `quantity` ≤ 0 / non-integer / NaN
  - Lazy restock fires during a buy when interval has elapsed
  - `priceMultiplier` and `driftPercentPerHour` actually applied to the
    ledger amount (not just to the response payload)
  - **`creditLedger` entry is appended** with correct
    `type: 'take'` (buy) / `'put'` (sell), `amount`, `description`,
    `referenceId` after every successful transaction
  - `requestId` echoed on failure responses
- **Target**: ≥ 80% branch on each of the three handlers.

### TQ-05 Add Socket.IO + Mongo round-trip smoke test
- **Why**: 0 tests cover the production wiring (real socket layer + real DB).
  [test-support/mongodb-test-helpers.js](test-support/mongodb-test-helpers.js)
  is ready to be reused.
- **Deliverable**: `test/server.mongo.integration.test.js` that:
  1. Boots `createServer` with `mongoHarness.databaseService` injected
  2. Registers + logs in a player
  3. Adds a character via socket
  4. Re-reads from Mongo (via `databaseService.getPlayerByName`) and asserts persistence
  5. Tears down cleanly
- **Side-effect**: closes a 50%+ chunk of the `server.js` function-coverage gap.

### TQ-06 Mongo round-trip per collection
- **Why**: Only markets have a real-Mongo integration test. See
  [TEST_QUALITY_REVIEW.md](TEST_QUALITY_REVIEW.md) §2.6.
- **Deliverable**: One `*.mongo.integration.test.js` per collection
  (`players`, `items`, `cb`, `jump_gates`) with one round-trip per CRUD op.
  Use `createMongoTestHarness()` and `clearDatabase()` per test, as the
  existing market test does.

### TQ-07 Lift `db/service.js` branch coverage from 64.67%
- **Why**: Most uncovered branches are error-input or empty-input paths.
- **Deliverable**: Negative-input tests against `DatabaseService` driven by
  the memory-server harness rather than prototype stubs (the current core/
  extended files mock `Player`/`Item.findOne` etc.). Aim ≥ 80% branch.

---

## P1 — Helper hygiene

### TQ-08 Use canonical helpers from `test-support/` *(partial)*
- **Why**: `createShip` / `createCelestialBody` / `createMarket` are exported
  but never imported (see [TEST_QUALITY_REVIEW.md](TEST_QUALITY_REVIEW.md) §4.1).
  Three test files re-define their own `createCelestialBody` with subtly
  different defaults; one defines a local `createMarket`.
- **Progress** (2026-05-07): Local `createCelestialBody` in
  [test/celestial-body-upsert-message-handler.test.js](test/celestial-body-upsert-message-handler.test.js)
  removed and replaced with shared import (done as part of TQ-02).
- **Remaining**:
  1. Delete the local `createCelestialBody` defs in
     [test/celestial-body-list-message-handler.test.js](test/celestial-body-list-message-handler.test.js#L21),
     [test/server.test.js](test/server.test.js#L309).
  2. Delete the local `createMarket` in
     [test/market-list-by-location-message-handler.test.js](test/market-list-by-location-message-handler.test.js#L21).
  3. Import from `test-support/message-handler-test-helpers.js` and adjust
     overrides as needed.
  4. Bumps helper-file coverage from 42.57% to a meaningful number.

### TQ-09 Make `createTestContext` ID generator robust past 4 calls
- **Where**: [test-support/message-handler-test-helpers.js:7-12](test-support/message-handler-test-helpers.js#L7-L12)
- **Why**: After the 4 seeded IDs are drained, the fallback returns
  `generated-0` repeatedly because `issuedIds.length` is always 0 once
  emptied. Tests creating multiple characters silently get duplicate IDs.
- **Deliverable**: Replace fallback with a monotonic counter
  (`generated-1`, `generated-2`, …). Optionally accept a `seedIds` argument
  so tests that need specific IDs are explicit.

### TQ-10 Extract a shared trader-character seeder
- **Why**: [TEST_QUALITY_REVIEW.md](TEST_QUALITY_REVIEW.md) §4.3 — three
  market test files reimplement near-identical "character with N credits + ship".
- **Deliverable**: Add `seedTraderCharacter(context, { credits, shipOverrides })`
  to `test-support/message-handler-test-helpers.js`; replace local seeders
  in `market-buy-sell`, `market-quote`, `market-ledger-list` test files.

### TQ-11 Remove explicit `credits` from character fixtures
- **Why**: [CODEBASE.md](CODEBASE.md) invariant #2: `credits` is computed,
  never stored. [test/market-buy-sell-message-handler.test.js:38](test/market-buy-sell-message-handler.test.js#L38)
  sets both `creditLedger` and `credits` — misleading template.
- **Deliverable**: Delete `credits` from all character seed objects; let
  `normalizeCharacter` compute it.

---

## P2 — Test design polish

### TQ-12 One assertion per test name (where reasonable)
- **Why**: Multi-clause names hide the real failure cause.
- **Deliverable**: Where a test asserts ≥ 3 unrelated post-conditions,
  split into sibling tests or use `t.test()` subtests. Prioritize the
  market-buy/sell tests and any `'... and ...'`-named handler tests.

### TQ-13 Free-port server tests
- **Why**: [test/server.test.js](test/server.test.js) hard-codes 21+ specific
  ports; `listen(server)` already shows the right `server.listen(0)` pattern.
- **Deliverable**: Replace `createServer({ port: '30xx' })` calls with
  `createServer({ port: '0' })` (or a helper `createTestServer()`); use the
  existing `listen()` helper to read the actual port.

### TQ-14 Rename historically-misnamed test files
- **Why**: [TEST_QUALITY_REVIEW.md](TEST_QUALITY_REVIEW.md) §7.2.
- **Remaining**:
  - Rename `test/km-to-au-migration.test.js` →
    `test/context-distance-and-routing.test.js` (or split).
  - Move the gate-routing tests out of `test/credit-ledger.test.js`.
  - Document the split between `db-service-core.test.js` and
    `db-service-extended.test.js`, or merge them.

### TQ-15 Echo `requestId` consistently in market-test assertions
- **Deliverable**: For each market handler test, include a `requestId` in
  the request payload and assert it is echoed in both success and failure
  responses. Closes a contract gap noted in §3.3.

### TQ-16 Cover `solar-system-gate-seed.js`
- **Why**: 25.58% line coverage on the seeder.
- **Deliverable**: A seed-then-query test against the memory harness
  asserting expected gate count + traversal cost/time after seeding.

### TQ-17 Verify ship `driveProfile` matrix items
- **Why**: [MESSAGE_CONTRACT.md](MESSAGE_CONTRACT.md) acceptance matrix calls
  for both "present when configured" and "null/absent when not"; only one
  side appears tested.
- **Deliverable**: Two ship-list tests asserting both branches.

---

## Tracking template

When picking up an item, copy this template into the PR description:

```
TQ-XX <title>
- Files touched:
- Tests added/changed:
- Branch coverage delta on affected handler:
- Notes:
```
