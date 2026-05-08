# Stellar Socket Message Contract

This document describes all Socket.IO message types handled by this server,
including required fields, response payloads, and edge-case behavior.

## General Behavior

- All message payload string fields are trimmed.
- Player lookup is case-insensitive by `playerName`.
- Character operations (`list`, `add`, `delete`, `edit`, `ship-list-request`,
  `game-join`, `add-mission-request`, `list-missions-request`,
  `item-upsert-request`, `item-list-by-container-request`,
  `item-list-by-location-request`, `launch-item-request`,
  `market-list-request`, `market-list-by-location-request`, `market-quote-request`,
  `market-inventory-list-request`, `market-buy-request`,
  `market-sell-request`, `market-ledger-list-request`) require
  a valid session.
- Invalid or missing session for character operations emits:
  - event: `invalid-session`
  - payload: `{ "message": "Invalid session" }`
- Validation failures return response events with `success: false` and a message,
  except invalid session which uses `invalid-session` event.
- Server tracks a game membership model for joined characters with:
  - `joinedAt`
  - `lastMessageReceivedAt`
- For valid character-operation messages, the server refreshes
  `lastMessageReceivedAt` for matching joined character entries.

## Final State

- Canonical spatial contract is hard-cut and stable:
  - Every in-world ship, celestial body, and market response includes `spatial`.
  - `spatial` requires: `solarSystemId`, `frame: "barycentric"`, `positionKm.{x,y,z}`, `epochMs` (number).
  - `motion` is optional and never carries position.
  - When `motion` is present, `velocityKmPerSec.{x,y,z}` is required.
- Canonical response keys:
  - Ship display field is `name`.
  - Celestial body list array is `celestialBodies`.
  - Market site fields are `siteType` and `siteName`.
  - Market position is under `spatial.positionKm`.
  - Market orbit payload is under `trajectory.orbit`.
  - `trajectory.kind` (when present) is `static` or `orbital-elements`.
  - Market distance from query position is `distanceAu` (astronomical units, not km).
  - Location-filtered market responses include a `route` object per market (`in-system`, `gate-route`, or `no-route`).
  - `market-list-response` includes `distanceAu` computed from the solar system barycenter `{x:0,y:0,z:0}`.
  - Ships optionally include a `driveProfile` sub-document when the ship has a configured drive.
- Legacy fields are not canonical and are rejected at request boundaries where applicable:
  - `location`, `kinematics`, root `solarSystemId` on celestial body payloads.
  - `item.kinematics` on item payloads (use `item.spatial` and optional `item.motion`).

## Transition Plan

- No dual-key response transition is active.
- Duplicated response keys:
  - none
- Transition start date:
  - n/a
- Hard sunset date:
  - n/a
- Removal release version:
  - `v2.0.0` (already canonical-only for response keys)
- Internal legacy normalization readers (non-contract behavior) are temporary and scheduled for removal:
  - start date: `2026-05-05`
  - hard sunset date: `2026-06-30T00:00:00Z`
  - removal release version: `v2.1.0`

## Acceptance Test Matrix

- Ship list contract key name:
  - positive: `ship-list-response` includes `ships[].name`
  - negative: `ship-list-response` does not include `ships[].shipName`
- Celestial body list array key:
  - positive: `celestial-body-list-response` includes `celestialBodies`
  - negative: `celestial-body-list-response` does not include `bodies`
- Canonical spatial shape:
  - positive: ship/celestial/market responses include valid `spatial`
  - negative: market responses fail when canonical `spatial`/`trajectory` shape is invalid
- Legacy field rejection:
  - positive: canonical `ship-upsert` and `celestial-body-upsert` payloads succeed
  - negative: legacy `location`/`kinematics`/root celestial `solarSystemId` payload fields are rejected with explicit replacement messages
- Item canonical spatial contract:
  - positive: `item-upsert-request` accepts canonical `item.spatial` (+ optional `item.motion`)
  - negative: `item-upsert-request` rejects legacy `item.kinematics` with explicit replacement guidance
- Item location query contract:
  - positive: `item-list-by-location-response` computes distance from `items[].spatial.positionKm`
  - negative: contained items with `spatial: null` are excluded from radius matches
- Market distance unit (AU):
  - positive: `market-list-by-location-response` includes `markets[].distanceAu` (number)
  - negative: `market-list-by-location-response` does not include `markets[].distanceKm`
  - positive: `market-list-response` includes `markets[].distanceAu` (number)
- Market route descriptor:
  - positive: `market-list-by-location-response` includes `markets[].route` with a `kind` of `in-system`, `gate-route`, or `no-route`
- Ship drive profile:
  - positive: `ship-list-response` includes `ships[].driveProfile` when the ship has a configured drive
  - positive: `ships[].driveProfile` is `null` or absent when the ship has no configured drive

## Event: `register`

- Request event: `register`
- Response event: `register-response`

### Request Payload

- `playerName` (required, non-empty string)
- `email` (required, non-empty string)
- `password` (required, non-empty string)
- `locale` (optional string; normalized as lowercase base language code)
  - Region values are reduced to base language (for example `it-IT` -> `it`)
  - Supported locales: `en`, `it`
  - Unknown or missing locale falls back to `en`

### Success Response

```json
{
  "success": true,
  "message": "Registration successful",
  "playerId": "<uuid>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName, email, and password are required"
}
```

- Duplicate `playerName` (case-insensitive):

```json
{
  "success": false,
  "message": "playerName already exists"
}
```

### Edge Cases

- `playerName` uniqueness is enforced case-insensitively.
- On successful register, an empty character list is initialized for the player.
- On successful register, normalized locale is persisted as player `preferredLocale`.

## Event: `login`

- Request event: `login`
- Response event: `login-response`

### Request Payload

- `playerName` (required, non-empty string)
- `password` (required, non-empty string)
- `locale` (optional string; normalized as lowercase base language code)
  - Region values are reduced to base language (for example `it-IT` -> `it`)
  - Supported locales: `en`, `it`
  - Unknown locale falls back to `en`
  - If omitted, existing stored locale is preserved

### Success Response

```json
{
  "success": true,
  "message": "Login successful",
  "playerId": "<uuid>",
  "sessionKey": "<uuid>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and password are required",
  "reason": "UNKNOWN"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "reason": "PLAYER_NOT_REGISTERED"
}
```

- Password mismatch:

```json
{
  "success": false,
  "message": "Password does not match",
  "reason": "PASSWORD_MISMATCH"
}
```

### Edge Cases

- Login regenerates a fresh `sessionKey` every successful login.
- `playerName` matching is case-insensitive.
- When `locale` is provided on a successful login, player `preferredLocale` is updated using normalized/fallback rules.

## Event: `character-list-request`

- Request event: `character-list-request`
- Response event: `character-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required for valid list response)
- `sessionKey` (required and must match the player)

### Success Response

```json
{
  "success": true,
  "message": "Character list retrieved successfully",
  "playerName": "<canonical player name>",
  "characters": [
    {
      "id": "<character id>",
      "characterName": "<name>",
      "createdAt": "<iso timestamp>",
      "credits": 425,
      "creditLedger": [
        {
          "type": "put",
          "amount": 425,
          "description": "Starting credits",
          "timestamp": "<iso timestamp>",
          "referenceId": null
        }
      ],
      "ships": [
        {
          "id": "<ship id>",
          "name": "<ship name>",
          "status": "active",
          "model": "starter-mk1"
        }
      ],
      "inGame": true,
      "gameJoinedAt": "<iso timestamp>",
      "gameLastMessageReceivedAt": "<iso timestamp>"
    }
  ]
}
```

### Failure and Edge Behavior

- Invalid session emits `invalid-session` instead of `character-list-response`.
- If session is valid but `playerName` is empty:

```json
{
  "success": false,
  "message": "playerName is required",
  "playerName": "",
  "characters": []
}
```

- If session is valid but player is not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>",
  "characters": []
}
```

