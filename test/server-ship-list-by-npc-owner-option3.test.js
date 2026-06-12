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

const { SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT, SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT } = require('../src/model/ship-list-by-npc-owner');
const { SHIP_PIRACY_SEIZE_REQUEST_EVENT, SHIP_PIRACY_SEIZE_RESPONSE_EVENT } = require('../src/model/ship-piracy-seize');
const { CHARACTER_ADD_REQUEST_EVENT, CHARACTER_ADD_RESPONSE_EVENT } = require('../src/model/character-add');
const { SHIP_LIST_RESPONSE_EVENT, SHIP_LIST_REQUEST_EVENT } = require('../src/model/ship-list');

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

async function getShipId(client, playerName, sessionKey, characterId) {
  const promise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, { playerName, characterId, sessionKey });
  const list = await withTimeout(promise, 1200, 'ship-list');
  return list.ships?.[0]?.id;
}

test('Option3 npc-ship-list positive: returns ships seized by a specific NPC', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'NpcListVictim', 'npc-list-victim@example.com', 'secret');
    const character = await addCharacter(client, 'NpcListVictim', login.sessionKey, 'VictimChar');
    const shipId = await getShipId(client, 'NpcListVictim', login.sessionKey, character.characterId);
    assert.ok(shipId);

    // NPC seizes the ship
    const seizePromise = waitForEvent(client, SHIP_PIRACY_SEIZE_RESPONSE_EVENT);
    client.emit(SHIP_PIRACY_SEIZE_REQUEST_EVENT, {
      playerName: 'NpcListVictim',
      sessionKey: login.sessionKey,
      shipId,
      seizingOwner: { ownerType: 'npc-pirate', npcId: 'pirate-npc-query-1', factionId: 'reavers' },
    });
    const seize = await withTimeout(seizePromise, 1200, 'seize');
    assert.equal(seize.success, true);

    // Query ships owned by that NPC
    const listPromise = waitForEvent(client, SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT, {
      playerName: 'NpcListVictim',
      sessionKey: login.sessionKey,
      npcOwner: { ownerType: 'npc-pirate', npcId: 'pirate-npc-query-1' },
    });

    const response = await withTimeout(listPromise, 1200, 'npc ship list');
    assert.equal(response.success, true);
    assert.ok(Array.isArray(response.ships));
    assert.ok(response.ships.length >= 1);
    assert.equal(response.ships[0].id, shipId);
    assert.equal(response.ships[0].ownership.ownerType, 'npc-pirate');
    assert.equal(response.ships[0].ownership.npcId, 'pirate-npc-query-1');
    assert.equal(response.npcOwner.npcId, 'pirate-npc-query-1');
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 npc-ship-list positive: returns empty list for NPC with no ships', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'NpcListEmptyPilot', 'npc-list-empty@example.com', 'secret');
    await addCharacter(client, 'NpcListEmptyPilot', login.sessionKey, 'EmptyChar');

    const listPromise = waitForEvent(client, SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT, {
      playerName: 'NpcListEmptyPilot',
      sessionKey: login.sessionKey,
      npcOwner: { ownerType: 'npc-pirate', npcId: 'npc-with-no-ships' },
    });

    const response = await withTimeout(listPromise, 1200, 'empty npc list');
    assert.equal(response.success, true);
    assert.deepEqual(response.ships, []);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 npc-ship-list negative: non-npc-pirate ownerType is rejected', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'NpcListBadTypePilot', 'npc-list-bad@example.com', 'secret');
    await addCharacter(client, 'NpcListBadTypePilot', login.sessionKey, 'BadTypeChar');

    const listPromise = waitForEvent(client, SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT, {
      playerName: 'NpcListBadTypePilot',
      sessionKey: login.sessionKey,
      npcOwner: { ownerType: 'player-character', playerId: 'p1', characterId: 'c1' },
    });

    const response = await withTimeout(listPromise, 1200, 'bad type list');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'OWNERSHIP_VALIDATION_FAILED');
    assert.match(response.message, /npc-pirate/i);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
