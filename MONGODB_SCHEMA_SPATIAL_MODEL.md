# MongoDB Schema - Canonical Spatial Model

**Effective**: May 5, 2026  
**Status**: Core implementation complete. All new schemas use spatial model.

This document describes the Mongoose schemas after the canonical spatial model cutover. See [MONGODB_SCHEMA.md](./MONGODB_SCHEMA.md) for legacy schema reference.

---

## Collections Overview

| Collection   | Root Model        | Purpose                                           |
| ------------ | ----------------- | ------------------------------------------------- |
| `players`    | Player            | Player accounts, sessions, embedded characters    |
| `items`      | Item              | Global inventory items (deployed or contained)    |
| `cb`         | CelestialBody     | Scanned celestial bodies (spatial indexed)        |
| `markets`    | Market            | Market locations and trading inventory            |
| `game_state` | GameStateDocument | Persistent game flags (e.g., market seed version) |

---

## Core Schema Types

### SpatialStateSchema

```javascript
{
  solarSystemId: String (required),
  frame: String (enum: ['barycentric'], required, default: 'barycentric'),
  positionKm: {
    x: Number (required),
    y: Number (required),
    z: Number (required)
  },
  epochMs: Number (required)
}
```

### MotionStateSchema

```javascript
{
  velocityKmPerSec: {
    x: Number (required),
    y: Number (required),
    z: Number (required)
  },
  angularVelocityRadPerSec: {
    x: Number (default: null),
    y: Number (default: null),
    z: Number (default: null)
  }
}
```

### PhysicalStateSchema

```javascript
{
  estimatedMassKg: Number (default: null),
  estimatedDiameterM: Number (default: null)
}
```

### ObservabilityStateSchema

```javascript
{
  visibility: String (enum: ['visible', 'not-visible', 'cloaked'], required),
  scanState: String (enum: ['unscanned', 'scanned'], required)
}
```

### TrajectoryDescriptorSchema

```javascript
{
  kind: String (enum: ['static', 'orbital-elements'], required),
  orbit: Mixed (optional, present when kind === 'orbital-elements')
}
```

---

## Ship Schema (Embedded in Character)

### Before (Legacy)

```javascript
{
  id: String,
  shipName: String,
  status: String,
  model: String,
  tier: Number,
  createdAt: String,
  inventory: [InventoryItemReference],
  location: { positionKm: Triple },           // REMOVED
  kinematics: {                                // REMOVED
    position: Triple,
    velocity: Triple,
    reference: { solarSystemId, epochMs, ... }
  },
  launchable: Boolean,
  damageProfile: DamageProfile
}
```

### After (Canonical)

```javascript
{
  id: String (required),
  shipName: String (required),
  status: String (default: null),
  model: String (required, default: 'Scavenger Pod'),
  tier: Number (required, 1-10, default: 1),
  createdAt: String (required),
  inventory: [InventoryItemReference] (default: []),
  spatial: SpatialStateSchema (required),           // NEW
  motion: MotionStateSchema (default: null),        // NEW
  launchable: Boolean (required, default: true),
  damageProfile: DamageProfile (default: null)
}
```

### Indexes

- No explicit indexes (embedded document)

---

## Celestial Body Schema (Root Document, Collection: `cb`)

### Before (Legacy)

```javascript
{
  id: String,
  catalogId: String,
  solarSystemId: String,                    // REMOVED (now in spatial)
  sourceScanId: String,
  createdByCharacterId: String,
  createdAt: String,
  updatedAt: String,
  location: { positionKm: Triple },        // REMOVED
  kinematics: {                             // REMOVED
    velocityKmPerSec: Triple,
    angularVelocityRadPerSec: Triple,
    estimatedMassKg: Number,
    estimatedDiameterM: Number
  },
  composition: AsteroidMaterialProfile,
  state: String,
  destroyedAt: String,
  destroyedReason: String,
  debris: [DebrisMaterial]
}
```

### After (Canonical)