### Edge Cases

- Returned `characters` array is a defensive copy of server state.

## Event: `character-add-request`

- Request event: `character-add-request`
- Response event: `character-add-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterName` (required)

### Success Response

```json
{
  "success": true,
  "message": "Character added successfully",
  "playerName": "<canonical player name>",
  "characterName": "<provided characterName>",
  "characterId": "<new character id>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterName are required",
  "playerName": ""
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>"
}
```

- Database error during creation:

```json
{
  "success": false,
  "message": "Failed to add character: database error",
  "playerName": "<canonical player name>"
}
```

### Edge Cases

- On success, a starter ship (`Scavenger Pod`, Tier 1) is created and attached to the character.
- An initial `first-target` mission is seeded with status `available`.
- The character is initialized with a starting balance of **425 credits**, recorded as a `put` ledger entry with description `"Starting credits"`.
- `credits` is always a computed sum: `sum(put amounts) - sum(take amounts)` across the `creditLedger` array.
- If item creation fails, starter items are rolled back before the error response is returned.

## Credit Ledger

Each character carries a `creditLedger` array and a computed `credits` summary field.

### Ledger Entry Shape

```json
{
  "type": "put",
  "amount": 425,
  "description": "Starting credits",
  "timestamp": "<iso timestamp>",
  "referenceId": null
}
```

- `type` — `"put"` (credits in) or `"take"` (credits out)
- `amount` — positive number
- `description` — human-readable reason for the transaction
- `timestamp` — ISO 8601 timestamp of the transaction
- `referenceId` — optional identifier linking to a source event (mission, market item, etc.); `null` when not applicable

### `credits` Field

- Always computed from the ledger: `credits = sum(put.amount) - sum(take.amount)`
- Never stored independently; recalculated on every `normalizeCharacter` call
- Characters with no ledger entries have `credits: 0` and `creditLedger: []`

## Event: `market-list-request`

- Request event: `market-list-request`
- Response event: `market-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `solarSystemId` (optional string filter)

### Success Response

```json
{
  "success": true,
  "message": "Market list retrieved successfully",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "markets": [
    {
      "marketId": "sol-ceres-exchange",
      "solarSystemId": "sol",
      "marketName": "Ceres Exchange",
      "siteType": "station",
      "siteName": "Ceres Belt Trade Ring",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 123.45, "y": -22.1, "z": 0.9 },
        "epochMs": 1776384000000
      },
      "trajectory": {
        "kind": "orbital-elements",
        "orbit": {
          "anchorBodyId": "ceres",
          "semiMajorAxisKm": 480,
          "eccentricity": 0.006,
          "inclinationDeg": 2.1,
          "longitudeOfAscendingNodeDeg": 95,
          "argumentOfPeriapsisDeg": 12,
          "meanAnomalyAtEpochDeg": 8,
          "orbitalPeriodSec": 21600,
          "epoch": "<iso timestamp>"
        }
      },
      "distanceAu": 2.766,
      "priceMultiplier": 1,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    }
  ]
}
```

### Failure Responses

- Missing `playerName`:

```json
{
  "success": false,
  "message": "playerName is required",
  "playerName": "",
  "markets": []
}
```

- Unregistered player:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>",
  "markets": []
}
```

### Edge Cases

- Invalid session emits `invalid-session` instead of `market-list-response`.
- Omitting `solarSystemId` returns markets across all solar systems.
- Market stock is restocked lazily on reads based on `restockIntervalMinutes`.
- Each market includes `distanceAu` (astronomical units, rounded to 3 decimal places) computed from the solar system barycenter `{x:0,y:0,z:0}` using the market's current `spatial.positionKm`.

## Event: `market-list-by-location-request`

- Request event: `market-list-by-location-request`
- Response event: `market-list-by-location-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `solarSystemId` (required)
- `positionKm` (required object with numeric `x`, `y`, `z`)
- `distanceAu` (required number in astronomical units, must be `>= 0`; replaces the former `distanceKm` field)
- `limit` (optional positive integer)
- `locationTypes` (optional array of non-empty strings; case-insensitive match)
- `characterId` (optional; required to compute docking state)
- `shipId` (optional; when omitted server uses the character's first ship)

### Success Response

```json
{
  "success": true,
  "message": "Local market list retrieved successfully",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceAu": 0.001,
  "locationTypes": ["station"],
  "isDocked": false,
  "dockedMarketId": null,
  "markets": [
    {
      "marketId": "sol-ceres-exchange",
      "solarSystemId": "sol",
      "marketName": "Ceres Exchange",
      "siteType": "station",
      "siteName": "Ceres Belt Trade Ring",
      "isStarterMarket": true,
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 123.45, "y": -22.1, "z": 0.9 },
        "epochMs": 1776384000000
      },
      "trajectory": {
        "kind": "orbital-elements",
        "orbit": {
          "anchorBodyId": "ceres",
          "semiMajorAxisKm": 480,
          "eccentricity": 0.006,
          "inclinationDeg": 2.1,
          "longitudeOfAscendingNodeDeg": 95,
          "argumentOfPeriapsisDeg": 12,
          "meanAnomalyAtEpochDeg": 8,
          "orbitalPeriodSec": 21600,
          "epoch": "<iso timestamp>"
        }
      },
      "distanceAu": 0.032,
      "route": { "kind": "in-system" },
      "isDocked": false,
      "priceMultiplier": 1,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    },
    {
      "marketId": "ac-proxima-station",
      "solarSystemId": "alpha-centauri",
      "marketName": "Proxima Gateway Market",
      "siteType": "station",
      "siteName": "Proxima Centauri Orbital Market",
      "isStarterMarket": true,
      "spatial": {
        "solarSystemId": "alpha-centauri",
        "frame": "barycentric",
        "positionKm": { "x": 3200, "y": 0, "z": 0 },
        "epochMs": 1776384000000
      },
      "trajectory": {
        "kind": "orbital-elements",
        "orbit": {
          "anchorBodyId": "ac-proxima",
          "semiMajorAxisKm": 3200,
          "eccentricity": 0.02,
          "inclinationDeg": 0,
          "longitudeOfAscendingNodeDeg": 0,
          "argumentOfPeriapsisDeg": 0,
          "meanAnomalyAtEpochDeg": 0,
          "orbitalPeriodSec": 95000,
          "epoch": "<iso timestamp>"
        }
      },
      "distanceAu": null,
      "route": { "kind": "gate-route", "hops": 1 },
      "isDocked": false,
      "priceMultiplier": 1.12,
      "driftPercentPerHour": 6,
      "restockIntervalMinutes": 60
    }
  ]
}
```

When no markets are found inside radius, the response remains successful:

```json
{
  "success": true,
  "message": "No markets found within distance",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceAu": 0.001,
  "locationTypes": [],
  "isDocked": false,
  "dockedMarketId": null,
  "markets": []
}
```

### Failure Responses

- Missing or invalid required radius inputs:

```json
{
  "success": false,
  "message": "playerName, solarSystemId, positionKm, and distanceAu are required",
  "playerName": "<provided playerName>",
  "solarSystemId": "<provided solarSystemId>",
  "markets": [],
  "isDocked": false,
  "dockedMarketId": null
}
```

- Invalid `limit` format:

```json
{
  "success": false,
  "message": "limit must be a positive integer when provided",
  "playerName": "<provided playerName>",
  "solarSystemId": "<provided solarSystemId>",
  "markets": [],
  "isDocked": false,
  "dockedMarketId": null
}
```

- Invalid `locationTypes` format:

```json
{
  "success": false,
  "message": "locationTypes must be an array of non-empty strings when provided",
  "playerName": "<provided playerName>",
  "solarSystemId": "<provided solarSystemId>",
  "markets": [],
  "isDocked": false,
  "dockedMarketId": null
}
```

### Edge Cases

- Invalid session emits `invalid-session` instead of `market-list-by-location-response`.
- Distances are authoritative and server-computed from market spatial state (or trajectory-derived position) and request `positionKm`.
- Distance is expressed as `distanceAu` (astronomical units, rounded to 3 decimal places; 1 AU = 149,597,870.7 km).
- Each market in the response includes a `route` object describing how to reach the market's solar system:
  - `{ "kind": "in-system" }` — market is in the same solar system as the request.
  - `{ "kind": "gate-route", "hops": <N> }` — market is reachable via N jump-gate hops.
  - `{ "kind": "no-route" }` — market's solar system is not reachable from the request solar system.
- Results are sorted: in-system markets first (nearest-first by km distance), then `gate-route` markets (fewest hops first), then `no-route` markets. `limit` is applied after sorting.
- Cross-system markets (different `solarSystemId` than the request) are always included; their `distanceAu` is `null` since in-system distances are not applicable.
- If `characterId` (and optional `shipId`) is supplied, response docking state indicates whether the specified ship is currently docked at one of the returned markets.

## Event: `market-quote-request`

- Request event: `market-quote-request`
- Response event: `market-quote-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required; must belong to the player)
- `sessionKey` (required and must match the player)
- `marketId` (required)
- `solarSystemId` (required)
- `itemId` (required; market catalog item id)
- `direction` (required; `buy` or `sell`)
- `quantity` (required positive integer)
- `requestId` (optional idempotency/request correlation token; echoed in response)

