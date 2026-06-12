#!/bin/bash

# Extract and create modular OpenAPI files
MAIN="api/openapi.yaml"
OUT_DIR="api/openapi"

echo "Reading main openapi.yaml structure..."

# Create _shared/schemas.yaml with common schemas
cat > "$OUT_DIR/_shared/schemas.yaml" << 'YAML'
openapi: 3.0.3
info:
  title: Stellar API - Shared Schemas
  version: 3.1.0
components:
  schemas:
    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        reason:
          type: string
        details:
          type: object
YAML

echo "✓ Created _shared/schemas.yaml"

# List of tags to create
declare -a TAGS=(
  "utility"
  "auth"
  "character"
  "ship"
  "mission"
  "celestial"
  "items"
  "market"
  "context"
  "solarsystem"
  "stars"
  "ledger"
  "game"
  "realtime"
  "bust"
)

for tag in "${TAGS[@]}"; do
  cat > "$OUT_DIR/$tag/openapi.yaml" << YAML
openapi: 3.0.3
info:
  title: Stellar API - ${tag^}
  version: 3.1.0
servers:
  - url: http://localhost:3000
tags:
  - name: ${tag^}
paths: {}
components:
  schemas: {}
YAML
  echo "✓ Created $tag/openapi.yaml"
done

echo ""
echo "Modular structure created. Next: Extract actual paths and schemas"
