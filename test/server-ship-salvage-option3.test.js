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

const { SHIP_SALVAGE_CLAIM_REQUEST_EVENT, SHIP_SALVAGE_CLAIM_RESPONSE_EVENT } = require('../src/model/ship-salvage-claim');
const { SHIP_UPSERT_REQUEST_EVENT, SHIP_UPSERT_RESPONSE_EVENT } = require('../src/model/ship-upsert');
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

async function upsertUnownedShip(client, playerName, sessionKey, characterId) {
  const promise = waitForEvent(client, SHIP_UPSERT_RESPONSE_EVENT);
  const unownedShipId = `unowned-ship-${Date.now()}`;
  client.emit(SHIP_UPSERT_REQUEST_EVENT, {
    playerName,
    characterId,
    sessionKey,
    correlationId: '00000000-0000-4000-8000-000000000010',
    requestIdentity: { operation: 'ship-upsert', entityType: 'ship', containerId: unownedShipId },
    ship: {
      id: unownedShipId,
      shipName: 'Derelict Scout',
      model: 'Scout',
      tier: 1,
      spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 100, y: 0, z: 0 }, epochMs: 0 },
      ownership: { ownerType: 'unknown', playerId: null, characterId: null, npcId: null, factionId: null },
    },
  });
  const result = await withTimeout(promise, 1200, 'ship-upsert');
  return { shipId: unownedShipId, result };
}

test('Option3 salvage negative: cross-player claim is forbidden', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const shipOwnerClient = connectClient(port);
  const claimantClient = connectClient(port);

  await withTimeout(waitForEvent(shipOwnerClient, 'connect'), 1200, 'ship owner connect');
  await withTimeout(waitForEvent(claimantClient, 'connect'), 1200, 'claimant connect');

  try {
    const shipOwnerLogin = await registerAndLogin(shipOwnerClient, 'SalvageShipOwner', 'salvage-owner@example.com', 'secret');
    const shipOwnerChar = await addCharacter(shipOwnerClient, 'SalvageShipOwner', shipOwnerLogin.sessionKey, 'ShipOwnerChar');

    const claimantLogin = await registerAndLogin(claimantClient, 'SalvageClaimant', 'salvage-claimant@example.com', 'secret');
    const claimantChar = await addCharacter(claimantClient, 'SalvageClaimant', claimantLogin.sessionKey, 'ClaimantChar');

    const { shipId } = await upsertUnownedShip(shipOwnerClient, 'SalvageShipOwner', shipOwnerLogin.sessionKey, shipOwnerChar.characterId);

    // Claimant tries to claim using ship owner's playerId — cross-player block
    const claimPromise = waitForEvent(claimantClient, SHIP_SALVAGE_CLAIM_RESPONSE_EVENT);
    claimantClient.emit(SHIP_SALVAGE_CLAIM_REQUEST_EVENT, {
      playerName: 'SalvageClaimant',
      sessionKey: claimantLogin.sessionKey,
      shipId,
      claimantOwner: {
        ownerType: 'player-character',
        playerId: shipOwnerLogin.playerId || 'SalvageShipOwner',
        characterId: claimantChar.characterId,
      },
    });

    const response = await withTimeout(claimPromise, 1200, 'forbidden salvage claim');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'SALVAGE_CLAIM_FORBIDDEN');
  } finally {
    await closeClient(shipOwnerClient);
    await closeClient(claimantClient);
    io.close();
    server.close();
  }
});

test('Option3 salvage positive: player can claim unowned ship', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'SalvagePilot', 'salvage-pilot@example.com', 'secret');
    const character = await addCharacter(client, 'SalvagePilot', login.sessionKey, 'SalvageChar');

    const { shipId } = await upsertUnownedShip(client, 'SalvagePilot', login.sessionKey, character.characterId);

    const claimPromise = waitForEvent(client, SHIP_SALVAGE_CLAIM_RESPONSE_EVENT);
    client.emit(SHIP_SALVAGE_CLAIM_REQUEST_EVENT, {
      playerName: 'SalvagePilot',
      sessionKey: login.sessionKey,
      shipId,
      claimantOwner: {
        ownerType: 'player-character',
        playerId: login.playerId || 'SalvagePilot',
        characterId: character.characterId,
      },
    });

    const response = await withTimeout(claimPromise, 1200, 'salvage claim');
    assert.equal(response.success, true);
    assert.equal(response.shipId, shipId);
    assert.equal(response.claimantOwner.ownerType, 'player-character');
    assert.equal(response.claimantOwner.characterId, character.characterId);
    assert.equal(response.previousOwnerType, 'unknown');
    assert.ok(response.claimedAt);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 salvage negative: cannot claim already-owned ship', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(client, 'SalvageOwnedPilot', 'salvage-owned@example.com', 'secret');
    const character = await addCharacter(client, 'SalvageOwnedPilot', login.sessionKey, 'OwnedChar');

    // The starter ship is already player-character owned
    const shipId = await getShipId(client, 'SalvageOwnedPilot', login.sessionKey, character.characterId);
    assert.ok(shipId, 'Should have a starter ship');

    const claimPromise = waitForEvent(client, SHIP_SALVAGE_CLAIM_RESPONSE_EVENT);
    client.emit(SHIP_SALVAGE_CLAIM_REQUEST_EVENT, {
      playerName: 'SalvageOwnedPilot',
      sessionKey: login.sessionKey,
      shipId,
      claimantOwner: {
        ownerType: 'player-character',
        playerId: login.playerId || 'SalvageOwnedPilot',
        characterId: character.characterId,
      },
    });

    const response = await withTimeout(claimPromise, 1200, 'owned ship claim');
    assert.equal(response.success, false);
    assert.equal(response.reason, 'SALVAGE_ALREADY_OWNED');
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
