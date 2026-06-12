# Ownership Contract Formalization Plan

Status: Draft
Date: 2026-06-12
Repo: solid-train
Priority: Follow current NPC slice

## 1. Why This Is Separate

The current Elias Fujimoto work is a narrow NPC seed and persistence slice.

This ownership discussion is broader:

1. Markets can have owners.
2. NPCs and characters can own entities.
3. Items and ships already imply ownership.
4. Ownership can change through salvage, piracy, sale, and similar transfer flows.

That means this is not just a continuation of the Elias NPC task. It is a cross-cutting contract and persistence change that should be planned separately.

## 2. Decision

Close out the current NPC plan first, then begin ownership contract formalization as a new workstream.

Reason:

1. The NPC slice is currently scoped to seed and persistence behavior.
2. Ownership formalization affects multiple domains and APIs at once.
3. Mixing them would blur validation boundaries and increase rollback risk.

## 3. Problem Statement

Ownership exists today, but not as a single formalized canonical model across all owned entities.

Current state appears implicit and fragmented:

1. Ships have ownership metadata.
2. Items have ownership metadata.
3. NPC market ownership is being introduced through local seed/state plumbing.
4. Markets do not yet expose a formal ownership contract.

The repo needs an explicit ownership model that is shared across item, ship, NPC, character, and market surfaces.

## 4. Target Direction

Introduce a canonical ownership contract that can represent:

1. Owner type.
2. Owner identity.
3. Owned entity type.
4. Ownership acquisition source.
5. Ownership transfer history or current transfer reason.
6. Contract-visible ownership on entities where clients need it.

## 5. Likely Scope Areas

1. Canonical ownership schema or shared ownership fragment.
2. Market ownership model and response exposure.
3. NPC ownership identity and relationship to characters.
4. Item ownership normalization.
5. Ship ownership normalization.
6. Transfer semantics for salvage.
7. Transfer semantics for piracy.
8. Transfer semantics for sale or trade.
9. Persistence migration and backfill strategy.
10. OpenAPI and JSON schema updates.

## 6. Key Design Questions

1. What owner types are canonical: player-character, npc, faction, market, other?
2. Is ownership a reusable embedded object or a first-class ledgered relationship?
3. Do markets own inventory directly, or does a market owner own inventory routed through a market?
4. Does transfer history belong on the entity, in ledger entries, or both?
5. Which read surfaces must expose ownership immediately, and which can remain internal?
6. How should legacy records without canonical ownership be normalized?
7. What is the authoritative transfer event model for piracy, salvage, and sale?

## 7. Recommended Delivery Order

1. Finish the Elias NPC plan and verify it remains intentionally narrow.
2. Inventory all current ownership shapes in code, schemas, and handlers.
3. Define the canonical ownership contract first.
4. Update persistence and normalizers second.
5. Update contract surfaces third.
6. Update transfer workflows fourth.
7. Add migration and regression tests last before rollout.

## 8. Risks

1. Contract drift across items, ships, markets, and NPC surfaces.
2. Hidden assumptions in salvage/piracy/sale flows.
3. Persistence inconsistency between embedded ownership and transactional history.
4. Partial rollout causing contradictory ownership reads.

## 9. Suggested Follow-Up Planning File

The next planning artifact after the current NPC slice should likely be a dedicated implementation plan for canonical ownership modeling, contract updates, and migration.