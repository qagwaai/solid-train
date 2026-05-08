# Test Coverage & Quality Review

**Date**: 2026-05-07
**Scope**: Test coverage and quality only (no production-code review)
**Baseline**: 246 tests, 0 fail, 1.6s wall time
**Coverage**: 87.36% line / 73.13% branch / 88.45% function (all files)
**Method**: `node --test --experimental-test-coverage` + targeted file inspection

> See [TODO.md](TODO.md) for the remediation backlog derived from this review.

---

## Executive Summary

The suite is healthy at the macro level (all green, fast, ~80%+ line coverage,
deterministic id/timestamp injection, no external mocks library). The maintainability
risks are concentrated in **five themes**:

1. **Branch coverage gaps in money-flow handlers** (market buy/sell/quote at 36–47%
   branch) leave the most business-critical code paths thinly tested.
2. **Helper/fixture drift** — the canonical spatial helpers in
   [test-support/message-handler-test-helpers.js](test-support/message-handler-test-helpers.js)
   are largely unused (42.57% line coverage on the helpers themselves); tests
   inline ad-hoc fixtures and re-define local `createCelestialBody` / `createMarket`
   in 3+ files.
3. **Legacy-shape reliance** — many tests still pass `location` / `kinematics` /
   root-level `solarSystemId` and rely on the backward-compat normalization layer,
   which [MESSAGE_CONTRACT.md](MESSAGE_CONTRACT.md) schedules for removal on
   **2026-06-30** (~7 weeks from now).
4. **Misnamed / orphan test files** — `mission-add-message-handler.test.js`
   actually tests `MissionUpsertMessageHandler`; `context-distance-and-routing.test.js`
   actually tests `calculateDistanceAu` and gate-routing BFS;
   `MissionAddMessageHandler` is **dead code** (no wiring in `src/server.js`,
   no test imports it).
5. **Integration-vs-unit imbalance** — only one Mongo-backed integration test
   exists (markets); `server.js` function coverage is **52.54%**, indicating most
   Socket.IO event wiring is not exercised end-to-end.

The good news: structural conventions (one handler-per-file, deterministic
`createId`/`getCurrentTimestamp`, single shared `MessageHandlerContext`) make
all of these fixable without a re-architecture.

---

## 1. Coverage Snapshot

### Worst offenders (line %)

| File                                                                                             | Line %    | Branch %  | Notes                                                      |
| ------------------------------------------------------------------------------------------------ | --------- | --------- | ---------------------------------------------------------- |
| [test-support/message-handler-test-helpers.js](test-support/message-handler-test-helpers.js)     | **42.57** | 73.68     | Spatial factory helpers exist but tests bypass them        |
| [src/model/solar-system-gate-seed.js](src/model/solar-system-gate-seed.js)                       | **25.58** | 100       | Gate seed code largely untested                            |
| [src/handlers/market-quote-message-handler.js](src/handlers/market-quote-message-handler.js)     | 78.40     | **47.37** | Money-flow: most branches untested                         |
| [src/handlers/ship-upsert-message-handler.js](src/handlers/ship-upsert-message-handler.js)       | 79.88     | 73.91     | Spatial validation paths thin                              |
| [src/handlers/character-list-message-handler.js](src/handlers/character-list-message-handler.js) | 80.00     | 77.78     |                                                            |
| [src/handlers/message-handler-context.js](src/handlers/message-handler-context.js)               | 81.00     | **66.98** | Central business logic, weakest branch coverage in core    |
| [src/handlers/market-buy-message-handler.js](src/handlers/market-buy-message-handler.js)         | 81.65     | **36.84** | Money-flow: lowest branch coverage in repo                 |
| [src/handlers/market-sell-message-handler.js](src/handlers/market-sell-message-handler.js)       | 82.24     | **38.89** | Money-flow: same                                           |
| [src/handlers/launch-item-message-handler.js](src/handlers/launch-item-message-handler.js)       | 85.50     | **54.55** | Drone launch + body destruction branches                   |
| [src/db/service.js](src/db/service.js)                                                           | 84.07     | **64.67** | Mongoose error-path branches uncovered                     |
| [src/server.js](src/server.js)                                                                   | 88.47     | 83.33     | **funcs 52.54%** — half of socket handlers never exercised |

