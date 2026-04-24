# MongoDB Schema and Relationships

This document describes the active MongoDB schema used by the Node.js server through Mongoose.

## Overview

The data model is document-oriented with two active collections:

- Collection: players
- Root model: Player
- Embedded subdocuments:
  - Character (embedded in Player.characters)
  - Ship (embedded in Character.ships)
  - MissionProgress (embedded in Character.missions)
- Collection: cb
- Root model: CelestialBody

Player-owned game state remains embedded in a Player document, while scanned celestial bodies are stored independently in `cb`.

## Entity Relationship Diagram

```mermaid
erDiagram
  PLAYER ||--o{ CHARACTER : embeds
  CHARACTER ||--o{ SHIP : embeds
  CHARACTER ||--o{ MISSION_PROGRESS : embeds
  CHARACTER ||--o{ CELESTIAL_BODY : creates
  SHIP ||--o| SHIP_KINEMATICS : embeds

  PLAYER {
    ObjectId _id
    string playerId
    string playerName
    string playerNameNormalized
    string email
    string password
    string sessionKey
    string socketId
    date createdAt
    date updatedAt
  }

  CHARACTER {
    string id
    string characterName
    string createdAt
  }

  MISSION_PROGRESS {
    string missionId
    string status
    string startedAt
    string inProgressAt
    string failedAt
    string completedAt
    string updatedAt
    string failureReason
    string statusDetail
  }

  SHIP {
    string id
    string shipName
    string model
    int tier
    string createdAt
    object kinematics
  }

  SHIP_KINEMATICS {
    object position
    object velocity
    object reference
  }

  CELESTIAL_BODY {
    ObjectId _id
    string id
    string catalogId
    string solarSystemId
    string sourceScanId
    string createdByCharacterId
    string createdAt
    string updatedAt
    object location
    object kinematics
    object composition
  }
```

## Player Schema

Defined in src/db/models.js.

### Fields

- _id: ObjectId
  - MongoDB-generated primary key.
- playerId: String
  - Required.
  - Unique index.
  - Application-level player identifier.
- playerName: String
  - Required.
  - Display name.
- playerNameNormalized: String
  - Required.
  - Unique index.
  - Lowercased by schema option.
  - Used for case-insensitive lookups.
- email: String
  - Required.
- password: String
  - Required.
- sessionKey: String | null
  - Defaults to null.
  - Tracks active session token.
- socketId: String | null
  - Defaults to null.
  - Tracks active socket connection.
- characters: Character[]
  - Embedded array of character subdocuments.
- createdAt: Date
  - Defaults to Date.now.
- updatedAt: Date
  - Defaults to Date.now.
  - Also refreshed by pre-save hook.

### Indexes and Constraints

- Unique index on playerId.
- Unique index on playerNameNormalized.

## Character Subdocument Schema

Embedded under Player.characters.

### Fields

- id: String (required)
- characterName: String (required)
- createdAt: String (required)
- ships: Ship[]
- missions: MissionProgress[]

Notes:
- _id is disabled for Character subdocuments (_id: false).
- Character identifiers use the id field, not MongoDB ObjectId.

## MissionProgress Subdocument Schema

Embedded under Player.characters[].missions.

### Fields

- missionId: String (required)
- status: String (required)
- startedAt: String (optional)
- inProgressAt: String (optional)
- failedAt: String (optional)
- completedAt: String (optional)
- updatedAt: String (optional)
- failureReason: String (optional)
- statusDetail: String (optional)

Notes:
- _id is disabled for MissionProgress subdocuments (_id: false).
- Canonical statuses include:
  `available`, `started`, `in-progress`, `failed`, `completed`, `locked`,
  `abandoned`, `paused`, `turned-in`.
- Custom status values are allowed for server-side mission extensions.

## Ship Subdocument Schema

Embedded under Player.characters[].ships.

### Fields

- id: String (required)
- shipName: String (required)
- model: String (required)
  - Default: `'Scavenger Pod'`
- tier: Number (required)
  - Default: `1`
  - Valid range: 1–10
- createdAt: String (required)
- location: ShipLocation | null (optional)
  - Contains barycentric/body-relative position in km
  - Default: null
- kinematics: ShipKinematics | null (optional)
  - Contains position, velocity, and spatial reference information
  - Default: null

### ShipLocation Subdocument Fields