### Success Response

```json
{
  "success": true,
  "message": "Market quote retrieved successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "requestId": "<optional request id>",
  "quote": {
    "marketId": "sol-ceres-exchange",
    "solarSystemId": "sol",
    "itemId": "iron",
    "itemType": "raw-material",
    "displayName": "Iron",
    "rarity": "Common",
    "direction": "buy",
    "quantity": 5,
    "unitPrice": 29,
    "totalPrice": 145,
    "availableStock": 1200,
    "marketCanBuy": true,
    "marketCanSell": true,
    "marketMultiplier": 1,
    "driftMultiplier": 0.97,
    "quotedAt": "<iso timestamp>"
  }
}
```

### Failure Responses

```json
{
  "success": false,
  "message": "direction must be buy or sell",
  "reason": "INVALID_DIRECTION",
  "requestId": "<optional request id>"
}
```

Possible `reason` values:

- `INVALID_PAYLOAD`
- `PLAYER_NOT_REGISTERED`
- `CHARACTER_NOT_FOUND`
- `MARKET_NOT_FOUND`
- `ITEM_NOT_FOUND`
- `ITEM_NOT_TRADEABLE`
- `INVALID_DIRECTION`
- `INVALID_QUANTITY`
- `MARKET_DOES_NOT_BUY_ITEM`

### Edge Cases

- Invalid session emits `invalid-session` instead of `market-quote-response`.
- Price is evaluated at execution-time quote request (not pre-locked).
- Unit price is the market midpoint after applying market multiplier and hourly deterministic drift.
- Buy and sell currently use the same midpoint pricing model in phase 1.

## Event: `market-inventory-list-request`

- Request event: `market-inventory-list-request`
- Response event: `market-inventory-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `marketId` (required)
- `solarSystemId` (required)
- `offset` (optional non-negative integer; default `0`)
- `limit` (optional positive integer; default `50`)

### Success Response

```json
{
  "success": true,
  "message": "Market inventory retrieved successfully",
  "playerName": "<canonical player name>",
  "marketId": "sol-ceres-exchange",
  "solarSystemId": "sol",
  "marketName": "Ceres Exchange",
  "inventory": [
    {
      "itemId": "iron",
      "itemType": "raw-material",
      "displayName": "Iron",
      "rarity": "Common",
      "stock": 1198,
      "maxStock": 1200,
      "restockPerInterval": 96,
      "marketCanBuy": true,
      "marketCanSell": true
    }
  ],
  "total": 21,
  "offset": 0,
  "limit": 50,
  "asOf": "<iso timestamp>"
}
```

## Event: `market-buy-request`

- Request event: `market-buy-request`
- Response event: `market-buy-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `sessionKey` (required and must match the player)
- `marketId` (required)
- `solarSystemId` (required)
- `itemId` (required)
- `quantity` (required positive integer)
- `requestId` (optional, echoed)
- `transactionId` (optional idempotency/trace id; autogenerated when omitted)

### Success Response

```json
{
  "success": true,
  "message": "Market buy transaction completed",
  "requestId": "buy-1",
  "transaction": {
    "transactionId": "<id>",
    "requestId": "buy-1",
    "marketId": "sol-ceres-exchange",
    "solarSystemId": "sol",
    "characterId": "<character id>",
    "itemId": "iron",
    "direction": "buy",
    "quantity": 3,
    "unitPrice": 29,
    "totalPrice": 87,
    "timestamp": "<iso timestamp>",
    "characterCredits": 338,
    "marketStock": 1197
  }
}
```

### Failure Reasons

- `INVALID_PAYLOAD`
- `PLAYER_NOT_REGISTERED`
- `CHARACTER_NOT_FOUND`
- `MARKET_NOT_FOUND`
- `ITEM_NOT_FOUND`
- `ITEM_NOT_TRADEABLE`
- `INSUFFICIENT_CREDITS`
- `INSUFFICIENT_MARKET_STOCK`
- `NO_SHIP_AVAILABLE`
- `PARTIAL_WRITE_REVERSED`
- `TRANSACTION_FAILED`

## Event: `market-sell-request`

- Request event: `market-sell-request`
- Response event: `market-sell-response`
- Session failure event: `invalid-session`

### Request Payload

- Same as `market-buy-request` except direction is implied as sell by event type.

### Success Response

- Same `transaction` shape as `market-buy-response`, with `direction: "sell"`.

### Failure Reasons

- `INVALID_PAYLOAD`
- `PLAYER_NOT_REGISTERED`
- `CHARACTER_NOT_FOUND`
- `MARKET_NOT_FOUND`
- `ITEM_NOT_FOUND`
- `ITEM_NOT_TRADEABLE`
- `MARKET_DOES_NOT_BUY_ITEM`
- `INSUFFICIENT_ITEM_QUANTITY`
- `PARTIAL_WRITE_REVERSED`
- `TRANSACTION_FAILED`

## Event: `market-ledger-list-request`