Models (`src/model/*.js`) are at or near 100% — they're pure constants/typedefs.

### Bright spots

- [src/handlers/market-inventory-list-message-handler.js](src/handlers/market-inventory-list-message-handler.js) — 100/100/100
- [src/handlers/login-message-handler.js](src/handlers/login-message-handler.js) — 94/96/100
- [src/handlers/mission-upsert-message-handler.js](src/handlers/mission-upsert-message-handler.js) — 97/95/100
- [src/db/connection.js](src/db/connection.js) — 100/100/100
- [test-support/mongodb-test-helpers.js](test-support/mongodb-test-helpers.js) — 100% (used in only 1 integration test, but well written)

---

## 2. Coverage Gaps

### 2.1 Market money-flow is under-tested (highest risk)

[test/market-buy-sell-message-handler.test.js](test/market-buy-sell-message-handler.test.js)
contains only **4 tests** for two of the most consequential handlers in the system.
Branch coverage of 36.84% / 38.89% confirms many decision points are unexercised.

Missing scenarios I could not find tests for:

- Insufficient stock in the market (only insufficient credits is tested)
- Market not found / wrong `solarSystemId`
- Catalog miss (`itemId` not in `MARKET_CATALOG_BY_ID`)
- `quantity` ≤ 0, non-integer, NaN
- Lazy restock side-effect firing during a buy when the interval has elapsed
- `priceMultiplier` and `driftPercentPerHour` actually applied to ledger amounts
- `requestId` echoed on failure responses
- Idempotency under repeated `requestId` (if intended)
- Verification that the **`creditLedger` entry is appended** with the correct
  `type: 'take'`, `amount`, `description`, and `referenceId` — current happy-path
  test only asserts response payload + stock delta + item rows; it never reads
  `character.creditLedger` post-buy. Per [CODEBASE.md](CODEBASE.md) invariant #2,
  `credits` is recomputed from the ledger, so a regression that updates `credits`
  without writing to the ledger would pass these tests silently.

### 2.2 `MissionAddMessageHandler` is dead code

- Implementation: [src/handlers/mission-add-message-handler.js](src/handlers/mission-add-message-handler.js) (~130 lines)
- **Not registered** in [src/server.js](src/server.js) (`grep mission-add` returns nothing)
- **Not imported by any test** — `test/mission-add-message-handler.test.js` actually
  imports `MissionUpsertMessageHandler` and tests upsert behavior (already covered
  by `mission-upsert-message-handler.test.js`)
- Coverage report omits the file entirely

Either it is in-progress functionality that should be wired + tested, or stale and
should be deleted. The README and CODEBASE.md both list `add-mission-request` as a
public event, so the wiring may simply have been missed.

### 2.3 `solar-system-gate-seed.js` at 25.58% line coverage

Lines 10–41 (most of the seed body) are untouched. Gate routing itself is tested
via BFS in [test/context-distance-and-routing.test.js](test/context-distance-and-routing.test.js) (see
naming issue 4.1), but the seed step that populates the network from
[data/Stellar mineable raw elements - Mineable Materials.csv](data/Stellar%20mineable%20raw%20elements%20-%20Mineable%20Materials.csv)
or the in-code seed list isn't asserted.

### 2.4 `server.js` function coverage 52.54%

`server.test.js` is large (~1700+ lines) but exercises a subset of socket events end-to-end.
Roughly half of the registered Socket.IO handlers have **no integration test** —
a wiring regression (wrong event constant, swapped handler, missing `socket.on`)
would only be caught if a unit test happens to break, and most unit tests bypass
the socket layer entirely. This is the single highest-leverage gap to close.

### 2.5 `db/service.js` branch coverage 64.67%

Error/empty-input paths in DatabaseService methods (`getPlayerByName`,
`addOrUpdateItem`, `findItemsNearPosition`, etc.) lack negative-path tests that
go through real Mongoose validation. The current `db-service-core.test.js` /
`db-service-extended.test.js` use stub overrides on the `Player`/`Item` model
prototypes rather than a memory-server harness, which limits branch reach.

