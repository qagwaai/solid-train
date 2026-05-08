# Codebase Guide

A reference for AI assistants working in this repository.

## Project Summary

A Node.js Socket.IO game server for a space-trading/exploration game called **Stellar**.
Players register, log in, manage characters and ships, explore solar systems, trade at markets,
and launch drone attacks against celestial bodies.

- Runtime: Node.js ≥ 20, CommonJS (`"type": "commonjs"`)
- Transport: Socket.IO over HTTP
- Persistence: MongoDB via Mongoose (optional; server runs fully in-memory without it)

---

## Commands

| Purpose                          | Command                                       |
| -------------------------------- | --------------------------------------------- |
| Run all tests                    | `npm test`                                    |
| Run tests with coverage          | `npm test -- --experimental-test-coverage`    |
| Run tests matching a pattern     | `npm test -- --test-name-pattern="<pattern>"` |
| Start server (MongoDB)           | `npm start`                                   |
| Start server (watch mode, no DB) | `npm run dev`                                 |

Tests use the built-in `node --test` runner (no Jest, no Mocha).

### Running Tests in Non-TTY Terminals (Git Bash / CI)

`node --test` writes TAP output only to a TTY; piping or redirecting stdout produces no output and
the process exits with code 1. Use the TAP reporter with an explicit destination file instead:

```bash
node --test --test-reporter=tap --test-reporter-destination=/tmp/test-tap.txt
grep -E "^(ok|not ok|# tests|# pass|# fail)" /tmp/test-tap.txt
```

Or as a one-liner that prints only the summary:

```bash
node --test --test-reporter=tap --test-reporter-destination=/tmp/test-tap.txt && \
  grep -E "^(# tests|# pass|# fail)" /tmp/test-tap.txt
```

Verified result (Node v24.14.1, 212 tests): `# pass 212`, `# fail 0`.

---

## Directory Structure

```
src/
  server.js                   Entry point; creates HTTP + Socket.IO server, wires all events
  db/
    connection.js             MongoConnection class (connect/disconnect/status)
    models.js                 Mongoose schemas and model exports
    service.js                DatabaseService class; all DB reads/writes go here
  handlers/
    message-handler-context.js  Central shared context; all business logic lives here
    *-message-handler.js     One handler class per event type
  model/
    *.js                     Event name constants, typedefs, and domain config (no side effects)

test/
  *.test.js                  Unit tests; one file per handler or domain concern

test-support/
  message-handler-test-helpers.js  Shared test utilities (createTestContext, seedPlayer, etc.)
```

---

## Architecture

### Event → Handler Flow

Every Socket.IO event maps 1-to-1 to a handler class:

```
socket.on(EVENT_CONSTANT, (payload) => handler.handle(socket, payload))
```

All handlers follow the same shape:

```js
class FooMessageHandler {
  constructor(context) {
    this.context = context;
  }
  async buildResponse(payload) {
    /* validation + business logic */
  }
  async handle(socket, payload) {
    if (!(await this.context.hasValidSessionAsync(payload))) {
      socket.emit(INVALID_SESSION_EVENT, { message: INVALID_SESSION_MESSAGE });
      return { message: INVALID_SESSION_MESSAGE };
    }
    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);
    const response = await this.buildResponse(payload);
    socket.emit(RESPONSE_EVENT, response);
    return response;
  }
}
```

### MessageHandlerContext

`src/handlers/message-handler-context.js` is the single most important file in the codebase.
It holds all in-memory state and all business logic. Handlers are thin wrappers that call into it.

Key state maps (all `Map` instances):

| Property              | Key                        | Value           |
| --------------------- | -------------------------- | --------------- |
| `registeredPlayers`   | `playerName.toLowerCase()` | player object   |
| `charactersByPlayer`  | `playerName.toLowerCase()` | character array |
| `celestialBodiesById` | `body.id`                  | celestial body  |
| `itemsById`           | `item.id`                  | item            |
| `marketsByKey`        | `"solarSystemId:marketId"` | market          |

Key methods:

