# Stellar Socket Message Contract

This document describes all Socket.IO message types handled by this server,
including required fields, response payloads, and edge-case behavior.

## General Behavior

- All message payload string fields are trimmed.
- Player lookup is case-insensitive by `playerName`.
- Character operations (`list`, `add`, `delete`, `edit`, `ship-list-request`,
  `game-join`, `add-mission-request`, `list-missions-request`,
  `item-upsert-request`, `item-list-by-container-request`,
  `item-list-by-location-request`, `launch-item-request`) require
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
  - `solarSystemId` (accepted but currently forced to `sol` by the server)
  - `sourceScanId` (required)
  - `createdByCharacterId` (required and must match a character belonging to the player)
  - `missionId` (optional string; recommended for mission-scoped asteroid fields)
  - `missionInstanceId` (optional string)
  - `createdAt` (required ISO timestamp)
  - `updatedAt` (required ISO timestamp)
  - `location.positionKm.x|y|z` (required numbers)
  - `kinematics.velocityKmPerSec.x|y|z` (required numbers)
  - `kinematics.angularVelocityRadPerSec.x|y|z` (required numbers)
  - `kinematics.estimatedMassKg` (required number)
  - `kinematics.estimatedDiameterM` (required number)
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
    "solarSystemId": "sol",
    "sourceScanId": "<scan id>",
    "createdByCharacterId": "<character id>",
    "missionId": "first-target",
    "missionInstanceId": null,
    "createdAt": "<iso timestamp>",
    "updatedAt": "<iso timestamp>",
    "location": {
      "positionKm": { "x": 1, "y": 2, "z": 3 }
    },
    "kinematics": {
      "velocityKmPerSec": { "x": 1, "y": 2, "z": 3 },
      "angularVelocityRadPerSec": { "x": 0.1, "y": 0.2, "z": 0.3 },
      "estimatedMassKg": 42000000000,
      "estimatedDiameterM": 320
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
  "message": "playerName and a complete celestialBody payload are required",
  "playerName": "<provided playerName or empty string>"
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
      "solarSystemId": "sol",
      "sourceScanId": "<scan id>",
      "createdByCharacterId": "<character id>",
      "missionId": "first-target",
      "missionInstanceId": null,
      "createdAt": "<iso timestamp>",
      "updatedAt": "<iso timestamp>",
      "location": {
        "positionKm": { "x": 1, "y": 2, "z": 3 }
      },
      "kinematics": {
        "velocityKmPerSec": { "x": 1, "y": 2, "z": 3 },
        "angularVelocityRadPerSec": { "x": 0.1, "y": 0.2, "z": 0.3 },
        "estimatedMassKg": 42000000000,
        "estimatedDiameterM": 320
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
  "celestialBodies": [
    { "id": "cb-1", "state": "unscanned", "sourceScanId": "sample-a1" },
    { "id": "cb-2", "state": "active", "sourceScanId": "sample-a2" }
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
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `missionId` (required)
- `sessionKey` (required and must match the player)
- `status` (required, must be a non-empty string)

### Success Response

```json
{
  "success": true,
  "message": "Mission recorded successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "mission": {
    "missionId": "<mission id>",
    "status": "<mission status>",
    "updatedAt": "<iso timestamp>",
    "startedAt": "<optional when status is started>",
    "inProgressAt": "<optional when status is in-progress>",
    "failedAt": "<optional when status is failed>",
    "completedAt": "<optional when status is completed>"
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
- Re-adding the same `missionId` updates the existing mission progress.
- Canonical status values include:
  `available`, `started`, `in-progress`, `failed`, `completed`, `locked`,
  `abandoned`, `paused`, `turned-in`.
- Custom statuses are allowed for server-side extensions.
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

### Success Response

```json
{
  "success": true,
  "message": "Mission list retrieved successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "missions": [
    {
      "missionId": "<mission id>",
      "status": "<mission status>",
      "updatedAt": "<iso timestamp>"
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
- `statuses` filter is optional and supports custom statuses.
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
          "kinematics": null,
          "launchable": true
        }
      ],
      "location": {
        "positionKm": { "x": 100.5, "y": 200.3, "z": 50.1 }
      },
      "kinematics": {
        "position": { "x": 100.5, "y": 200.3, "z": 50.1 },
        "velocity": { "x": 0.5, "y": -0.2, "z": 0.1 },
        "reference": {
          "solarSystemId": "system-sol",
          "referenceKind": "barycentric",
          "referenceBodyId": null,
          "distanceUnit": "km",
          "velocityUnit": "km/s",
          "epochMs": 1713607200000
        }
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
  - `location.positionKm.x|y|z` (optional; required if `kinematics` omitted and no `model`/`tier`/`status`/`damageProfile`)
  - `kinematics.position.x|y|z` (optional; required if `location` omitted and no `model`/`tier`/`status`/`damageProfile`)
  - `kinematics.velocity.x|y|z` (optional; required if `location` omitted and no `model`/`tier`/`status`/`damageProfile`)
  - `kinematics.reference.referenceBodyId` (optional with `kinematics`)
  - `kinematics.reference.epochMs` (required number with `kinematics`)
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
    "shipName": "<ship name>",
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
        "kinematics": null,
        "launchable": true
      }
    ],
    "location": {
      "positionKm": { "x": 100.5, "y": 200.3, "z": 50.1 }
    },
    "kinematics": {
      "position": { "x": 100.5, "y": 200.3, "z": 50.1 },
      "velocity": { "x": 0.5, "y": -0.2, "z": 0.1 },
      "reference": {
        "solarSystemId": "system-sol",
        "referenceKind": "barycentric",
        "referenceBodyId": null,
        "distanceUnit": "km",
        "velocityUnit": "km/s",
        "epochMs": 1713607200000
      }
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
  "message": "ship.location, ship.kinematics, ship.model, and/or ship.tier is required",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Invalid update payload:

```json
{
  "success": false,
  "message": "ship location/kinematics payload is invalid",
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
- The server always emits kinematics units as `distanceUnit: "km"` and `velocityUnit: "km/s"` when kinematics are present.
- `status` and `damageProfile` use patch semantics: omitting a field preserves the stored value; sending `damageProfile: null` explicitly clears it.
- Ships without a stored `damageProfile` return `damageProfile: null`.
- At least one of `location`, `kinematics`, `model`, `tier`, `status`, or `damageProfile` must be present in the update payload.

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
  - `kinematics` (optional; set to update deployed position; see kinematics shape below)
  - `owningPlayerId` (optional string)
  - `owningCharacterId` (optional string)
  - `destroyedAt` (optional ISO timestamp; auto-populated when `state` transitions to `destroyed` if not provided)
  - `destroyedReason` (optional string)
  - `discoveredAt` (optional ISO timestamp)
  - `discoveredByCharacterId` (optional string)
  - `launchable` (optional boolean; whether the item can be launched; defaults to `true` when not provided)

#### Kinematics Shape (item)

```json
{
  "position": { "x": 100.0, "y": 200.0, "z": 300.0 },
  "velocity": { "x": 1.0, "y": 0.5, "z": 0.0 },
  "reference": {
    "solarSystemId": "sol",
    "referenceKind": "barycentric",
    "referenceBodyId": null,
    "distanceUnit": "km",
    "velocityUnit": "km/s",
    "epochMs": 1713607200000
  }
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
    "kinematics": null,
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

- Invalid kinematics:

```json
{
  "success": false,
  "message": "item.kinematics payload is invalid",
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
      "kinematics": null,
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
      "kinematics": {
        "position": { "x": 3, "y": 4, "z": 0 },
        "velocity": { "x": 0, "y": 0, "z": 0 },
        "reference": {
          "solarSystemId": "sol",
          "referenceKind": "barycentric",
          "referenceBodyId": null,
          "distanceUnit": "km",
          "velocityUnit": "km/s",
          "epochMs": 1713607200000
        }
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
- Distance is calculated in 3D Euclidean kilometers from `positionKm` to `item.kinematics.position`.
- Items without `kinematics` (e.g. contained items with null kinematics) are excluded.
- All item states (`contained`, `deployed`, `destroyed`) are included; callers filter by state if needed.
- `itemType` filter is applied before distance filtering.
- Results are sorted nearest-first by computed `distanceKm`.
- `limit` is applied after filtering and sorting.
- Solar system scoping is via `kinematics.reference.solarSystemId`.

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