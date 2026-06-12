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
16. **_shared** — Schemas used across multiple tags

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
- **Single source of truth** for the complete API contract
- All paths and schemas defined inline
- Version managed here (currently 3.1.0)
- Used by:
  - Swagger UI (`GET /docs`)
  - Contract hardening tests
  - OpenAPI validation tools
  - Contract artifact generation

### Modular References (`api/openapi/{tag}/`)
- **Documentation and organization** by semantic domain
- Each file contains conceptual description of that tag's operations
- Can be extended in future to support full decomposition with `$ref` imports
- Acts as organizational guide for developers

### Shared Schemas (`api/openapi/_shared/schemas.yaml`)
- Schemas used by 2+ tags (currently ErrorResponse + ExternalObject* schemas)
- Extensible as contract grows

## Migration Path

**Current State (3.1.0):** Master-only with modular documentation  
**Future State:** Full decomposition with `$ref` imports in main file  
**Benefits:**
- Tests and tooling continue to work immediately
- Organizational structure established
- Foundation for gradual migration to fully modular contract
- Easier to onboard new developers to specific tag domains

## Usage

### For Developers
- Consult `api/openapi/{tag}/openapi.yaml` to understand domain operations
- Read `api/openapi.yaml` for complete contract details

### For Tooling
- Swagger UI: `GET http://localhost:3000/docs` (reads main file)
- Contract validation: `npm run contract:*` (reads main file)
- Contract generation: `npm run contract:artifact` (reads main file)

### For Testing
- All existing tests remain unchanged
- Tests read from `api/openapi.yaml` directly
- Version bump to 3.1.0 tracked for API evolution
