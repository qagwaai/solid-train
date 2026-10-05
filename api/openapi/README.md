# Stellar API - Modular OpenAPI Structure

## Overview

The Stellar API contract is organized into **16 semantic tags**, each representing a distinct domain:

1. **Utility** — Health checks
2. **Auth** — Authentication (register, login)
3. **Character** — Character management
4. **Ship** — Ship operations
5. **Mission** — Mission lifecycle
6. **Celestial** — Celestial body queries
7. **Items** — Item management and inventory
8. **Market** — Market operations
9. **Context** — Context queries (distance, routing)
10. **SolarSystem** — Solar system queries
11. **Stars** — Star catalog
12. **Ledger** — Credit ledger
13. **Game** — Game state and lifecycle
14. **Realtime** — Realtime messaging
15. **Bust** — Character customization/appearance
16. **\_shared** — Schemas used across multiple tags

## Directory Structure

```
api/
  openapi.yaml                 # Master contract (single source of truth)
  openapi/
    utility/openapi.yaml       # Utility tag documentation
    auth/openapi.yaml          # Auth tag documentation
    character/openapi.yaml     # Character tag documentation
    ship/openapi.yaml          # Ship tag documentation
    ... (15 more tags)
    _shared/schemas.yaml       # Shared schemas (ErrorResponse, ExternalObject*)
  schemas/                      # JSON Schema definitions (~120 files)
  artifacts/contracts/          # Generated contract artifacts
```

## Design Pattern

### Master File (`api/openapi.yaml`)

- **Entry point and version authority** for the complete API contract
- References domain operation modules and JSON Schema files
- Contract version is 4.0.0
- Used by:
  - Swagger UI (`GET /docs`)
  - Contract hardening tests
  - OpenAPI validation tools
  - Contract artifact generation

### Modular References (`api/openapi/{tag}/`)

- **Canonical operation definitions** organized by semantic domain
- The root contract references these modules and their JSON Schemas

### Shared Schemas (`api/openapi/_shared/schemas.yaml`)

- Schemas used by 2+ tags (currently ErrorResponse + ExternalObject* schemas)
- Extensible as contract grows

## Contract ownership

The root OpenAPI file is the entry point and version authority. Domain modules and JSON Schemas
are canonical contract sources referenced by the root. Keep module versions aligned with the root
when a contract release changes their behavior.

Celestial body IDs are durable canonical identities and are the deterministic appearance-generator
input for clients. Every celestial-body response and upsert requires a non-null `surfaceArchetype`;
this semantic field is independent of `planetType` and generated texture data.

## Usage

### For Developers

- Consult `api/openapi/{tag}/openapi.yaml` to understand domain operations
- Read `api/openapi.yaml` for complete contract details

### For Tooling

- Swagger UI: `GET http://localhost:3000/docs` (reads main file)
- Celestial-body contract guidance: `GET http://localhost:3000/docs/celestial-body-contract.md`
- Contract validation: `npm run contract:*` (reads main file)
- Contract generation: `npm run contract:artifact` (reads main file)

### For Testing

- All existing tests remain unchanged
- Tests read from `api/openapi.yaml` directly
- Breaking contract changes use a major version bump; 4.0.0 requires canonical celestial-body `surfaceArchetype` values
