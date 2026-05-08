---
Owner: Project Maintainers
Last Verified: 2026-05-08
Status: Living
---

# Spatial Model (Canonical)

This is the canonical spatial-model reference for backend schemas and response contracts.

## Scope

- Canonical entity shape for ships, celestial bodies, markets, and deployed items.
- Canonical storage shape in MongoDB schemas.
- Canonical response shape in Socket.IO payloads.
- Legacy field policy and hard-cut behavior.

## Canonical Core Types

### SpatialState (required)

```json
{
  "solarSystemId": "sol",
  "frame": "barycentric",
  "positionKm": { "x": 0, "y": 0, "z": 0 },
  "epochMs": 1713360000000
}
```

### MotionState (optional)

```json
{
  "velocityKmPerSec": { "x": 0.1, "y": 0, "z": 0.02 },
  "angularVelocityRadPerSec": { "x": 0, "y": 0, "z": 0 }
}
```

### PhysicalState (optional, celestial bodies)

```json
{
  "estimatedMassKg": 1e18,
  "estimatedDiameterM": 500
}
```

### ObservabilityState (required, celestial bodies)

```json
{
  "visibility": "visible",
  "scanState": "scanned"
}
```

### TrajectoryDescriptor (optional, markets)

```json
{
  "kind": "orbital-elements",
  "orbit": {
    "anchorBodyId": "ceres",
    "orbitType": "elliptical"
  }
}
```

## Canonical Entity Rules

### Ships

- Required: `spatial`.
- Optional: `motion`, `driveProfile`, `damageProfile`.
- Rejected legacy request fields: `location`, `kinematics`.

### Celestial Bodies

- Required: `spatial`, `observability`.
- Optional: `motion`, `physical`.
- Rejected legacy request fields: `location`, `kinematics`, root `solarSystemId`.

### Markets

- Required: `spatial`, `siteType`, `siteName`.
- Optional: `trajectory` (`kind: static|orbital-elements`).
- Canonical response distance unit: `distanceAu`.

### Items

- Deployed items: canonical `spatial` (+ optional `motion`).
- Contained items: `spatial: null`.
- Rejected legacy request field: `item.kinematics`.

## MongoDB Canonical Notes

- Spatial indexing is performed with `spatial.solarSystemId` + `spatial.positionKm.{x,y,z}`.
- Collections participating in canonical spatial storage include `items`, `cb`, and `markets`.
- Player-owned ships remain embedded under players, but use canonical `spatial` and optional `motion`.

## Response Contract Canonical Notes

- In-world entity responses use canonical `spatial`; `motion` is optional.
- Market responses use `siteType`/`siteName`, `spatial`, optional `trajectory`, and `distanceAu` where distance is returned.
- `trajectory.kind` (when present) is `static` or `orbital-elements`.

## Legacy Policy

- Canonical-only request boundaries are enforced for ship, celestial body, and item spatial payloads.
- Internal compatibility readers were transitional and are removed as part of the hard-cut path.

## Related Living Docs

- [MESSAGE_CONTRACT.md](../MESSAGE_CONTRACT.md)
- [MONGODB_SCHEMA.md](../MONGODB_SCHEMA.md)
- [CODEBASE.md](../CODEBASE.md)

## Historical Snapshots

- [docs/history/2026-05-05_mongodb-schema-spatial-model.md](history/2026-05-05_mongodb-schema-spatial-model.md)
- [docs/history/2026-05-05_spatial-model-response-contracts.md](history/2026-05-05_spatial-model-response-contracts.md)
- [docs/history/2026-05-05_spatial-model-implementation.md](history/2026-05-05_spatial-model-implementation.md)
