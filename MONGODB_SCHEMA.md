# MongoDB Schema and Relationships

This document describes the active MongoDB schema used by the Node.js server through Mongoose.

## Overview

The data model is document-oriented with three active collections:

- Collection: players
- Root model: Player
- Embedded subdocuments:
  - Character (embedded in Player.characters)
  - Ship (embedded in Character.ships)
  - DriveProfile (embedded in Ship.driveProfile)
  - MissionProgress (embedded in Character.missions)
- Collection: items
- Root model: Item
- Collection: cb
- Root model: CelestialBody
- Collection: jump_gates
- Root model: JumpGate

Player-owned character and ship state remains embedded in a Player document, while globally queryable inventory items and scanned celestial bodies are stored independently in `items` and `cb`. Jump gate network topology is stored in `jump_gates`.

## Entity Relationship Diagram

```mermaid
erDiagram
  PLAYER ||--o{ CHARACTER : embeds
  CHARACTER ||--o{ SHIP : embeds
  CHARACTER ||--o{ MISSION_PROGRESS : embeds
  CHARACTER ||--o{ CELESTIAL_BODY : creates
  SHIP ||--o{ INVENTORY_ITEM_REF : contains
  INVENTORY_ITEM_REF }o--|| ITEM : references
  SHIP ||--o| SHIP_KINEMATICS : embeds
  SHIP ||--o| DRIVE_PROFILE : embeds
  ITEM ||--o| ITEM_CONTAINER : contained-by
  ITEM ||--o| SHIP_KINEMATICS : moves-with
  JUMP_GATE }o--|| SOLAR_SYSTEM : source
  JUMP_GATE }o--|| SOLAR_SYSTEM : dest

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
    array inventory
    object kinematics
    object driveProfile
  }

  INVENTORY_ITEM_REF {
    string itemId
    string itemType
  }

  SHIP_KINEMATICS {
    object position
    object velocity
    object reference
  }

  ITEM {
    ObjectId _id
    string id
    string itemType
    string displayName
    string state
    string damageStatus
    string owningPlayerId
    string owningCharacterId
    string createdAt
    string updatedAt
    string destroyedAt
    string destroyedReason
    object container
    object kinematics
  }

  ITEM_CONTAINER {
    string containerType
    string containerId
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
- inventory: InventoryItemReference[] (optional)
  - List of globally stored item references contained in the ship.
  - Default: []
  - Ships of model `'Scavenger Pod'` are initialized with one `expendable-dart-drone` item reference.
- location: ShipLocation | null (optional)
  - Contains barycentric/body-relative position in km
  - Default: null
- kinematics: ShipKinematics | null (optional)
  - Contains position, velocity, and spatial reference information
  - Default: null
- driveProfile: DriveProfile | null (optional)
  - Contains drive/engine configuration for the ship
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

## DriveProfile Subdocument Schema

Embedded under Player.characters[].ships[].driveProfile.

### Fields

- id: String (required)
  - Unique drive profile identifier.
- name: String (required)
  - Human-readable drive name.
- rangeAu: Number (required)
  - Maximum range in astronomical units. Must be > 0.
- cruiseSpeedAuPerHour: Number (required)
  - Cruise speed in AU per hour. Must be > 0.
- fuelCostPerAu: Number (required)
  - Fuel consumed per AU traveled. Must be > 0.

Notes:
- _id is disabled for DriveProfile subdocuments (_id: false).
- All numeric fields must be positive finite numbers; invalid profiles are dropped at the normalization layer.

### InventoryItemReference Subdocument Fields

- itemId: String (required)
  - References Item.id.
- itemType: String (required)
  - Current supported value: `expendable-dart-drone`.

## JumpGate Root Schema

Defined in src/db/models.js and stored in the `jump_gates` collection.

### Fields

- _id: ObjectId
  - MongoDB-generated primary key.
- gateId: String (required)
  - Unique application-level identifier for this gate.
  - Unique index.
- sourceSystemId: String (required)
  - Solar system identifier of the gate's origin end.
  - Indexed.
- destSystemId: String (required)
  - Solar system identifier of the gate's destination end.
  - Indexed.
- traversalCostAu: Number (required)
  - Fuel/cost in AU equivalent to traverse this gate.
  - Must be >= 0.
- traversalTimeHours: Number (required)
  - Time in hours to traverse this gate.
  - Must be >= 0.
- isActive: Boolean (required)
  - Whether the gate is currently usable.
  - Default: true.

### Indexes and Constraints

- Unique index on gateId.
- Non-unique index on sourceSystemId.
- Non-unique index on destSystemId.

### Notes

- Gates are directional records; a bidirectional connection requires two documents (one per direction).
- The server caches the full gate network in memory on first load; the cache lives for the lifetime of the `MessageHandlerContext` instance.
- Only gates with `isActive: true` are included in BFS routing.

## Item Root Schema

Defined in src/db/models.js and stored in the `items` collection.

### Fields

- _id: ObjectId
  - MongoDB-generated primary key.
- id: String
  - Required.
  - Unique index.
  - Application-level item identifier.
- itemType: String
  - Required.
  - Indexed.
  - Current supported value: `expendable-dart-drone`.
- displayName: String
  - Required.
- state: String
  - Required.
  - Indexed.
  - Canonical values: `contained`, `deployed`, `destroyed`.
- damageStatus: String
  - Required.
  - Canonical values: `intact`, `damaged`, `disabled`, `destroyed`.
- container: ItemContainer | null
  - Present when the item is physically contained by another entity.
  - Null when the item is deployed in space or destroyed.
- owningPlayerId: String
  - Required.
  - Indexed.
- owningCharacterId: String
  - Required.
  - Indexed.
- kinematics: ShipKinematics | null
  - Optional.
  - Null while `state = contained`; contained items inherit location from their container.
- createdAt: String
  - Required.
- updatedAt: String
  - Required.
- destroyedAt: String | null
  - Optional.
- destroyedReason: String | null
  - Optional.

### ItemContainer Subdocument Fields

- containerType: String (required)
  - Canonical values: `ship`, `market`.
- containerId: String (required)

### Indexes and Constraints

- Unique index on id.
- Non-unique index on itemType.
- Non-unique index on state.
- Non-unique index on owningPlayerId.
- Non-unique index on owningCharacterId.
- Compound non-unique index on `container.containerType` + `container.containerId`.

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
- One Ship to many InventoryItemReference entries: 1:N (embedded references)
- One Ship to zero or one DriveProfile: 1:0-1 (embedded optional)
- One InventoryItemReference to one Item: N:1 (referenced)
- One Character to many CelestialBody documents: 1:N (referenced by createdByCharacterId)
- JumpGate has no ownership relationship; it is a standalone network-topology document keyed by gateId

Player, Character, Ship, and MissionProgress remain ownership relationships contained in a single Player document. Item and CelestialBody are separate root documents referenced by ids. JumpGate documents define the inter-system travel graph and are independent of player ownership.

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
