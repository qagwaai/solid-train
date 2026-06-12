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

const { MARKET_LISTING_CREATE_REQUEST_EVENT, MARKET_LISTING_CREATE_RESPONSE_EVENT } = require('../src/model/market-listing-create');
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

test('Option3 market negative: listing creation with cross-player owner is forbidden', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const creatorClient = connectClient(port);
  const intruderClient = connectClient(port);

  await withTimeout(waitForEvent(creatorClient, 'connect'), 1200, 'creator connect');
  await withTimeout(waitForEvent(intruderClient, 'connect'), 1200, 'intruder connect');

  try {
    const creatorLogin = await registerAndLogin(
      creatorClient,
      'MarketListingCreator',
      'creator@example.com',
      'secret'
    );
    const creatorCharacter = await addCharacter(
      creatorClient,
      'MarketListingCreator',
      creatorLogin.sessionKey,
      'CreatorChar'
    );

    const intruderLogin = await registerAndLogin(
      intruderClient,
      'MarketListingIntruder',
      'intruder@example.com',
      'secret'
    );

    const createPromise = waitForEvent(intruderClient, MARKET_LISTING_CREATE_RESPONSE_EVENT);
    intruderClient.emit(MARKET_LISTING_CREATE_REQUEST_EVENT, {
      playerName: 'MarketListingIntruder',
      sessionKey: intruderLogin.sessionKey,
      marketId: 'starter-market-1',
      solarSystemId: 'sol',
      itemId: 'test-item-1',
      quantity: 5,
      listingPrice: 100,
      owner: {
        ownerType: 'player-character',
        playerId: creatorLogin.playerId || 'MarketListingCreator',
        characterId: creatorCharacter.characterId,
      },
    });

    const createResponse = await withTimeout(createPromise, 1200, 'forbidden listing');
    assert.equal(createResponse.success, false);
    assert.equal(createResponse.reason, 'OWNERSHIP_LISTING_FORBIDDEN');
  } finally {
    await closeClient(creatorClient);
    await closeClient(intruderClient);
    io.close();
    server.close();
  }
});

test('Option3 market positive: listing creation with valid player-character owner succeeds', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'MarketListingPilot',
      'listing-pilot@example.com',
      'secret'
    );
    const character = await addCharacter(
      client,
      'MarketListingPilot',
      login.sessionKey,
      'ListingChar'
    );

    const createPromise = waitForEvent(client, MARKET_LISTING_CREATE_RESPONSE_EVENT);
    client.emit(MARKET_LISTING_CREATE_REQUEST_EVENT, {
      playerName: 'MarketListingPilot',
      sessionKey: login.sessionKey,
      marketId: 'starter-market-1',
      solarSystemId: 'sol',
      itemId: 'test-item-1',
      quantity: 5,
      listingPrice: 100,
      expiresInMinutes: 1440,
      owner: {
        ownerType: 'player-character',
        playerId: login.playerId || 'MarketListingPilot',
        characterId: character.characterId,
      },
    });

    const createResponse = await withTimeout(createPromise, 1200, 'listing creation');
    assert.equal(createResponse.success, true);
    assert.ok(createResponse.listingId);
    assert.equal(createResponse.owner.ownerType, 'player-character');
    assert.equal(createResponse.owner.characterId, character.characterId);
    assert.equal(createResponse.itemId, 'test-item-1');
    assert.equal(createResponse.quantity, 5);
    assert.equal(createResponse.listingPrice, 100);
    assert.ok(createResponse.createdAt);
    assert.ok(createResponse.expiresAt);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 market negative: listing creation rejects non-player-character owner types', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'MarketNpcListingPilot',
      'npc-listing@example.com',
      'secret'
    );

    const createPromise = waitForEvent(client, MARKET_LISTING_CREATE_RESPONSE_EVENT);
    client.emit(MARKET_LISTING_CREATE_REQUEST_EVENT, {
      playerName: 'MarketNpcListingPilot',
      sessionKey: login.sessionKey,
      marketId: 'starter-market-1',
      solarSystemId: 'sol',
      itemId: 'test-item-1',
      quantity: 5,
      listingPrice: 100,
      owner: {
        ownerType: 'npc-pirate',
        npcId: 'npc-1',
      },
    });

    const createResponse = await withTimeout(createPromise, 1200, 'npc owner rejection');
    assert.equal(createResponse.success, false);
    assert.equal(createResponse.reason, 'OWNERSHIP_VALIDATION_FAILED');
    assert.match(createResponse.message, /player-character/i);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