- Request event: `market-ledger-list-request`
- Response event: `market-ledger-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `marketId` (required)
- `solarSystemId` (required)
- `characterId` (optional)
- `itemId` (optional)
- `direction` (optional; `buy`, `sell`, `reversal`)
- `startAt` (optional inclusive ISO timestamp)
- `endAt` (optional inclusive ISO timestamp)
- `offset` (optional non-negative integer; default `0`)
- `limit` (optional positive integer; default `50`)

### Success Response

```json
{
  "success": true,
  "message": "Market ledger retrieved successfully",
  "playerName": "<canonical player name>",
  "marketId": "sol-ceres-exchange",
  "solarSystemId": "sol",
  "entries": [
    {
      "transactionId": "<id>",
      "requestId": "buy-1",
      "characterId": "<character id>",
      "itemId": "iron",
      "direction": "buy",
      "quantity": 3,
      "unitPrice": 29,
      "totalPrice": 87,
      "timestamp": "<iso timestamp>",
      "reversalOfTransactionId": null
    }
  ],
  "total": 2,
  "offset": 0,
  "limit": 50
}
```

### Edge Behavior

- Ledger is append-only.
- If one ledger write succeeds and another fails, a reversal is appended where possible and response reason is `PARTIAL_WRITE_REVERSED`.

## Event: `celestial-body-upsert-request`

- Request event: `celestial-body-upsert-request`
- Response event: `celestial-body-upsert-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `celestialBody` (required object)
  - `id` (optional, stable unique identifier)
  - `catalogId` (required)
  - `sourceScanId` (required)
  - `createdByCharacterId` (required and must match a character belonging to the player)
  - `missionId` (optional string; recommended for mission-scoped asteroid fields)
  - `missionInstanceId` (optional string)
  - `createdAt` (required ISO timestamp)
  - `updatedAt` (required ISO timestamp)
  - `spatial.solarSystemId` (required)
  - `spatial.frame` (required; must be `barycentric`)
  - `spatial.positionKm.x|y|z` (required numbers)
  - `spatial.epochMs` (required number)
  - `motion.velocityKmPerSec.x|y|z` (optional numbers)
  - `motion.angularVelocityRadPerSec.x|y|z` (optional numbers)
  - `physical.estimatedMassKg` (optional number)
  - `physical.estimatedDiameterM` (optional number)
  - `observability.visibility` (required; one of `visible`, `not-visible`, `cloaked`)
  - `observability.scanState` (required; one of `unscanned`, `scanned`)
  - `composition` (required for `state=active|destroyed`; optional for `state=unscanned`)
    - `rarity` (one of `Common`, `Uncommon`, `Rare`, `Exotic`)
    - `material` (string)
    - `textureColor` (string)
  - `state` (optional; one of `unscanned`, `active`, `destroyed`; defaults to `active`)

### Success Response

```json
{
  "success": true,
  "message": "Celestial body recorded successfully",
  "playerName": "<canonical player name>",
  "celestialBody": {
    "id": "<celestial body id>",
    "catalogId": "<catalog id>",
    "sourceScanId": "<scan id>",
    "createdByCharacterId": "<character id>",
    "missionId": "first-target",
    "missionInstanceId": null,
    "createdAt": "<iso timestamp>",
    "updatedAt": "<iso timestamp>",
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 1, "y": 2, "z": 3 },
      "epochMs": 1776384000000
    },
    "motion": {
      "velocityKmPerSec": { "x": 1, "y": 2, "z": 3 },
      "angularVelocityRadPerSec": { "x": 0.1, "y": 0.2, "z": 0.3 }
    },
    "physical": {
      "estimatedMassKg": 42000000000,
      "estimatedDiameterM": 320
    },
    "observability": {
      "visibility": "visible",
      "scanState": "scanned"
    },
    "composition": {
      "rarity": "Rare",
      "material": "Nickel-Iron",
      "textureColor": "#8df7b2"
    },
    "state": "unscanned"
  }
}
```

### Success Response Example (Unscanned Mission Seed)

```json
{
  "success": true,
  "message": "Celestial body recorded successfully",
  "playerName": "<canonical player name>",
  "celestialBody": {
    "id": "cb-character-1-first-target-sample-a3",
    "sourceScanId": "sample-a3",
    "state": "unscanned",
    "missionId": "first-target",
    "composition": {
      "material": "Iron",
      "rarity": "Common",
      "textureColor": "#8f99a7"
    }
  }
}
```

### Failure and Edge Behavior

- Invalid session emits `invalid-session` instead of `celestial-body-upsert-response`.
- Missing required payload data returns:

```json
{
  "success": false,
  "message": "playerName and a complete canonical celestialBody payload are required",
  "playerName": "<provided playerName or empty string>"
}
```

- Legacy field rejection (`location`):

```json
{
  "success": false,
  "message": "CelestialBodyUpsert: legacy field 'location' is not supported. Use 'spatial' instead.",
  "playerName": "<provided playerName>"
}
```

- Legacy field rejection (`kinematics`):

```json
{
  "success": false,
  "message": "CelestialBodyUpsert: legacy field 'kinematics' is not supported. Use 'motion' and/or 'physical' instead.",
  "playerName": "<provided playerName>"
}
```

- Legacy field rejection (root `solarSystemId`):

```json
{
  "success": false,
  "message": "CelestialBodyUpsert: legacy field 'solarSystemId' is not supported. Use 'spatial.solarSystemId' instead.",
  "playerName": "<provided playerName>"
}
```

- If the player is not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>"
}
```

- If `createdByCharacterId` does not belong to the player:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>"
}
```

### Edge Cases

- Upsert identity supports either:
  - `celestialBody.id` (preferred deterministic key), or
  - derived deterministic id from `sourceScanId + createdByCharacterId + missionId` when `id` is omitted.
- Incoming `createdAt` and `updatedAt` are preserved as provided.
- Celestial bodies are not stored under player documents; they are persisted in the separate Mongo collection `cb`.
- Lifecycle states are backend-authoritative: `unscanned -> active -> destroyed`.

## Event: `celestial-body-list-request`

- Request event: `celestial-body-list-request`
- Response event: `celestial-body-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `solarSystemId` (required string)
- `positionKm` (required object)
  - `x` (required finite number)
  - `y` (required finite number)
  - `z` (required finite number)
- `distanceKm` (required finite number, must be `>= 0`)
- `limit` (optional; positive integer when provided)
- `states` (optional array; each value one of `unscanned`, `active`, `destroyed`)
- `createdByCharacterId` (optional string)
- `missionId` (optional string; recommended for mission-scoped asteroid field queries)

### Success Response

```json
{
  "success": true,
  "message": "Celestial body list retrieved successfully",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "celestialBodies": [
    {
      "id": "<celestial body id>",
      "catalogId": "<catalog id>",
      "sourceScanId": "<scan id>",
      "createdByCharacterId": "<character id>",
      "missionId": "first-target",
      "missionInstanceId": null,
      "createdAt": "<iso timestamp>",
      "updatedAt": "<iso timestamp>",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 1, "y": 2, "z": 3 },
        "epochMs": 1776384000000
      },
      "motion": {
        "velocityKmPerSec": { "x": 1, "y": 2, "z": 3 }
      },
      "physical": {
        "estimatedMassKg": 42000000000,
        "estimatedDiameterM": 320
      },
      "observability": {
        "visibility": "visible",
        "scanState": "scanned"
      },
      "composition": {
        "rarity": "Rare",
        "material": "Nickel-Iron",
        "textureColor": "#8df7b2"
      },
      "state": "active",
      "destroyedAt": null,
      "destroyedReason": null,
      "debrisSeed": null,
      "debris": [],
      "distanceKm": 3.74
    }
  ]
}
```

### Success Response Example (Including Unscanned)

```json
{
  "success": true,
  "message": "Celestial body list retrieved successfully",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "celestialBodies": [
    {
      "id": "cb-1",
      "state": "unscanned",
      "sourceScanId": "sample-a1",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 1, "y": 0, "z": 0 },
        "epochMs": 1776384000000
      }
    },
    {
      "id": "cb-2",
      "state": "active",
      "sourceScanId": "sample-a2",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 2, "y": 0, "z": 0 },
        "epochMs": 1776384000000
      }
    }
  ]
}
```

### Empty-Match Success Response

```json
{
  "success": true,
  "message": "No celestial bodies found within distance",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "celestialBodies": []
}
```

### Failure and Edge Behavior

- Invalid session emits `invalid-session` instead of `celestial-body-list-response`.
- Missing/invalid required search fields return:

```json
{
  "success": false,
  "message": "playerName, solarSystemId, positionKm, and distanceKm are required",
  "playerName": "<provided playerName or empty string>",
  "solarSystemId": "<provided solarSystemId or empty string>",
  "celestialBodies": []
}
```

- Invalid optional `limit` returns:

```json
{
  "success": false,
  "message": "limit must be a positive integer when provided",
  "playerName": "<provided playerName or empty string>",
  "solarSystemId": "<provided solarSystemId or empty string>",
  "celestialBodies": []
}
```

- Invalid optional `states` returns:

```json
{
  "success": false,
  "message": "states must be an array with values from: unscanned, active, destroyed",
  "playerName": "<provided playerName or empty string>",
  "solarSystemId": "<provided solarSystemId or empty string>",
  "celestialBodies": []
}
```

- If the player is not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>",
  "solarSystemId": "<provided solarSystemId>",
  "celestialBodies": []
}
```