```javascript
{
  id: String (required, unique, indexed),
  catalogId: String (required, indexed),
  sourceScanId: String (required, indexed),
  createdByCharacterId: String (required, indexed),
  missionId: String (default: null, indexed),
  missionInstanceId: String (default: null),
  createdAt: String (required),
  updatedAt: String (required),
  spatial: SpatialStateSchema (required),                      // NEW
  motion: MotionStateSchema (default: null),                   // NEW
  physical: PhysicalStateSchema (default: null),               // NEW
  observability: ObservabilityStateSchema (required),          // NEW
  composition: AsteroidMaterialProfile,
  state: String (enum: ['unscanned', 'active', 'destroyed'], default: 'active', indexed),
  destroyedAt: String (default: null),
  destroyedReason: String (default: null),
  debrisSeed: Number (default: null),
  debris: [DebrisMaterial] (default: [])
}
```

### Indexes

```javascript
// Spatial index for bounding-box prefilter on distance queries
db.cb.createIndex({
  'spatial.solarSystemId': 1,
  'spatial.positionKm.x': 1,
  'spatial.positionKm.y': 1,
  'spatial.positionKm.z': 1,
});

// Mission/scan queries
db.cb.createIndex({
  createdByCharacterId: 1,
  missionId: 1,
  sourceScanId: 1,
});

// Single-field indexes
db.cb.createIndex({ id: 1, unique: true });
db.cb.createIndex({ catalogId: 1 });
db.cb.createIndex({ sourceScanId: 1 });
db.cb.createIndex({ createdByCharacterId: 1 });
db.cb.createIndex({ missionId: 1 });
db.cb.createIndex({ state: 1 });
```

---

## Market Schema (Root Document, Collection: `markets`)

### Before (Legacy)

```javascript
{
  marketId: String,
  solarSystemId: String,
  marketName: String,
  locationType: String,          // RENAMED
  locationName: String,          // RENAMED
  positionKm: Triple,            // REMOVED (now in spatial)
  orbit: OrbitSchema,            // CHANGED (now wrapped in trajectory)
  priceMultiplier: Number,
  driftPercentPerHour: Number,
  restockIntervalMinutes: Number,
  lastRestockAt: String,
  inventory: [MarketInventoryEntry],
  ledger: [MarketLedgerEntry]
}
```

### After (Canonical)

```javascript
{
  marketId: String (required),
  solarSystemId: String (required, indexed),
  marketName: String (required),
  siteType: String (enum: ['station', 'surface-settlement', 'free-floating'], required),      // RENAMED
  siteName: String (required),                                                                 // RENAMED
  spatial: SpatialStateSchema (required),                       // NEW
  trajectory: TrajectoryDescriptorSchema (default: null),       // NEW (wraps orbit)
  isStarterMarket: Boolean (required, default: false),
  priceMultiplier: Number (required, default: 1),
  driftPercentPerHour: Number (required, default: 0),
  restockIntervalMinutes: Number (required, default: 60),
  lastRestockAt: String (required),
  inventory: [MarketInventoryEntry] (default: []),
  ledger: [MarketLedgerEntry] (default: [])
}
```

### Indexes

```javascript
// Unique market per system
db.markets.createIndex(
  {
    marketId: 1,
    solarSystemId: 1,
  },
  { unique: true }
);

// System query
db.markets.createIndex({ solarSystemId: 1 });
```

---

## Migration Path

### Data Migration Strategy

For existing databases with legacy schemas:

