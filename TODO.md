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

### ~~TQ-04~~ ✅ Cover money-flow branches (market buy / sell / quote)

- **Completed**: 2026-05-07
- **Added 22 new tests** across `test/market-buy-sell-message-handler.test.js` (+16) and `test/market-quote-message-handler.test.js` (+6)
- **Covered**:
  - Invalid session (buy, sell)
  - `INVALID_PAYLOAD` with `requestId` echoed (buy: missing marketId / quantity=0; sell: missing itemId / non-integer quantity)
  - `MARKET_NOT_FOUND` (buy: unknown marketId; sell: wrong solarSystemId)
  - `ITEM_NOT_FOUND` / catalog miss for buy, sell, quote
  - `INSUFFICIENT_MARKET_STOCK` (buy)
  - `NO_SHIP_AVAILABLE` (buy, character has no ships)
  - `MARKET_DOES_NOT_BUY_ITEM` (sell and quote)
  - `INVALID_QUANTITY` — quantity=0 (quote)
  - `CHARACTER_NOT_FOUND` (quote)
  - `creditLedger` entry: `type:'take'` after buy, `type:'put'` after sell with correct amount/description/referenceId
  - Lazy restock fires during buy when interval has elapsed
- **Skipped**: `priceMultiplier`/`driftPercentPerHour` ledger assertions (deferred per decision)
- **Test count**: 244 → 266 (all green)

### ~~TQ-05~~ ✅ Add Socket.IO + Mongo round-trip smoke test

- **Completed**: 2026-05-07
- **Created**: `test/server.mongo.integration.test.js` — 1 integration test
- **Flow**: `createServer` + `databaseService` injected → register → login → add character → `getPlayerByName` assertion
- **Asserts**: player persisted, character `id`/`characterName`/`creditLedger`/`ships` present in Mongo
- **Also created**: `test-support/socket-test-helpers.js` — extracted `listen`, `connectClient`, `waitForEvent`, `httpGetJson`, `closeClient`, `registerAndLogin` from `test/server.test.js` so they can be shared
- **Test count**: 266 → 267 (all green)

### ~~TQ-06~~ ✅ Mongo round-trip per collection

- **Completed**: 2026-05-07 (with approved scope decision)
- **Added**:
  - `test/db-players.mongo.integration.test.js`
  - `test/db-items.mongo.integration.test.js`
  - `test/db-celestial-bodies.mongo.integration.test.js`
- **Coverage added**:
  - Players: register/read/update + character add/read/update/delete + clear + negative input short-circuits
  - Items: add/read/update/delete + container query + near-position query + negative/empty input paths
  - Celestial bodies: upsert/read/update/delete + filtered list + near-position query + invalid upsert/delete paths
- **Deferred by decision**: `jump_gates` round-trip coverage moved to TQ-07 scope discussion.

### ~~TQ-07~~ ✅ Lift `db/service.js` branch coverage

- **Completed**: 2026-05-07
- **Result**: `src/db/service.js` branch coverage is now **80.00%**
  (line: 90.38%, funcs: 95.08%).
- **Added**: `test/db-service-branch.mongo.integration.test.js`
- **Covered branches**:
  - Market seed-state round-trip + invalid inputs (`get/setSolarSystemMarketSeedState`)
  - Market upsert/get invalid + filtered paths (`upsertMarket`, `getMarkets`)
  - Player character mutations with negative paths (`addShip`, `addOrUpdateMission`, `getMissions`, `getShips`)
  - Jump-gate fallback and catch-return-empty branches (`getJumpGatesAsync`)
- **Approach**: Real memory-server harness for DB-backed paths, plus minimal targeted monkey-patch only for the jump-gate catch branch that intentionally returns `[]` on DB failures.

---

## P1 — Helper hygiene

### ~~TQ-08~~ ✅ Use canonical helpers from `test-support/`

- **Completed**: 2026-05-07
- **Removed local factories**:
  - `createCelestialBody` from `test/celestial-body-list-message-handler.test.js`
  - `createCelestialBody` from `test/server.test.js`
  - `createMarket` from `test/market-list-by-location-message-handler.test.js`
- **Replaced with shared imports** from `test-support/message-handler-test-helpers.js`.
- **Fixture updates**: migrated market fixtures to canonical helper-compatible `siteType` + `trajectory.orbit` overrides where required.
- **Validation**: full suite green after migration (`281` pass, `0` fail).

### ~~TQ-09~~ ✅ Make `createTestContext` ID generator robust past 4 calls

- **Completed**: 2026-05-07
- **Implemented** in `test-support/message-handler-test-helpers.js`:
  - `createTestContext({ seedIds })` optional API
  - Default seed IDs preserved: `player-1`, `session-1`, `session-2`, `character-1`
  - Monotonic per-context fallback after seed exhaustion: `generated-1`, `generated-2`, ...
  - Custom `seedIds` are trimmed/filtered before use
