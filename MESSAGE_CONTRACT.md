# Stellar Socket Message Contract

This document describes all Socket.IO message types handled by this server,
including required fields, response payloads, and edge-case behavior.

## General Behavior

- All message payload string fields are trimmed.
- Player lookup is case-insensitive by `playerName`.
- Character operations (`list`, `add`, `delete`, `edit`, `drone-list-request`,
  `game-join`, `add-mission-request`, `list-missions-request`) require
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

## Event: `login`

- Request event: `login`
- Response event: `login-response`

### Request Payload

- `playerName` (required, non-empty string)
- `password` (required, non-empty string)

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
      "drones": [
        {
          "id": "<drone id>",
          "name": "<drone name>",
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
  - `id` (required, stable unique identifier; used as upsert key)
  - `catalogId` (required)
  - `solarSystemId` (accepted but currently forced to `sol` by the server)
  - `sourceScanId` (required)
  - `createdByCharacterId` (required and must match a character belonging to the player)
  - `createdAt` (required ISO timestamp)
  - `updatedAt` (required ISO timestamp)
  - `location.positionKm.x|y|z` (required numbers)
  - `kinematics.velocityKmPerSec.x|y|z` (required numbers)
  - `kinematics.angularVelocityRadPerSec.x|y|z` (required numbers)
  - `kinematics.estimatedMassKg` (required number)
  - `kinematics.estimatedDiameterM` (required number)
  - `composition.rarity` (required; one of `Common`, `Uncommon`, `Rare`, `Exotic`)
  - `composition.material` (required string)
  - `composition.textureColor` (required string)

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

- Upsert identity is based on `celestialBody.id`.
- Incoming `createdAt` and `updatedAt` are preserved as provided.
- Celestial bodies are not stored under player documents; they are persisted in the separate Mongo collection `cb`.

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
      "distanceKm": 3.74
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
- New characters are initialized with at least one starter drone in `drones`.
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

## Event: `drone-list-request`

- Request event: `drone-list-request`
- Response event: `drone-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `sessionKey` (required and must match the player)

### Success Response

```json
{
  "success": true,
  "message": "Drone list retrieved successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "drones": [
    {
      "id": "<drone id>",
      "name": "<drone name>",
      "status": "<optional status>",
      "model": "<optional model>",
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
  "drones": []
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>",
  "drones": []
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>",
  "drones": []
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Drones are scoped per character.
- Returned `drones` list is a defensive copy of server state.

## Event: `drone-upsert-request`

- Request event: `drone-upsert-request`
- Response event: `drone-upsert-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `characterId` (required)
- `sessionKey` (required and must match the player)
- `drone` (required object)
  - `id` (required; must exist in the character's drone list)
  - `location.positionKm.x|y|z` (optional; required if `kinematics` omitted)
  - `kinematics.position.x|y|z` (optional; required if `location` omitted)
  - `kinematics.velocity.x|y|z` (optional; required if `location` omitted)
  - `kinematics.reference.solarSystemId` (required with `kinematics`)
  - `kinematics.reference.referenceKind` (required with `kinematics`; `barycentric` or `body-centered`)
  - `kinematics.reference.referenceBodyId` (optional with `kinematics`)
  - `kinematics.reference.epochMs` (required number with `kinematics`)

### Success Response

```json
{
  "success": true,
  "message": "Drone updated successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "drone": {
    "id": "<drone id>",
    "droneName": "<drone name>",
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
    }
  }
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName, characterId, and drone.id are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>"
}
```

- Missing update payload:

```json
{
  "success": false,
  "message": "drone.location and/or drone.kinematics is required",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

- Invalid update payload:

```json
{
  "success": false,
  "message": "drone location/kinematics payload is invalid",
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

- Drone not found in character list:

```json
{
  "success": false,
  "message": "Drone is not in character list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- `drone-upsert` only mutates a drone already owned by the specified character.
- The server always emits kinematics units as `distanceUnit: "km"` and `velocityUnit: "km/s"` when kinematics are present.

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

## Notes For Client Implementers

- Treat `invalid-session` as a top-level auth/session failure signal for all
  character operations.
- Use the response `playerName` value as the canonical casing from server state
  when present.
- For login failures, branch on `reason` in addition to `message`.
- Treat `gameJoinedAt`/`gameLastMessageReceivedAt` as server-managed fields.