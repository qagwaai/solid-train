'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');
const {
  listen,
  connectClient,
  waitForEvent,
  closeClient,
  registerAndLogin,
} = require('../test-support/socket-test-helpers');
const {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
} = require('../src/model/character-add');
const { SHIP_LIST_REQUEST_EVENT, SHIP_LIST_RESPONSE_EVENT } = require('../src/model/ship-list');
const {
  SHIP_UPSERT_REQUEST_EVENT,
  SHIP_UPSERT_RESPONSE_EVENT,
} = require('../src/model/ship-upsert');

const SHIP_LIST_BY_OWNER_REQUEST_EVENT = 'ship-list-by-owner-request';
const SHIP_LIST_BY_OWNER_RESPONSE_EVENT = 'ship-list-by-owner-response';
const SHIP_TRANSFER_REQUEST_EVENT = 'ship-transfer-request';
const SHIP_TRANSFER_RESPONSE_EVENT = 'ship-transfer-response';

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function addCharacter(client, playerName, sessionKey, characterName) {
  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName,
    sessionKey,
    characterName,
  });

  const response = await withTimeout(addResponsePromise, 1200, CHARACTER_ADD_RESPONSE_EVENT);
  assert.equal(response.success, true);
  return response;
}

async function getCharacterShipId(client, playerName, sessionKey, characterId) {
  const listResponsePromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName,
    sessionKey,
    characterId,
  });

  const response = await withTimeout(listResponsePromise, 1200, SHIP_LIST_RESPONSE_EVENT);
  assert.equal(response.success, true);
  assert.ok(Array.isArray(response.ships));
  assert.ok(response.ships.length > 0);
  return response.ships[0].id;
}

test('Option3 server contract: ship-list-by-owner returns strict owner-scoped payload', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'OwnerScopePilot',
      'owner-scope@example.com',
      'secret'
    );
    const added = await addCharacter(client, 'OwnerScopePilot', login.sessionKey, 'CaptainA');

    const responsePromise = waitForEvent(client, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'OwnerScopePilot',
      sessionKey: login.sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId: added.characterId,
      },
    });

    const response = await withTimeout(responsePromise, 1200, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);

    assert.equal(response.success, true);
    assert.equal(response.message, 'Ship list by owner retrieved successfully');
    assert.equal(response.owner.ownerType, 'player-character');
    assert.equal(response.owner.characterId, added.characterId);
    assert.equal(typeof response.owner.playerId, 'string');
    assert.ok(response.owner.playerId.length > 0);
    assert.equal(response.owner.npcId, null);
    assert.equal(response.owner.factionId, null);
    assert.ok(Array.isArray(response.ships));
    assert.ok(response.ships.length >= 1);

    const [firstShip] = response.ships;
    assert.equal(typeof firstShip.id, 'string');
    assert.ok(firstShip.id.length > 0);
    assert.deepEqual(firstShip.ownership, response.owner);
    assert.ok(Array.isArray(firstShip.inventory));
    assert.ok(firstShip.inventory.length > 0);

    const starterDrone = firstShip.inventory.find(
      (item) => item.itemType === 'expendable-dart-drone'
    );
    assert.ok(starterDrone);
    assert.equal(starterDrone.launchable, true);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 server negative: ship-transfer rejects unauthorized actor with strict reason', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const ownerClient = connectClient(port);
  const intruderClient = connectClient(port);

  await withTimeout(waitForEvent(ownerClient, 'connect'), 1200, 'owner connect');
  await withTimeout(waitForEvent(intruderClient, 'connect'), 1200, 'intruder connect');

  try {
    const ownerLogin = await registerAndLogin(
      ownerClient,
      'TransferOwner',
      'transfer-owner@example.com',
      'secret'
    );
    const ownerCharacter = await addCharacter(
      ownerClient,
      'TransferOwner',
      ownerLogin.sessionKey,
      'OwnerCharacter'
    );

    const intruderLogin = await registerAndLogin(
      intruderClient,
      'TransferIntruder',
      'transfer-intruder@example.com',
      'secret'
    );

    const intruderCharacter = await addCharacter(
      intruderClient,
      'TransferIntruder',
      intruderLogin.sessionKey,
      'IntruderCharacter'
    );

    const shipId = await getCharacterShipId(
      ownerClient,
      'TransferOwner',
      ownerLogin.sessionKey,
      ownerCharacter.characterId
    );

    const transferResponsePromise = waitForEvent(intruderClient, SHIP_TRANSFER_RESPONSE_EVENT);
    intruderClient.emit(SHIP_TRANSFER_REQUEST_EVENT, {
      playerName: 'TransferIntruder',
      sessionKey: intruderLogin.sessionKey,
      shipId,
      fromOwner: {
        ownerType: 'player-character',
        characterId: ownerCharacter.characterId,
      },
      toOwner: {
        ownerType: 'player-character',
        characterId: intruderCharacter.characterId,
      },
    });

    const transferResponse = await withTimeout(
      transferResponsePromise,
      1200,
      SHIP_TRANSFER_RESPONSE_EVENT
    );

    assert.deepEqual(transferResponse, {
      success: false,
      reason: 'SHIP_TRANSFER_FORBIDDEN',
      message: 'Actor does not have permission to transfer this ship',
      shipId,
      correlationId: 'missing-correlation-id',
      requestIdentity: {
        operation: 'ship-transfer',
        entityType: 'unknown',
        containerId: shipId,
      },
    });
  } finally {
    await closeClient(ownerClient);
    await closeClient(intruderClient);
    io.close();
    server.close();
  }
});

