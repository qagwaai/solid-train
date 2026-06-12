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

const { ITEM_LIST_BY_OWNER_REQUEST_EVENT, ITEM_LIST_BY_OWNER_RESPONSE_EVENT } = require('../src/model/item-list-by-owner');
const { ITEM_UPSERT_REQUEST_EVENT, ITEM_UPSERT_RESPONSE_EVENT } = require('../src/model/item-upsert');
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
  const promise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, { playerName, sessionKey, characterName });
  return await withTimeout(promise, 1200, 'character-add');
}

async function upsertItem(client, playerName, sessionKey, playerId, characterId) {
  const promise = waitForEvent(client, ITEM_UPSERT_RESPONSE_EVENT);
  client.emit(ITEM_UPSERT_REQUEST_EVENT, {
    playerName,
    sessionKey,
    correlationId: '00000000-0000-4000-8000-000000000099',
    requestIdentity: { operation: 'item-upsert', entityType: 'conduit-seals', containerId: '-' },
    item: {
      itemType: 'conduit-seals',
      displayName: 'Conduit Seals',
      owningPlayerId: playerId || playerName,
      owningCharacterId: characterId,
      ownership: {
        ownerType: 'player-character',
        playerId: playerId || playerName,
        characterId,
      },
    },
  });
  return await withTimeout(promise, 1200, 'item-upsert');
}

test('Option3 item-list-by-owner negative: cross-player query is forbidden', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const ownerClient = connectClient(port);
  const actorClient = connectClient(port);

  await withTimeout(waitForEvent(ownerClient, 'connect'), 1200, 'owner connect');
  await withTimeout(waitForEvent(actorClient, 'connect'), 1200, 'actor connect');

  try {
    const ownerLogin = await registerAndLogin(ownerClient, 'ItemListOwnerPlayer', 'item-list-owner@example.com', 'secret');
    const ownerCharacter = await addCharacter(ownerClient, 'ItemListOwnerPlayer', ownerLogin.sessionKey, 'OwnerChar');

    const actorLogin = await registerAndLogin(actorClient, 'ItemListActorPlayer', 'item-list-actor@example.com', 'secret');

    const listPromise = waitForEvent(actorClient, ITEM_LIST_BY_OWNER_RESPONSE_EVENT);
    actorClient.emit(ITEM_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'ItemListActorPlayer',
      sessionKey: actorLogin.sessionKey,
      owner: {
        ownerType: 'player-character',
        playerId: ownerLogin.playerId || 'ItemListOwnerPlayer',
        characterId: ownerCharacter.characterId,
      },
    });

    const response = await withTimeout(listPromise, 1200, 'forbidden list');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'ITEM_LIST_OWNER_FORBIDDEN');
  } finally {
    await closeClient(ownerClient);
    await closeClient(actorClient);
    io.close();
    server.close();
  }
});

test('Option3 item-list-by-owner positive: player can list own items', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'ItemListPilot', 'item-list-pilot@example.com', 'secret');
    const character = await addCharacter(client, 'ItemListPilot', login.sessionKey, 'PilotChar');

    // Create an item with canonical ownership
    const upsertResponse = await upsertItem(
      client,
      'ItemListPilot',
      login.sessionKey,
      login.playerId || 'ItemListPilot',
      character.characterId
    );
    assert.equal(upsertResponse.success, true);

    const listPromise = waitForEvent(client, ITEM_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(ITEM_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'ItemListPilot',
      sessionKey: login.sessionKey,
      owner: {
        ownerType: 'player-character',
        playerId: login.playerId || 'ItemListPilot',
        characterId: character.characterId,
      },
    });

    const response = await withTimeout(listPromise, 1200, 'item list');
    assert.equal(response.success, true);
    assert.ok(Array.isArray(response.items));
    assert.ok(response.items.length >= 1);
    assert.equal(response.owner.ownerType, 'player-character');
    assert.equal(response.owner.characterId, character.characterId);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 item-list-by-owner negative: invalid owner type is rejected', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'ItemListBadTypePilot', 'item-list-bad@example.com', 'secret');

    const listPromise = waitForEvent(client, ITEM_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(ITEM_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'ItemListBadTypePilot',
      sessionKey: login.sessionKey,
      owner: {
        ownerType: 'invalid-type',
      },
    });

    const response = await withTimeout(listPromise, 1200, 'bad owner type');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'OWNERSHIP_VALIDATION_FAILED');
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