- **Added tests**: `test/message-handler-test-helpers.test.js`
  - default-seed then monotonic fallback behavior
  - custom `seedIds` behavior
  - per-context counter isolation (no cross-test leakage)
- **Validation**: full suite green (`284` pass, `0` fail)

### ~~TQ-10~~ ✅ Extract a shared trader-character seeder

- **Completed**: 2026-05-07
- **Added helper** in `test-support/message-handler-test-helpers.js`:
  - `seedTraderCharacter(context, { credits, shipOverrides })`
  - Defaults: `MarketPilot`, `session-1`, `player-1`, `character-1`, one `ship-1`, seed ledger entry timestamp `2026-05-05T00:00:00.000Z`
- **Migrated usage**:
  - `test/market-buy-sell-message-handler.test.js` (removed local `seedMarketCharacter`)
  - `test/market-quote-message-handler.test.js` (straightforward trader seed cases)
  - `test/market-ledger-list-message-handler.test.js`
- **Scope note**: explicit `credits` field intentionally left unchanged for TQ-11.
- **Validation**: full suite green (`284` pass, `0` fail)

### ~~TQ-11~~ ✅ Remove explicit `credits` from character fixtures

- **Completed**: 2026-05-07
- **Fixture/API cleanup**:
  - Removed explicit `credits:` fields from character fixture objects in tests.
  - Updated `seedTraderCharacter` API in `test-support/message-handler-test-helpers.js`:
    - removed `{ credits }` option
    - replaced with `{ startingBalance }` (ledger-only seed)
    - removed persisted `character.credits` field assignment
- **Call-site migration**:
  - `test/market-buy-sell-message-handler.test.js`
  - `test/market-quote-message-handler.test.js`
  - `test/market-ledger-list-message-handler.test.js`
  - expectation cleanup in `test/character-add-message-handler.test.js` and `test/login-message-handler.test.js`
- **Validation**: full suite green (`284` pass, `0` fail)

---

## P2 — Test design polish

### ~~TQ-12~~ ✅ One assertion per test name (where reasonable)

- **Completed**: 2026-05-07
- **Implementation**:
  - Split broad market tests into narrower sibling tests in
    `test/market-buy-sell-message-handler.test.js`.
  - Separated buy assertions into focused tests for transaction metadata,
    stock decrement, and inventory write.
  - Separated sell assertions into focused tests for success response and
    inventory quantity decrement.
- **Validation**: targeted suite green (`106` pass, `0` fail).

### ~~TQ-13~~ ✅ Free-port server tests

- **Completed**: 2026-05-07
- **Implementation**:
  - Replaced fixed 30xx `createServer(...)` call sites in `test/server.test.js`
    with `createServer()` to avoid fixed-port coupling.
  - Added `getAvailablePort()` helper for the `startServer(...)` test and now
    pass a dynamically probed port.
  - Preserved the explicit `createServer({ port: '4000' })` unit test that
    verifies `resolvePort` behavior.
- **Validation**: `test/server.test.js` passing in targeted suite.

### ~~TQ-14~~ ✅ Rename historically-misnamed test files

- **Completed**: 2026-05-07
- **Implementation**:
  - Renamed `test/km-to-au-migration.test.js` to
    `test/context-distance-and-routing.test.js`.
  - Updated stale references in `TEST_QUALITY_REVIEW.md`.
  - Added `test/DB_SERVICE_TEST_SPLIT.md` documenting the intended scope split
    between `db-service-core.test.js` and `db-service-extended.test.js`.
- **Validation**: renamed test file passes in targeted suite.

### ~~TQ-15~~ ✅ Echo `requestId` consistently in market-test assertions

- **Completed**: 2026-05-07
- **Implementation**:
  - Added/standardized `requestId` payloads and echo assertions across:
    - `test/market-buy-sell-message-handler.test.js`
    - `test/market-quote-message-handler.test.js`
    - `test/market-ledger-list-message-handler.test.js`
  - Updated `src/handlers/market-ledger-list-message-handler.js` to include
    `requestId` in success and failure responses.
- **Validation**: all targeted market handler tests passing.

### ~~TQ-16~~ ✅ Cover `solar-system-gate-seed.js`

- **Completed**: 2026-05-07
- **Implementation**:
  - Added `test/solar-system-gate-seed.test.js` with:
    - direct assertions on seeded gate count and traversal fields,
    - memory-harness seed-then-query route validation via
      `loadGateNetworkAsync()` and `getHopPathBetweenSystems()`.
- **Validation**: new gate-seed test file passing.

### ~~TQ-17~~ ✅ Verify ship `driveProfile` matrix items

- **Completed**: 2026-05-07
- **Implementation**:
  - Confirmed and retained the positive branch test where driveProfile is
    present and valid.
  - Added explicit null/absent branch coverage in
    `test/ship-list-message-handler.test.js`:
    - `driveProfile` missing
    - `driveProfile: null`
    - invalid profile omitted
- **Validation**: ship-list targeted tests passing.

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
