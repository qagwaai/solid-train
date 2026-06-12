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

test('Option3 piracy positive: npc-pirate can seize player-character ship', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'PiracyVictim', 'piracy-victim@example.com', 'secret');
    const character = await addCharacter(client, 'PiracyVictim', login.sessionKey, 'VictimChar');
    const shipId = await getShipId(client, 'PiracyVictim', login.sessionKey, character.characterId);
    assert.ok(shipId);

    const seizePromise = waitForEvent(client, SHIP_PIRACY_SEIZE_RESPONSE_EVENT);
    client.emit(SHIP_PIRACY_SEIZE_REQUEST_EVENT, {
      playerName: 'PiracyVictim',
      sessionKey: login.sessionKey,
      shipId,
      seizingOwner: {
        ownerType: 'npc-pirate',
        npcId: 'pirate-npc-1',
        factionId: 'black-flag',
      },
    });

    const response = await withTimeout(seizePromise, 1200, 'piracy seize');
    assert.equal(response.success, true);
    assert.equal(response.shipId, shipId);
    assert.equal(response.seizingOwner.ownerType, 'npc-pirate');
    assert.equal(response.seizingOwner.npcId, 'pirate-npc-1');
    assert.equal(response.previousOwner.ownerType, 'player-character');
    assert.ok(response.seizedAt);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 piracy negative: non-npc-pirate seizingOwner is rejected', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'PiracyInvalidSeizer', 'piracy-invalid@example.com', 'secret');
    const character = await addCharacter(client, 'PiracyInvalidSeizer', login.sessionKey, 'InvalidChar');
    const shipId = await getShipId(client, 'PiracyInvalidSeizer', login.sessionKey, character.characterId);

    const seizePromise = waitForEvent(client, SHIP_PIRACY_SEIZE_RESPONSE_EVENT);
    client.emit(SHIP_PIRACY_SEIZE_REQUEST_EVENT, {
      playerName: 'PiracyInvalidSeizer',
      sessionKey: login.sessionKey,
      shipId,
      seizingOwner: {
        ownerType: 'player-character',
        playerId: login.playerId || 'PiracyInvalidSeizer',
        characterId: character.characterId,
      },
    });

    const response = await withTimeout(seizePromise, 1200, 'invalid seizer');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'OWNERSHIP_VALIDATION_FAILED');
    assert.match(response.message, /npc-pirate/i);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 piracy negative: cannot seize unowned/unknown ship', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'PiracyUnownedTarget', 'piracy-unowned@example.com', 'secret');
    const character = await addCharacter(client, 'PiracyUnownedTarget', login.sessionKey, 'UnownedChar');

    // Add an unknown ship first using ship-upsert
    const { SHIP_UPSERT_REQUEST_EVENT, SHIP_UPSERT_RESPONSE_EVENT } = require('../src/model/ship-upsert');
    const unknownShipId = `unknown-ship-piracy-${Date.now()}`;
    const upsertPromise = waitForEvent(client, SHIP_UPSERT_RESPONSE_EVENT);
    client.emit(SHIP_UPSERT_REQUEST_EVENT, {
      playerName: 'PiracyUnownedTarget',
      characterId: character.characterId,
      sessionKey: login.sessionKey,
      correlationId: '00000000-0000-4000-8000-000000000020',
      requestIdentity: { operation: 'ship-upsert', entityType: 'ship', containerId: unknownShipId },
      ship: {
        id: unknownShipId,
        shipName: 'Derelict',
        model: 'Scout',
        tier: 1,
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 200, y: 0, z: 0 }, epochMs: 0 },
        ownership: { ownerType: 'unknown', playerId: null, characterId: null, npcId: null, factionId: null },
      },
    });
    await withTimeout(upsertPromise, 1200, 'upsert unknown ship');

    const seizePromise = waitForEvent(client, SHIP_PIRACY_SEIZE_RESPONSE_EVENT);
    client.emit(SHIP_PIRACY_SEIZE_REQUEST_EVENT, {
      playerName: 'PiracyUnownedTarget',
      sessionKey: login.sessionKey,
      shipId: unknownShipId,
      seizingOwner: {
        ownerType: 'npc-pirate',
        npcId: 'pirate-npc-2',
      },
    });

    const response = await withTimeout(seizePromise, 1200, 'unowned piracy target');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'PIRACY_SEIZE_INVALID_TARGET');
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
