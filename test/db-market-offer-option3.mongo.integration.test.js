'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');

let mongoHarness = null;

test.before(async () => {
  mongoHarness = await createMongoTestHarness();
});

test.after(async () => {
  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

test.beforeEach(async () => {
  await mongoHarness.clearDatabase();
});

test('Option3 DB: offer acceptance transfers ship ownership', async () => {
  const db = mongoHarness.databaseService;

  const shipId = `test-ship-${Date.now()}`;
  const listingOwnerPlayerId = 'ListingOwnerPlayer';
  const listingOwnerCharacterId = 'listing-char-1';
  const offerorPlayerId = 'OfferorPlayer';
  const offerorCharacterId = 'offeror-char-1';

  const listingOwner = {
    ownerType: 'player-character',
    playerId: listingOwnerPlayerId,
    characterId: listingOwnerCharacterId,
    npcId: null,
    factionId: null,
  };

  const offerorOwner = {
    ownerType: 'player-character',
    playerId: offerorPlayerId,
    characterId: offerorCharacterId,
    npcId: null,
    factionId: null,
  };

  const ship = await db.createShip({
    id: shipId,
    shipName: 'TestShip',
    model: 'TestShip',
    tier: 1,
    createdAt: new Date().toISOString(),
    inventory: [],
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
    launchable: true,
    damageProfile: null,
    ownership: listingOwner,
  });

  assert.ok(ship);
  assert.equal(ship.ownership.ownerType, 'player-character');
  assert.equal(ship.ownership.playerId, listingOwnerPlayerId);

  const offerId = `offer-${Date.now()}`;
  const listingId = `listing-${Date.now()}`;

  const offer = await db.createMarketOffer({
    offerId,
    listingId,
    offerorOwner,
    createdBy: { playerId: offerorPlayerId, characterId: offerorCharacterId },
    offerPrice: 1000,
    quantity: 1,
  });

  assert.ok(offer);
  assert.equal(offer.status, 'pending');
  assert.equal(offer.offerorOwner.playerId, offerorPlayerId);

  const acceptedOffer = await db.acceptMarketOfferAndTransferShip({
    offerId,
    shipId,
    listingOwner,
    offerorOwner,
    actorPlayerId: listingOwnerPlayerId,
    acceptorCharacterId: listingOwnerCharacterId,
  });

  assert.ok(acceptedOffer);
  assert.equal(acceptedOffer.status, 'accepted');
  assert.ok(acceptedOffer.acceptedAt);
  assert.ok(acceptedOffer.tradeHistory);
  assert.equal(acceptedOffer.tradeHistory.offerId, offerId);
  assert.equal(acceptedOffer.tradeHistory.acceptorCharacterId, listingOwnerCharacterId);

  assert.ok(acceptedOffer.ship);
  const transferredShip = acceptedOffer.ship;
  assert.equal(transferredShip.ownership.ownerType, 'player-character');
  assert.equal(transferredShip.ownership.playerId, offerorPlayerId);
  assert.equal(transferredShip.ownership.characterId, offerorCharacterId);

  assert.ok(Array.isArray(transferredShip.ownershipHistory));
  assert.ok(transferredShip.ownershipHistory.length > 0);
  const tradeEntry = transferredShip.ownershipHistory[transferredShip.ownershipHistory.length - 1];
  assert.equal(tradeEntry.reason, 'trade-completion');
  assert.equal(tradeEntry.fromOwner.playerId, listingOwnerPlayerId);
  assert.equal(tradeEntry.toOwner.playerId, offerorPlayerId);
});

test('Option3 DB: offer acceptance without shipId skips transfer', async () => {
  const db = mongoHarness.databaseService;

  const offerId = `offer-no-transfer-${Date.now()}`;
  const listingId = `listing-no-transfer-${Date.now()}`;

  const listingOwner = {
    ownerType: 'player-character',
    playerId: 'ListingOwnerPlayer',
    characterId: 'listing-char-1',
  };

  const offerorOwner = {
    ownerType: 'player-character',
    playerId: 'OfferorPlayer',
    characterId: 'offeror-char-1',
  };

  const offer = await db.createMarketOffer({
    offerId,
    listingId,
    offerorOwner,
    createdBy: { playerId: 'OfferorPlayer', characterId: 'offeror-char-1' },
    offerPrice: 500,
    quantity: 1,
  });

  assert.equal(offer.status, 'pending');

  const acceptedOffer = await db.acceptMarketOfferAndTransferShip({
    offerId,
    listingOwner,
    offerorOwner,
    actorPlayerId: 'ListingOwnerPlayer',
    acceptorCharacterId: 'listing-char-1',
  });

  assert.equal(acceptedOffer.status, 'accepted');
  assert.ok(!acceptedOffer.ship);
});

test('Option3 DB: offer acceptance fails for non-pending offer', async () => {
  const db = mongoHarness.databaseService;

  const offerId = `offer-already-accepted-${Date.now()}`;
  const listingId = `listing-already-accepted-${Date.now()}`;

  const listingOwner = {
    ownerType: 'player-character',
    playerId: 'ListingOwnerPlayer',
    characterId: 'listing-char-1',
  };

  const offerorOwner = {
    ownerType: 'player-character',
    playerId: 'OfferorPlayer',
    characterId: 'offeror-char-1',
  };

  await db.createMarketOffer({
    offerId,
    listingId,
    offerorOwner,
    createdBy: { playerId: 'OfferorPlayer', characterId: 'offeror-char-1' },
    offerPrice: 1000,
    quantity: 1,
  });

  await db.acceptMarketOfferAndTransferShip({
    offerId,
    listingOwner,
    offerorOwner,
    actorPlayerId: 'ListingOwnerPlayer',
    acceptorCharacterId: 'listing-char-1',
  });

  try {
    await db.acceptMarketOfferAndTransferShip({
      offerId,
      listingOwner,
      offerorOwner,
      actorPlayerId: 'ListingOwnerPlayer',
      acceptorCharacterId: 'listing-char-1',
    });
    assert.fail('Should have thrown error for non-pending offer');
  } catch (error) {
    assert.match(error.message, /not pending/i);
  }
});
