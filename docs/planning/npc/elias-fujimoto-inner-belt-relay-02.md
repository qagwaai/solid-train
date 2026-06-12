# Elias Fujimoto - Inner Belt Relay 02 NPC Implementation Plan

Status: Complete
Date: 2026-06-12
Completed: 2026-06-12
Repo: solid-train
Scope: Data seeding and persistence only

## 1. Objective

Introduce Elias Fujimoto as the persisted market owner of sol-belt-02, Belt Prospectors Exchange, located at Inner Belt Relay 02, using current data models and startup seed flow.

This implementation should:

1. Persist Elias Fujimoto using existing persistence models.
2. Link the NPC to sol-belt-02 and Inner Belt Relay 02.
3. Store a fixed seeded credit value plus variability metadata.
4. Emit a startup log line for each NPC successfully seeded.

## 2. Implementation Boundaries

In scope:

1. NPC seed source of truth for Elias Fujimoto.
2. NPC bust persistence via existing NpcBust model.
3. Market-owner state persistence via existing GameState model.
4. Startup seeding integration and startup logging.
5. Unit and integration test coverage for NPC seed and persistence behavior.

Out of scope:

1. Dialogue, interactions, or gameplay behavior.
2. OpenAPI or response contract exposure.
3. New database schemas beyond current NpcBust and GameState usage.

## 3. Implementation Sequence

1. Create the solar-system NPC seed model and define canonical Elias Fujimoto seed data.
2. Add GameState-backed persistence wrappers for NPC owner state and NPC seed-state versioning.
3. Add context-level startup seeding flow for NPCs with deterministic idempotency.
4. Add one startup log message per successfully seeded NPC with NPC id, name, market, and location.
5. Add tests for seed payload shape, DB owner-state persistence, cached rerun behavior, and logging.

## 4. Canonical Seed Data

1. npcId: sol-belt-02-market-owner-elias-fujimoto
2. Name: Elias Fujimoto
3. marketId: sol-belt-02
4. marketName: Belt Prospectors Exchange
5. locationName: Inner Belt Relay 02
6. Appearance overrides:
   - faceShape: square
   - skinTone: light
   - hairStyle: mid-fade
   - hairColor: silver
   - eyeStyle: narrow
   - eyeColor: amber
   - expressionPreset: neutral
   - apparelAccent: hood
   - facialHair: goatee
   - scar: brow-right
   - tattoo: neck-left
7. Credits: fixed seeded value plus variable range metadata.

## 5. Persistence Strategy

1. Persist bust/visual identity in NpcBust.
2. Persist owner identity, location, and credits state in GameState.
3. Persist NPC seed-state version separately in GameState so startup reseed remains idempotent.
4. Reuse startup logger output to make each seeded NPC visible during boot.

## 6. Verification

1. Verify Elias Fujimoto is returned by the NPC seed model for sol only.
2. Verify startup seeding writes NpcBust, owner GameState, and NPC seed-state entries.
3. Verify rerun with current seed version reuses persisted data without duplicate writes.
4. Verify boot logs include one line per successfully seeded NPC.
5. Verify market seeding behavior remains unchanged.

Status update (2026-06-12): Complete.

Evidence:

1. Elias Fujimoto seed source of truth added in src/model/solar-system-npc-seed.js.
2. NPC owner persistence and seed-state flow implemented in src/db/service/npc-seed-state-service.js and surfaced through src/db/service.js.
3. Runtime NPC seed, lookup, owner-market traversal, and credit mutation helpers implemented in src/handlers/context/npc-service.js.
4. Startup bootstrap and startup logging integrated in src/handlers/context/context-bootstrap-service.js and src/server.js.
5. Market-side joins to owner profiles implemented in src/handlers/context/market-operations-service.js.
6. Focused unit and integration coverage added in test/solar-system-npc-seed.test.js, test/npc-seeding-context.test.js, test/context-bootstrap-service.test.js, test/market-operations-service.test.js, and test/db-service-branch.mongo.integration.test.js.

## 7. Relevant Files

1. src/model/solar-system-npc-seed.js
2. src/db/service/npc-seed-state-service.js
3. src/db/service.js
4. src/handlers/context/npc-service.js
5. src/handlers/message-handler-context.js
6. src/server.js
7. test/solar-system-npc-seed.test.js
8. test/npc-seeding-context.test.js
9. test/db-service-branch.mongo.integration.test.js