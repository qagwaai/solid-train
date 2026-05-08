# Spatial Model Implementation - Backend Cutover

**Status**: Core implementation complete. Tests require fixture updates.  
**Date**: May 5, 2026  
**Frontend Status**: Complete (1181 tests passing)

## Overview

The backend has implemented the canonical spatial model where:

- Every in-world entity (Ships, CelestialBodies, Markets) has a **required `spatial` field**
- Motion is **optional** and stored separately
- Legacy fields (`location`, `kinematics`) are being phased out
- Frame is hardcoded to `'barycentric'`

## What Changed

### MongoDB Schemas (src/db/models.js)

#### Ships

```javascript
// Before
ship = {
  location: { positionKm: Triple },
  kinematics: { position: Triple, velocity: Triple, reference: { solarSystemId, epochMs } }
}

// After (canonical)
ship = {
  spatial: { solarSystemId, frame: 'barycentric', positionKm, epochMs }, // REQUIRED
  motion?: { velocityKmPerSec, angularVelocityRadPerSec? }              // OPTIONAL
}
```

#### Celestial Bodies

```javascript
// Before
body = {
  solarSystemId,
  location: { positionKm },
  kinematics: { velocityKmPerSec, angularVelocityRadPerSec, estimatedMassKg, estimatedDiameterM },
  scanState, visibility
}

// After (canonical)
body = {
  spatial: { solarSystemId, frame: 'barycentric', positionKm, epochMs },  // REQUIRED
  motion?: { velocityKmPerSec, angularVelocityRadPerSec? },              // OPTIONAL
  physical?: { estimatedMassKg?, estimatedDiameterM? },                  // OPTIONAL
  observability: { visibility, scanState }                              // REQUIRED
}
```

#### Markets

```javascript
// Before
market = {
  locationType,
  locationName,
  positionKm,
  orbit: { /* orbital elements */ }
}

// After (canonical)
market = {
  siteType,         // Renamed from locationType
  siteName,         // Renamed from locationName
  spatial: { solarSystemId, frame: 'barycentric', positionKm, epochMs }, // REQUIRED
  trajectory?: {                                                          // OPTIONAL
    kind: 'orbital-elements',
    orbit: { /* unchanged orbital elements */ }
  }
}
```

### Normalization Layer (src/handlers/message-handler-context.js)

#### New Methods Added

- `normalizeSpatialState(value)` - Validates and normalizes spatial state
- `normalizeTriple(value)` - Validates 3D coordinate vectors
- `normalizeMotionState(value)` - Optional velocity/angular-velocity
- `normalizePhysicalState(value)` - Optional mass/diameter
- `normalizeObservabilityState(value)` - Visibility and scan state
- `convertLegacyShipToSpatial(ship)` - Backward compatibility converter
- `convertLegacyShipToMotion(ship)` - Backward compatibility converter
- `convertLegacyCelestialBodyToSpatial(body)` - Backward compatibility converter
- `convertLegacyCelestialBodyToMotionAndPhysical(body)` - Backward compatibility converter

#### Updated Methods

- `normalizeShip()` - Now requires spatial, optionally includes motion
- `normalizeCelestialBody()` - Now requires spatial + observability, optionally includes motion/physical
- `normalizeMarket()` - Now uses spatial, wraps orbit in trajectory descriptor
- `getShipPositionKm()` - Checks spatial first, then legacy fields
- `resolveMarketPositionKmAsync()` - Uses spatial directly or computes from orbit

### Test Fixtures (test-support/message-handler-test-helpers.js)

#### New Helper Functions

```javascript
createSpatialState(overrides); // Default: sol barycentric at origin
createMotionState(overrides); // Default: no motion
createPhysicalState(overrides); // Default: typical asteroid properties
createObservabilityState(overrides); // Default: visible, scanned
createShip(overrides); // Creates ship with spatial
createCelestialBody(overrides); // Creates body with spatial + observability
createMarket(overrides); // Creates market with spatial
```

## Implementation Status

### ✅ Complete

1. **Core Model Interfaces** (`src/model/spatial-model.js`)
   - SpatialState, MotionState, PhysicalState, ObservabilityState, TrajectoryDescriptor
   - Helper validators: `isTriple()`, `isSpatialState()`
   - Distance calculations: `distanceKm()`, `distanceKmSquared()`

2. **MongoDB Schemas** (`src/db/models.js`)
   - Ship schema: `spatial` (required), `motion` (optional)
   - CelestialBody schema: `spatial` (required), `observability` (required), `motion`/`physical` (optional)
   - Market schema: `spatial` (required), `trajectory` (optional)
   - Database indexes updated for spatial queries

3. **Normalization Layer** (`src/handlers/message-handler-context.js`)
   - All spatial/motion/physical/observability normalizers
   - Backward compatibility layer for legacy location/kinematics
   - Updated ship/celestial body/market normalization

4. **Starter Ship Creation** (`src/handlers/character-add-message-handler.js`)
   - Character starter ships now include spatial state

