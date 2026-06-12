# Ownership Contract Formalization Plan

Status: In Progress (Vertical Slice 1)
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

## 10. Implementation Kickoff (Vertical Slice 1)

Selected start scope for this slice:

1. End-to-end ship ownership vertical slice.
2. Strict fail-fast contract behavior.
3. No legacy support paths for ownership transfer/list contracts.
4. Tests are the acceptance criteria.

Initial implementation targets:

1. Enforce transfer source contract via `fromOwner` equality checks.
2. Enforce claim token requirement for unknown -> player-character claim transitions.
3. Add explicit authorization rejection for cross-player owner-list queries.
4. Persist ownership transfer history entries (`ownershipHistory`) on transfer.
5. Surface ownership history on ship read/list surfaces where available.
6. Align JSON schema reason enums with strict transfer/list failure reasons.

Deferred from this first slice:

1. Canonical market ownership model.
2. Ownership normalization across item and NPC contract surfaces.
3. Migration/backfill workflow for non-ship ownership domains.

## 11. Vertical Slice 2: Canonical Market Ownership Model

Status: Complete (Vertical Slice 2 - Market Listing Creation)

**Scope:**
Extend ownership contract to marketplace/trading domain. Establish canonical owner tracking for listed items, pending offers, and completed trades.

**Initial Implementation Targets (Completed):**
1. ✅ Market listing ownership (who can create/modify/cancel listings).
2. ✅ Cross-player listing blocking (OWNERSHIP_LISTING_FORBIDDEN reason code).
3. ✅ Strict player-character ownership requirement.
4. ✅ Ownership discriminator validation.
5. ✅ Market listing creation handler with ownership contract enforcement.

**Deferred to Slice 3:**
1. Pending offer ownership model and actor authorization.
2. Trade completion with automatic ownership transfer.
3. Market history audit trail (who listed, who offered, who accepted).
4. Item inventory ownership normalization.
5. NPC ownership contract surfaces for market operations.

## 13. Vertical Slice 4: Item Ownership Normalization

Status: Complete ✅

**Scope:**
Add canonical ownership discriminator to items. Characters are the only valid owners (ownerType: 'player-character'). Cross-player item upsert is blocked.

**Implementation Targets:**
1. ✅ Add `ownership` embedded schema to item Mongoose model
2. ✅ Add `ownership` field to item.schema.json and item-upsert-request.schema.json
3. ✅ Ownership validation in item-upsert handler (normalizeOwnership, player-character only, cross-player block)
4. ✅ `ownership` persisted in itemData on create/update
5. ✅ Tests: 3/3 passing (cross-player forbidden, valid success, npc rejection)

## 15. Vertical Slice 6: Item List By Owner

Status: Complete ✅

**Scope:**
New `item-list-by-owner` handler and event that queries items by canonical ownership discriminator with cross-player blocking.

**Implementation Targets:**
1. ✅ `item-list-by-owner-request/response` event constants and schemas
2. ✅ Handler with ownership validation + cross-player block (ITEM_LIST_OWNER_FORBIDDEN)
3. ✅ `getAllItems()` helper on inventory service and context
4. ✅ Server registration and socket-handler-registry entry
5. ✅ Tests: 3/3 passing (cross-player forbidden, valid list, invalid owner type)

## 16. Vertical Slice 7: Salvage Claim

Status: Complete ✅

**Scope:**
A character can claim an `unknown` ship via `ship-salvage-claim`, producing an ownership history entry with reason `salvage`. Already-owned ships are rejected.

**Implementation Targets:**
1. ✅ `ship-salvage-claim-request/response` event constants and schemas
2. ✅ Handler: player-character only, cross-player block, unknown only, history entry
3. ✅ Server registration and socket-handler-registry entry
4. ✅ Tests: 3/3 passing (cross-player forbidden, valid claim, reject already-owned)

## 17. Vertical Slice 8: Piracy Transfer

Status: Complete ✅

**Scope:**
An NPC can seize a `player-character` owned ship via `ship-piracy-seize`. Only `npc-pirate` ownerType can initiate, target must currently be `player-character` owned, and a history entry with reason `piracy` is recorded.

**Implementation Targets:**
1. ✅ `ship-piracy-seize-request/response` event constants and schemas
2. ✅ Handler: npc-pirate only, target must be player-character, history entry
3. ✅ Server registration and socket-handler-registry entry
4. ✅ Tests: 3/3 passing (valid seize, invalid seizer type, cannot seize unowned/unknown)

## 19. Vertical Slice 10: Ownership Backfill in Normalizers

Status: Complete ✅

**Scope:**
Legacy ship/item records without canonical `ownership` field are normalized on read by deriving `ownership` from `owningPlayerId`/`owningCharacterId` fields. Canonical `ownership` takes precedence when both are present.

