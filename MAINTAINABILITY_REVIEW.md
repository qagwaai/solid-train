# Maintainability Review — 2026-05-08

Scope: full codebase **excluding** test coverage/quality (covered by `TEST_QUALITY_REVIEW.md` / `TODO.md`).
Author: AI-assisted review. Findings ranked by leverage × risk.

---

## Codebase snapshot

| Area | Size | Notes |
|---|---|---|
| `src/handlers/message-handler-context.js` | **2,794 LOC** | Single god-class; ~80 methods |
| `src/db/service.js` | 998 LOC | Persistence + query + normalization mixed |
| `src/db/models.js` | 1,009 LOC | All Mongoose schemas in one file |
| `src/server.js` | 529 LOC | Mostly boilerplate import + `socket.on` wiring |
| Handlers (25 files) | 84–407 LOC each | Largest: `launch-item` 407, `mission-upsert` 367, `ship-upsert` 323 |
| Markdown specs | 8 files | High overlap risk (spatial model docs, schema docs, contracts) |

---

## M-01 — Decompose `MessageHandlerContext` (highest leverage)

Status: Completed on 2026-05-08.

`src/handlers/message-handler-context.js` is a 2.8k-line god object that owns: in-memory caches, normalization for every domain entity, market pricing/orbit math, gate routing, docking, ledger arithmetic, Kepler solver, and the DB fall-through layer for every collection. Every handler depends on the whole surface, so any change ripples broadly and tests are forced to mock through the same seam.

Suggested split:
- `context/normalizers.js` — `normalizeShip`, `normalizeCharacter`, `normalizeItem`, `normalizeMarket`, `normalizeCelestialBody`, `normalizeSpatialState`, `normalizeMotionState`, … (pure functions; many already are).
- `context/orbital-math.js` — `solveEccentricAnomaly`, `rotatePerifocalVector`, `computeRelativeOrbitPositionKm`, `resolveMarketPositionKmAsync`, `calculateDistanceKm/Au` (already mostly pure).
- `context/market-service.js` — seeding, restock, quote, transaction, ledger.
- `context/routing-service.js` — `loadGateNetworkAsync`, `getHopPathBetweenSystems`, `getRouteForMarketAsync`.
- `context/docking-service.js` — `resolveDockingStateAsync` and friends.
- `context/persistence-bridge.js` — the cache-or-DB methods (`getPlayerAsync`, `getCharactersAsync`, etc., currently a thick block of duplicated try/log).

Keep `MessageHandlerContext` as a thin façade so handler call sites are unchanged. Each module becomes independently testable and reviewable.

Implemented extraction:
- `src/handlers/context/normalizers.js`
- `src/handlers/context/orbital-math.js`
- `src/handlers/context/market-service.js`
- `src/handlers/context/routing-service.js`
- `src/handlers/context/docking-service.js`
- `src/handlers/context/persistence-bridge.js`

`MessageHandlerContext` now delegates routing, orbital/distance math, docking, market transaction workflows, and persistence/session bridge operations while keeping the public API stable for handlers.

---

## M-02 — Replace `socket.on` boilerplate with a registration table

Status: Completed on 2026-05-08.

In `src/server.js` (~lines 150–420) the same 4-line `socket.on(EVENT, p => handler.handle(socket, p).catch(err => process.stderr.write(...)))` pattern is copy-pasted ~25 times, plus a one-off alias for `MISSION_UPSERT_ALIAS_REQUEST_EVENT`. Each addition requires editing four places (import, instantiate, wire, log message).

Suggested: a `[ { event, handlerKey, aliasResponse? } ]` table + a single `wireHandler(io, socket, table, handlers)` function. Reduces ~250 LOC to ~30, removes inconsistent log strings, and makes adding a handler one entry.

Implemented extraction:
- `src/handlers/socket-handler-registry.js` now owns the core event-to-handler registration table.
- `src/server.js` now wires core handlers through `registerSocketHandlers(socket, handlersByKey)`.
- The mission upsert alias path remains explicit to preserve alias-specific response emission behavior.

---

## M-03 — Plaintext password storage (functional risk that affects maintainability)

`src/handlers/login-message-handler.js` (line ~71) compares `player.password !== password` directly, and `src/handlers/register-message-handler.js` (line ~43) persists the raw password. Security bug, but it also blocks future maintainability work: any auth-related refactor risks leaking secrets, and tests now seed plaintext credentials. Introduce `bcrypt`/`argon2` once, behind a `passwordHasher` injectable, before the surrounding code grows further.

(Also: `CORS_ORIGIN` defaults to `*` — fine for dev, but should be required-in-prod via config validation.)

---

## M-04 — Collapse the legacy spatial backward-compat readers (already scheduled)

Status: Completed on 2026-05-08.