test('Option3 server negative: ship-upsert cross-player mutation returns ownership mismatch reason', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const ownerClient = connectClient(port);
  const intruderClient = connectClient(port);

  await withTimeout(waitForEvent(ownerClient, 'connect'), 1200, 'owner connect');
  await withTimeout(waitForEvent(intruderClient, 'connect'), 1200, 'intruder connect');

  try {
    const ownerLogin = await registerAndLogin(
      ownerClient,
      'MismatchOwner',
      'mismatch-owner@example.com',
      'secret'
    );
    const ownerCharacter = await addCharacter(
      ownerClient,
      'MismatchOwner',
      ownerLogin.sessionKey,
      'OwnerCharacter'
    );

    const intruderLogin = await registerAndLogin(
      intruderClient,
      'MismatchIntruder',
      'mismatch-intruder@example.com',
      'secret'
    );

    const intruderCharacter = await addCharacter(
      intruderClient,
      'MismatchIntruder',
      intruderLogin.sessionKey,
      'IntruderCharacter'
    );

    const ownerShipId = await getCharacterShipId(
      ownerClient,
      'MismatchOwner',
      ownerLogin.sessionKey,
      ownerCharacter.characterId
    );

    const responsePromise = waitForEvent(intruderClient, 'ship-upsert-response');
    intruderClient.emit(SHIP_UPSERT_REQUEST_EVENT, {
      playerName: 'MismatchIntruder',
      characterId: intruderCharacter.characterId,
      sessionKey: intruderLogin.sessionKey,
      ship: {
        id: ownerShipId,
        model: 'Hijacker Mk2',
        ownership: {
          ownerType: 'player-character',
          characterId: intruderCharacter.characterId,
        },
      },
    });

    const response = await withTimeout(responsePromise, 1200, 'ship-upsert-response');

    assert.deepEqual(response, {
      success: false,
      reason: 'SHIP_OWNERSHIP_MISMATCH',
      message: 'Ship ownership mismatch for requested mutation',
      playerName: 'MismatchIntruder',
      characterId: intruderCharacter.characterId,
      correlationId: 'missing-correlation-id',
      requestIdentity: {
        operation: 'ship-upsert',
        entityType: 'ship',
        containerId: ownerShipId,
      },
    });
  } finally {
    await closeClient(ownerClient);
    await closeClient(intruderClient);
    io.close();
    server.close();
  }
});