1. **Backup**: Full backup before any migration
2. **Add new fields**: Add `spatial`, `motion`, `physical`, `observability`, `trajectory` fields to all documents
3. **Migrate data**:

   ```javascript
   // Ships
   db.players.updateMany({}, [
     {
       $set: {
         'characters.$[c].ships.$[s].spatial': {
           solarSystemId: '$characters.$[c].ships.$[s].kinematics.reference.solarSystemId',
           frame: 'barycentric',
           positionKm: '$characters.$[c].ships.$[s].location.positionKm',
           epochMs: '$characters.$[c].ships.$[s].kinematics.reference.epochMs',
         },
         'characters.$[c].ships.$[s].motion': {
           velocityKmPerSec: '$characters.$[c].ships.$[s].kinematics.velocity',
         },
       },
     },
     {
       $unset: ['characters.$[c].ships.$[s].location', 'characters.$[c].ships.$[s].kinematics'],
     },
   ]);

   // Celestial Bodies
   db.cb.updateMany({}, [
     {
       $set: {
         spatial: {
           solarSystemId: '$solarSystemId',
           frame: 'barycentric',
           positionKm: '$location.positionKm',
           epochMs: 0,
         },
         motion: {
           velocityKmPerSec: '$kinematics.velocityKmPerSec',
           angularVelocityRadPerSec: '$kinematics.angularVelocityRadPerSec',
         },
         physical: {
           estimatedMassKg: '$kinematics.estimatedMassKg',
           estimatedDiameterM: '$kinematics.estimatedDiameterM',
         },
         observability: {
           visibility: '$visibility',
           scanState: '$scanState',
         },
       },
     },
     {
       $unset: ['location', 'kinematics', 'solarSystemId', 'visibility', 'scanState'],
     },
   ]);

   // Markets
   db.markets.updateMany({}, [
     {
       $set: {
         spatial: {
           solarSystemId: '$solarSystemId',
           frame: 'barycentric',
           positionKm: '$positionKm',
           epochMs: 0,
         },
         siteType: '$locationType',
         siteName: '$locationName',
         trajectory: {
           kind: 'orbital-elements',
           orbit: '$orbit',
         },
       },
     },
     {
       $unset: ['locationType', 'locationName', 'positionKm', 'orbit'],
     },
   ]);
   ```

4. **Validation**: Run queries to ensure all documents have required fields
5. **Remove legacy fields**: Drop unused fields from schema (optional, after cutover)
6. **Update indexes**: Rebuild spatial indexes
7. **Test**: Run full test suite with migrated data
8. **Deploy**: Push application code and database state together

### Rollback Plan

- Keep legacy field values in database during transition (ignored by code)
- Can revert to legacy reader code if issues arise
- Backward compatibility layer allows reading either format

---

## Field Descriptions

### spatial (All in-world entities)

- **Required**: Yes (all ships, bodies, markets)
- **Purpose**: Authoritative position in barycentric reference frame
- **Usage**: All distance calculations, scene visibility, docking proximity
- **Computed At**: Request time (resolved from orbit if needed)
- **Consistency**: All entities in same response must have matching `epochMs`

### motion (Ships and Celestial Bodies)

- **Required**: No
- **Purpose**: Velocity vectors for kinematic calculations
- **Usage**: Trajectory prediction, relative velocity checks
- **Inclusion**: Only present if entity has non-zero velocity

### physical (Celestial Bodies)

- **Required**: No
- **Purpose**: Physical properties (mass, diameter)
- **Usage**: Scanning, resource estimation, gravitational calculations
- **Inclusion**: Only present if body has known mass/diameter

### observability (Celestial Bodies)

- **Required**: Yes
- **Purpose**: Visibility and scan state for client rendering
- **Values**: visibility ∈ {visible, not-visible, cloaked}, scanState ∈ {unscanned, scanned}
- **Usage**: Fog of war, scan target identification

### trajectory (Markets)

- **Required**: No
- **Purpose**: Orbital motion description (if orbiting)
- **Kind Values**: `'static'` (fixed position) or `'orbital-elements'` (Kepler orbit)
- **Computation**: Positions computed from orbital elements + anchor body position

---

## Performance Considerations

### Spatial Indexing

- Compound index on `(spatial.solarSystemId, spatial.positionKm.x/y/z)` enables bounding-box prefilter
- Significantly faster than computing all distances server-side
- Used in: `celestial-body-list-by-location`, distance-filtered queries

### Epoch Consistency

- All responses in same snapshot should share `epochMs`
- Reduces network chatter for position updates
- Clients can interpolate between epochs locally

### Trade-offs

- Market positions can be:
  - **Option A**: Pre-computed and stored in `spatial.positionKm` (faster reads, requires periodic updates)
  - **Option B**: Computed from orbit on each request (accurate, slower reads)
  - Current: **Option B** (computed per-request)

---

## References

- [SPATIAL_MODEL_IMPLEMENTATION.md](./SPATIAL_MODEL_IMPLEMENTATION.md) - Backend implementation
- [SPATIAL_MODEL_RESPONSE_CONTRACTS.md](./SPATIAL_MODEL_RESPONSE_CONTRACTS.md) - Response shapes
- [src/db/models.js](./src/db/models.js) - Mongoose schema definitions
