# Canonical Spatial Model - Response Contracts (Backend)

**Effective**: May 5, 2026  
**Status**: Core implementation complete. Responses use canonical spatial model.

This document defines the canonical response shapes for all entity types (Ships, Celestial Bodies, Markets) using the spatial model cutover. See [SPATIAL_MODEL_IMPLEMENTATION.md](./SPATIAL_MODEL_IMPLEMENTATION.md) for implementation details.

---

## Core Types

All responses now use these canonical types:

### SpatialState (Required on all in-world entities)
```json
{
  "solarSystemId": "sol",
  "frame": "barycentric",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "epochMs": 1713360000000
}
```
- `solarSystemId`: Solar system identifier
- `frame`: Always `'barycentric'` (hardcoded)
- `positionKm`: 3D position in kilometers
- `epochMs`: Unix timestamp in milliseconds (epoch of position)

### MotionState (Optional)
```json
{
  "velocityKmPerSec": { "x": 1.5, "y": 0, "z": -0.5 },
  "angularVelocityRadPerSec": { "x": 0.001, "y": 0.002, "z": 0 }
}
```
- `velocityKmPerSec`: Linear velocity vector (required if motion present)
- `angularVelocityRadPerSec`: Angular velocity in radians/second (optional, for celestial bodies)

### PhysicalState (Optional, Celestial Bodies Only)
```json
{
  "estimatedMassKg": 1e18,
  "estimatedDiameterM": 500
}
```
- `estimatedMassKg`: Mass in kilograms (optional)
- `estimatedDiameterM`: Diameter in meters (optional)

### ObservabilityState (Required on Celestial Bodies)
```json
{
  "visibility": "visible",
  "scanState": "scanned"
}
```
- `visibility`: One of `'visible'`, `'not-visible'`, `'cloaked'`
- `scanState`: One of `'unscanned'`, `'scanned'`

### TrajectoryDescriptor (Optional, Markets Only)
```json
{
  "kind": "orbital-elements",
  "orbit": {
    "anchorBodyId": "ceres",
    "anchorBodyName": "Ceres",
    "orbitType": "elliptical",
    "semiMajorAxisKm": 413000,
    "eccentricity": 0.076,
    "inclinationDeg": 10.593,
    "longitudeOfAscendingNodeDeg": 80.329,
    "argumentOfPeriapsisDeg": 73.115,
    "meanAnomalyAtEpochDeg": 0,
    "orbitalPeriodSec": 145730400,
    "epoch": "2026-05-05T00:00:00Z"
  }
}
```
- `kind`: `'static'` or `'orbital-elements'`
- `orbit`: Present only when `kind === 'orbital-elements'`

---

## Ship List Response

**Event**: `ship-list-response`

### Success Response
```json
{
  "success": true,
  "message": "Ship list retrieved successfully",
  "playerName": "Pioneer",
  "characterId": "char-1",
  "ships": [
    {
      "id": "ship-1",
      "shipName": "Explorer-1",
      "status": null,
      "model": "Scavenger Pod",
      "tier": 1,
      "createdAt": "2026-05-05T00:00:00Z",
      "inventory": [],
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 0, "y": 0, "z": 0 },
        "epochMs": 1714896000000
      },
      "motion": {
        "velocityKmPerSec": { "x": 0.1, "y": 0, "z": 0.05 }
      },
      "launchable": true,
      "damageProfile": null
    }
  ]
}
```

### Key Notes
- `spatial` is **always present** and required
- `motion` is **optional**; only included if ship has velocity
- `launchable` defaults to `true`
- `damageProfile` is `null` for undamaged ships

---

## Celestial Body List Response

**Event**: `celestial-body-list-response`

### Success Response
```json
{
  "success": true,
  "message": "Celestial body list retrieved successfully",
  "playerName": "ScannerOne",
  "bodies": [
    {
      "id": "body-1",
      "catalogId": "asteroid-001",
      "sourceScanId": "scan-1",
      "createdByCharacterId": "char-1",
      "missionId": null,
      "missionInstanceId": null,
      "createdAt": "2026-05-05T00:00:00Z",
      "updatedAt": "2026-05-05T00:00:00Z",
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 150000, "y": 50000, "z": 30000 },
        "epochMs": 1714896000000
      },
      "motion": {
        "velocityKmPerSec": { "x": 0, "y": 0.2, "z": -0.1 },
        "angularVelocityRadPerSec": { "x": 0.0001, "y": 0.0002, "z": 0 }
      },
      "physical": {
        "estimatedMassKg": 1e18,
        "estimatedDiameterM": 500
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
      "distanceKm": 158114.4
    }
  ]
}
```

### Key Notes
- `spatial` is **always present** and required
- `observability` is **always present** and required
- `motion` is **optional**; only included if body has velocity/angular-velocity
- `physical` is **optional**; only included if body has mass/diameter
- `distanceKm` is computed distance from query position (present in distance-filtered responses)

---

## Market List Response

**Event**: `market-list-response`