test('Option3 server positive: ship-transfer success and persistence (list-by-owner reflects transfer)', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const ownerClient = connectClient(port);
  const recipientClient = connectClient(port);

  await withTimeout(waitForEvent(ownerClient, 'connect'), 1200, 'owner connect');
  await withTimeout(waitForEvent(recipientClient, 'connect'), 1200, 'recipient connect');

  try {
    const ownerLogin = await registerAndLogin(
      ownerClient,
      'TransferSuccessOwner',
      'transfer-success-owner@example.com',
      'secret'
    );
    const ownerCharacter = await addCharacter(
      ownerClient,
      'TransferSuccessOwner',
      ownerLogin.sessionKey,
      'OwnerCharacter'
    );

    const recipientLogin = await registerAndLogin(
      recipientClient,
      'TransferSuccessRecipient',
      'transfer-success-recipient@example.com',
      'secret'
    );
    const recipientCharacter = await addCharacter(
      recipientClient,
      'TransferSuccessRecipient',
      recipientLogin.sessionKey,
      'RecipientCharacter'
    );

    const shipId = await getCharacterShipId(
      ownerClient,
      'TransferSuccessOwner',
      ownerLogin.sessionKey,
      ownerCharacter.characterId
    );

    // Transfer the ship from owner to recipient
    const transferResponsePromise = waitForEvent(ownerClient, SHIP_TRANSFER_RESPONSE_EVENT);
    ownerClient.emit(SHIP_TRANSFER_REQUEST_EVENT, {
      playerName: 'TransferSuccessOwner',
      sessionKey: ownerLogin.sessionKey,
      shipId,
      fromOwner: {
        ownerType: 'player-character',
        characterId: ownerCharacter.characterId,
        playerId: ownerLogin.playerId || 'TransferSuccessOwner',
        npcId: null,
        factionId: null,
      },
      toOwner: {
        ownerType: 'player-character',
        characterId: recipientCharacter.characterId,
        playerId: recipientLogin.playerId || 'TransferSuccessRecipient',
        npcId: null,
        factionId: null,
      },
    });

    const transferResponse = await withTimeout(
      transferResponsePromise,
      1200,
      SHIP_TRANSFER_RESPONSE_EVENT
    );

    assert.deepEqual(transferResponse, {
      success: true,
      message: 'Ship transferred successfully',
      shipId,
      fromOwner: {
        ownerType: 'player-character',
        characterId: ownerCharacter.characterId,
        playerId: ownerLogin.playerId || 'TransferSuccessOwner',
        npcId: null,
        factionId: null,
      },
      toOwner: {
        ownerType: 'player-character',
        characterId: recipientCharacter.characterId,
        playerId: recipientLogin.playerId || 'TransferSuccessRecipient',
        npcId: null,
        factionId: null,
      },
      correlationId: 'missing-correlation-id',
      requestIdentity: {
        operation: 'ship-transfer',
        entityType: 'unknown',
        containerId: shipId,
      },
    });

    // Old owner should no longer see the ship
    const oldOwnerListPromise = waitForEvent(ownerClient, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    ownerClient.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'TransferSuccessOwner',
      sessionKey: ownerLogin.sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId: ownerCharacter.characterId,
      },
    });
    const oldOwnerList = await withTimeout(oldOwnerListPromise, 1200, 'old owner list');
    assert.equal(oldOwnerList.success, true);
    assert.ok(Array.isArray(oldOwnerList.ships));
    assert.ok(!oldOwnerList.ships.some((s) => s.id === shipId));

    // New owner should see the ship
    const newOwnerListPromise = waitForEvent(recipientClient, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    recipientClient.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'TransferSuccessRecipient',
      sessionKey: recipientLogin.sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId: recipientCharacter.characterId,
      },
    });
    const newOwnerList = await withTimeout(newOwnerListPromise, 1200, 'new owner list');
    assert.equal(newOwnerList.success, true);
    assert.ok(Array.isArray(newOwnerList.ships));
    assert.ok(newOwnerList.ships.some((s) => s.id === shipId));
  } finally {
    await closeClient(ownerClient);
    await closeClient(recipientClient);
    io.close();
    server.close();
  }
});

