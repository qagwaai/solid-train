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
  const characterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, { playerName, sessionKey, characterName });
  return await withTimeout(characterPromise, 1200, 'character-add');
}

test('Option3 item negative: upsert with cross-player ownership is forbidden', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const ownerClient = connectClient(port);
  const actorClient = connectClient(port);

  await withTimeout(waitForEvent(ownerClient, 'connect'), 1200, 'owner connect');
  await withTimeout(waitForEvent(actorClient, 'connect'), 1200, 'actor connect');

  try {
    const ownerLogin = await registerAndLogin(ownerClient, 'ItemOwnerPlayer', 'item-owner@example.com', 'secret');
    const ownerCharacter = await addCharacter(ownerClient, 'ItemOwnerPlayer', ownerLogin.sessionKey, 'OwnerChar');

    const actorLogin = await registerAndLogin(actorClient, 'ItemActorPlayer', 'item-actor@example.com', 'secret');

    const upsertPromise = waitForEvent(actorClient, ITEM_UPSERT_RESPONSE_EVENT);
    actorClient.emit(ITEM_UPSERT_REQUEST_EVENT, {
      playerName: 'ItemActorPlayer',
      sessionKey: actorLogin.sessionKey,
      correlationId: '00000000-0000-4000-8000-000000000001',
      requestIdentity: { operation: 'item-upsert', entityType: 'iron-ore', containerId: '-' },
      item: {
        itemType: 'conduit-seals',
        displayName: 'Conduit Seals',
        owningPlayerId: ownerLogin.playerId || 'ItemOwnerPlayer',
        owningCharacterId: ownerCharacter.characterId,
        ownership: {
          ownerType: 'player-character',
          playerId: ownerLogin.playerId || 'ItemOwnerPlayer',
          characterId: ownerCharacter.characterId,
        },
      },
    });

    const response = await withTimeout(upsertPromise, 1200, 'forbidden item upsert');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'OWNERSHIP_ITEM_FORBIDDEN');
  } finally {
    await closeClient(ownerClient);
    await closeClient(actorClient);
    io.close();
    server.close();
  }
});

test('Option3 item positive: upsert with valid player-character ownership succeeds', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'ItemOwnerPilot', 'item-pilot@example.com', 'secret');
    const character = await addCharacter(client, 'ItemOwnerPilot', login.sessionKey, 'PilotChar');

    const upsertPromise = waitForEvent(client, ITEM_UPSERT_RESPONSE_EVENT);
    client.emit(ITEM_UPSERT_REQUEST_EVENT, {
      playerName: 'ItemOwnerPilot',
      sessionKey: login.sessionKey,
      correlationId: '00000000-0000-4000-8000-000000000002',
      requestIdentity: { operation: 'item-upsert', entityType: 'iron-ore', containerId: '-' },
      item: {
        itemType: 'conduit-seals',
        displayName: 'Conduit Seals',
        owningPlayerId: login.playerId || 'ItemOwnerPilot',
        owningCharacterId: character.characterId,
        ownership: {
          ownerType: 'player-character',
          playerId: login.playerId || 'ItemOwnerPilot',
          characterId: character.characterId,
        },
      },
    });

    const response = await withTimeout(upsertPromise, 1200, 'item upsert');
    assert.equal(response.success, true);
    assert.ok(response.item);
    assert.equal(response.item.ownership.ownerType, 'player-character');
    assert.equal(response.item.ownership.characterId, character.characterId);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 item negative: upsert rejects non-player-character ownership types', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'ItemNpcOwnerPilot', 'item-npc@example.com', 'secret');

    const upsertPromise = waitForEvent(client, ITEM_UPSERT_RESPONSE_EVENT);
    client.emit(ITEM_UPSERT_REQUEST_EVENT, {
      playerName: 'ItemNpcOwnerPilot',
      sessionKey: login.sessionKey,
      correlationId: '00000000-0000-4000-8000-000000000003',
      requestIdentity: { operation: 'item-upsert', entityType: 'iron-ore', containerId: '-' },
      item: {
        itemType: 'conduit-seals',
        displayName: 'Conduit Seals',
        owningPlayerId: 'some-player',
        owningCharacterId: 'some-char',
        ownership: {
          ownerType: 'npc-pirate',
          npcId: 'npc-1',
        },
      },
    });

    const response = await withTimeout(upsertPromise, 1200, 'npc ownership rejection');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'OWNERSHIP_VALIDATION_FAILED');
    assert.match(response.message, /player-character/i);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