- positionKm: Triple (required)
  - x: Number - X coordinate in km
  - y: Number - Y coordinate in km
  - z: Number - Z coordinate in km

### ShipKinematics Subdocument Fields

- position: Triple (required)
  - x: Number - X coordinate
  - y: Number - Y coordinate
  - z: Number - Z coordinate
- velocity: Triple (required)
  - x: Number - X velocity component
  - y: Number - Y velocity component
  - z: Number - Z velocity component
- reference: SpatialReference (required)
  - solarSystemId: String - Reference solar system identifier
  - referenceKind: String - 'barycentric' or 'body-centered'
  - referenceBodyId: String | null - Optional reference body identifier
  - distanceUnit: String - 'km'
  - velocityUnit: String - 'km/s'
  - epochMs: Number - Epoch timestamp in milliseconds

Notes:
- _id is disabled for Ship subdocuments (_id: false).
- Ship identifiers use the id field, not MongoDB ObjectId.
- Kinematics data is optional and can be null when not applicable.

## CelestialBody Root Schema

Defined in src/db/models.js and stored in the `cb` collection.

### Fields

- _id: ObjectId
  - MongoDB-generated primary key.
- id: String
  - Required.
  - Unique index.
  - Application-level celestial body identifier and upsert key.
- catalogId: String
  - Required.
  - Indexed.
- solarSystemId: String
  - Required.
  - Indexed.
  - Currently forced to `sol` by the socket handler.
- sourceScanId: String
  - Required.
  - Indexed.
- createdByCharacterId: String
  - Required.
  - Indexed.
  - References the character id that discovered or created the body.
- createdAt: String
  - Required.
  - Preserved from the request payload.
- updatedAt: String
  - Required.
  - Preserved from the request payload.
- location: CelestialBodyLocation
  - Required.
  - `positionKm` uses the shared Triple schema.
- kinematics: CelestialBodyKinematics
  - Required.
  - Contains velocity vector, angular velocity vector, estimated mass, and estimated diameter.
- composition: AsteroidMaterialProfile
  - Required.
  - Contains `rarity`, `material`, and `textureColor`.

### Indexes and Constraints

- Unique index on id.
- Non-unique indexes on catalogId, solarSystemId, sourceScanId, and createdByCharacterId.
- Compound non-unique index on `solarSystemId` + `location.positionKm.x/y/z` to support
  bounding-cube prefilter queries for spherical distance search.

### Geospatial Index Roadmap

The current schema stores position as a 3D triple (`location.positionKm.x/y/z`) and performs
exact spherical filtering in application code after a bounding-cube Mongo query.

Planned upgrade path for true geospatial indexing:

1. Add a GeoJSON-compatible field (for example `locationPoint`) derived from current position data.
2. Backfill existing `cb` documents with that field.
3. Create a `2dsphere` index on the new field.
4. Migrate proximity queries to `$near`/`$geoWithin` while retaining current distance semantics.

## Relationship Semantics

- One Player to many Characters: 1:N (embedded)
- One Character to many Ships: 1:N (embedded)
- One Character to many MissionProgress entries: 1:N (embedded)
- One Character to many CelestialBody documents: 1:N (referenced by createdByCharacterId)

Player, Character, Ship, and MissionProgress remain ownership relationships contained in a single Player document. CelestialBody is a separate root document referenced by character id.

## Access Patterns

The service layer in src/db/service.js uses playerNameNormalized as the primary query key for most operations:

- Register player
- Fetch player by name
- Update player session/socket
- Add, edit, delete characters
- Add and fetch ships
- Add and list character mission progress
- Upsert celestial bodies by id in the `cb` collection

Because Character and Drone are embedded, those operations commonly update a single Player document. Celestial body upserts target the separate `cb` collection.

## Lifecycle Behavior

A pre-save middleware on Player sets:

- updatedAt = new Date()

This runs on save operations and keeps modification timestamps current.

## Practical Implications

- Strong locality: player + characters + drones are read together efficiently.
- Simpler joins: no cross-collection joins for character/drone data.
- Document growth: large character/drone lists increase Player document size.
- Consistency: player-owned game state updates are naturally scoped to one document.
- Celestial body isolation: scanned-body records avoid inflating Player documents and can be filtered by `solarSystemId` or `createdByCharacterId`.

## Example Documents

### Player Document (with embedded Character and Drone)