- `hasValidSessionAsync(payload)` — checks `playerName` + `sessionKey`; falls back to DB
- `getPlayer(playerName)` — case-insensitive in-memory lookup
- `findCharacter(playerName, characterId)` — finds character across player's list
- `normalizeCharacter(char)` — computes `credits` from `creditLedger`, normalizes shapes
- `normalizeMarket(market)` — normalizes market including `orbit`, `inventory`, `ledger`
- `normalizeMarketOrbit(orbit)` — fills missing orbit fields with safe defaults
- `cacheMarket(market)` — normalize + store in `marketsByKey`
- `getMarketsAsync(query)` — filter by `solarSystemId`, apply lazy restock, sort by name
- `getMarketsByLocationAsync(query)` — radius filter with server-computed orbital positions
- `resolveDockingStateAsync(request)` — returns `isDocked`, `dockedMarketId`, `perMarketDocked`
- `resolveMarketPositionKmAsync(market, timestamp)` — Kepler orbit → world-space position
- `seedSolarSystemMarketsAsync({ solarSystemId })` — upsert seeded markets; checks DB version flag
- `getItemsNearPositionAsync(query)` — radius filter for deployed items
- `computeMidpointPrice(catalogEntry, market, timestamp)` — deterministic hourly price drift

### Model Files (`src/model/`)

Pure constants and typedefs — no constructors, no side effects.
Each file exports event name constants and optionally JSDoc typedefs.

| File                          | What it exports                                                  |
| ----------------------------- | ---------------------------------------------------------------- |
| `session.js`                  | `INVALID_SESSION_EVENT`, `INVALID_SESSION_MESSAGE`               |
| `market-catalog.js`           | `MARKET_CATALOG`, `MARKET_CATALOG_BY_ID` (21 raw-material items) |
| `market-pricing.js`           | `computeMidpointPrice`                                           |
| `solar-system-market-seed.js` | `buildSeededMarketsForSolarSystem`, seed version constant        |
| `game.js`                     | `GameState` class (joined character tracking, idle detection)    |
| `*.js`                        | `FOO_REQUEST_EVENT`, `FOO_RESPONSE_EVENT` pairs                  |

### Database Layer (`src/db/`)

- `MongoConnection` — thin wrapper around `mongoose.connect` / `mongoose.disconnect`
- `DatabaseService` — all Mongoose queries; stateless, callable from `MessageHandlerContext`
- Schema collections: `players`, `items`, `cb` (celestial bodies)
- `GameStateDocument` model stores persistent seed metadata (`solarSystemMarketSeedState`)

---

## Event Reference

All events use Socket.IO. Request/response pairs listed below.

| Request Event                                           | Response Event                                            | Session Required |
| ------------------------------------------------------- | --------------------------------------------------------- | ---------------- |
| `register`                                              | `register-response`                                       | No               |
| `login`                                                 | `login-response`                                          | No               |
| `character-list-request`                                | `character-list-response`                                 | Yes              |
| `character-add-request`                                 | `character-add-response`                                  | Yes              |
| `character-delete-request`                              | `character-delete-response`                               | Yes              |
| `character-edit`                                        | `character-edit-response`                                 | Yes              |
| `ship-list-request`                                     | `ship-list-response`                                      | Yes              |
| `ship-upsert-request`                                   | `ship-upsert-response`                                    | Yes              |
| `game-join`                                             | `game-join-response`                                      | Yes              |
| `add-mission-request` (alias: `mission-upsert-request`) | `add-mission-response` (alias: `mission-upsert-response`) | Yes              |
| `list-missions-request`                                 | `list-missions-response`                                  | Yes              |
| `celestial-body-upsert-request`                         | `celestial-body-upsert-response`                          | Yes              |
| `celestial-body-list-request`                           | `celestial-body-list-response`                            | Yes              |
| `item-upsert-request`                                   | `item-upsert-response`                                    | Yes              |
| `item-list-by-container-request`                        | `item-list-by-container-response`                         | Yes              |
| `item-list-by-location-request`                         | `item-list-by-location-response`                          | Yes              |
| `launch-item-request`                                   | `launch-item-response`                                    | Yes              |
| `market-list-request`                                   | `market-list-response`                                    | Yes              |
| `market-list-by-location-request`                       | `market-list-by-location-response`                        | Yes              |
| `market-quote-request`                                  | `market-quote-response`                                   | Yes              |
| `market-inventory-list-request`                         | `market-inventory-list-response`                          | Yes              |
| `market-buy-request`                                    | `market-buy-response`                                     | Yes              |
| `market-sell-request`                                   | `market-sell-response`                                    | Yes              |
| `market-ledger-list-request`                            | `market-ledger-list-response`                             | Yes              |
| `mission-upsert-alias-request`                          | `mission-upsert-alias-response`                           | Yes              |

Invalid session always emits `invalid-session` with `{ message: "Invalid session" }` before the normal response event.

See `MESSAGE_CONTRACT.md` for full request/response schemas and edge cases.

---

## Key Domain Concepts

### Players and Sessions

- `playerName` lookups are always case-insensitive.
- `sessionKey` is a UUID assigned at login; rotated on every successful login.
- Players are stored in-memory keyed by `playerName.toLowerCase()`.
- If a player is not in memory, handlers fall back to `DatabaseService.getPlayerByName`.