### Success Response
```json
{
  "success": true,
  "message": "Market list retrieved successfully",
  "playerName": "Trader-1",
  "solarSystemId": "sol",
  "markets": [
    {
      "marketId": "market-ceres-exchange",
      "solarSystemId": "sol",
      "marketName": "Ceres Belt Trade Ring",
      "siteType": "station",
      "siteName": "Ceres Main",
      "isStarterMarket": false,
      "spatial": {
        "solarSystemId": "sol",
        "frame": "barycentric",
        "positionKm": { "x": 413000, "y": 0, "z": 0 },
        "epochMs": 1714896000000
      },
      "trajectory": {
        "kind": "orbital-elements",
        "orbit": {
          "anchorBodyId": "ceres",
          "anchorBodyName": "Ceres",
          "orbitType": "elliptical",
          "semiMajorAxisKm": 413000,
          "eccentricity": 0.076,
          "inclinationDeg": 10.593,
          "longitudeOfAscendingNodeDeg": 80.329,
          "argumentOfPeriapsisDeg": 73.115,
          "meanAnomalyAtEpochDeg": 0,
          "orbitalPeriodSec": 145730400,
          "epoch": "2026-05-05T00:00:00Z"
        }
      },
      "priceMultiplier": 1.0,
      "driftPercentPerHour": 0.5,
      "restockIntervalMinutes": 60
    }
  ]
}
```

### Key Notes
- `spatial` is **always present** and required
- `trajectory` is **optional**; only present if market has orbital data
- `siteType` (renamed from `locationType`)
- `siteName` (renamed from `locationName`)
- `distanceKm` present in location-filtered responses

---

## Ship List in Character Response

**Event**: `character-list-response` (includes ships array)

### Ship Object in Character Context
```json
{
  "id": "ship-1",
  "name": "Explorer-1",
  "status": null,
  "model": "Scavenger Pod",
  "tier": 1,
  "spatial": {
    "solarSystemId": "sol",
    "frame": "barycentric",
    "positionKm": { "x": 0, "y": 0, "z": 0 },
    "epochMs": 1714896000000
  },
  "motion": {
    "velocityKmPerSec": { "x": 0, "y": 0, "z": 0 }
  },
  "launchable": true
}
```

---

## Backward Compatibility Notes

During the transition period, the server's normalization layer automatically converts legacy `location`/`kinematics` fields to the canonical `spatial`/`motion` structure. However:

1. **New inbound payloads** must use canonical structure
2. **All outbound responses** use canonical structure
3. **Legacy payloads** in test fixtures are automatically converted for backward compatibility
4. **Hard cutover**: Once migration is complete, legacy fields are not supported

---

## Validation Rules

### Ships
- `spatial` is **required**
  - Must have: `solarSystemId`, `frame: 'barycentric'`, `positionKm` (valid Triple), `epochMs` (number)
- `motion` is optional
  - If present, must have: `velocityKmPerSec` (valid Triple)
- No legacy fields (`location`, `kinematics`)

### Celestial Bodies
- `spatial` is **required**
- `observability` is **required**
  - Must have: `visibility` (one of valid values), `scanState` (one of valid values)
- `motion` is optional (max 2 velocity vectors)
- `physical` is optional (optional mass/diameter)
- No legacy fields (`location`, `solarSystemId` as root, `kinematics`)

### Markets
- `spatial` is **required**
- `siteType` and `siteName` are **required** (renamed from location fields)
- `trajectory` is optional
  - If present: `kind` must be `'static'` or `'orbital-elements'`
  - If `kind === 'orbital-elements'`, `orbit` must be present
- No legacy fields (`locationType`, `locationName`, `positionKm` as root)

---

## Migration Helper

To update existing code to the new spatial model:

**Before:**
```javascript
const ship = {
  location: { positionKm: { x: 100, y: 200, z: 300 } },
  kinematics: {
    position: { x: 100, y: 200, z: 300 },
    velocity: { x: 1, y: 0, z: 0 },
    reference: {
      solarSystemId: 'sol',
      epochMs: 1714896000000,
      referenceKind: 'barycentric'
    }
  }
};
```

**After:**
```javascript
const ship = {
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 100, y: 200, z: 300 },
    epochMs: 1714896000000
  },
  motion: {
    velocityKmPerSec: { x: 1, y: 0, z: 0 }
  }
};
```

---

## Questions & Issues

- For **offline calculation** of market positions, should temporal position be pre-computed and stored in `spatial.positionKm`, or should clients compute from orbit?
- For **distance-filtered responses**, should epoch be the query timestamp or the entity's epoch?
- Should **legacy field warnings** be logged when backward compat converters are used?

---

## References

- [SPATIAL_MODEL_IMPLEMENTATION.md](./SPATIAL_MODEL_IMPLEMENTATION.md) - Implementation details
- [src/model/spatial-model.js](./src/model/spatial-model.js) - Core type definitions
- [src/db/models.js](./src/db/models.js) - MongoDB schema definitions