test('Option3 server positive: unknown -> player-character claim-token success and persistence', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'ClaimTokenPilot',
      'claim-token@example.com',
      'secret'
    );
    const added = await addCharacter(client, 'ClaimTokenPilot', login.sessionKey, 'CaptainB');

    // Add a fixture ship with ownerType: 'unknown' to the character before upsert
    const addUnknownShipPromise = waitForEvent(client, SHIP_UPSERT_RESPONSE_EVENT);
    client.emit(SHIP_UPSERT_REQUEST_EVENT, {
      playerName: 'ClaimTokenPilot',
      characterId: added.characterId,
      sessionKey: login.sessionKey,
      ship: {
        id: 'unknown-ship-1',
        model: 'Derelict',
        spatial: {
          solarSystemId: 'system-sol',
          frame: 'barycentric',
          positionKm: { x: 25, y: 0, z: -10 },
          epochMs: 1713607200000,
        },
        motion: {
          velocityKmPerSec: { x: 0, y: 0, z: 0 },
        },
        ownership: {
          ownerType: 'unknown',
        },
      },
    });
    const addUnknownShipResponse = await withTimeout(
      addUnknownShipPromise,
      1200,
      'add-unknown-ship'
    );
    assert.equal(addUnknownShipResponse.success, true);

    // Claim the ship for the player-character
    const claimResponsePromise = waitForEvent(client, SHIP_TRANSFER_RESPONSE_EVENT);
    client.emit(SHIP_TRANSFER_REQUEST_EVENT, {
      playerName: 'ClaimTokenPilot',
      sessionKey: login.sessionKey,
      shipId: 'unknown-ship-1',
      fromOwner: { ownerType: 'unknown' },
      toOwner: {
        ownerType: 'player-character',
        characterId: added.characterId,
        playerId: login.playerId || 'ClaimTokenPilot',
        npcId: null,
        factionId: null,
      },
      claimToken: 'test-claim-token',
    });
    const claimResponse = await withTimeout(claimResponsePromise, 1200, 'claim-token transfer');
    assert.deepEqual(claimResponse, {
      success: true,
      message: 'Ship transferred successfully',
      shipId: 'unknown-ship-1',
      fromOwner: {
        ownerType: 'unknown',
        playerId: null,
        characterId: null,
        npcId: null,
        factionId: null,
      },
      toOwner: {
        ownerType: 'player-character',
        characterId: added.characterId,
        playerId: login.playerId || 'ClaimTokenPilot',
        npcId: null,
        factionId: null,
      },
      correlationId: 'missing-correlation-id',
      requestIdentity: {
        operation: 'ship-transfer',
        entityType: 'unknown',
        containerId: 'unknown-ship-1',
      },
    });

    // Verify persistence: ship now appears in list-by-owner for player-character
    const listPromise = waitForEvent(client, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'ClaimTokenPilot',
      sessionKey: login.sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId: added.characterId,
        playerId: login.playerId || 'ClaimTokenPilot',
        npcId: null,
        factionId: null,
      },
    });
    const listResponse = await withTimeout(listPromise, 1200, 'list-by-owner after claim');
    assert.equal(listResponse.success, true);
    assert.ok(Array.isArray(listResponse.ships));
    assert.ok(listResponse.ships.some((s) => s.id === 'unknown-ship-1'));
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('Option3 server negative: invalid session/identity on ship-list-by-owner and ship-transfer returns INVALID_SESSION', async () => {
  const { server, io } = createServer();
  const port = await listen(server);
  const client = connectClient(port);

  await withTimeout(waitForEvent(client, 'connect'), 1200, 'connect');

  try {
    // Try ship-list-by-owner with invalid session
    const listPromise = waitForEvent(client, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'InvalidSessionPilot',
      sessionKey: 'not-a-real-session',
      owner: {
        ownerType: 'player-character',
        characterId: 'fake-character',
        playerId: 'InvalidSessionPilot',
        npcId: null,
        factionId: null,
      },
    });
    const listResponse = await withTimeout(listPromise, 1200, 'invalid session list-by-owner');
    assert.deepEqual(listResponse, {
      success: false,
      reason: 'INVALID_SESSION',
      message: 'Invalid session',
      ships: [],
      correlationId: 'missing-correlation-id',
      requestIdentity: {
        operation: 'ship-list-by-owner',
        entityType: 'unknown',
        containerId: '-',
      },
    });

    // Try ship-transfer with invalid session
    const transferPromise = waitForEvent(client, SHIP_TRANSFER_RESPONSE_EVENT);
    client.emit(SHIP_TRANSFER_REQUEST_EVENT, {
      playerName: 'InvalidSessionPilot',
      sessionKey: 'not-a-real-session',
      shipId: 'fake-ship',
      fromOwner: {
        ownerType: 'player-character',
        characterId: 'fake-character',
        playerId: 'InvalidSessionPilot',
        npcId: null,
        factionId: null,
      },
      toOwner: {
        ownerType: 'player-character',
        characterId: 'other-character',
        playerId: 'InvalidSessionPilot',
        npcId: null,
        factionId: null,
      },
    });
    const transferResponse = await withTimeout(transferPromise, 1200, 'invalid session transfer');
    assert.deepEqual(transferResponse, {
      success: false,
      reason: 'INVALID_SESSION',
      message: 'Invalid session',
      ships: [],
      correlationId: 'missing-correlation-id',
      requestIdentity: {
        operation: 'ship-transfer',
        entityType: 'unknown',
        containerId: 'fake-ship',
      },
    });
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