### Edge Cases

- Match inclusion is spherical and inclusive of the boundary (`distance <= distanceKm`).
- Distance is calculated in kilometers using 3D Euclidean distance from `positionKm`.
- Results are sorted nearest-first by computed `distanceKm`.
- `limit` is applied after filtering and sorting.
- By default, list includes all lifecycle states (`unscanned`, `active`, `destroyed`) unless `states` filter is provided.
- `createdByCharacterId` and `missionId` can be used together to scope a mission-specific asteroid field.

### Success Response

```json
{
  "success": true,
  "message": "Character added successfully",
  "playerName": "<canonical player name>",
  "characterName": "<character name>",
  "characterId": "<uuid>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterName are required",
  "playerName": "<trimmed playerName or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Added character stores `id`, `characterName`, and `createdAt`.
- New characters are initialized with at least one starter ship in `ships`.
- New characters are initialized with mission progress containing
  `The First Target` in status `available`.

## Event: `add-mission-request`

- Request event: `add-mission-request`
- Response event: `add-mission-response`
- Alias request event: `mission-upsert-request`
- Alias response event: `mission-upsert-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `missionId` (required)
- `sessionKey` (required and must match the player)
- `status` (required; one of `available`, `started`, `in-progress`, `failed`, `completed`, `locked`, `abandoned`, `paused`, `turned-in`)
- `statusDetail` (optional string; persisted exactly as provided)
- `requestId` (optional string; echoed in response when present)

Mission catalog IDs:

- `first-target`
- `m-01`
- `m-02`
- `m-03`
- `m-04`
- `m-05`
- `sq-01`
- `sq-02`
- `sq-03`
- `sq-04`

Prerequisite graph:

- `first-target` -> `m-01`, `sq-02`, `sq-03`
- `m-01` -> `m-02`
- `m-02` -> `m-03`, `sq-01`
- `m-03` -> `m-04`
- `m-04` -> `m-05`, `sq-04`

### Success Response

```json
{
  "success": true,
  "message": "Mission recorded successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "requestId": "<optional echo when provided>",
  "mission": {
    "missionId": "<mission id>",
    "status": "<mission status>",
    "updatedAt": "<iso timestamp>",
    "startedAt": "<optional when status is started>",
    "inProgressAt": "<optional when status is in-progress>",
    "failedAt": "<optional when status is failed>",
    "completedAt": "<optional when status is completed>",
    "failureReason": "<optional failure reason>",
    "statusDetail": "<optional status detail>"
  }
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName, characterId, missionId, and status are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>"
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Mission progress is scoped to a character.
- Re-adding the same `missionId` updates the existing mission progress (idempotent upsert; no duplicate mission rows for a mission/character pair).
- On status transition to `completed` or `turned-in`, the server evaluates prerequisites and auto-creates newly unlocked missions as `available` when missing (idempotent; retries do not create duplicates).
- For `missionId=first-target`, transition to `started`/`in-progress` seeds a backend-owned asteroid field as celestial-body records with `state=unscanned` (idempotent; no duplicate spawns on repeated start calls).
- Mission payload remains status progression only; asteroid world-state is persisted and queried through celestial-body events.

## Event: `list-missions-request`

- Request event: `list-missions-request`
- Response event: `list-missions-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `sessionKey` (required and must match the player)
- `statuses` (optional list of statuses to filter)
- `requestId` (optional string; echoed in response when present)

### Success Response

```json
{
  "success": true,
  "message": "Mission list retrieved successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "requestId": "<optional echo when provided>",
  "missions": [
    {
      "missionId": "<mission id>",
      "status": "<mission status>",
      "startedAt": "<optional started timestamp>",
      "inProgressAt": "<optional in-progress timestamp>",
      "failedAt": "<optional failed timestamp>",
      "completedAt": "<optional completed timestamp>",
      "updatedAt": "<optional updated timestamp>",
      "failureReason": "<optional failure reason>",
      "statusDetail": "<optional status detail>"
    }
  ]
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterId are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>",
  "missions": []
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>",
  "missions": []
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>",
  "missions": []
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Mission list is scoped to the requested character.
- `statuses` filter is optional.
- Missions are returned as an array and sorted deterministically by catalog order.
- Returned `missions` list is a defensive copy of server state.

## Event: `ship-list-request`

- Request event: `ship-list-request`
- Response event: `ship-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `sessionKey` (required and must match the player)

### Success Response