### Characters and Credits

- Each player owns a list of characters.
- Each character has a `creditLedger` (array of `{ type, amount, description, timestamp, referenceId }`).
- `credits` is always recomputed from the ledger — never stored as a raw number.
- New characters start with **425 credits** (`put` ledger entry, `"Starting credits"`).
- New characters receive a starter ship (`Scavenger Pod`, Tier 1) with one `expendable-dart-drone`.
- New characters receive the `first-target` mission at status `available`.

### Markets

- Markets are seeded on startup from `buildSeededMarketsForSolarSystem('sol', now)`.
- 14 seeded Sol markets; each has a full `orbit` descriptor (Keplerian elements).
- Market stock restocks lazily on read, based on `restockIntervalMinutes` (default 60).
- Price drift is deterministic and hour-based: `computeMidpointPrice(catalogEntry, market, now)`.
- Market docking threshold: 50 km (`MARKET_DOCKING_DISTANCE_KM`).
- `market-list-by-location-request` returns markets sorted nearest-first with server-computed `distanceKm`.
- DB seed state version is `"2026-05-sol-v1"` (stored in `GameStateDocument`).

### Items

- Items live in `itemsById` (and `items` collection in Mongo).
- States: `contained`, `deployed`, `destroyed`.
- Containers: `{ containerType: "ship"|"market", containerId }`.
- Deployed items use canonical `spatial` and optional `motion`.
- `spatial` shape: `{ solarSystemId, frame: "barycentric", positionKm, epochMs }`.
- `motion` shape (optional): `{ velocityKmPerSec }`.
- Contained items are represented with `spatial: null`.

### Celestial Bodies

- Stored in `celestialBodiesById` (and `cb` collection in Mongo).
- Use canonical `spatial` and optional `motion`, plus optional `physical` and `observability`.
- Used as targets for `launch-item-request` (expendable-dart-drone destroys them, yields raw materials).

### Missions

- Progress tracked per-character: `{ missionId, status, ... timestamps }`.
- Canonical mission IDs: `first-target`, `mining-basics`, etc.
- Completing `first-target` unlocks dependent missions.

---

## Testing Conventions

Tests use `node:test` and `node:assert/strict`. No external test framework.

### Test Helpers (`test-support/message-handler-test-helpers.js`)

```js
createTestContext()      // MessageHandlerContext with deterministic id/timestamp
createMockSocket()       // { id, events[], emit(name, payload) }
seedPlayer(context, {    // Add a player + characters to in-memory state
  playerName, sessionKey, characters, ...
})
seedItems(context, [...])            // Add items to itemsById
seedCelestialBodies(context, [...])  // Add bodies to celestialBodiesById
```

`createTestContext` uses:

- `createId`: draws from `['player-1', 'session-1', 'session-2', 'character-1']` sequentially
- `getCurrentTimestamp`: always returns `'2026-04-17T00:00:00.000Z'`

### Test File Conventions

- `test/<handler-name>.test.js` — unit tests for a single handler/domain concern
- `test/server.test.js` — Socket.IO integration tests using a real `createServer()` and client
- Each test is a top-level `test(...)` call, no `describe` blocks
- Handler unit tests import the handler class and `createTestContext()` directly — no HTTP/socket involved

### Coverage Target

Line coverage target is ≥ 80%. Run with:

```
npm test -- --experimental-test-coverage
```

---

## Environment Variables

| Variable      | Default | Description                         |
| ------------- | ------- | ----------------------------------- |
| `PORT`        | `3000`  | Server listen port                  |
| `MONGODB_URI` | (none)  | If set, enables MongoDB persistence |
| `CORS_ORIGIN` | `*`     | Socket.IO CORS origin               |

Without `MONGODB_URI`, all state is in-memory and lost on restart.

---

## Important Invariants

1. **Market IDs are stable.** Changing a market ID breaks existing test fixtures and client contracts.
2. **`normalizeCharacter` is the single source of truth** for character shape — call it before returning a character in any response.
3. **Session validation is always first.** Every authenticated handler checks `hasValidSessionAsync` before any state read or mutation.
4. **`createId` is injected.** Tests pass a deterministic queue; production uses `randomUUID`. Never call `randomUUID` directly inside a handler.
5. **Orbit fields always default gracefully.** `normalizeMarketOrbit` fills missing Keplerian elements with zeros — downstream orbital math is always safe to run.
6. **`getCurrentTimestamp` is injected.** Use `this.context.getCurrentTimestamp()` in handlers and context methods, not `new Date().toISOString()` directly, so tests can control time.