### 2.6 No Mongo-backed integration tests outside markets

[test-support/mongodb-test-helpers.js](test-support/mongodb-test-helpers.js)
provides a clean `createMongoTestHarness()` (memory server + `clearDatabase()` +
`teardown()`), but it is consumed by **exactly one test file**
([test/market-list-by-location.mongo.integration.test.js](test/market-list-by-location.mongo.integration.test.js)).

No real-Mongo round-trip exists for:

- Player register → process restart simulation → login still works
- Character/ship/inventory persistence
- Item upsert/launch/destroy lifecycle
- Celestial body upsert + spatial index query
- Mission progress persistence
- Jump-gate seed → BFS routing

---

## 3. Test Design Quality

### 3.1 Multi-assert test names

Several tests bundle several assertions into one name, which makes failures
ambiguous:

- [test/market-buy-sell-message-handler.test.js:42](test/market-buy-sell-message-handler.test.js#L42)
  `'MarketBuyMessageHandler buys item, updates credits, stock, and character inventory'`
- Similar patterns in market-sell and several handler tests.

Splitting into one-assertion-per-test, or grouping under `t.test()` subtests
inside a parent that builds the scenario once, would make regressions
self-locating.

### 3.2 Fixtures violate documented invariants

[test/market-buy-sell-message-handler.test.js:38](test/market-buy-sell-message-handler.test.js#L38)
seeds a character with both an explicit `creditLedger` _and_ an explicit `credits`
property. Per [CODEBASE.md](CODEBASE.md) invariant #2 and
[MESSAGE_CONTRACT.md](MESSAGE_CONTRACT.md), `credits` must always be recomputed
from the ledger and never stored. The test passes because `normalizeCharacter`
overwrites the field, but the fixture demonstrates the wrong shape and could
mislead anyone copying it.

### 3.3 Inconsistent `requestId` assertions

[MESSAGE_CONTRACT.md](MESSAGE_CONTRACT.md) shows market responses include
`requestId`. Some tests assert it (market buy happy path), most do not.
The negative-path tests for buy/sell omit the `requestId` from the input entirely,
so the contract behavior of "echo requestId on failure" is uncovered.

### 3.4 No assertion that legacy-shape inputs are _rejected_

[MESSAGE_CONTRACT.md](MESSAGE_CONTRACT.md) §"Acceptance Test Matrix" calls for a
**negative test** that legacy `location` / `kinematics` / root `solarSystemId`
celestial-body payloads are rejected with explicit replacement messages. In
[test/celestial-body-upsert-message-handler.test.js](test/celestial-body-upsert-message-handler.test.js)
the tests at lines 178, 203, 230 (which set legacy fields) appear to verify
_acceptance_ via the backward-compat reader, not rejection. After the
2026-06-30 hard-cut date these tests will need to be re-purposed as rejection tests.

### 3.5 Single-character `port` reuse risk

[test/server.test.js](test/server.test.js) hard-codes 21+ specific ports
(`3001`, `3002`, ..., `3064`, `4000`). On busy CI runners or when running tests
in parallel with another process, port collisions cause flakiness. The file
already demonstrates the right pattern — `listen(server)` uses `server.listen(0)`
to take any free port — but only the `health` test adopts it.

---

## 4. Fixtures & Helpers

### 4.1 Helper drift — canonical factories are unused

[test-support/message-handler-test-helpers.js](test-support/message-handler-test-helpers.js)
exports `createSpatialState`, `createMotionState`, `createPhysicalState`,
`createObservabilityState`, `createShip`, `createCelestialBody`, `createMarket`.
Searching the test corpus:

- `createShip(` — **0 call sites**
- `createCelestialBody(` — never imported from helpers; instead **3 different test files**
  ([celestial-body-list](test/celestial-body-list-message-handler.test.js#L21),
  [celestial-body-upsert](test/celestial-body-upsert-message-handler.test.js#L22),
  [server.test.js](test/server.test.js#L309)) define their own local `createCelestialBody`
  with subtly different defaults
- `createMarket(` — defined locally in
  [market-list-by-location-message-handler.test.js:21](test/market-list-by-location-message-handler.test.js#L21)
  rather than imported

This explains the 42.57% line coverage on the helpers file: it's mostly dead.
The duplication is also where most legacy-shape leaks live.

### 4.2 `createTestContext` ID queue exhausts silently

[test-support/message-handler-test-helpers.js:7-12](test-support/message-handler-test-helpers.js#L7-L12)
defines `issuedIds = ['player-1', 'session-1', 'session-2', 'character-1']` and
falls back to `` `generated-${issuedIds.length}` `` (always equal to `0` once
exhausted because `.shift()` empties the array). Any test that requires more
than four IDs will produce duplicate `'generated-0'` values — a fragile
foundation for tests that create multiple characters or items.
A monotonic counter (`generated-1`, `generated-2`, …) is safer.

### 4.3 Bespoke market-character seeders

[test/market-buy-sell-message-handler.test.js:18-39](test/market-buy-sell-message-handler.test.js#L18-L39),
[test/market-ledger-list-message-handler.test.js](test/market-ledger-list-message-handler.test.js),
and [test/market-quote-message-handler.test.js](test/market-quote-message-handler.test.js)
each define near-identical "trader with N credits and a ship" seeders. A single
shared helper (e.g., `seedTraderCharacter(context, { credits, ship })`) would
remove ~30 lines of duplication and centralize the credit-ledger shape.

---

## 5. Determinism & Isolation

### 5.1 Determinism: good

- `createId` and `getCurrentTimestamp` are injected into `MessageHandlerContext`
  via [test-support/message-handler-test-helpers.js](test-support/message-handler-test-helpers.js)
- All handler unit tests construct a fresh context — no cross-test state
  bleeding through `MessageHandlerContext`
- Per [CODEBASE.md](CODEBASE.md) invariant #4/#6, handlers never call `randomUUID`
  or `new Date()` directly; spot checks confirm this

### 5.2 Isolation gaps

- The four IDs in the `createTestContext` queue (§4.2) couples test authors to
  knowing the _order_ in which the context will issue IDs. Tests expecting
  `character-1` will silently start expecting `generated-0` if a prior call
  drains the queue.
- Mongo-backed test ([test/market-list-by-location.mongo.integration.test.js](test/market-list-by-location.mongo.integration.test.js))
  uses `test.before` / `test.after` / `test.beforeEach` correctly with
  `clearDatabase()`; this is the right model and should be the template for
  more integration tests (§2.6).
- Fixed-port server tests (§3.5) leak isolation when ports collide.

---

## 6. Integration vs Unit Balance

| Tier                                     | Files                                                   | Notes                                              |
| ---------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| Pure unit (handler + context, in-memory) | ~28                                                     | Fast, deterministic, dominant tier                 |
| Real Socket.IO end-to-end (no DB)        | 1 (`server.test.js`)                                    | Wide but covers ~half of events                    |
| Real Mongo (memory-server)               | 1 (`market-list-by-location.mongo.integration.test.js`) | Excellent template, only used once                 |
| Real Socket.IO + real Mongo              | 0                                                       | **Gap** — the production wiring is never exercised |

The cheapest high-value wins are:

1. Adopt the existing `createMongoTestHarness` for at least one round-trip per
   collection (players, items, cb, jump_gates).
2. Add a single Socket.IO + Mongo "smoke" test that registers, logs in,
   adds a character, and then re-loads the player from Mongo — guards the
   end-to-end persistence path that today has no test at all.

---

## 7. Contract Alignment

### 7.1 Acceptance test matrix coverage

Cross-checking [MESSAGE_CONTRACT.md](MESSAGE_CONTRACT.md) §"Acceptance Test Matrix"
against tests:

| Matrix item                                                               | Status                                                            |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ship-list-response` includes `ships[].name` (not `shipName`)             | Covered (server.test.js + ship-list test)                         |
| `celestial-body-list-response` uses `celestialBodies` (not `bodies`)      | Covered                                                           |
| Canonical `spatial` shape on responses                                    | Partial — covered for happy paths, **negative** assertions thin   |
| Legacy `location`/`kinematics`/root `solarSystemId` payload **rejection** | **Not covered** — current tests verify backward-compat acceptance |
| Market distance unit `distanceAu` (not `distanceKm`)                      | Covered                                                           |
| Market `route` descriptor with `kind`                                     | Covered (integration test)                                        |
| Ship `driveProfile` present when configured / absent when not             | Need to verify (no obvious test name match)                       |

The biggest contract gap is the **legacy-rejection** matrix item. The contract
mandates an explicit replacement message and a rejection at the request boundary
once the 2026-06-30 cutover lands. No test file currently asserts that an
inbound `ship-upsert-request` or `celestial-body-upsert-request` carrying a
`location` field returns `success: false` with the prescribed message.

### 7.2 Naming consistency with contract

- [test/mission-add-message-handler.test.js](test/mission-add-message-handler.test.js)
  imports `MissionUpsertMessageHandler` — file name vs subject mismatch.
- [test/context-distance-and-routing.test.js](test/context-distance-and-routing.test.js) actually
  tests `calculateDistanceAu` and `getHopPathBetweenSystems`. There is no
  KM→AU migration; the file name is historical. The first tests in this
  file would be at home in `distance-and-routing.test.js` or split into
  `context-distance.test.js` and `context-gate-routing.test.js`.
- [test/credit-ledger.test.js](test/credit-ledger.test.js) is correctly named
  and is now focused on credit normalization/ledger behavior.
- `db-service-core.test.js` vs `db-service-extended.test.js` — the split is
  documented in [test/DB_SERVICE_TEST_SPLIT.md](test/DB_SERVICE_TEST_SPLIT.md).

---

## 8. Top Risks Ranked

1. **Money-flow branch coverage** (market buy/sell/quote at 36–47% branch).
   _Highest blast radius: silent regression debits the wrong amount or doesn't write the ledger._
2. **Legacy-shape removal cliff (2026-06-30)** — many tests rely on backward-compat
   conversion that is scheduled to be removed. Without rejection tests in place,
   the cutover will silently degrade contract enforcement.
3. **Server-wiring coverage** (`server.js` 52.54% functions) — a swapped event
   constant or missing `socket.on` would not be caught.
4. **Helper drift** (`createShip`/`createCelestialBody`/`createMarket` unused;
   3× duplicated local definitions) — fixtures diverge from canonical contract,
   tests don't share a single source of truth for valid shapes.
5. **Dead handler** (`MissionAddMessageHandler`) — either ship it or delete it.
6. **Mongo round-trip coverage** (1 file) — no real-DB tests for players, items,
   cb, or jump_gates.

---

## 9. What's Working Well

- 100% green, fast (1.6s for 246 tests), and the runner is the standard library.
- Deterministic time and ID injection through `MessageHandlerContext`.
- Strong invariant documentation in [CODEBASE.md](CODEBASE.md), and most tests
  honor it.
- One handler-per-file with one test-per-handler (mostly) keeps the surface area
  navigable.
- The `mongodb-memory-server` harness in
  [test-support/mongodb-test-helpers.js](test-support/mongodb-test-helpers.js)
  is small, correct, and easy to reuse.
- Models (`src/model/*.js`) hit 100% line coverage almost across the board.

---

## 10. Suggested Next Pass

If you want a follow-up, these scopes are the most useful to do separately:

- **Architecture review** of `MessageHandlerContext` (1700+ lines, central
  business logic, 67% branch coverage) — likely the right place for the next
  decomposition pass.
- **Production-code maintainability review** of the handlers themselves
  (duplication of session/idle boilerplate is visible across all 26 handlers).
- **Schema/contract sync audit** between
  [MONGODB_SCHEMA.md](../../MONGODB_SCHEMA.md),
  [docs/spatial-model.md](../spatial-model.md), and
  [src/db/models.js](../../src/db/models.js) — both schema docs are currently active
  and drift between them is likely.
