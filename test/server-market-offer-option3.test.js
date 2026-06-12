'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');
const {
  listen,
  connectClient,
  closeClient,
  waitForEvent,
  registerAndLogin,
} = require('../test-support/socket-test-helpers');

const { MARKET_OFFER_CREATE_REQUEST_EVENT, MARKET_OFFER_CREATE_RESPONSE_EVENT } = require('../src/model/market-offer-create');
const { CHARACTER_ADD_REQUEST_EVENT, CHARACTER_ADD_RESPONSE_EVENT } = require('../src/model/character-add');

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function addCharacter(client, playerName, sessionKey, characterName) {
  const characterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName,
    sessionKey,
    characterName,
  });
  return await withTimeout(characterPromise, 1200, 'character-add');
}

test('Option3 market negative: offer creation with cross-player offeror is forbidden', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const offerorClient = connectClient(port);
  const actorClient = connectClient(port);

  await withTimeout(waitForEvent(offerorClient, 'connect'), 1200, 'offeror connect');
  await withTimeout(waitForEvent(actorClient, 'connect'), 1200, 'actor connect');

  try {
    const offerorLogin = await registerAndLogin(
      offerorClient,
      'MarketOfferorPlayer',
      'offeror@example.com',
      'secret'
    );
    const offerorCharacter = await addCharacter(
      offerorClient,
      'MarketOfferorPlayer',
      offerorLogin.sessionKey,
      'OfferorChar'
    );

    const actorLogin = await registerAndLogin(
      actorClient,
      'MarketActorPlayer',
      'actor@example.com',
      'secret'
    );

    const offerPromise = waitForEvent(actorClient, MARKET_OFFER_CREATE_RESPONSE_EVENT);
    actorClient.emit(MARKET_OFFER_CREATE_REQUEST_EVENT, {
      playerName: 'MarketActorPlayer',
      sessionKey: actorLogin.sessionKey,
      listingId: 'test-listing-1',
      offerorOwner: {
        ownerType: 'player-character',
        playerId: offerorLogin.playerId || 'MarketOfferorPlayer',
        characterId: offerorCharacter.characterId,
      },
      offerPrice: 500,
      quantity: 1,
    });

    const offerResponse = await withTimeout(offerPromise, 1200, 'forbidden offer');
    assert.equal(offerResponse.success, false);
    assert.equal(offerResponse.reason, 'OWNERSHIP_OFFER_FORBIDDEN');
  } finally {
    await closeClient(offerorClient);
    await closeClient(actorClient);
    io.close();
    server.close();
  }
});

test('Option3 market positive: offer creation with valid player-character offeror succeeds', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'MarketOfferorPilot',
      'offeror-pilot@example.com',
      'secret'
    );
    const character = await addCharacter(
      client,
      'MarketOfferorPilot',
      login.sessionKey,
      'OfferorChar'
    );

    const offerPromise = waitForEvent(client, MARKET_OFFER_CREATE_RESPONSE_EVENT);
    client.emit(MARKET_OFFER_CREATE_REQUEST_EVENT, {
      playerName: 'MarketOfferorPilot',
      sessionKey: login.sessionKey,
      listingId: 'test-listing-1',
      offerorOwner: {
        ownerType: 'player-character',
        playerId: login.playerId || 'MarketOfferorPilot',
        characterId: character.characterId,
      },
      offerPrice: 500,
      quantity: 1,
    });

    const offerResponse = await withTimeout(offerPromise, 1200, 'offer creation');
    assert.equal(offerResponse.success, true);
    assert.ok(offerResponse.offerId);
    assert.equal(offerResponse.offerorOwner.ownerType, 'player-character');
    assert.equal(offerResponse.offerorOwner.characterId, character.characterId);
    assert.equal(offerResponse.offerPrice, 500);
    assert.equal(offerResponse.quantity, 1);
    assert.ok(offerResponse.createdAt);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 market negative: offer creation rejects non-player-character offeror types', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'MarketNpcOfferorPilot',
      'npc-offeror@example.com',
      'secret'
    );

    const offerPromise = waitForEvent(client, MARKET_OFFER_CREATE_RESPONSE_EVENT);
    client.emit(MARKET_OFFER_CREATE_REQUEST_EVENT, {
      playerName: 'MarketNpcOfferorPilot',
      sessionKey: login.sessionKey,
      listingId: 'test-listing-1',
      offerorOwner: {
        ownerType: 'npc-pirate',
        npcId: 'npc-1',
      },
      offerPrice: 500,
      quantity: 1,
    });

    const offerResponse = await withTimeout(offerPromise, 1200, 'npc offeror rejection');
    assert.equal(offerResponse.success, false);
    assert.equal(offerResponse.reason, 'OWNERSHIP_VALIDATION_FAILED');
    assert.match(offerResponse.message, /player-character/i);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