Per `MESSAGE_CONTRACT.md` the internal legacy `location` / `kinematics` readers have a hard sunset of **2026-06-30 / v2.1.0**. Today, residue still exists in:
- `src/handlers/message-handler-context.js` lines ~889, ~913–918, ~1648
- `src/handlers/item-upsert-message-handler.js` — items still use `kinematics.position` rather than canonical `spatial`/`motion`.
- `src/db/service.js` lines ~793–801 — `findItemsNearPosition` queries `kinematics.position.{x,y,z}`.

Items were migrated to canonical `spatial`/`motion`, legacy ship/celestial fallback readers were removed, and item contracts/tests were updated to reject legacy `item.kinematics` payloads.

---

## M-05 — `db/models.js` and `db/service.js` are monoliths

Status: Completed on 2026-05-08 (slice 1-4).

`src/db/models.js` defines every Mongoose schema in 1k LOC; `src/db/service.js` mixes player CRUD, item CRUD, celestial-body CRUD, market CRUD, jump-gate CRUD, and seed-state CRUD. Suggested:
- `db/models/player.js`, `db/models/item.js`, `db/models/celestial-body.js`, `db/models/market.js`, `db/models/jump-gate.js`, `db/models/game-state.js`, plus shared sub-schemas (`spatial`, `motion`, `physical`, `observability`) factored once.
- `db/services/players.js`, `db/services/items.js`, … with a thin `DatabaseService` aggregator. The integration test files already split this way (`db-players.mongo.integration.test.js`, etc.) — production layout has just not caught up.

Implemented (slice 1, players + characters):
- Added `src/db/models/player-model.js` and moved `Player`, `playerSchema`, `characterSchema`, and `creditLedgerEntrySchema` there.
- Added `src/db/service/player-character-service.js` and moved player/character methods there (`registerPlayer`, `getPlayerByName`, `getPlayerById`, `updatePlayer`, character/ship/mission methods).
- `src/db/models.js` and `src/db/service.js` remain stable facades with backward-compatible exports and method signatures.

Implemented (slice 2, items + shared primitives):
- Added `src/db/models/shared-primitives.js` and moved shared schemas (`tripleSchema`, `shipKinematicsSchema`, `motionStateSchema`, `spatialStateSchema`) there.
- Added `src/db/models/item-model.js` and moved `Item`, `itemSchema`, `itemContainerSchema`, and `inventoryItemReferenceSchema` there.
- Added fine-grained item services:
  - `src/db/service/item-write-service.js` (`addItems`, `deleteItemsByIds`, `updateItemById`)
  - `src/db/service/item-query-service.js` (`getItemsByIds`, `getItemsByContainer`, `findItemsNearPosition`)
- `src/db/models.js` and `src/db/service.js` continue as stable facades with existing exports and method signatures unchanged.

Implemented (slice 3, markets + seed-state):
- Added `src/db/models/market-model.js` and moved `Market`, `marketSchema`, `marketInventoryEntrySchema`, `marketLedgerEntrySchema`, and `marketOrbitSchema` there.
- Added `src/db/models/game-state-model.js` and moved `GameStateDocument` + `gameStateDocumentSchema` there.
- Added fine-grained market services:
  - `src/db/service/market-write-service.js` (`upsertMarket`)
  - `src/db/service/market-query-service.js` (`getMarkets`)
  - `src/db/service/market-seed-state-service.js` (`getSolarSystemMarketSeedState`, `setSolarSystemMarketSeedState`)
- `src/db/models.js` and `src/db/service.js` remain stable facades with backward-compatible exports and method signatures.

Implemented (slice 4, celestial + gates + ship/missions model extraction):
- Added `src/db/models/celestial-model.js` and moved `CelestialBody`, `celestialBodySchema`, and `asteroidMaterialProfileSchema` there.
- Added `src/db/models/jump-gate-model.js` and moved `JumpGate` + `jumpGateSchema` there.
- Added `src/db/models/ship-model.js` and moved `driveProfileSchema`, `shipSchema`, and `missionSchema` there.
- Added fine-grained service modules:
  - `src/db/service/celestial-write-service.js` (`addOrUpdateCelestialBody`, `deleteCelestialBodyById`)
  - `src/db/service/celestial-query-service.js` (`getCelestialBodyById`, `findCelestialBodiesNearPosition`, `getCelestialBodies`)
  - `src/db/service/jump-gate-query-service.js` (`getJumpGatesAsync`)
- `src/db/models.js` and `src/db/service.js` continue to expose the same public exports and method signatures as facades.

---

## M-06 — Side-effecting constructor

`MessageHandlerContext` constructor calls `seedDefaultMarkets()` (line ~77), which uses `new Date().toISOString()` directly (bypassing the injected `getCurrentTimestamp`) and silently mutates state. This makes `new MessageHandlerContext({})` non-deterministic and surprising for tests/SSR. Move to an explicit `await context.initializeAsync()` step (server already calls `seedSolarSystemMarketsAsync` after construction).

