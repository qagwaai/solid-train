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

const { CHARACTER_ADD_REQUEST_EVENT, CHARACTER_ADD_RESPONSE_EVENT } = require('../src/model/character-add');
const { SHIP_LIST_RESPONSE_EVENT, SHIP_LIST_REQUEST_EVENT } = require('../src/model/ship-list');
const { ITEM_UPSERT_REQUEST_EVENT, ITEM_UPSERT_RESPONSE_EVENT } = require('../src/model/item-upsert');
const { ITEM_LIST_BY_OWNER_REQUEST_EVENT, ITEM_LIST_BY_OWNER_RESPONSE_EVENT } = require('../src/model/item-list-by-owner');

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

test('Option3 backfill: starter ship has canonical ownership on read', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'BackfillShipPilot', 'backfill-ship@example.com', 'secret');
    const character = await addCharacter(client, 'BackfillShipPilot', login.sessionKey, 'BackfillChar');

    const listPromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
    client.emit(SHIP_LIST_REQUEST_EVENT, {
      playerName: 'BackfillShipPilot',
      characterId: character.characterId,
      sessionKey: login.sessionKey,
    });

    const response = await withTimeout(listPromise, 1200, 'ship list');
    assert.equal(response.success, true);
    assert.ok(response.ships.length >= 1);

    const ship = response.ships[0];
    assert.ok(ship.ownership, 'Starter ship should have canonical ownership');
    assert.equal(ship.ownership.ownerType, 'player-character');
    assert.ok(ship.ownership.playerId);
    assert.ok(ship.ownership.characterId);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 backfill: item upserted with legacy owningPlayerId/owningCharacterId gets canonical ownership', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'BackfillItemPilot', 'backfill-item@example.com', 'secret');
    const character = await addCharacter(client, 'BackfillItemPilot', login.sessionKey, 'BackfillItemChar');

    // Upsert item with only legacy fields (no canonical ownership)
    const upsertPromise = waitForEvent(client, ITEM_UPSERT_RESPONSE_EVENT);
    client.emit(ITEM_UPSERT_REQUEST_EVENT, {
      playerName: 'BackfillItemPilot',
      sessionKey: login.sessionKey,
      correlationId: '00000000-0000-4000-8000-000000000030',
      requestIdentity: { operation: 'item-upsert', entityType: 'conduit-seals', containerId: '-' },
      item: {
        itemType: 'conduit-seals',
        displayName: 'Conduit Seals',
        owningPlayerId: login.playerId || 'BackfillItemPilot',
        owningCharacterId: character.characterId,
        // No ownership field — legacy path
      },
    });

    const upsertResponse = await withTimeout(upsertPromise, 1200, 'item upsert');
    assert.equal(upsertResponse.success, true);
    assert.ok(upsertResponse.item);

    // Backfilled ownership should be derived from legacy fields
    assert.ok(upsertResponse.item.ownership, 'Item should have backfilled canonical ownership');
    assert.equal(upsertResponse.item.ownership.ownerType, 'player-character');
    assert.equal(upsertResponse.item.ownership.playerId, login.playerId || 'BackfillItemPilot');
    assert.equal(upsertResponse.item.ownership.characterId, character.characterId);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 backfill: item with canonical ownership takes precedence over legacy fields', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'BackfillPrecedencePilot', 'backfill-prec@example.com', 'secret');
    const character = await addCharacter(client, 'BackfillPrecedencePilot', login.sessionKey, 'PrecedenceChar');

    const upsertPromise = waitForEvent(client, ITEM_UPSERT_RESPONSE_EVENT);
    client.emit(ITEM_UPSERT_REQUEST_EVENT, {
      playerName: 'BackfillPrecedencePilot',
      sessionKey: login.sessionKey,
      correlationId: '00000000-0000-4000-8000-000000000031',
      requestIdentity: { operation: 'item-upsert', entityType: 'conduit-seals', containerId: '-' },
      item: {
        itemType: 'conduit-seals',
        displayName: 'Conduit Seals',
        owningPlayerId: 'legacy-player',
        owningCharacterId: 'legacy-char',
        ownership: {
          ownerType: 'player-character',
          playerId: login.playerId || 'BackfillPrecedencePilot',
          characterId: character.characterId,
        },
      },
    });

    const upsertResponse = await withTimeout(upsertPromise, 1200, 'item upsert with canonical');
    assert.equal(upsertResponse.success, true);
    assert.ok(upsertResponse.item.ownership);
    // Canonical ownership should be used, not the legacy fields
    assert.equal(upsertResponse.item.ownership.playerId, login.playerId || 'BackfillPrecedencePilot');
    assert.equal(upsertResponse.item.ownership.characterId, character.characterId);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
