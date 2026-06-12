# Ownership API Migration Guide for Nova (Angular Client)

**Date:** 2026-06-12  
**Target:** Nova — Angular frontend  
**Scope:** Consuming new canonical ownership APIs introduced in the ownership contract formalization plan (Slices 1–12)

---

## Overview

The backend now exposes a **canonical ownership discriminator** on ships, items, market listings, and offers. Every owned entity carries an `ownership` object:

```json
{
  "ownerType": "player-character",
  "playerId": "player-uuid",
  "characterId": "character-uuid",
  "npcId": null,
  "factionId": null
}
```

Valid `ownerType` values: `"player-character"`, `"npc-pirate"`, `"unowned"`, `"unknown"`.

---

## 1. Ships

### What changed

Ships now always carry `ownership` in every response. Legacy `owningPlayerId` / `owningCharacterId` fields are still present but `ownership` is the authoritative source.

### Before (legacy pattern)

```typescript
// Filter ships by player/character using owningCharacterId
const myShips = ships.filter(s => s.owningCharacterId === characterId);
```

### Now (preferred pattern)

```typescript
// Use canonical ownership for filtering
const myShips = ships.filter(s =>
  s.ownership?.ownerType === 'player-character' &&
  s.ownership?.characterId === characterId
);
```

### Query ships by owner — `ship-list-by-owner-request`

Use this instead of fetching all ships and filtering client-side.

```typescript
socket.emit('ship-list-by-owner-request', {
  playerName,
  sessionKey,
  correlationId: uuidv4(),
  requestIdentity: { operation: 'ship-list-by-owner', entityType: 'ship', containerId: characterId },
  owner: {
    ownerType: 'player-character',
    characterId,   // playerId is inferred from session if omitted
  },
});

socket.on('ship-list-by-owner-response', (response) => {
  if (!response.success) {
    // Handle reason: 'OWNERSHIP_VALIDATION_FAILED' | 'SHIP_LIST_OWNER_FORBIDDEN'
  }
  const ships = response.ships; // each ship has ownership, ownershipHistory
});
```

### Query NPC-owned ships — `ship-list-by-npc-owner-request`

Ships seized by piracy appear here. Useful for rendering NPC fleets.

```typescript
socket.emit('ship-list-by-npc-owner-request', {
  playerName,
  sessionKey,
  npcOwner: { ownerType: 'npc-pirate', npcId: 'pirate-npc-1' },
});

socket.on('ship-list-by-npc-owner-response', (response) => {
  const npcFleet = response.ships;
});
```

### Ship ownership history

Every ship now carries `ownershipHistory[]` — an audit trail of all transfers:

```typescript
ship.ownershipHistory.forEach(entry => {
  console.log(`${entry.reason} at ${entry.at}: ${entry.fromOwner.ownerType} → ${entry.toOwner.ownerType}`);
  // reason values: 'transfer' | 'claim' | 'salvage' | 'piracy' | 'trade-completion'
});
```

---

## 2. Items

### What changed

Items now carry an `ownership` field (backfilled from `owningPlayerId`/`owningCharacterId` for legacy records). Use `item-list-by-owner-request` to query items by canonical owner instead of fetching all items and filtering.

### Before (legacy pattern)

```typescript
// After container fetch, filter by owning character
const myItems = containerItems.filter(i => i.owningCharacterId === characterId);
```

### Now (preferred pattern — server-side filter)

```typescript
socket.emit('item-list-by-owner-request', {
  playerName,
  sessionKey,
  owner: {
    ownerType: 'player-character',
    playerId,
    characterId,
  },
});

socket.on('item-list-by-owner-response', (response) => {
  if (!response.success) {
    // Handle reason: 'OWNERSHIP_VALIDATION_FAILED' | 'ITEM_LIST_OWNER_FORBIDDEN'
  }
  const myItems = response.items; // items with canonical ownership populated
});
```

### Creating items with canonical ownership — `item-upsert-request`

When upserting items, pass `ownership` explicitly. The server validates that `ownership.playerId` matches the actor's session.

```typescript
socket.emit('item-upsert-request', {
  playerName,
  sessionKey,
  correlationId: uuidv4(),
  requestIdentity: { operation: 'item-upsert', entityType: itemType, containerId: '-' },
  item: {
    itemType: 'conduit-seals',
    displayName: 'Conduit Seals',
    owningPlayerId: playerId,       // legacy field — still required
    owningCharacterId: characterId, // legacy field — still required
    ownership: {                    // canonical field — validated strictly
      ownerType: 'player-character',
      playerId,
      characterId,
    },
  },
});
```

**Failure reasons to handle:**
- `OWNERSHIP_VALIDATION_FAILED` — invalid ownerType or missing fields
- `OWNERSHIP_ITEM_FORBIDDEN` — actor's playerId does not match ownership.playerId

---

## 3. Market Listings

### Creating a listing — `market-listing-create-request`

Only `player-character` owners can create listings. Pass `owner` with `playerId` matching the session.

```typescript
socket.emit('market-listing-create-request', {
  playerName,
  sessionKey,
  marketId: 'market-sol-1',
  solarSystemId: 'sol',
  itemId: 'item-uuid',
  quantity: 5,
  listingPrice: 1000,
  owner: {
    ownerType: 'player-character',
    playerId,
    characterId,
  },
});

socket.on('market-listing-create-response', (response) => {
  // Failure reasons:
  // 'OWNERSHIP_VALIDATION_FAILED' — invalid owner descriptor
  // 'OWNERSHIP_LISTING_FORBIDDEN' — cross-player attempt
});
```