---

## M-07 — Repeated DB-fallback try/log pattern

In `message-handler-context.js` (~lines 1900–2200) and similar elsewhere, ~15 methods follow:

```js
async fooAsync(...) {
  if (this.databaseService) {
    try { ... await this.databaseService.foo(...) ... }
    catch (error) { this.log(`[context] Error ...: ${error.message}`); throw|return; }
  }
  // mutate in-memory
}
```

Extract `withDb(operationName, fn)` and `withDbOrNull(operationName, fn)` helpers; remove ~200 LOC of repetition; centralizes error/log policy (and lets you add metrics/correlation IDs later).

---

## M-08 — Toolchain gaps

- **No ESLint / Prettier**. Add `eslint:recommended` + a small house ruleset (no-unused-vars, prefer-const, consistent-return). Codebase already follows a consistent style — codify it.
- **No CI config in tree** (no `.github/workflows/`). Add a minimal CI workflow that runs `npm test` on PR.
- **No `lint`, `format`, or `typecheck` npm scripts** in `package.json`. Add `npm run lint`, `npm run lint:fix`, `npm run format`.
- **JSDoc usage is thin**. Lightweight `@typedef` adoption (or `// @ts-check` on critical files + a single `tsconfig.json` for checking) buys safety with no build step.

---

## M-09 — Documentation drift risk

Living root-level docs: `CODEBASE.md`, `MESSAGE_CONTRACT.md`, `MONGODB_SCHEMA.md`, `MONGODB_SCHEMA_SPATIAL_MODEL.md`, `SPATIAL_MODEL_IMPLEMENTATION.md`, `SPATIAL_MODEL_RESPONSE_CONTRACTS.md`, `TEST_QUALITY_REVIEW.md`, `TODO.md`, `README.md`.

Several are point-in-time progress reports (e.g. `SPATIAL_MODEL_IMPLEMENTATION.md` dated May 5 2026 still shows "Tests require fixture updates" though that's now done). Recommend:
- Move time-stamped status docs into `docs/history/` (or rely on git history).
- Merge the two spatial-model docs.
- Add a "doc owner / last-verified date" header to each living doc.

---

## M-10 — Smaller wins

- **Magic numbers**: `MAX_YIELD_QUANTITY`, `MARKET_DOCKING_DISTANCE_KM`, `ASTRONOMICAL_UNIT_KM`, `DEFAULT_RESTOCK_INTERVAL_MINUTES`, rarity stock table — scattered across files. Centralize in `src/model/constants.js`.
- **`FALLBACK_ANCHOR_POSITION_KM`** (`message-handler-context.js` lines 15–29) is hard-coded data inside a logic file — move to `src/model/solar-system-bodies.js`.
- **Cache invariant doc**: there's no single doc explaining "in-memory cache + DB write-through; cache may lag DB". Worth a 10-line section in `CODEBASE.md`.
- **Naming**: `getMarketsAsync` (cache+DB) vs `getMarketsByLocationAsync` (cache+seed+DB) vs `getMarketQuoteAsync` (no DB). Adopt a suffix convention (`...Async` only when async; `...Cached` / `...Fresh` for cache vs DB-authoritative).
- **`character-add` / `mission-upsert`** handlers (~160–370 LOC each) embed business workflows (starter ship, starter mission, mission-completion side effects). Candidates for moving to a `services/character-creation.js` module so the handler stays a thin shell.

---

## Suggested target slate

| ID | Item | Risk if deferred | Effort |
|---|---|---|---|
| **M-04** | Finish spatial-model cutover (items + remove legacy readers) — **Completed 2026-05-08** | Hard 2026-06-30 sunset addressed ahead of sunset | M |
| **M-03** | Hash passwords | Security + blocks auth refactors | S |
| **M-01** | Split `MessageHandlerContext` — **Completed 2026-05-08** | Compounding complexity reduced via façade + extracted modules | L |
| **M-02** | Table-driven socket wiring — **Completed 2026-05-08** | Boilerplate growth reduced with shared registry wiring | S |
| **M-08** | Add ESLint + CI workflow + npm scripts | Style/correctness drift | S |
| **M-05** | Split `db/models.js` and `db/service.js` — **Completed 2026-05-08** | Domain modules extracted (players, items, markets/seed-state, celestial/gates, ship/missions) behind stable facades | M |
| **M-07** | Extract `withDb` helper | Easy duplication removal | S |
| **M-06** | Move seeding out of constructor | Hidden non-determinism; bites tests | S |
| **M-09** | Consolidate markdown docs | Drift; onboarding cost | S |
| **M-10** | Constants + naming + small extractions | Quality-of-life | S |

---

## Tracking template

```
M-XX <title>
- Files touched:
- Tests added/changed:
- Behavioral impact (if any):
- Notes:
```