```json
{
  "success": true,
  "message": "Ship list retrieved successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "ships": [
    {
      "id": "<ship id>",
      "name": "<ship name>",
      "status": "<status string or null>",
      "model": "<ship model, e.g. Scavenger Pod>",
      "tier": 1,
      "inventory": [
        {
          "id": "<item id>",
          "itemType": "expendable-dart-drone",
          "displayName": "Expendable Dart Drone",
          "state": "contained",
          "damageStatus": "intact",
          "container": {
            "containerType": "ship",
            "containerId": "<ship id>"
          },
          "owningPlayerId": "<player id>",
          "owningCharacterId": "<character id>",
          "spatial": null,
          "launchable": true
        }
      ],
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 100.5, "y": 200.3, "z": 50.1 },
        "epochMs": 1713607200000
      },
      "motion": {
        "velocityKmPerSec": { "x": 0.5, "y": -0.2, "z": 0.1 }
      },
      "launchable": true,
      "damageProfile": {
        "overallStatus": "damaged",
        "summary": "Hull breach in sector 4",
        "origin": "combat",
        "updatedAt": "2026-04-28T10:00:00.000Z",
        "systems": [
          {
            "code": "hull",
            "label": "Hull Integrity",
            "severity": "major",
            "summary": "Breach detected",
            "repairPriority": 1
          }
        ]
      },
      "driveProfile": {
        "id": "standard-cruise",
        "name": "Standard Cruise Drive",
        "rangeAu": 10,
        "cruiseSpeedAuPerHour": 0.5,
        "fuelCostPerAu": 2.5
      }
    }
  ]
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterId are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>",
  "ships": []
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>",
  "ships": []
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>",
  "ships": []
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Ships are scoped per character.
- Returned `ships` list is a defensive copy of server state.
- `driveProfile` is included on each ship when the ship has a configured drive; it is `null` or absent otherwise.
- All `driveProfile` numeric fields (`rangeAu`, `cruiseSpeedAuPerHour`, `fuelCostPerAu`) must be positive and finite; invalid profiles are silently dropped (field omitted or `null`).

## Event: `ship-upsert-request`

- Request event: `ship-upsert-request`
- Response event: `ship-upsert-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `sessionKey` (required and must match the player)
- `ship` (required object)
  - `id` (required; must exist in the character's ship list)
  - `model` (optional string; ship model name)
  - `tier` (optional integer 1–10; ship tier)
  - `status` (optional string; current ship status label, e.g. `"docked"` or `"in-flight"`; trimmed; omit to preserve stored value)
  - `inventory` is server-managed; responses return hydrated item objects and persistence stores item references
  - `spatial.solarSystemId` (optional; required if `motion` omitted and no `model`/`tier`/`status`/`damageProfile`)
  - `spatial.frame` (optional string, defaults to `"barycentric"`)
  - `spatial.positionKm.x|y|z` (optional numbers; required when `spatial` is provided)
  - `spatial.epochMs` (optional number; required when `spatial` is provided)
  - `motion.velocityKmPerSec.x|y|z` (optional numbers)
  - `launchable` (optional boolean; whether the ship can be launched; defaults to `true`)
  - `damageProfile` (optional object or `null`; omit to preserve stored profile; send `null` to clear it)
    - `overallStatus` (required string; one of `intact`, `damaged`, `disabled`, `destroyed`)
    - `summary` (required non-empty string)
    - `origin` (required string; one of `cold-boot-scripted`, `combat`, `wear`, `unknown`)
    - `updatedAt` (required non-empty string; ISO timestamp)
    - `systems` (required array of subsystem entries)
      - Each entry: `code` (non-empty string), `label` (non-empty string), `severity` (`minor`|`major`|`critical`), `summary` (non-empty string), `repairPriority` (integer)

### Success Response

```json
{
  "success": true,
  "message": "Ship updated successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "ship": {
    "id": "<ship id>",
    "name": "<ship name>",
    "status": "<status string or null>",
    "model": "<ship model>",
    "tier": 1,
    "inventory": [
      {
        "id": "<item id>",
        "itemType": "expendable-dart-drone",
        "displayName": "Expendable Dart Drone",
        "state": "contained",
        "damageStatus": "intact",
        "container": {
          "containerType": "ship",
          "containerId": "<ship id>"
        },
        "owningPlayerId": "<player id>",
        "owningCharacterId": "<character id>",
        "spatial": null,
        "launchable": true
      }
    ],
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 100.5, "y": 200.3, "z": 50.1 },
      "epochMs": 1713607200000
    },
    "motion": {
      "velocityKmPerSec": { "x": 0.5, "y": -0.2, "z": 0.1 }
    },
    "launchable": true,
    "damageProfile": {
      "overallStatus": "damaged",
      "summary": "Hull breach in sector 4",
      "origin": "combat",
      "updatedAt": "2026-04-28T10:00:00.000Z",
      "systems": [
        {
          "code": "hull",
          "label": "Hull Integrity",
          "severity": "major",
          "summary": "Breach detected",
          "repairPriority": 1
        }
      ]
    }
  }
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName, characterId, and ship.id are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>"
}
```

- Missing update payload:

```json
{
  "success": false,
  "message": "ship.spatial, ship.motion, ship.model, and/or ship.tier is required",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Invalid update payload:

```json
{
  "success": false,
  "message": "ship spatial/motion payload is invalid",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Legacy field rejection (`location`):

```json
{
  "success": false,
  "message": "ShipUpsert: legacy field 'location' is not supported. Use 'spatial' instead.",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Legacy field rejection (`kinematics`):

```json
{
  "success": false,
  "message": "ShipUpsert: legacy field 'kinematics' is not supported. Use 'motion' instead.",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Invalid `status` type:

```json
{
  "success": false,
  "message": "ship.status must be a string",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Invalid `damageProfile` field:

```json
{
  "success": false,
  "message": "damageProfile.<fieldName> must be ...",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>"
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

- Ship not found in character list:

```json
{
  "success": false,
  "message": "Ship is not in character list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- `ship-upsert` only mutates a ship already owned by the specified character.
- Ship inventory is persisted as item references but returned as hydrated item objects in ship responses.
- Legacy request fields `ship.location` and `ship.kinematics` are rejected; use `ship.spatial` and `ship.motion`.
- `status` and `damageProfile` use patch semantics: omitting a field preserves the stored value; sending `damageProfile: null` explicitly clears it.
- Ships without a stored `damageProfile` return `damageProfile: null`.
- At least one of `spatial`, `motion`, `model`, `tier`, `status`, or `damageProfile` must be present in the update payload.

## Canonical Detail Payload Examples

The following examples define canonical entity payloads used by list/detail/upsert responses.

### `ship-details-response` Example

```json
{
  "success": true,
  "message": "Ship details retrieved successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "ship": {
    "id": "<ship id>",
    "name": "<ship name>",
    "status": "active",
    "model": "Scavenger Pod",
    "tier": 1,
    "inventory": [],
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 0, "y": 0, "z": 0 },
      "epochMs": 1776384000000
    },
    "motion": {
      "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 }
    },
    "launchable": true,
    "damageProfile": null
  }
}
```

### `celestial-body-details-response` Example

```json
{
  "success": true,
  "message": "Celestial body details retrieved successfully",
  "celestialBody": {
    "id": "<celestial body id>",
    "catalogId": "<catalog id>",
    "sourceScanId": "<scan id>",
    "createdByCharacterId": "<character id>",
    "missionId": null,
    "missionInstanceId": null,
    "createdAt": "<iso timestamp>",
    "updatedAt": "<iso timestamp>",
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 10, "y": 20, "z": 30 },
      "epochMs": 1776384000000
    },
    "motion": {
      "velocityKmPerSec": { "x": 1, "y": 2, "z": 3 }
    },
    "physical": {
      "estimatedMassKg": 42000000000,
      "estimatedDiameterM": 320
    },
    "observability": {
      "visibility": "visible",
      "scanState": "scanned"
    },
    "composition": {
      "rarity": "Rare",
      "material": "Nickel-Iron",
      "textureColor": "#8df7b2"
    },
    "state": "active",
    "destroyedAt": null,
    "destroyedReason": null
  }
}
```

### `market-details-response` Example

```json
{
  "success": true,
  "message": "Market details retrieved successfully",
  "market": {
    "marketId": "sol-ceres-exchange",
    "solarSystemId": "sol",
    "marketName": "Ceres Exchange",
    "siteType": "station",
    "siteName": "Ceres Belt Trade Ring",
    "isStarterMarket": true,
    "spatial": {
      "solarSystemId": "sol",
      "frame": "barycentric",
      "positionKm": { "x": 123.45, "y": -22.1, "z": 0.9 },
      "epochMs": 1776384000000
    },
    "trajectory": {
      "kind": "orbital-elements",
      "orbit": {
        "anchorBodyId": "ceres",
        "semiMajorAxisKm": 480,
        "eccentricity": 0.006,
        "inclinationDeg": 2.1,
        "longitudeOfAscendingNodeDeg": 95,
        "argumentOfPeriapsisDeg": 12,
        "meanAnomalyAtEpochDeg": 8,
        "orbitalPeriodSec": 21600,
        "epoch": "<iso timestamp>"
      }
    },
    "priceMultiplier": 1,
    "driftPercentPerHour": 6,
    "restockIntervalMinutes": 60
  }
}
```

### `character-list-response` Ship Object Shape

```json
{
  "id": "<ship id>",
  "name": "<ship name>",
  "status": "active",
  "model": "Scavenger Pod",
  "tier": 1,
  "inventory": [],
  "spatial": {
    "solarSystemId": "sol",
    "frame": "barycentric",
    "positionKm": { "x": 0, "y": 0, "z": 0 },
    "epochMs": 1776384000000
  },
  "motion": {
    "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 }
  },
  "launchable": true,
  "damageProfile": null
}
```

## Event: `character-delete-request`

- Request event: `character-delete-request`
- Response event: `character-delete-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterId` (required)

### Success Response

```json
{
  "success": true,
  "message": "Character deleted successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterId are required",
  "playerName": "<trimmed playerName or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>"
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Character removal is scoped to that player only.

## Event: `character-edit`

- Request event: `character-edit`
- Response event: `character-edit-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterId` (required)
- `characterName` (required)

### Success Response

```json
{
  "success": true,
  "message": "Character edited successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "characterName": "<updated character name>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName, characterId, and characterName are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>"
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Edit mutates only the target player's character list entry.
- If character is missing, list is unchanged.

## Event: `game-join`

- Request event: `game-join`
- Response event: `game-join-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterId` (required)

### Success Response

```json
{
  "success": true,
  "message": "Character joined game successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterId are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>"
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- On success, the character is marked in the player list as in-game and receives
  `gameJoinedAt` and `gameLastMessageReceivedAt` timestamps.
- If character is already joined, join time is preserved and heartbeat is
  refreshed.
- Server supports idle cleanup by detaching joined characters whose
  `lastMessageReceivedAt` is older than 30 minutes.

## Event: `item-upsert-request`

- Request event: `item-upsert-request`
- Response event: `item-upsert-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `item` (required object)
  - `id` (optional string; omit or pass empty to create a new item)
  - `itemType` (required when creating; string identifying the item class, e.g. `expendable-dart-drone`)
  - `displayName` (required when creating; human-readable label)
  - `state` (optional; one of `contained`, `deployed`, `destroyed`)
  - `damageStatus` (optional; one of `intact`, `damaged`, `disabled`, `destroyed`)
  - `container` (optional; set to `null` to clear; otherwise object with `containerType` and `containerId`)
    - `containerType` (required with container; one of `ship`, `market`)
    - `containerId` (required with container; string id of the containing ship or market)
  - `spatial` (optional; set to `null` for contained items; required in deployed updates)
    - `solarSystemId` (required with spatial)
    - `frame` (required with spatial; must be `barycentric`)
    - `positionKm` (required with spatial; object with finite `x`, `y`, `z`)
    - `epochMs` (required with spatial; finite number)
  - `motion` (optional; set to `null` to clear)
    - `velocityKmPerSec` (required when motion is provided; object with finite `x`, `y`, `z`)
  - `owningPlayerId` (optional string)
  - `owningCharacterId` (optional string)
  - `destroyedAt` (optional ISO timestamp; auto-populated when `state` transitions to `destroyed` if not provided)
  - `destroyedReason` (optional string)
  - `discoveredAt` (optional ISO timestamp)
  - `discoveredByCharacterId` (optional string)
  - `launchable` (optional boolean; whether the item can be launched; defaults to `true` when not provided)

#### Spatial Shape (item)

```json
{
  "solarSystemId": "sol",
  "frame": "barycentric",
  "positionKm": { "x": 100.0, "y": 200.0, "z": 300.0 },
  "epochMs": 1713607200000
}
```

#### Motion Shape (item, optional)

```json
{
  "velocityKmPerSec": { "x": 1.0, "y": 0.5, "z": 0.0 }
}
```

### Success Response (create)

```json
{
  "success": true,
  "message": "Item created successfully",
  "playerName": "<canonical player name>",
  "item": {
    "id": "<uuid>",
    "itemType": "expendable-dart-drone",
    "displayName": "Expendable Dart Drone",
    "state": "contained",
    "damageStatus": "intact",
    "container": {
      "containerType": "ship",
      "containerId": "<ship id>"
    },
    "spatial": null,
    "owningPlayerId": "<player id>",
    "owningCharacterId": "<character id>",
    "destroyedAt": null,
    "destroyedReason": null,
    "discoveredAt": null,
    "discoveredByCharacterId": null,
    "launchable": true,
    "createdAt": "<iso timestamp>",
    "updatedAt": "<iso timestamp>"
  }
}
```

### Success Response (update)

Same shape as create; `message` is `"Item updated successfully"`.

### Failure Responses

- Missing `itemType`/`displayName` on create:

```json
{
  "success": false,
  "message": "item.itemType and item.displayName are required to create an item",
  "playerName": "<canonical player name>"
}
```

- Invalid `state`:

```json
{
  "success": false,
  "message": "item.state must be one of: contained, deployed, destroyed",
  "playerName": "<canonical player name>"
}
```

- Invalid `damageStatus`:

```json
{
  "success": false,
  "message": "item.damageStatus must be one of: intact, damaged, disabled, destroyed",
  "playerName": "<canonical player name>"
}
```

- Legacy kinematics is rejected:

```json
{
  "success": false,
  "message": "item.kinematics is no longer accepted; use canonical item.spatial (and optional item.motion) instead",
  "playerName": "<canonical player name>"
}
```

- Invalid `spatial` payload:

```json
{
  "success": false,
  "message": "item.spatial must include solarSystemId, frame:'barycentric', positionKm, and epochMs",
  "playerName": "<canonical player name>"
}
```

- Invalid `motion` payload:

```json
{
  "success": false,
  "message": "item.motion must include velocityKmPerSec when provided",
  "playerName": "<canonical player name>"
}
```

- Invalid container:

```json
{
  "success": false,
  "message": "item.container must include a valid containerType (ship or market) and containerId",
  "playerName": "<canonical player name>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Any authenticated player may upsert any item (no ownership check).
- When creating, `id` is server-generated if omitted or empty.
- When `state` transitions to `destroyed` and no `destroyedAt` is provided, the server auto-sets `destroyedAt` to the current timestamp.
- Items are stored in the global `items` collection, not embedded in player/ship documents.
- Ship inventory stores item references `{ itemId, itemType }`; responses hydrate these to full item objects.
- State transitions (deploy, destroy, discover) are all handled via this single upsert event by sending the relevant field updates.

## Event: `item-list-by-container-request`

- Request event: `item-list-by-container-request`
- Response event: `item-list-by-container-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `containerType` (required; one of `ship`, `market`)
- `containerId` (required string; id of the ship or market)

### Success Response

```json
{
  "success": true,
  "message": "Items retrieved successfully",
  "playerName": "<canonical player name>",
  "containerType": "ship",
  "containerId": "<ship id>",
  "items": [
    {
      "id": "<item id>",
      "itemType": "expendable-dart-drone",
      "displayName": "Expendable Dart Drone",
      "state": "contained",
      "damageStatus": "intact",
      "container": {
        "containerType": "ship",
        "containerId": "<ship id>"
      },
      "spatial": null,
      "owningPlayerId": "<player id>",
      "owningCharacterId": "<character id>",
      "destroyedAt": null,
      "destroyedReason": null,
      "discoveredAt": null,
      "discoveredByCharacterId": null,
      "launchable": true,
      "createdAt": "<iso timestamp>",
      "updatedAt": "<iso timestamp>"
    }
  ]
}
```

### Empty-Match Success Response

```json
{
  "success": true,
  "message": "Items retrieved successfully",
  "playerName": "<canonical player name>",
  "containerType": "ship",
  "containerId": "<ship id>",
  "items": []
}
```

### Failure Responses

- Invalid `containerType`:

```json
{
  "success": false,
  "message": "containerType must be one of: ship, market",
  "playerName": "<canonical player name>"
}
```

- Missing `containerId`:

```json
{
  "success": false,
  "message": "containerId is required",
  "playerName": "<canonical player name>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Returns all items whose `container.containerType` and `container.containerId` match exactly.
- Items without a matching container (e.g. deployed items) are not returned.
- When a DB connection is available, the query is run against the `items` collection. Otherwise the in-memory cache is filtered.

## Event: `item-list-by-location-request`

- Request event: `item-list-by-location-request`
- Response event: `item-list-by-location-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `solarSystemId` (required string)
- `positionKm` (required object)
  - `x` (required finite number)
  - `y` (required finite number)
  - `z` (required finite number)
- `distanceKm` (required finite number, must be `>= 0`)
- `itemType` (optional string; filters results to a specific item type)
- `limit` (optional; positive integer when provided)

### Success Response

```json
{
  "success": true,
  "message": "Item list retrieved successfully",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "itemType": null,
  "items": [
    {
      "id": "<item id>",
      "itemType": "expendable-dart-drone",
      "displayName": "Expendable Dart Drone",
      "state": "deployed",
      "damageStatus": "intact",
      "container": null,
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 3, "y": 4, "z": 0 },
        "epochMs": 1713607200000
      },
      "motion": {
        "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 }
      },
      "owningPlayerId": "<player id>",
      "owningCharacterId": "<character id>",
      "destroyedAt": null,
      "destroyedReason": null,
      "discoveredAt": null,
      "discoveredByCharacterId": null,
      "launchable": true,
      "createdAt": "<iso timestamp>",
      "updatedAt": "<iso timestamp>",
      "distanceKm": 5.0
    }
  ]
}
```

### Empty-Match Success Response

```json
{
  "success": true,
  "message": "No items found within distance",
  "playerName": "<canonical player name>",
  "solarSystemId": "sol",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "distanceKm": 100,
  "itemType": null,
  "items": []
}
```

### Failure Responses

- Missing/invalid required search fields:

```json
{
  "success": false,
  "message": "playerName, solarSystemId, positionKm, and distanceKm are required",
  "playerName": "<provided playerName or empty string>",
  "solarSystemId": "<provided solarSystemId or empty string>",
  "items": []
}
```

- Invalid optional `limit`:

```json
{
  "success": false,
  "message": "limit must be a positive integer when provided",
  "playerName": "<provided playerName or empty string>",
  "solarSystemId": "<provided solarSystemId or empty string>",
  "items": []
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>",
  "solarSystemId": "<provided solarSystemId>",
  "items": []
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Match inclusion is spherical and inclusive of the boundary (`distance <= distanceKm`).
- Distance is calculated in 3D Euclidean kilometers from `positionKm` to `item.spatial.positionKm`.
- Items without canonical `spatial` (for example contained items with `spatial: null`) are excluded.
- All item states (`contained`, `deployed`, `destroyed`) are included; callers filter by state if needed.
- `itemType` filter is applied before distance filtering.
- Results are sorted nearest-first by computed `distanceKm`.
- `limit` is applied after filtering and sorting.
- Solar system scoping is via `spatial.solarSystemId`.

## Event: `launch-item-request`

- Request event: `launch-item-request`
- Response event: `launch-item-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterId` (required)
- `shipId` (required)
- `targetCelestialBodyId` (required)
- `hotkey` (required integer; one of `1`, `2`, `3`, `4`, `5`)
- `itemId` (required)
- `itemType` (required)

### Success Response (`target-destroyed` outcome)

```json
{
  "success": true,
  "message": "Launch successful: target destroyed and materials yielded",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "shipId": "<ship id>",
  "targetCelestialBodyId": "<celestial body id>",
  "hotkey": 3,
  "itemId": "<item id>",
  "itemType": "expendable-dart-drone",
  "launchedItem": {
    "id": "<item id>",
    "state": "destroyed",
    "container": null,
    "launchable": false,
    "destroyedAt": "<iso timestamp>",
    "destroyedReason": "expended-on-target:<celestial body id>",
    "updatedAt": "<iso timestamp>"
  },
  "resolution": {
    "outcome": "target-destroyed",
    "targetDestroyed": true,
    "yieldedMaterials": [
      {
        "material": "Nickel-Iron",
        "rarity": "Rare",
        "quantity": 32
      }
    ],
    "yieldedItems": [
      {
        "id": "<item id>",
        "itemType": "raw-material-nickel-iron",
        "displayName": "Nickel-Iron (Raw Material)",
        "quantity": 32,
        "state": "contained",
        "container": {
          "containerType": "ship",
          "containerId": "<ship id>"
        },
        "launchable": false
      }
    ],
    "targetCelestialBody": {
      "id": "<celestial body id>",
      "state": "destroyed",
      "destroyedAt": "<iso timestamp>",
      "destroyedReason": "impacted-by:expendable-dart-drone",
      "debrisSeed": 123456789,
      "debris": [
        {
          "material": "Nickel-Iron",
          "rarity": "Rare",
          "quantity": 32,
          "itemType": "raw-material-nickel-iron"
        }
      ]
    },
    "launchSeed": 123456789
  }
}
```

### Success Response (`no-effect` outcome)

```json
{
  "success": true,
  "message": "Launch completed with no effect for itemType: basic-mining-laser",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "shipId": "<ship id>",
  "targetCelestialBodyId": "<celestial body id>",
  "hotkey": 2,
  "itemId": "<item id>",
  "itemType": "basic-mining-laser",
  "launchedItem": {
    "id": "<item id>",
    "state": "destroyed",
    "container": null,
    "launchable": false
  },
  "resolution": {
    "outcome": "no-effect",
    "targetDestroyed": false,
    "yieldedMaterials": [],
    "yieldedItems": [],
    "launchSeed": 123456789
  }
}
```

### Failure Responses

- Missing/invalid required fields:

```json
{
  "success": false,
  "message": "playerName, characterId, shipId, targetCelestialBodyId, hotkey, itemId, and itemType are required",
  "playerName": "<provided playerName or empty string>",
  "characterId": "<provided characterId or empty string>",
  "shipId": "<provided shipId or empty string>",
  "targetCelestialBodyId": "<provided targetCelestialBodyId or empty string>",
  "hotkey": 1,
  "itemId": "<provided itemId or empty string>",
  "itemType": "<provided itemType or empty string>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>",
  "characterId": "<provided characterId>",
  "shipId": "<provided shipId>",
  "targetCelestialBodyId": "<provided targetCelestialBodyId>",
  "hotkey": 3,
  "itemId": "<provided itemId>",
  "itemType": "<provided itemType>"
}
```

- Character/ship/item/target validation failures return `success: false` with one of these messages and the same identifying fields as above:
  - `Character is not in player list`
  - `Ship is not in character list`
  - `Item is not in ship inventory`
  - `Launch item does not exist`
  - `itemType does not match launch item`
  - `Launch item is not launchable`
  - `Launch item is destroyed`
  - `Target celestial body does not exist`

### Edge Cases

- Invalid session emits `invalid-session`.
- The launched item is always consumed for valid launch processing paths, including `no-effect` outcomes.
- `launchSeed` is deterministic for the same launch inputs and target identifiers.
- For `target-destroyed`, yielded materials are persisted as quantity-based item records (one item per material/itemType, with `quantity`) and added to the firing ship inventory as item references.
- Target resolution supports `unscanned`, `active`, and `destroyed` celestial-body lifecycle records; launch destruction transitions target state to `destroyed`.

### Yield Quantity Rules (Target Size -> Material Amount)

For `target-destroyed` outcomes, the server computes yielded material quantity from asteroid mass and rarity:

- `baseFromMass = max(1, round(estimatedMassKg / 5,000,000,000))`
- rarity multiplier: all rarities = `2`
- final quantity:
  - `quantity = clamp(baseFromMass * 2, 1, 100)`

Behavior notes:

- Larger asteroids (higher `estimatedMassKg`) produce more material.
- Distribution spans ~1–100 over the mass range up to 250,000,000,000 kg.
- Quantity is always at least `1` and capped at `100`.

## Notes For Client Implementers

- Treat `invalid-session` as a top-level auth/session failure signal for all
  character operations.
- Use the response `playerName` value as the canonical casing from server state
  when present.
- For login failures, branch on `reason` in addition to `message`.
- Treat `gameJoinedAt`/`gameLastMessageReceivedAt` as server-managed fields.

## Migration Note

- Existing celestial body records that predate lifecycle expansion are treated as `state: active` by default.
- For mission-scoped asteroid continuity, new records should include `missionId` (and optionally `missionInstanceId`).