**Implementation Targets:**
1. ✅ `normalizeShip` backfills `ownership` from `owningPlayerId`/`owningCharacterId` if missing
2. ✅ `normalizeItem` adds canonical `ownership` from explicit field or backfills from legacy fields
3. ✅ Tests: 3/3 passing (starter ship has ownership, legacy item backfill, canonical precedence)
4. ✅ Fixture assertions updated in character-add, ship-list, ship-upsert tests

## 20. Vertical Slice 11: NPC Ship List

Status: Complete ✅

**Scope:**
NPC ownership identity surface — query ships currently owned by a specific `npc-pirate`. Completes scope area 3 (NPC ownership identity and relationship to characters).

**Implementation Targets:**
1. ✅ `ship-list-by-npc-owner-request/response` event constants and schemas
2. ✅ Handler: npc-pirate only query, scans all characters for matching ownership
3. ✅ Server registration and socket-handler-registry entry
4. ✅ Tests: 3/3 passing (list ships after piracy seize, empty list for unknown NPC, reject non-npc-pirate query)

## 21. Vertical Slice 12: OpenAPI Final Sync (Slices 10–11)

Status: Complete ✅

**Scope:**
Final OpenAPI sync — NPC ship list endpoint and version bump.

**Implementation Targets:**
1. ✅ `/socket/ship-list-by-npc-owner` endpoint with NPC ownership contract docs
2. ✅ Component schema refs: `ShipListByNpcOwnerRequest`, `ShipListByNpcOwnerResponse`
3. ✅ `info.version` bumped to 3.0.4

---

## Summary: Ownership Contract Formalization — All Scope Areas Complete

| Scope Area | Slice(s) |
|---|---|
| Canonical ownership schema/fragment | Slice 1 (ship), Slices 4/10 (item) |
| Market ownership model | Slices 2, 3 |
| NPC ownership identity | Slices 8 (piracy), 11 (NPC ship list) |
| Item ownership normalization | Slices 4, 10 |
| Ship ownership normalization | Slice 1 |
| Transfer semantics: salvage | Slice 7 |
| Transfer semantics: piracy | Slice 8 |
| Transfer semantics: sale/trade | Slice 3 |
| Persistence migration/backfill | Slice 10 |
| OpenAPI and JSON schema updates | Slices 5, 9, 12 |

Status: Complete ✅

**Scope:**
Sync openapi.yaml with all new ownership surfaces from slices 6–8.

**Implementation Targets:**
1. ✅ `/socket/item-list-by-owner` with cross-player ownership contract docs
2. ✅ `/socket/ship-salvage-claim` with salvage claim contract docs
3. ✅ `/socket/ship-piracy-seize` with piracy seize contract docs
4. ✅ Component schema refs for all 6 new request/response schemas
5. ✅ `info.version` bumped to 3.0.3

Status: Complete ✅

**Scope:**
Sync openapi.yaml with all new ownership surfaces introduced in Slices 2-4.

**Implementation Targets:**
1. ✅ `/socket/market-listing-create` endpoint with ownership contract docs
2. ✅ `/socket/market-offer-create` endpoint with offeror ownership docs
3. ✅ `/socket/market-offer-accept` endpoint with trade completion and ship transfer docs
4. ✅ Component schema refs for all 6 new request/response schemas
5. ✅ `info.version` bumped to 3.0.2

Status: Complete ✅

**Scope:**
Establish offer ownership contract and automatic ownership transfer on trade completion. Track offer actor authorization and market history audit trail.

**Implementation Targets:**
1. ✅ Pending offer creation with actor and offeror ownership.
2. ✅ Offer acceptance validation (owner can only accept own listings).
3. ✅ Automatic ship ownership transfer on accepted offer.
4. ✅ Trade history audit trail for offers and trades.
5. ✅ Reason codes for offer authorization failures.

**Implementation Status (Phase 1 - Create):**
- ✅ Offer create handler with strict ownership validation
- ✅ Cross-player offer blocking (OWNERSHIP_OFFER_FORBIDDEN)
- ✅ Non-player-character offeror rejection
- ✅ JSON schemas (request/response with offeror ownership discriminator)
- ✅ Socket.io registry integrated
- ✅ Tests: 3/3 passing

**Implementation Status (Phase 2 - Accept):**
- ✅ Offer accept handler with listing owner validation
- ✅ Cross-player acceptance blocking (OWNERSHIP_ACCEPT_FORBIDDEN)
- ✅ Non-player-character listing owner rejection
- ✅ Trade history tracking (at, offerId, listingOwner, acceptorCharacterId)
- ✅ JSON schemas (request/response with tradeHistory)
- ✅ Socket.io registry integrated
- ✅ Tests: 3/3 passing

**Implementation Status (Phase 3 - Transfer):**
- ✅ Market offer model with offer persistence and status tracking
- ✅ DB service methods: createMarketOffer() and acceptMarketOfferAndTransferShip()
- ✅ Automatic ship ownership transfer on offer acceptance
- ✅ Ownership history recording with trade-completion reason
- ✅ Trade completion validates ship transfer authorization
- ✅ DB Integration Tests: 3/3 passing (transfer with ship, transfer without ship, non-pending rejection)