---

## 4. Market Offers

### Creating an offer — `market-offer-create-request`

```typescript
socket.emit('market-offer-create-request', {
  playerName,
  sessionKey,
  listingId: 'listing-uuid',
  offerorOwner: {
    ownerType: 'player-character',
    playerId,
    characterId,
  },
  offerPrice: 900,
  quantity: 1,
});

socket.on('market-offer-create-response', (response) => {
  // Failure reasons:
  // 'OWNERSHIP_VALIDATION_FAILED' — invalid offeror descriptor
  // 'OWNERSHIP_OFFER_FORBIDDEN' — cross-player attempt
  if (response.success) {
    const offerId = response.offerId;
  }
});
```

### Accepting an offer — `market-offer-accept-request`

Only the listing owner can accept. Pass `listingOwner` matching the session's player.

```typescript
socket.emit('market-offer-accept-request', {
  playerName,
  sessionKey,
  offerId: 'offer-uuid',
  listingId: 'listing-uuid',
  listingOwner: {
    ownerType: 'player-character',
    playerId,
    characterId,
  },
  offerorOwner: {       // optional — for trade history record
    ownerType: 'player-character',
    playerId: offerorPlayerId,
    characterId: offerorCharacterId,
  },
});

socket.on('market-offer-accept-response', (response) => {
  // Failure reasons:
  // 'OWNERSHIP_ACCEPT_FORBIDDEN' — not the listing owner
  // 'OWNERSHIP_VALIDATION_FAILED' — invalid descriptor
  if (response.success) {
    const { tradeId, tradeHistory } = response;
    // tradeHistory.listingOwner / tradeHistory.offerorOwner / tradeHistory.acceptorCharacterId
  }
});
```

---

## 5. Salvage & Piracy

### Claiming an unknown ship — `ship-salvage-claim-request`

```typescript
socket.emit('ship-salvage-claim-request', {
  playerName,
  sessionKey,
  shipId: 'unknown-ship-uuid',
  claimantOwner: {
    ownerType: 'player-character',
    playerId,
    characterId,
  },
});

socket.on('ship-salvage-claim-response', (response) => {
  // Failure reasons:
  // 'SALVAGE_CLAIM_FORBIDDEN' — cross-player attempt
  // 'SALVAGE_ALREADY_OWNED' — ship already has an owner
  // 'SHIP_NOT_FOUND'
  if (response.success) {
    const { previousOwnerType, claimedAt } = response;
  }
});
```

### NPC ship seizure — `ship-piracy-seize-request`

This is a **server-initiated** event (triggered by NPC AI logic, not directly by the player UI). Nova may want to listen for `ship-piracy-seize-response` to react to seizure outcomes and update the ship ownership display.

```typescript
// Listen for piracy outcomes (server-side NPC action)
socket.on('ship-piracy-seize-response', (response) => {
  if (response.success) {
    const { shipId, seizingOwner, previousOwner } = response;
    // Remove ship from player's fleet UI
    // Show piracy notification
  }
});
```

---

## 6. Error Reason Reference

| Reason | Surface | Meaning |
|---|---|---|
| `OWNERSHIP_VALIDATION_FAILED` | All | Invalid ownerType, missing required fields, or npcId/characterId on wrong type |
| `OWNERSHIP_LISTING_FORBIDDEN` | Market listing | Actor playerId ≠ owner playerId |
| `OWNERSHIP_OFFER_FORBIDDEN` | Market offer | Actor playerId ≠ offeror playerId |
| `OWNERSHIP_ACCEPT_FORBIDDEN` | Market offer accept | Actor is not the listing owner |
| `OWNERSHIP_ITEM_FORBIDDEN` | Item upsert | Actor playerId ≠ ownership.playerId |
| `ITEM_LIST_OWNER_FORBIDDEN` | Item list | Actor playerId ≠ owner.playerId |
| `SHIP_LIST_OWNER_FORBIDDEN` | Ship list | Actor playerId ≠ owner.playerId |
| `SALVAGE_CLAIM_FORBIDDEN` | Salvage | Cross-player claim attempt |
| `SALVAGE_ALREADY_OWNED` | Salvage | Target ship is not unknown |
| `PIRACY_SEIZE_INVALID_TARGET` | Piracy | Target ship is not player-character owned |

---

## 7. Migration Checklist for Nova

- [ ] Replace `owningCharacterId` filtering with `ownership.characterId` comparisons in ship/item lists
- [ ] Switch to `item-list-by-owner-request` for character inventory screens (avoid fetching all and filtering)
- [ ] Switch to `ship-list-by-owner-request` for player fleet screens
- [ ] Add `ownership` field to all `item-upsert-request` payloads
- [ ] Handle all new `OWNERSHIP_*` reason codes in error display logic
- [ ] Add salvage claim flow (scan for `unknown` ships, trigger claim, show transfer confirmation)
- [ ] Add piracy notification handling (listen for `ship-piracy-seize-response`, update fleet UI)
- [ ] Add ownership history display on ship detail view (`ownershipHistory[]` in ship list responses)
- [ ] Use `ship-list-by-npc-owner-request` to populate NPC fleet displays or encounter data