```json
{
  "_id": "661f9a53e8f93b0b2d4f12a1",
  "playerId": "player-8a4d2e54",
  "playerName": "OrbitFox",
  "playerNameNormalized": "orbitfox",
  "email": "orbitfox@example.com",
  "password": "plain-text-in-dev-only",
  "sessionKey": "8ce4a2a7-7a6f-4559-8e22-2e95a9a0f6b4",
  "socketId": "yYfU4dG2qv95uT4xAAAB",
  "characters": [
    {
      "id": "character-cf86b7",
      "characterName": "RangerOne",
      "createdAt": "2026-04-19T12:00:00.000Z",
      "drones": [
        {
          "id": "character-cf86b7-drone-1",
          "droneName": "RangerOne Drone 1",
          "createdAt": "2026-04-19T12:00:00.000Z",
          "kinematics": {
            "position": {
              "x": 100.5,
              "y": 200.3,
              "z": 50.1
            },
            "velocity": {
              "x": 0.5,
              "y": -0.2,
              "z": 0.1
            },
            "reference": {
              "solarSystemId": "system-sol",
              "referenceKind": "barycentric",
              "referenceBodyId": null,
              "epochMs": 1713607200000
            }
          }
        }
      ],
      "missions": [
        {
          "missionId": "The First Target",
          "status": "available",
          "updatedAt": "2026-04-19T12:00:00.000Z"
        },
        {
          "missionId": "Moon Relay",
          "status": "in-progress",
          "startedAt": "2026-04-19T12:05:00.000Z",
          "inProgressAt": "2026-04-19T12:07:00.000Z",
          "updatedAt": "2026-04-19T12:07:00.000Z"
        }
      ]
    }
  ],
  "createdAt": "2026-04-19T11:58:10.000Z",
  "updatedAt": "2026-04-19T12:00:00.000Z",
  "__v": 0
}
```

### Character Subdocument (shape)

```json
{
  "id": "character-cf86b7",
  "characterName": "RangerOne",
  "createdAt": "2026-04-19T12:00:00.000Z",
  "drones": [
    {
      "id": "character-cf86b7-drone-1",
      "droneName": "RangerOne Drone 1",
      "createdAt": "2026-04-19T12:00:00.000Z"
    }
  ],
  "missions": [
    {
      "missionId": "The First Target",
      "status": "available",
      "updatedAt": "2026-04-19T12:00:00.000Z"
    }
  ]
}
```

### Drone Subdocument (shape)

```json
{
  "id": "character-cf86b7-drone-1",
  "droneName": "RangerOne Drone 1",
  "createdAt": "2026-04-19T12:00:00.000Z",
  "kinematics": {
    "position": {
      "x": 100.5,
      "y": 200.3,
      "z": 50.1
    },
    "velocity": {
      "x": 0.5,
      "y": -0.2,
      "z": 0.1
    },
    "reference": {
      "solarSystemId": "system-sol",
      "referenceKind": "barycentric",
      "referenceBodyId": null,
      "epochMs": 1713607200000
    }
  }
}
```

## Before and After Operation Examples

### Login Operation Update

When a login succeeds, the server updates sessionKey, socketId, and updatedAt.

Before:

```json
{
  "playerNameNormalized": "orbitfox",
  "sessionKey": null,
  "socketId": null,
  "updatedAt": "2026-04-19T11:58:10.000Z"
}
```

After:

```json
{
  "playerNameNormalized": "orbitfox",
  "sessionKey": "8ce4a2a7-7a6f-4559-8e22-2e95a9a0f6b4",
  "socketId": "yYfU4dG2qv95uT4xAAAB",
  "updatedAt": "2026-04-19T12:05:40.000Z"
}
```

### Character Add Operation Update

When a character is added, a new Character subdocument is pushed into characters and updatedAt is refreshed.

Before:

```json
{
  "playerNameNormalized": "orbitfox",
  "characters": [],
  "updatedAt": "2026-04-19T12:05:40.000Z"
}
```

After:

```json
{
  "playerNameNormalized": "orbitfox",
  "characters": [
    {
      "id": "character-cf86b7",
      "characterName": "RangerOne",
      "createdAt": "2026-04-19T12:07:00.000Z",
      "drones": [
        {
          "id": "character-cf86b7-drone-1",
          "droneName": "RangerOne Drone 1",
          "createdAt": "2026-04-19T12:07:00.000Z"
        }
      ]
    }
  ],
  "updatedAt": "2026-04-19T12:07:00.000Z"
}
```
