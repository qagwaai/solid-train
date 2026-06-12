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

const { MARKET_OFFER_ACCEPT_REQUEST_EVENT, MARKET_OFFER_ACCEPT_RESPONSE_EVENT } = require('../src/model/market-offer-accept');
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

test('Option3 trade negative: acceptance with cross-player listing owner is forbidden', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const listingOwnerClient = connectClient(port);
  const acceptorClient = connectClient(port);

  await withTimeout(waitForEvent(listingOwnerClient, 'connect'), 1200, 'listing owner connect');
  await withTimeout(waitForEvent(acceptorClient, 'connect'), 1200, 'acceptor connect');

  try {
    const ownerLogin = await registerAndLogin(
      listingOwnerClient,
      'ListingOwnerPlayer',
      'owner@example.com',
      'secret'
    );
    const ownerCharacter = await addCharacter(
      listingOwnerClient,
      'ListingOwnerPlayer',
      ownerLogin.sessionKey,
      'OwnerChar'
    );

    const acceptorLogin = await registerAndLogin(
      acceptorClient,
      'TradeAcceptorPlayer',
      'acceptor@example.com',
      'secret'
    );

    const acceptPromise = waitForEvent(acceptorClient, MARKET_OFFER_ACCEPT_RESPONSE_EVENT);
    acceptorClient.emit(MARKET_OFFER_ACCEPT_REQUEST_EVENT, {
      playerName: 'TradeAcceptorPlayer',
      sessionKey: acceptorLogin.sessionKey,
      offerId: 'test-offer-1',
      listingId: 'test-listing-1',
      listingOwner: {
        ownerType: 'player-character',
        playerId: ownerLogin.playerId || 'ListingOwnerPlayer',
        characterId: ownerCharacter.characterId,
      },
    });

    const acceptResponse = await withTimeout(acceptPromise, 1200, 'forbidden accept');
    assert.equal(acceptResponse.success, false);
    assert.equal(acceptResponse.reason, 'OWNERSHIP_ACCEPT_FORBIDDEN');
  } finally {
    await closeClient(listingOwnerClient);
    await closeClient(acceptorClient);
    io.close();
    server.close();
  }
});

test('Option3 trade positive: acceptance with valid listing owner succeeds', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'TradeOwnerPilot',
      'trade-owner@example.com',
      'secret'
    );
    const character = await addCharacter(
      client,
      'TradeOwnerPilot',
      login.sessionKey,
      'TradeChar'
    );

    const acceptPromise = waitForEvent(client, MARKET_OFFER_ACCEPT_RESPONSE_EVENT);
    client.emit(MARKET_OFFER_ACCEPT_REQUEST_EVENT, {
      playerName: 'TradeOwnerPilot',
      sessionKey: login.sessionKey,
      offerId: 'test-offer-1',
      listingId: 'test-listing-1',
      listingOwner: {
        ownerType: 'player-character',
        playerId: login.playerId || 'TradeOwnerPilot',
        characterId: character.characterId,
      },
    });

    const acceptResponse = await withTimeout(acceptPromise, 1200, 'trade accept');
    assert.equal(acceptResponse.success, true);
    assert.ok(acceptResponse.tradeId);
    assert.ok(acceptResponse.completedAt);
    assert.deepEqual(acceptResponse.tradeHistory.listingOwner.characterId, character.characterId);
    assert.equal(acceptResponse.tradeHistory.acceptorCharacterId, character.characterId);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 trade negative: acceptance rejects non-player-character listing owner', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'TradeNpcOwnerPilot',
      'npc-trade@example.com',
      'secret'
    );

    const acceptPromise = waitForEvent(client, MARKET_OFFER_ACCEPT_RESPONSE_EVENT);
    client.emit(MARKET_OFFER_ACCEPT_REQUEST_EVENT, {
      playerName: 'TradeNpcOwnerPilot',
      sessionKey: login.sessionKey,
      offerId: 'test-offer-1',
      listingId: 'test-listing-1',
      listingOwner: {
        ownerType: 'npc-pirate',
        npcId: 'npc-1',
      },
    });

    const acceptResponse = await withTimeout(acceptPromise, 1200, 'npc owner rejection');
    assert.equal(acceptResponse.success, false);
    assert.equal(acceptResponse.reason, 'OWNERSHIP_VALIDATION_FAILED');
    assert.match(acceptResponse.message, /player-character/i);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