5. **Test Fixture Helpers** (`test-support/message-handler-test-helpers.js`)
   - New factory functions for creating spatial-aware entities

### 🔄 In Progress

- Test fixture updates (migrating existing tests to use new helpers)
- Handler request validation (ship-upsert, celestial-body-upsert)

### ⏳ Remaining

- Message contract documentation updates
- MongoDB schema documentation updates
- Full test suite validation

## Backward Compatibility

The normalization layer includes conversion helpers that automatically convert legacy location/kinematics fields to spatial/motion during normalization. This means:

- Old test fixtures using `location`/`kinematics` will be automatically converted
- During database reads, legacy data is converted on-the-fly
- **New** ships/bodies must provide spatial state (no fallback)

### Conversion Rules

**Ships:**

```javascript
// Legacy location + kinematics.reference.solarSystemId → new spatial
ship.location.positionKm        → spatial.positionKm
ship.kinematics.reference.solarSystemId → spatial.solarSystemId
ship.kinematics.reference.epochMs → spatial.epochMs
ship.kinematics.velocity        → motion.velocityKmPerSec
```

**Celestial Bodies:**

```javascript
// Legacy location + solarSystemId → new spatial
body.location.positionKm            → spatial.positionKm
body.solarSystemId                  → spatial.solarSystemId
body.kinematics.velocityKmPerSec    → motion.velocityKmPerSec
body.kinematics.angularVelocityRadPerSec → motion.angularVelocityRadPerSec
body.kinematics.estimatedMassKg     → physical.estimatedMassKg
body.kinematics.estimatedDiameterM  → physical.estimatedDiameterM
body.scanState                      → observability.scanState
body.visibility                     → observability.visibility
```

## Key Rules (Hard Cut)

1. **No fallback readers**: Once migration is complete, code does not check legacy fields
2. **One truth**: Position is only in `spatial.positionKm`; never computed or inferred
3. **Frame safety**: All distance calculations assert matching `solarSystemId` and `frame: 'barycentric'`
4. **Required fields**:
   - Ships: `spatial` is always required
   - Celestial Bodies: `spatial` and `observability` are always required
   - Markets: `spatial` is always required
5. **Optional motion**: Ships and bodies may lack motion; `undefined` is valid

## Testing Approach

### Option A: Update Existing Fixtures

Update test files to use new factory helpers:

```javascript
const {
  createShip,
  createCelestialBody,
  createMarket,
} = require('../test-support/message-handler-test-helpers');

const ship = createShip({
  id: 'ship-1',
  spatial: { positionKm: { x: 100, y: 200, z: 300 } },
});

const body = createCelestialBody({
  id: 'asteroid-1',
  observability: { visibility: 'visible', scanState: 'scanned' },
});
```

### Option B: Rely on Backward Compatibility

Continue using old fixture format; conversion layer handles it automatically during normalization:

```javascript
// Old format - still works during transition
const body = {
  location: { positionKm: { x: 100, y: 200, z: 300 } },
  solarSystemId: 'sol',
  kinematics: {
    /* ... */
  },
};
// Automatically converted to spatial + motion + physical during normalize
```

## Validation Rules (Strict Mode)

Once legacy support is removed:

```javascript
// ✅ Valid
{
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 0, y: 0, z: 0 },
    epochMs: 1713360000000
  },
  motion: { velocityKmPerSec: { x: 1, y: 0, z: 0 } }
}

// ❌ Invalid - missing required spatial
{ motion: { velocityKmPerSec: { x: 1, y: 0, z: 0 } } }

// ❌ Invalid - wrong frame
{ spatial: { ..., frame: 'body-centered' } }

// ❌ Invalid - legacy field
{ location: { positionKm: {...} }, spatial: {...} }
```

## Next Steps

1. **Run full test suite** with backward compatibility layer to identify remaining failures
2. **Update failing test fixtures** to use new factory helpers OR verify backward compatibility works
3. **Add request validation** to handlers (ship-upsert, celestial-body-upsert) to reject payloads with legacy fields
4. **Update MESSAGE_CONTRACT.md** with new response shapes and examples
5. **Update MONGODB_SCHEMA.md** with new field layouts
6. **Integration test** with frontend consuming new response structure
7. **Remove backward compatibility layer** once all tests pass and database is migrated
8. **Deploy** with hard cutover

## Questions for Frontend Team

- Should backend compute market positions from orbit at request time, or use pre-computed spatial?
- For celestial body responses in list views, what distance calculation epoch should be used?
- Are there any client-side caches that need invalidation with the new model?

## Files Changed

- `src/model/spatial-model.js` (NEW)
- `src/db/models.js` (MAJOR: Schema updates)
- `src/handlers/message-handler-context.js` (MAJOR: Normalization layer)
- `src/handlers/character-add-message-handler.js` (Updated starter ship)
- `test-support/message-handler-test-helpers.js` (New factory functions)

## References

- Architecture Decision: See `spatial-model-architecture-decision.md` (if available in frontend repo)
- Frontend Status: All 1181 tests passing with new structure
- Message Contracts: Will be updated in MESSAGE_CONTRACT.md
