# NPC Buildout Mechanism

Status: Active
Date: 2026-06-12
Repo: solid-train
Audience: Developers and agents adding new seeded NPCs
Default output: Plan plus seed-data checklist

## 1. Purpose

Use this procedure when adding the next seeded NPC to the game.

This mechanism is designed to avoid ad hoc NPC additions by forcing the same intake, planning, persistence, and verification steps that were used to add Elias Fujimoto.

The expected outcome is:

1. A concrete NPC intake payload.
2. A planning file in docs/planning/npc.
3. A seed-data implementation path.
4. Persistence through current NPC bust and owner-state models unless a broader ownership change is intentionally in scope.

## 2. When To Use This

Use this mechanism when the NPC is any of the following:

1. A market owner.
2. A seeded stationary NPC at a known location.
3. A canonical named NPC whose identity must persist across restarts.
4. An NPC that needs bust data, owner state, credits, market linkage, or runtime query support.

Do not use this mechanism when the task is actually:

1. A broader ownership contract change.
2. Temporary encounter-only NPC logic.
3. Dialogue or behavior design without seed/persistence work.

## 3. Intake Form

Collect these fields before implementation.

### Identity

1. NPC name
2. Canonical npcId preference, if already known
3. NPC role
4. Solar system id

### Location

1. marketId
2. marketName
3. locationName
4. Whether the NPC is currently located at that market

### Appearance

1. faceShape
2. skinTone
3. hairStyle
4. hairColor
5. eyeStyle
6. eyeColor
7. expressionPreset
8. apparelAccent
9. facialHair
10. scar
11. tattoo

### Economy

1. Starting credits
2. Credit variability range min
3. Credit variability range max
4. Whether credit updates are expected at runtime

### Delivery Scope

1. Plan only, or plan plus implementation
2. Seed and persistence only, or broader runtime surfaces
3. Whether startup logs should mention this NPC
4. Whether any contract exposure is explicitly in scope

## 4. Recommended Intake Prompt

Use this prompt when gathering the next NPC.

```text
New NPC request.

Provide the following:

1. NPC name
2. NPC role
3. solarSystemId
4. marketId
5. marketName
6. locationName
7. Whether the NPC is currently located at this market
8. faceShape
9. skinTone
10. hairStyle
11. hairColor
12. eyeStyle
13. eyeColor
14. expressionPreset
15. apparelAccent
16. facialHair
17. scar
18. tattoo
19. starting credits
20. variability range min and max
21. Whether this should be seed plus persistence only, or include additional runtime/contract work
22. Preferred planning filename under docs/planning/npc

If any field is unknown, mark it TBD.
```

## 5. Planning Output Procedure

After intake is complete:

1. Create a planning file in docs/planning/npc named after the NPC and location.
2. Mark whether the work is seed-only or seed-plus-runtime-helper work.
3. Explicitly record whether contract changes are out of scope.
4. Include canonical ids, appearance payload, credits policy, and verification steps.
5. Include startup logging requirements when applicable.

## 6. Seed-Data Checklist

For each NPC, confirm the following implementation targets.

1. Add or update the seed source in src/model/solar-system-npc-seed.js.
2. Define deterministicSeed and canonical npcId.
3. Add descriptor fields required by the NpcBust schema.
4. Add owner-state payload: solarSystemId, marketId, marketName, locationName, name, credits.
5. Confirm credit range values are valid and intentional.
6. Confirm the target market already exists and the marketId is canonical.

## 7. Persistence Checklist

1. NPC bust persists through NpcBust.
2. Owner identity and credits persist through GameState owner state.
3. NPC seed-state version remains idempotent.
4. In-memory bootstrap path also hydrates the NPC.
5. Runtime helpers can resolve the NPC by npcId and by market.

## 8. Verification Checklist

1. The NPC appears in the seed builder for the intended solar system.
2. Startup seeding persists or hydrates the NPC without duplicates.
3. Startup logs include one line for the seeded NPC when logging is required.
4. Market owner lookup resolves the NPC correctly.
5. Credits read helpers return expected values.
6. Credit update helpers clamp to the configured range.
7. Bulk profile and owned-market helpers remain consistent.

## 9. Decision Gate

Before implementing, ask one final question:

Is this still a narrow NPC seed/persistence task, or has it become an ownership/contract task?

If it has become an ownership or contract task, stop and move the work into the ownership planning track before editing implementation files.

## 10. Suggested File Set

For a standard seeded market-owner NPC, expect work in these files:

1. src/model/solar-system-npc-seed.js
2. src/db/service/npc-seed-state-service.js
3. src/db/service.js
4. src/handlers/context/npc-service.js
5. src/handlers/message-handler-context.js
6. src/handlers/context/context-bootstrap-service.js
7. src/server.js
8. test/solar-system-npc-seed.test.js
9. test/npc-seeding-context.test.js
10. test/db-service-branch.mongo.integration.test.js
11. docs/planning/npc/<new-npc-plan>.md

## 11. Minimal Done Definition

An NPC added through this mechanism is done when:

1. The planning file exists.
2. The NPC is seeded with canonical bust and owner data.
3. The NPC persists through current models.
4. The NPC can be resolved through runtime helpers.
5. The targeted tests are green.
6. The task has not silently expanded into ownership contract work.