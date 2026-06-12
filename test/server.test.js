'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, resolvePort, startServer } = require('../src/server');
const {
  listen,
  connectClient,
  waitForEvent,
  httpGetJson,
  closeClient,
  registerAndLogin,
} = require('../test-support/socket-test-helpers');
const { createCelestialBody } = require('../test-support/message-handler-test-helpers');
const { REGISTER_EVENT, REGISTER_RESPONSE_EVENT } = require('../src/model/register');
const { LOGIN_EVENT, LOGIN_RESPONSE_EVENT, LOGIN_FAILURE_REASONS } = require('../src/model/login');
const {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT,
} = require('../src/model/character-list');
const {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
} = require('../src/model/character-add');
const {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT,
} = require('../src/model/character-delete');
const {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT,
} = require('../src/model/character-edit');
const { SHIP_LIST_REQUEST_EVENT, SHIP_LIST_RESPONSE_EVENT } = require('../src/model/ship-list');
const {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
} = require('../src/model/ship-list-by-owner');
const {
  ITEM_UPSERT_REQUEST_EVENT,
  ITEM_UPSERT_RESPONSE_EVENT,
} = require('../src/model/item-upsert');
const {
  ITEM_LIST_BY_CONTAINER_REQUEST_EVENT,
  ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT,
} = require('../src/model/item-list-by-container');
const {
  SHIP_UPSERT_REQUEST_EVENT,
  SHIP_UPSERT_RESPONSE_EVENT,
} = require('../src/model/ship-upsert');
const { GAME_JOIN_REQUEST_EVENT, GAME_JOIN_RESPONSE_EVENT } = require('../src/model/game-join');
const {
  MISSION_UPSERT_REQUEST_EVENT: MISSION_ADD_REQUEST_EVENT,
  MISSION_UPSERT_RESPONSE_EVENT: MISSION_ADD_RESPONSE_EVENT,
} = require('../src/model/mission-upsert');
const {
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
} = require('../src/model/celestial-body-upsert');
const {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
} = require('../src/model/celestial-body-list');
const {
  MISSION_LIST_REQUEST_EVENT,
  MISSION_LIST_RESPONSE_EVENT,
} = require('../src/model/mission-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  MARKET_LIST_REQUEST_EVENT,
  MARKET_LIST_RESPONSE_EVENT,
} = require('../src/model/market-list');
const {
  MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
} = require('../src/model/market-list-by-location');
const {
  MARKET_QUOTE_REQUEST_EVENT,
  MARKET_QUOTE_RESPONSE_EVENT,
} = require('../src/model/market-quote');
const {
  MARKET_INVENTORY_LIST_REQUEST_EVENT,
  MARKET_INVENTORY_LIST_RESPONSE_EVENT,
} = require('../src/model/market-inventory-list');
const {
  MARKET_LEDGER_LIST_REQUEST_EVENT,
  MARKET_LEDGER_LIST_RESPONSE_EVENT,
} = require('../src/model/market-ledger-list');
const { MARKET_BUY_REQUEST_EVENT, MARKET_BUY_RESPONSE_EVENT } = require('../src/model/market-buy');
const {
  MARKET_SELL_REQUEST_EVENT,
  MARKET_SELL_RESPONSE_EVENT,
} = require('../src/model/market-sell');
const {
  LAUNCH_ITEM_REQUEST_EVENT,
  LAUNCH_ITEM_RESPONSE_EVENT,
} = require('../src/model/launch-item');

async function getAvailablePort() {
  const net = require('node:net');

  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, () => {
      const address = probe.address();
      const port = address && typeof address === 'object' ? address.port : null;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    probe.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('resolvePort returns default port when not set', () => {
  assert.equal(resolvePort(undefined), 3000);
});

test('resolvePort throws for invalid port', () => {
  assert.throws(() => resolvePort('70000'), /PORT must be a valid number/);
});

test('createServer returns server and io instances', () => {
  const { port, server, io } = createServer({ port: '4000' });

  assert.equal(port, 4000);
  assert.equal(typeof server.listen, 'function');
  assert.equal(typeof io.close, 'function');

  io.close();
  server.close();
});

test('startServer runs without MongoDB URI and shutdown exits cleanly', async () => {
  const originalMongoUri = process.env.MONGODB_URI;
  const originalExit = process.exit;

  delete process.env.MONGODB_URI;

  let exitCode = null;
  let resolveExit;
  const exitPromise = new Promise((resolve) => {
    resolveExit = resolve;
  });

  process.exit = (code) => {
    exitCode = code;
    resolveExit();
  };

  try {
    const freePort = await getAvailablePort();
    const started = await startServer({ port: String(freePort) });
    assert.equal(typeof started.shutdown, 'function');

    await started.shutdown();
    await exitPromise;

    assert.equal(exitCode, 0);
  } finally {
    process.exit = originalExit;
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
  }
});

test('server health endpoint responds with ok JSON payload', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  try {
    const response = await httpGetJson(`http://127.0.0.1:${port}/health`);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  } finally {
    io.close();
    server.close();
  }
});

test('GET /items includes canonical conduit-seals catalog item', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  try {
    const response = await httpGetJson(`http://127.0.0.1:${port}/items`);
    assert.equal(response.statusCode, 200);

    const parsed = JSON.parse(response.body);
    assert.ok(Array.isArray(parsed.items));

    const conduitSeals = parsed.items.find((item) => item.itemType === 'conduit-seals');
    assert.ok(conduitSeals);
    assert.equal(conduitSeals.displayName, 'Conduit Seals');
    assert.equal(
      conduitSeals.description,
      'Pressure-rated sealing sleeves for rerouting damaged ship conduits and stabilizing subsystem junctions.'
    );
    assert.equal(conduitSeals.tier, 1);
    assert.equal(conduitSeals.launchable, false);
    assert.equal(conduitSeals.state, 'contained');
    assert.equal(conduitSeals.damageStatus, 'intact');
    assert.equal(conduitSeals.container, null);
    assert.equal(conduitSeals.category, 'manufactured-component');
    assert.equal(conduitSeals.rarity, 'common');
    assert.equal(conduitSeals.stackable, true);
    assert.equal(conduitSeals.massKg, 2);
    assert.equal(conduitSeals.volumeM3, 0.02);
    assert.equal(conduitSeals.baseValueCredits, 250);
    assert.deepEqual(conduitSeals.fabrication, {
      durationMs: 600000,
      requiredMaterials: [
        { itemType: 'copper', quantity: 2 },
        { itemType: 'polymer', quantity: 1 },
      ],
    });

    assert.equal(parsed.items.filter((item) => item.itemType === 'conduit-seals').length, 1);
  } finally {
    io.close();
    server.close();
  }
});

test('GET /items includes canonical ship-tractor-beam catalog item', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  try {
    const response = await httpGetJson(`http://127.0.0.1:${port}/items`);
    assert.equal(response.statusCode, 200);

    const parsed = JSON.parse(response.body);
    assert.ok(Array.isArray(parsed.items));

    const tractorBeam = parsed.items.find((item) => item.itemType === 'ship-tractor-beam');
    assert.ok(tractorBeam);
    assert.equal(tractorBeam.displayName, 'Tractor Beam');
    assert.equal(tractorBeam.launchable, false);
    assert.equal(tractorBeam.state, 'contained');
    assert.equal(tractorBeam.damageStatus, 'intact');
    assert.equal(tractorBeam.container, null);

    assert.equal(parsed.items.filter((item) => item.itemType === 'ship-tractor-beam').length, 1);
  } finally {
    io.close();
    server.close();
  }
});

test('server serves OpenAPI yaml and Swagger UI from the same process', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  try {
    const openApiResponse = await httpGetJson(`http://127.0.0.1:${port}/openapi.yaml`);
    assert.equal(openApiResponse.statusCode, 200);
    assert.match(openApiResponse.body, /openapi\s*:/i);

    const schemaResponse = await httpGetJson(`http://127.0.0.1:${port}/schemas/item.schema.json`);
    assert.equal(schemaResponse.statusCode, 200);
    assert.match(schemaResponse.body, /"title"\s*:\s*"item"/i);

    const modularSchemaResponse = await httpGetJson(
      `http://127.0.0.1:${port}/openapi/schemas/item.schema.json`
    );
    assert.equal(modularSchemaResponse.statusCode, 200);
    assert.match(modularSchemaResponse.body, /"title"\s*:\s*"item"/i);

    const docsResponse = await httpGetJson(`http://127.0.0.1:${port}/docs`);
    assert.equal(docsResponse.statusCode, 301);

    const docsIndexResponse = await httpGetJson(`http://127.0.0.1:${port}/docs/`);
    assert.equal(docsIndexResponse.statusCode, 200);
    assert.match(docsIndexResponse.body, /SwaggerUIBundle|swagger-ui/i);
  } finally {
    io.close();
    server.close();
  }
});

test('selected OpenAPI socket examples stay aligned with runtime correlation behavior', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const openApiResponse = await httpGetJson(`http://127.0.0.1:${port}/openapi.yaml`);
    assert.equal(openApiResponse.statusCode, 200);
    assert.match(openApiResponse.body, /\/socket\/character-add:/);
    assert.match(openApiResponse.body, /\/socket\/market-quote:/);
    assert.match(
      openApiResponse.body,
      /\.\/openapi\/character\/openapi\.yaml#\/paths\/~1socket~1character-add/
    );
    assert.match(
      openApiResponse.body,
      /\.\/openapi\/market\/openapi\.yaml#\/paths\/~1socket~1market-quote/
    );

    const characterOpenApiResponse = await httpGetJson(
      `http://127.0.0.1:${port}/openapi/character/openapi.yaml`
    );
    assert.equal(characterOpenApiResponse.statusCode, 200);
    assert.match(characterOpenApiResponse.body, /operation:\s+character-add/);

    const marketOpenApiResponse = await httpGetJson(
      `http://127.0.0.1:${port}/openapi/market/openapi.yaml`
    );
    assert.equal(marketOpenApiResponse.statusCode, 200);
    assert.match(marketOpenApiResponse.body, /operation:\s+market-quote/);
    assert.match(marketOpenApiResponse.body, /requestId:\s+rq-1/);

    const loginResponse = await registerAndLogin(
      client,
      'OpenApiSyncPilot',
      'openapi-sync@example.com',
      'sync-pass'
    );

    const characterCorrelationId = '8de8c197-bd34-4fe3-a619-379f31d0c3a7';
    const characterRequestIdentity = {
      operation: 'character-add',
      entityType: 'character',
      containerId: 'player-openapisyncpilot',
    };

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'OpenApiSyncPilot',
      sessionKey: loginResponse.sessionKey,
      correlationId: characterCorrelationId,
      requestIdentity: characterRequestIdentity,
      characterName: 'SyncRanger',
    });
    const addCharacter = await addCharacterPromise;

    assert.equal(addCharacter.success, true);
    assert.equal(addCharacter.correlationId, characterCorrelationId);
    assert.deepEqual(addCharacter.requestIdentity, characterRequestIdentity);

    const marketListPromise = waitForEvent(client, MARKET_LIST_RESPONSE_EVENT);
    client.emit(MARKET_LIST_REQUEST_EVENT, {
      playerName: 'OpenApiSyncPilot',
      sessionKey: loginResponse.sessionKey,
      correlationId: '85f134ea-cb3d-4470-b811-ee78075ad38b',
      requestIdentity: {
        operation: 'market-list',
        entityType: 'market',
        containerId: 'sol',
      },
      solarSystemId: 'sol',
    });
    const marketList = await marketListPromise;

    assert.equal(marketList.success, true);
    assert.ok(Array.isArray(marketList.markets));
    assert.ok(marketList.markets.length >= 1);

    const marketQuoteCorrelationId = '7471fa72-7fe6-4123-88c5-0450b6690bf8';
    const marketQuoteRequestIdentity = {
      operation: 'market-quote',
      entityType: 'market-quote',
      containerId: marketList.markets[0].marketId,
    };

    const marketQuotePromise = waitForEvent(client, MARKET_QUOTE_RESPONSE_EVENT);
    client.emit(MARKET_QUOTE_REQUEST_EVENT, {
      requestId: 'rq-1',
      playerName: 'OpenApiSyncPilot',
      characterId: addCharacter.characterId,
      sessionKey: loginResponse.sessionKey,
      correlationId: marketQuoteCorrelationId,
      requestIdentity: marketQuoteRequestIdentity,
      marketId: marketList.markets[0].marketId,
      solarSystemId: marketList.markets[0].solarSystemId,
      itemId: 'iron',
      direction: 'buy',
      quantity: 2,
    });
    const marketQuote = await marketQuotePromise;

    assert.equal(marketQuote.success, true);
    assert.equal(marketQuote.requestId, 'rq-1');
    assert.equal(marketQuote.correlationId, marketQuoteCorrelationId);
    assert.deepEqual(marketQuote.requestIdentity, marketQuoteRequestIdentity);
    assert.equal(marketQuote.quote.itemId, 'iron');
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('ship-list-by-owner operation emits only ship-list-by-owner-response', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'OwnerChannelPilot',
      'owner-channel@example.com',
      'owner-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'OwnerChannelPilot',
      sessionKey: login.sessionKey,
      correlationId: '7a6e72a8-42c4-4d3b-9f1a-49e0f71d6e30',
      requestIdentity: {
        operation: 'character-add',
        entityType: 'character',
        containerId: 'player-ownerchannelpilot',
      },
      characterName: 'OwnerChannelCharacter',
    });
    const addedCharacter = await addCharacterPromise;

    const unexpectedMissionResponses = [];
    const onMissionResponse = (payload) => unexpectedMissionResponses.push(payload);
    client.on(MISSION_LIST_RESPONSE_EVENT, onMissionResponse);

    const shipByOwnerPromise = waitForEvent(client, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'OwnerChannelPilot',
      sessionKey: login.sessionKey,
      correlationId: '58f2cc38-68c6-48ba-ba3e-2ca78f65d926',
      requestIdentity: {
        operation: 'ship-list-by-owner',
        entityType: 'ship',
        containerId: `player-character:${addedCharacter.characterId}`,
      },
      owner: {
        ownerType: 'player-character',
        characterId: addedCharacter.characterId,
      },
    });

    const shipByOwnerResponse = await shipByOwnerPromise;
    await delay(80);
    client.off(MISSION_LIST_RESPONSE_EVENT, onMissionResponse);

    assert.equal(shipByOwnerResponse.success, true);
    assert.equal(shipByOwnerResponse.requestIdentity.operation, 'ship-list-by-owner');
    assert.equal(shipByOwnerResponse.correlationId, '58f2cc38-68c6-48ba-ba3e-2ca78f65d926');
    assert.ok(Array.isArray(shipByOwnerResponse.ships));
    assert.ok(shipByOwnerResponse.ships.length >= 1);
    assert.ok(Array.isArray(shipByOwnerResponse.ships[0].inventory));
    assert.ok(shipByOwnerResponse.ships[0].inventory.length >= 1);

    const starterDrone = shipByOwnerResponse.ships[0].inventory.find(
      (item) => item.itemType === 'expendable-dart-drone'
    );
    assert.ok(starterDrone);
    assert.equal(starterDrone.launchable, true);
    assert.deepEqual(unexpectedMissionResponses, []);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('ship-list-by-owner restores starter drone composition for first-target progression when refs are degraded', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'OwnerRecoveryPilot',
      'owner-recovery@example.com',
      'owner-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'OwnerRecoveryPilot',
      sessionKey: login.sessionKey,
      correlationId: '0bfc103f-57e1-4f67-9a2a-16d5f66af6aa',
      requestIdentity: {
        operation: 'character-add',
        entityType: 'character',
        containerId: 'player-ownerrecoverypilot',
      },
      characterName: 'OwnerRecoveryCharacter',
    });
    const addedCharacter = await addCharacterPromise;

    const shipListPromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
    client.emit(SHIP_LIST_REQUEST_EVENT, {
      playerName: 'OwnerRecoveryPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
    });
    const shipList = await shipListPromise;

    assert.equal(shipList.success, true);
    assert.ok(Array.isArray(shipList.ships));
    assert.ok(shipList.ships.length >= 1);
    const ship = shipList.ships[0];
    assert.ok(Array.isArray(ship.inventory));

    const degradedInventoryRefs = ship.inventory
      .filter((item) => item.itemType !== 'expendable-dart-drone')
      .map((item) => ({ itemId: item.id, itemType: item.itemType }));

    const shipUpsertPromise = waitForEvent(client, SHIP_UPSERT_RESPONSE_EVENT);
    client.emit(SHIP_UPSERT_REQUEST_EVENT, {
      playerName: 'OwnerRecoveryPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
      correlationId: '8519a53b-f61a-4c62-b63d-6928f6782e4f',
      requestIdentity: {
        operation: 'ship-upsert',
        entityType: 'ship',
        containerId: ship.id,
      },
      ship: {
        id: ship.id,
        inventory: degradedInventoryRefs,
      },
    });
    const shipUpsert = await shipUpsertPromise;
    assert.equal(shipUpsert.success, true);

    const shipByOwnerPromise = waitForEvent(client, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'OwnerRecoveryPilot',
      sessionKey: login.sessionKey,
      correlationId: '4c1045b1-c494-45bf-b26a-afd54bb84f0e',
      requestIdentity: {
        operation: 'ship-list-by-owner',
        entityType: 'ship',
        containerId: `player-character:${addedCharacter.characterId}`,
      },
      owner: {
        ownerType: 'player-character',
        characterId: addedCharacter.characterId,
      },
    });
    const shipByOwner = await shipByOwnerPromise;

    assert.equal(shipByOwner.success, true);
    assert.ok(Array.isArray(shipByOwner.ships));
    assert.ok(shipByOwner.ships.length >= 1);
    assert.ok(Array.isArray(shipByOwner.ships[0].inventory));

    const drones = shipByOwner.ships[0].inventory.filter(
      (item) => item.itemType === 'expendable-dart-drone'
    );
    assert.ok(drones.length >= 1);
    assert.ok(drones.every((item) => item.launchable === true));
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('cold-boot launch-item succeeds for drone id emitted by ship-list-by-owner canonical inventory', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'LaunchParityPilot',
      'launch-parity@example.com',
      'owner-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      sessionKey: login.sessionKey,
      correlationId: 'f07a1cab-4bf6-4bd2-a12d-6a9712db4f83',
      requestIdentity: {
        operation: 'character-add',
        entityType: 'character',
        containerId: 'player-launchparitypilot',
      },
      characterName: 'LaunchParityCharacter',
    });
    const addedCharacter = await addCharacterPromise;

    const missionStartPromise = waitForEvent(client, MISSION_ADD_RESPONSE_EVENT);
    client.emit(MISSION_ADD_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      characterId: addedCharacter.characterId,
      missionId: 'first-target',
      status: 'active',
      sessionKey: login.sessionKey,
      correlationId: '17ef6779-09cc-496c-bbcf-c705c4cf6626',
      requestIdentity: {
        operation: 'mission-upsert',
        entityType: 'mission',
        containerId: addedCharacter.characterId,
      },
    });
    const missionStart = await missionStartPromise;
    assert.equal(missionStart.success, true);

    const shipListPromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
    client.emit(SHIP_LIST_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
    });
    const shipList = await shipListPromise;
    assert.equal(shipList.success, true);
    assert.ok(Array.isArray(shipList.ships));
    assert.ok(shipList.ships.length >= 1);

    const ship = shipList.ships[0];
    const degradedInventoryRefs = ship.inventory
      .filter((item) => item.itemType !== 'expendable-dart-drone')
      .map((item) => ({ itemId: item.id, itemType: item.itemType }));

    const shipUpsertPromise = waitForEvent(client, SHIP_UPSERT_RESPONSE_EVENT);
    client.emit(SHIP_UPSERT_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
      correlationId: '7e41989e-7f38-4b24-b306-a5de95cbadf5',
      requestIdentity: {
        operation: 'ship-upsert',
        entityType: 'ship',
        containerId: ship.id,
      },
      ship: {
        id: ship.id,
        inventory: degradedInventoryRefs,
      },
    });
    const shipUpsert = await shipUpsertPromise;
    assert.equal(shipUpsert.success, true);

    const shipByOwnerPromise = waitForEvent(client, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      sessionKey: login.sessionKey,
      correlationId: '74d67ec6-78b9-49ec-8f4a-9f2e6c4ce186',
      requestIdentity: {
        operation: 'ship-list-by-owner',
        entityType: 'ship',
        containerId: `player-character:${addedCharacter.characterId}`,
      },
      owner: {
        ownerType: 'player-character',
        characterId: addedCharacter.characterId,
      },
    });
    const shipByOwner = await shipByOwnerPromise;
    assert.equal(shipByOwner.success, true);
    assert.ok(Array.isArray(shipByOwner.ships));
    assert.ok(shipByOwner.ships.length >= 1);

    const launchShip = shipByOwner.ships[0];
    const starterDrone = Array.isArray(launchShip.inventory)
      ? launchShip.inventory.find((item) => item.itemType === 'expendable-dart-drone')
      : null;
    assert.ok(starterDrone);

    const upsertTargetPromise = waitForEvent(client, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
    client.emit(CELESTIAL_BODY_UPSERT_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      sessionKey: login.sessionKey,
      correlationId: '41d7f0a8-a235-4f63-a551-cab5fd332495',
      requestIdentity: {
        operation: 'celestial-body-upsert',
        entityType: 'celestial-body',
        containerId: addedCharacter.characterId,
      },
      celestialBody: createCelestialBody({
        id: 'cb-launch-parity-1',
        catalogId: 'CAT-001',
        sourceScanId: 'scan-launch-parity-1',
        createdByCharacterId: addedCharacter.characterId,
        missionId: 'first-target',
        composition: {
          rarity: 'Rare',
          material: 'Iron',
          textureColor: '#8f99a7',
        },
      }),
    });
    const targetUpsert = await upsertTargetPromise;
    assert.equal(targetUpsert.success, true);

    const launchPromise = waitForEvent(client, LAUNCH_ITEM_RESPONSE_EVENT);
    client.emit(LAUNCH_ITEM_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      characterId: addedCharacter.characterId,
      shipId: launchShip.id,
      sessionKey: login.sessionKey,
      correlationId: '0cd7df76-f6f1-4cd3-a2e1-1529e5f20897',
      requestIdentity: {
        operation: 'launch-item',
        entityType: starterDrone.itemType,
        containerId: launchShip.id,
      },
      targetCelestialBodyId: 'cb-launch-parity-1',
      hotkey: 1,
      itemId: starterDrone.id,
      itemType: starterDrone.itemType,
    });
    const launch = await launchPromise;

    assert.equal(launch.success, true);
    assert.notEqual(launch.message, 'Item is not in ship inventory');
    assert.equal(launch.resolution.outcome, 'target-destroyed');
    assert.equal(launch.resolution.targetDestroyed, true);
    assert.equal(launch.resolution.targetCelestialBody.missionId, 'first-target');
    assert.equal(launch.resolution.yieldedItems[0].itemType, 'iron');

    const postLaunchShipListPromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
    client.emit(SHIP_LIST_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
      correlationId: 'df95b5b8-84f0-4774-b532-00574779d6d8',
      requestIdentity: {
        operation: 'ship-list',
        entityType: 'ship',
        containerId: launchShip.id,
      },
    });
    const postLaunchShipList = await postLaunchShipListPromise;
    assert.equal(postLaunchShipList.success, true);
    const postLaunchShip = Array.isArray(postLaunchShipList.ships)
      ? postLaunchShipList.ships.find((candidate) => candidate.id === launchShip.id)
      : null;
    assert.ok(postLaunchShip);
    assert.equal(
      Array.isArray(postLaunchShip.inventory)
        ? postLaunchShip.inventory.some((item) => item.id === starterDrone.id)
        : false,
      false,
      'ship-list must not reintroduce consumed launched item id'
    );

    const postLaunchByOwnerPromise = waitForEvent(client, SHIP_LIST_BY_OWNER_RESPONSE_EVENT);
    client.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      sessionKey: login.sessionKey,
      correlationId: 'fe747ebb-a565-4e84-a86c-a076d6f03e53',
      requestIdentity: {
        operation: 'ship-list-by-owner',
        entityType: 'ship',
        containerId: `player-character:${addedCharacter.characterId}`,
      },
      owner: {
        ownerType: 'player-character',
        characterId: addedCharacter.characterId,
      },
    });
    const postLaunchByOwner = await postLaunchByOwnerPromise;
    assert.equal(postLaunchByOwner.success, true);
    const postLaunchByOwnerShip = Array.isArray(postLaunchByOwner.ships)
      ? postLaunchByOwner.ships.find((candidate) => candidate.id === launchShip.id)
      : null;
    assert.ok(postLaunchByOwnerShip);
    assert.equal(
      Array.isArray(postLaunchByOwnerShip.inventory)
        ? postLaunchByOwnerShip.inventory.some((item) => item.id === starterDrone.id)
        : false,
      false,
      'ship-list-by-owner must not reintroduce consumed launched item id'
    );

    const postLaunchShipListRepeatPromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
    client.emit(SHIP_LIST_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
      correlationId: '7b1e16b2-0388-4bfd-9522-2bb8cb4f912d',
      requestIdentity: {
        operation: 'ship-list',
        entityType: 'ship',
        containerId: launchShip.id,
      },
    });
    const postLaunchShipListRepeat = await postLaunchShipListRepeatPromise;
    assert.equal(postLaunchShipListRepeat.success, true);
    const postLaunchShipRepeat = Array.isArray(postLaunchShipListRepeat.ships)
      ? postLaunchShipListRepeat.ships.find((candidate) => candidate.id === launchShip.id)
      : null;
    assert.ok(postLaunchShipRepeat);
    assert.equal(
      Array.isArray(postLaunchShipRepeat.inventory)
        ? postLaunchShipRepeat.inventory.some((item) => item.id === starterDrone.id)
        : false,
      false,
      'consumed launch item id must remain absent across subsequent ship-list snapshots'
    );

    const missionListPromise = waitForEvent(client, MISSION_LIST_RESPONSE_EVENT);
    client.emit(MISSION_LIST_REQUEST_EVENT, {
      playerName: 'LaunchParityPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
      correlationId: 'ee1f9515-3515-4d45-a0d0-771df00f8d0d',
      requestIdentity: {
        operation: 'mission-list',
        entityType: 'mission',
        containerId: addedCharacter.characterId,
      },
    });
    const missionList = await missionListPromise;
    const firstTargetMission = missionList.missions.find((mission) => mission.missionId === 'first-target');

    assert.ok(firstTargetMission);
    assert.equal(firstTargetMission.status, 'completed');
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('mission-list operation emits only list-missions-response', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'MissionChannelPilot',
      'mission-channel@example.com',
      'mission-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'MissionChannelPilot',
      sessionKey: login.sessionKey,
      correlationId: 'c83834a0-2c4e-4388-a8c0-58d37a173970',
      requestIdentity: {
        operation: 'character-add',
        entityType: 'character',
        containerId: 'player-missionchannelpilot',
      },
      characterName: 'MissionChannelCharacter',
    });
    const addedCharacter = await addCharacterPromise;

    const unexpectedShipByOwnerResponses = [];
    const onShipByOwnerResponse = (payload) => unexpectedShipByOwnerResponses.push(payload);
    client.on(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, onShipByOwnerResponse);

    const missionListPromise = waitForEvent(client, MISSION_LIST_RESPONSE_EVENT);
    client.emit(MISSION_LIST_REQUEST_EVENT, {
      playerName: 'MissionChannelPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
      correlationId: '7a11cba8-bad6-4143-9424-ea1177cac8a0',
      requestIdentity: {
        operation: 'list-missions',
        entityType: 'mission',
        containerId: addedCharacter.characterId,
      },
    });

    const missionListResponse = await missionListPromise;
    await delay(80);
    client.off(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, onShipByOwnerResponse);

    assert.equal(missionListResponse.success, true);
    assert.equal(missionListResponse.requestIdentity.operation, 'list-missions');
    assert.equal(missionListResponse.correlationId, '7a11cba8-bad6-4143-9424-ea1177cac8a0');
    assert.deepEqual(unexpectedShipByOwnerResponses, []);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('mission-list responses strictly echo requestIdentity and correlationId', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const login = await registerAndLogin(
      client,
      'MissionLegacyOpPilot',
      'mission-legacy-op@example.com',
      'mission-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'MissionLegacyOpPilot',
      sessionKey: login.sessionKey,
      correlationId: 'dc89c2d5-d8b4-4b67-b34a-afd64a14faf9',
      requestIdentity: {
        operation: 'character-add',
        entityType: 'character',
        containerId: 'player-missionlegacyoppilot',
      },
      characterName: 'MissionLegacyOpCharacter',
    });
    const addedCharacter = await addCharacterPromise;

    const requestIdentity = {
      operation: 'mission-list',
      entityType: 'mission',
      containerId: addedCharacter.characterId,
      source: 'legacy-client',
    };

    const missionListPromise = waitForEvent(client, MISSION_LIST_RESPONSE_EVENT);
    client.emit(MISSION_LIST_REQUEST_EVENT, {
      playerName: 'MissionLegacyOpPilot',
      characterId: addedCharacter.characterId,
      sessionKey: login.sessionKey,
      correlationId: '984dce8e-b248-4d78-ba5f-95224e71d8c5',
      requestIdentity,
    });

    const missionListResponse = await missionListPromise;

    assert.equal(missionListResponse.success, true);
    assert.equal(missionListResponse.correlationId, '984dce8e-b248-4d78-ba5f-95224e71d8c5');
    assert.deepEqual(missionListResponse.requestIdentity, requestIdentity);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('server broadcasts generic message payload to connected clients', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const sender = connectClient(port);
  const receiver = connectClient(port);
  await waitForEvent(sender, 'connect');
  await waitForEvent(receiver, 'connect');

  try {
    const forwardedMessagePromise = waitForEvent(receiver, 'message');
    sender.emit('message', { text: 'hello' });

    const forwarded = await forwardedMessagePromise;
    assert.equal(typeof forwarded.id, 'string');
    assert.deepEqual(forwarded.payload, { text: 'hello' });
  } finally {
    await closeClient(sender);
    await closeClient(receiver);
    io.close();
    server.close();
  }
});

test('mission-upsert canonical request emits mission-upsert-response and never add-mission-response', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const loginResponse = await registerAndLogin(
      client,
      'MissionRoutePilot',
      'mission-route@example.com',
      'mission-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'MissionRoutePilot',
      sessionKey: loginResponse.sessionKey,
      correlationId: 'fedb3b9d-e90c-4c89-86d1-c097f00a0955',
      requestIdentity: {
        operation: 'character-add',
        entityType: 'character',
        containerId: 'player-missionroutepilot',
      },
      characterName: 'RouteCharacter',
    });
    const addCharacter = await addCharacterPromise;

    const unexpectedLegacyResponses = [];
    const onLegacyMissionResponse = (payload) => unexpectedLegacyResponses.push(payload);
    client.on('add-mission-response', onLegacyMissionResponse);

    const missionResponsePromise = waitForEvent(client, MISSION_ADD_RESPONSE_EVENT);
    client.emit(MISSION_ADD_REQUEST_EVENT, {
      playerName: 'MissionRoutePilot',
      characterId: addCharacter.characterId,
      missionId: 'first-target',
      status: 'active',
      sessionKey: loginResponse.sessionKey,
      correlationId: '47e2cd79-3867-46fb-b7be-7c467b3c4656',
      requestIdentity: {
        operation: 'mission-upsert',
        entityType: 'mission',
        containerId: addCharacter.characterId,
      },
    });

    const missionResponse = await missionResponsePromise;
    await delay(80);
    client.off('add-mission-response', onLegacyMissionResponse);

    assert.equal(missionResponse.success, true);
    assert.equal(missionResponse.correlationId, '47e2cd79-3867-46fb-b7be-7c467b3c4656');
    assert.equal(missionResponse.requestIdentity.operation, 'mission-upsert');
    assert.deepEqual(unexpectedLegacyResponses, []);
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});
test('register returns success and playerId for a unique playerName', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const responsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'CaptainPixel',
    email: 'captain@example.com',
    password: 'super-secret',
  });

  const response = await responsePromise;
  assert.equal(response.success, true);
  assert.equal(response.message, 'Registration successful');
  assert.equal(typeof response.playerId, 'string');
  assert.ok(response.playerId.length > 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('market list and market quote return responses for a valid session', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'MarketSocketPilot',
    'market-socket@example.com',
    'market-pass'
  );

  const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'MarketSocketPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'TraderOne',
  });
  const addCharacter = await addCharacterPromise;
  assert.equal(addCharacter.success, true);

  const marketListPromise = waitForEvent(client, MARKET_LIST_RESPONSE_EVENT);
  client.emit(MARKET_LIST_REQUEST_EVENT, {
    playerName: 'MarketSocketPilot',
    sessionKey: loginResponse.sessionKey,
    solarSystemId: 'sol',
  });
  const marketList = await marketListPromise;

  assert.equal(marketList.success, true);
  assert.ok(Array.isArray(marketList.markets));
  assert.ok(marketList.markets.length >= 1);

  const marketQuotePromise = waitForEvent(client, MARKET_QUOTE_RESPONSE_EVENT);
  client.emit(MARKET_QUOTE_REQUEST_EVENT, {
    requestId: 'quote-1',
    playerName: 'MarketSocketPilot',
    characterId: addCharacter.characterId,
    sessionKey: loginResponse.sessionKey,
    marketId: marketList.markets[0].marketId,
    solarSystemId: marketList.markets[0].solarSystemId,
    itemId: 'iron',
    direction: 'buy',
    quantity: 3,
  });
  const marketQuote = await marketQuotePromise;

  assert.equal(marketQuote.success, true);
  assert.equal(marketQuote.requestId, 'quote-1');
  assert.equal(marketQuote.quote.itemId, 'iron');
  assert.equal(marketQuote.quote.quantity, 3);
  assert.equal(
    marketQuote.quote.totalPrice,
    marketQuote.quote.unitPrice * marketQuote.quote.quantity
  );

  await closeClient(client);
  io.close();
  server.close();
});

test('market list by location returns response for valid session', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'MarketRangePilot',
    'market-range@example.com',
    'market-range-pass'
  );

  const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'MarketRangePilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangeTrader',
  });
  const addCharacter = await addCharacterPromise;
  assert.equal(addCharacter.success, true);

  const responsePromise = waitForEvent(client, MARKET_LIST_BY_LOCATION_RESPONSE_EVENT);
  client.emit(MARKET_LIST_BY_LOCATION_REQUEST_EVENT, {
    playerName: 'MarketRangePilot',
    sessionKey: loginResponse.sessionKey,
    characterId: addCharacter.characterId,
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceAu: 10,
    limit: 3,
  });
  const response = await responsePromise;

  assert.equal(response.success, true);
  assert.ok(Array.isArray(response.markets));
  assert.ok(response.markets.length >= 1);
  assert.equal(typeof response.markets[0].distanceAu, 'number');
  assert.equal(typeof response.isDocked, 'boolean');

  await closeClient(client);
  io.close();
  server.close();
});

test('register rejects duplicate playerName', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const firstClient = connectClient(port);
  await waitForEvent(firstClient, 'connect');

  const firstResponsePromise = waitForEvent(firstClient, REGISTER_RESPONSE_EVENT);
  firstClient.emit(REGISTER_EVENT, {
    playerName: 'ShadowRider',
    email: 'first@example.com',
    password: 'secret-1',
  });

  const firstResponse = await firstResponsePromise;
  assert.equal(firstResponse.success, true);

  const secondClient = connectClient(port);
  await waitForEvent(secondClient, 'connect');

  const secondResponsePromise = waitForEvent(secondClient, REGISTER_RESPONSE_EVENT);
  secondClient.emit(REGISTER_EVENT, {
    playerName: 'shadowrider',
    email: 'second@example.com',
    password: 'secret-2',
  });

  const secondResponse = await secondResponsePromise;
  assert.equal(secondResponse.success, false);
  assert.equal(secondResponse.message, 'playerName already exists');
  assert.equal(secondResponse.playerId, undefined);

  await closeClient(firstClient);
  await closeClient(secondClient);
  io.close();
  server.close();
});

test('register rejects payload missing required fields', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const responsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: '   ',
    email: 'mail@example.com',
    password: 'x',
  });

  const response = await responsePromise;
  assert.equal(response.success, false);
  assert.equal(response.message, 'playerName, email, and password are required');
  assert.equal(response.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});

test('login returns success for registered player with matching password', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'OrbitFox',
    email: 'orbit@example.com',
    password: 'safe-pass',
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'orbitfox',
    password: 'safe-pass',
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, true);
  assert.equal(loginResponse.message, 'Login successful');
  assert.equal(typeof loginResponse.playerId, 'string');
  assert.ok(loginResponse.playerId.length > 0);
  assert.equal(typeof loginResponse.sessionKey, 'string');
  assert.ok(loginResponse.sessionKey.length > 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('login generates a new session key on each successful login', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'SessionPilot',
    email: 'session@example.com',
    password: 'session-pass',
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const firstLoginPromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'SessionPilot',
    password: 'session-pass',
  });
  const firstLogin = await firstLoginPromise;
  assert.equal(firstLogin.success, true);

  const secondLoginPromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'SessionPilot',
    password: 'session-pass',
  });
  const secondLogin = await secondLoginPromise;
  assert.equal(secondLogin.success, true);
  assert.notEqual(firstLogin.sessionKey, secondLogin.sessionKey);

  await closeClient(client);
  io.close();
  server.close();
});

test('login rejects playerName that is not registered', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'NoSuchPilot',
    password: 'whatever',
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, false);
  assert.equal(loginResponse.message, 'Player is not registered');
  assert.equal(loginResponse.reason, LOGIN_FAILURE_REASONS.PLAYER_NOT_REGISTERED);
  assert.equal(loginResponse.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});

test('login rejects password mismatch for registered player', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'NovaWing',
    email: 'nova@example.com',
    password: 'correct-password',
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'novawing',
    password: 'wrong-password',
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, false);
  assert.equal(loginResponse.message, 'Password does not match');
  assert.equal(loginResponse.reason, LOGIN_FAILURE_REASONS.PASSWORD_MISMATCH);
  assert.equal(loginResponse.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});

test('login rejects payload missing required fields with UNKNOWN reason', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: '   ',
    password: '',
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, false);
  assert.equal(loginResponse.message, 'playerName and password are required');
  assert.equal(loginResponse.reason, LOGIN_FAILURE_REASONS.UNKNOWN);
  assert.equal(loginResponse.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});

test('character list returns per-player list for registered player', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'CharacterPilot',
    'pilot@example.com',
    'pilot-pass'
  );

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'characterpilot',
    sessionKey: loginResponse.sessionKey,
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.message, 'Character list retrieved successfully');
  assert.equal(listResponse.playerName, 'CharacterPilot');
  assert.deepEqual(listResponse.characters, []);

  await closeClient(client);
  io.close();
  server.close();
});

test('character list rejects playerName that is not registered', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'UnknownPilot',
    sessionKey: 'invalid-session-key',
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character add adds character and is returned by character list', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'BuilderPilot',
    'builder@example.com',
    'builder-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'builderpilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });

  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);
  assert.equal(addResponse.message, 'Character added successfully');
  assert.equal(addResponse.playerName, 'BuilderPilot');
  assert.equal(addResponse.characterName, 'RangerOne');
  assert.equal(typeof addResponse.characterId, 'string');
  assert.ok(addResponse.characterId.length > 0);

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'BuilderPilot',
    sessionKey: loginResponse.sessionKey,
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.playerName, 'BuilderPilot');
  assert.equal(listResponse.characters.length, 1);
  assert.equal(listResponse.characters[0].characterName, 'RangerOne');
  assert.equal(listResponse.characters[0].id, addResponse.characterId);
  assert.equal(typeof listResponse.characters[0].createdAt, 'string');
  assert.equal(Array.isArray(listResponse.characters[0].ships), true);
  assert.equal(listResponse.characters[0].ships.length >= 1, true);
  assert.equal(typeof listResponse.characters[0].ships[0].id, 'string');
  assert.equal(typeof listResponse.characters[0].ships[0].name, 'string');

  await closeClient(client);
  io.close();
  server.close();
});

test('ship list returns ships for a character', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'ShipPilot',
    'ship@example.com',
    'ship-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'ShipPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const shipListResponsePromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'shippilot',
    characterId: addResponse.characterId,
    sessionKey: loginResponse.sessionKey,
  });
  const shipListResponse = await shipListResponsePromise;

  assert.equal(shipListResponse.success, true);
  assert.equal(shipListResponse.message, 'Ship list retrieved successfully');
  assert.equal(shipListResponse.playerName, 'ShipPilot');
  assert.equal(shipListResponse.characterId, addResponse.characterId);
  assert.equal(Array.isArray(shipListResponse.ships), true);
  assert.equal(shipListResponse.ships.length >= 1, true);
  assert.equal(typeof shipListResponse.ships[0].id, 'string');
  assert.equal(typeof shipListResponse.ships[0].name, 'string');
  assert.ok(
    shipListResponse.ships[0].inventory.some(
      (item) => item.id === `${addResponse.characterId}-ship-1-item-1`
    )
  );
  const starterSubsystemTypes = [
    'propulsion-manifold',
    'sensor-array',
    'power-distribution-bus',
    'ship-tractor-beam',
  ];
  const subsystemRows = shipListResponse.ships[0].inventory.filter((item) =>
    starterSubsystemTypes.includes(item.itemType)
  );
  assert.equal(subsystemRows.length, 4);

  await closeClient(client);
  io.close();
  server.close();
});

test('item tier persists through upsert, relog, ship list, and container list', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const firstClient = connectClient(port);
  await waitForEvent(firstClient, 'connect');

  const loginResponse = await registerAndLogin(
    firstClient,
    'TierPilot',
    'tier@example.com',
    'tier-pass'
  );

  const addCharacterPromise = waitForEvent(firstClient, CHARACTER_ADD_RESPONSE_EVENT);
  firstClient.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'TierPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });
  const addCharacterResponse = await addCharacterPromise;
  assert.equal(addCharacterResponse.success, true);

  const shipListBeforeUpsertPromise = waitForEvent(firstClient, SHIP_LIST_RESPONSE_EVENT);
  firstClient.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'TierPilot',
    characterId: addCharacterResponse.characterId,
    sessionKey: loginResponse.sessionKey,
  });
  const shipListBeforeUpsert = await shipListBeforeUpsertPromise;
  assert.equal(shipListBeforeUpsert.success, true);

  const targetShipId = shipListBeforeUpsert.ships[0].id;

  const itemUpsertResponsePromise = waitForEvent(firstClient, ITEM_UPSERT_RESPONSE_EVENT);
  firstClient.emit(ITEM_UPSERT_REQUEST_EVENT, {
    playerName: 'TierPilot',
    sessionKey: loginResponse.sessionKey,
    item: {
      id: '',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      tier: 10,
      container: {
        containerType: 'ship',
        containerId: targetShipId,
      },
      owningCharacterId: addCharacterResponse.characterId,
    },
  });
  const itemUpsertResponse = await itemUpsertResponsePromise;

  assert.equal(itemUpsertResponse.success, true);
  assert.equal(itemUpsertResponse.item.tier, 10);

  await closeClient(firstClient);

  const secondClient = connectClient(port);
  await waitForEvent(secondClient, 'connect');

  const relogResponsePromise = waitForEvent(secondClient, LOGIN_RESPONSE_EVENT);
  secondClient.emit(LOGIN_EVENT, {
    playerName: 'TierPilot',
    password: 'tier-pass',
  });
  const relogResponse = await relogResponsePromise;
  assert.equal(relogResponse.success, true);

  const shipListAfterRelogPromise = waitForEvent(secondClient, SHIP_LIST_RESPONSE_EVENT);
  secondClient.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'TierPilot',
    characterId: addCharacterResponse.characterId,
    sessionKey: relogResponse.sessionKey,
  });
  const shipListAfterRelog = await shipListAfterRelogPromise;

  const hydratedItem = shipListAfterRelog.ships[0].inventory.find(
    (item) => item.id === itemUpsertResponse.item.id
  );
  assert.ok(hydratedItem);
  assert.equal(hydratedItem.tier, 10);

  const containerListPromise = waitForEvent(secondClient, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
  secondClient.emit(ITEM_LIST_BY_CONTAINER_REQUEST_EVENT, {
    playerName: 'TierPilot',
    sessionKey: relogResponse.sessionKey,
    containerType: 'ship',
    containerId: targetShipId,
  });
  const containerList = await containerListPromise;

  const containerItem = containerList.items.find((item) => item.id === itemUpsertResponse.item.id);
  assert.ok(containerItem);
  assert.equal(containerItem.tier, 10);

  await closeClient(secondClient);
  io.close();
  server.close();
});

test('ship upsert updates ship location and kinematics', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'ShipUpsertPilot',
    'ship-upsert@example.com',
    'ship-upsert-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'ShipUpsertPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const listResponsePromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'ShipUpsertPilot',
    characterId: addResponse.characterId,
    sessionKey: loginResponse.sessionKey,
  });
  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.ships.length >= 1, true);

  const upsertResponsePromise = waitForEvent(client, SHIP_UPSERT_RESPONSE_EVENT);
  client.emit(SHIP_UPSERT_REQUEST_EVENT, {
    playerName: 'ShipUpsertPilot',
    characterId: addResponse.characterId,
    sessionKey: loginResponse.sessionKey,
    ship: {
      id: listResponse.ships[0].id,
      spatial: {
        solarSystemId: 'system-sol',
        frame: 'barycentric',
        positionKm: { x: 100.5, y: 200.3, z: 50.1 },
        epochMs: 1713607200000,
      },
      motion: {
        velocityKmPerSec: { x: 0.5, y: -0.2, z: 0.1 },
      },
    },
  });

  const upsertResponse = await upsertResponsePromise;
  assert.equal(upsertResponse.success, true);
  assert.equal(upsertResponse.message, 'Ship updated successfully');
  assert.equal(upsertResponse.playerName, 'ShipUpsertPilot');
  assert.equal(upsertResponse.characterId, addResponse.characterId);
  assert.equal(upsertResponse.ship.id, listResponse.ships[0].id);
  assert.equal(upsertResponse.ship.inventory[0].id, `${addResponse.characterId}-ship-1-item-1`);
  assert.deepEqual(upsertResponse.ship.spatial, {
    solarSystemId: 'system-sol',
    frame: 'barycentric',
    positionKm: { x: 100.5, y: 200.3, z: 50.1 },
    epochMs: 1713607200000,
  });

  const shipListAfterUpsertPromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'ShipUpsertPilot',
    characterId: addResponse.characterId,
    sessionKey: loginResponse.sessionKey,
  });
  const shipListAfterUpsert = await shipListAfterUpsertPromise;

  assert.equal(shipListAfterUpsert.success, true);
  assert.equal(
    shipListAfterUpsert.ships[0].inventory[0].id,
    `${addResponse.characterId}-ship-1-item-1`
  );
  assert.deepEqual(shipListAfterUpsert.ships[0].spatial, {
    solarSystemId: 'system-sol',
    frame: 'barycentric',
    positionKm: { x: 100.5, y: 200.3, z: 50.1 },
    epochMs: 1713607200000,
  });
  assert.deepEqual(shipListAfterUpsert.ships[0].motion, {
    velocityKmPerSec: { x: 0.5, y: -0.2, z: 0.1 },
  });

  await closeClient(client);
  io.close();
  server.close();
});

test('ship upsert emits invalid session for wrong session key', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'ShipUpsertSessionPilot',
    'ship-upsert-session@example.com',
    'ship-upsert-session-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'ShipUpsertSessionPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const listResponsePromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'ShipUpsertSessionPilot',
    characterId: addResponse.characterId,
    sessionKey: loginResponse.sessionKey,
  });
  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(SHIP_UPSERT_REQUEST_EVENT, {
    playerName: 'ShipUpsertSessionPilot',
    characterId: addResponse.characterId,
    sessionKey: 'wrong-session-key',
    ship: {
      id: listResponse.ships[0].id,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 10, y: 20, z: 30 },
        epochMs: 0,
      },
    },
  });
  const invalidSession = await invalidSessionPromise;

  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('mission add stores mission progress and mission list returns it', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'MissionSocketPilot',
    'mission-socket@example.com',
    'mission-pass'
  );

  const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'MissionSocketPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });
  const addCharacter = await addCharacterPromise;
  assert.equal(addCharacter.success, true);

  const addMissionPromise = waitForEvent(client, MISSION_ADD_RESPONSE_EVENT);
  client.emit(MISSION_ADD_REQUEST_EVENT, {
    playerName: 'MissionSocketPilot',
    characterId: addCharacter.characterId,
    missionId: 'first-target',
    status: 'active',
    sessionKey: loginResponse.sessionKey,
  });
  const addMission = await addMissionPromise;

  assert.equal(addMission.success, true);
  assert.equal(addMission.message, 'Mission recorded successfully');
  assert.equal(addMission.playerName, 'MissionSocketPilot');
  assert.equal(addMission.characterId, addCharacter.characterId);
  assert.equal(addMission.mission.missionId, 'first-target');
  assert.equal(addMission.mission.status, 'active');

  const listMissionsPromise = waitForEvent(client, MISSION_LIST_RESPONSE_EVENT);
  client.emit(MISSION_LIST_REQUEST_EVENT, {
    playerName: 'MissionSocketPilot',
    characterId: addCharacter.characterId,
    statuses: ['active'],
    sessionKey: loginResponse.sessionKey,
  });
  const listMissions = await listMissionsPromise;

  assert.equal(listMissions.success, true);
  assert.equal(listMissions.message, 'Mission list retrieved successfully');
  assert.equal(listMissions.playerName, 'MissionSocketPilot');
  assert.equal(listMissions.characterId, addCharacter.characterId);
  assert.equal(listMissions.missions.length, 1);
  assert.equal(listMissions.missions[0].missionId, 'first-target');
  assert.equal(listMissions.missions[0].status, 'active');

  await closeClient(client);
  io.close();
  server.close();
});

test('mission-list integration emits only canonical statuses across completed/active/available paths', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const loginResponse = await registerAndLogin(
      client,
      'MissionIntegrationPilot',
      'mission-integration@example.com',
      'mission-integration-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'MissionIntegrationPilot',
      sessionKey: loginResponse.sessionKey,
      characterName: 'LaneVerifier',
    });
    const addCharacter = await addCharacterPromise;
    assert.equal(addCharacter.success, true);

    const activateFirstTargetPromise = waitForEvent(client, MISSION_ADD_RESPONSE_EVENT);
    client.emit(MISSION_ADD_REQUEST_EVENT, {
      playerName: 'MissionIntegrationPilot',
      characterId: addCharacter.characterId,
      missionId: 'first-target',
      status: 'active',
      sessionKey: loginResponse.sessionKey,
    });
    const activateFirstTarget = await activateFirstTargetPromise;
    assert.equal(activateFirstTarget.success, true);

    const completeFirstTargetPromise = waitForEvent(client, MISSION_ADD_RESPONSE_EVENT);
    client.emit(MISSION_ADD_REQUEST_EVENT, {
      playerName: 'MissionIntegrationPilot',
      characterId: addCharacter.characterId,
      missionId: 'first-target',
      status: 'completed',
      sessionKey: loginResponse.sessionKey,
    });
    const completeFirstTarget = await completeFirstTargetPromise;
    assert.equal(completeFirstTarget.success, true);

    const activateM01Promise = waitForEvent(client, MISSION_ADD_RESPONSE_EVENT);
    client.emit(MISSION_ADD_REQUEST_EVENT, {
      playerName: 'MissionIntegrationPilot',
      characterId: addCharacter.characterId,
      missionId: 'm-01',
      status: 'active',
      sessionKey: loginResponse.sessionKey,
    });
    const activateM01 = await activateM01Promise;
    assert.equal(activateM01.success, true);

    const missionListPromise = waitForEvent(client, MISSION_LIST_RESPONSE_EVENT);
    client.emit(MISSION_LIST_REQUEST_EVENT, {
      playerName: 'MissionIntegrationPilot',
      characterId: addCharacter.characterId,
      sessionKey: loginResponse.sessionKey,
      correlationId: 'ab5d2e36-a7de-4f95-ab70-26743231a652',
      requestIdentity: {
        operation: 'mission-list',
        entityType: 'mission',
        containerId: addCharacter.characterId,
      },
    });
    const missionList = await missionListPromise;

    assert.equal(missionList.success, true);
    assert.equal(missionList.correlationId, 'ab5d2e36-a7de-4f95-ab70-26743231a652');
    assert.equal(Array.isArray(missionList.missions), true);
    assert.ok(missionList.missions.length >= 3);

    const emittedStatuses = missionList.missions.map((mission) => mission.status);
    const canonicalStatuses = new Set(['available', 'active', 'completed']);
    for (const status of emittedStatuses) {
      assert.ok(canonicalStatuses.has(status), `Non-canonical status emitted: ${status}`);
    }

    assert.ok(emittedStatuses.includes('completed'));
    assert.ok(emittedStatuses.includes('active'));
    assert.ok(emittedStatuses.includes('available'));
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('mission-list integration rejects mixed canonical and non-canonical status filters with strict failure', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const loginResponse = await registerAndLogin(
      client,
      'MissionFilterPilot',
      'mission-filter@example.com',
      'mission-filter-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'MissionFilterPilot',
      sessionKey: loginResponse.sessionKey,
      characterName: 'FilterVerifier',
    });
    const addCharacter = await addCharacterPromise;
    assert.equal(addCharacter.success, true);

    const missionListPromise = waitForEvent(client, MISSION_LIST_RESPONSE_EVENT);
    client.emit(MISSION_LIST_REQUEST_EVENT, {
      playerName: 'MissionFilterPilot',
      characterId: addCharacter.characterId,
      statuses: ['active', 'paused'],
      sessionKey: loginResponse.sessionKey,
      correlationId: '7a11cba8-bad6-4143-9424-ea1177cac8a0',
      requestIdentity: {
        operation: 'mission-list',
        entityType: 'mission',
        containerId: addCharacter.characterId,
      },
    });
    const missionList = await missionListPromise;

    assert.equal(missionList.success, false);
    assert.match(missionList.message, /unsupported values: paused/);
    assert.deepEqual(missionList.missions, []);
    assert.equal(missionList.correlationId, '7a11cba8-bad6-4143-9424-ea1177cac8a0');
    assert.deepEqual(missionList.requestIdentity, {
      operation: 'mission-list',
      entityType: 'mission',
      containerId: addCharacter.characterId,
    });
  } finally {
    await closeClient(client);
    io.close();
    server.close();
  }
});

test('mission list emits invalid session for wrong session key', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'MissionSessionPilot',
    'mission-session@example.com',
    'mission-session-pass'
  );

  const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'MissionSessionPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });
  const addCharacter = await addCharacterPromise;
  assert.equal(addCharacter.success, true);

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(MISSION_LIST_REQUEST_EVENT, {
    playerName: 'MissionSessionPilot',
    characterId: addCharacter.characterId,
    sessionKey: 'wrong-session-key',
  });
  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('ship list handles character missing from player list', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgeShipPilot',
    'edge-ship@example.com',
    'edge-ship-pass'
  );

  const shipListResponsePromise = waitForEvent(client, SHIP_LIST_RESPONSE_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'EdgeShipPilot',
    characterId: 'missing-character-id',
    sessionKey: loginResponse.sessionKey,
  });
  const shipListResponse = await shipListResponsePromise;

  assert.equal(shipListResponse.success, false);
  assert.equal(shipListResponse.message, 'Character is not in player list');
  assert.equal(shipListResponse.playerName, 'EdgeShipPilot');
  assert.equal(shipListResponse.characterId, 'missing-character-id');
  assert.deepEqual(shipListResponse.ships, []);

  await closeClient(client);
  io.close();
  server.close();
});

test('ship list emits invalid session for wrong session key', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(
    client,
    'SessionShipPilot',
    'session-ship@example.com',
    'session-ship-pass'
  );

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(SHIP_LIST_REQUEST_EVENT, {
    playerName: 'SessionShipPilot',
    characterId: 'any-id',
    sessionKey: 'wrong-session-key',
  });
  const invalidSession = await invalidSessionPromise;

  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character add rejects request for unregistered player', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'MissingPilot',
    sessionKey: 'invalid-session-key',
    characterName: 'GhostUnit',
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character delete removes character from player list', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'DeletePilot',
    'delete@example.com',
    'delete-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'DeletePilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'TempCharacter',
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const deleteResponsePromise = waitForEvent(client, CHARACTER_DELETE_RESPONSE_EVENT);
  client.emit(CHARACTER_DELETE_REQUEST_EVENT, {
    playerName: 'deletepilot',
    sessionKey: loginResponse.sessionKey,
    characterId: addResponse.characterId,
  });

  const deleteResponse = await deleteResponsePromise;
  assert.equal(deleteResponse.success, true);
  assert.equal(deleteResponse.message, 'Character deleted successfully');
  assert.equal(deleteResponse.playerName, 'DeletePilot');
  assert.equal(deleteResponse.characterId, addResponse.characterId);

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'DeletePilot',
    sessionKey: loginResponse.sessionKey,
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('character delete handles character not found for player', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgePilot',
    'edge@example.com',
    'edge-pass'
  );

  const deleteResponsePromise = waitForEvent(client, CHARACTER_DELETE_RESPONSE_EVENT);
  client.emit(CHARACTER_DELETE_REQUEST_EVENT, {
    playerName: 'EdgePilot',
    sessionKey: loginResponse.sessionKey,
    characterId: 'missing-character-id',
  });

  const deleteResponse = await deleteResponsePromise;
  assert.equal(deleteResponse.success, false);
  assert.equal(deleteResponse.message, 'Character is not in player list');
  assert.equal(deleteResponse.playerName, 'EdgePilot');
  assert.equal(deleteResponse.characterId, 'missing-character-id');

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'EdgePilot',
    sessionKey: loginResponse.sessionKey,
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('character delete rejects request for unregistered player', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_DELETE_REQUEST_EVENT, {
    playerName: 'UnknownDeletePilot',
    sessionKey: 'invalid-session-key',
    characterId: 'any-id',
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character list emits invalid session event when session key does not match', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(client, 'SessionMismatchPilot', 'mismatch@example.com', 'mismatch-pass');

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'SessionMismatchPilot',
    sessionKey: 'wrong-session-key',
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character edit updates character name in player list', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EditPilot',
    'edit@example.com',
    'edit-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'EditPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'OldName',
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const editResponsePromise = waitForEvent(client, CHARACTER_EDIT_RESPONSE_EVENT);
  client.emit(CHARACTER_EDIT_REQUEST_EVENT, {
    playerName: 'editpilot',
    sessionKey: loginResponse.sessionKey,
    characterId: addResponse.characterId,
    characterName: 'NewName',
  });

  const editResponse = await editResponsePromise;
  assert.equal(editResponse.success, true);
  assert.equal(editResponse.message, 'Character edited successfully');
  assert.equal(editResponse.playerName, 'EditPilot');
  assert.equal(editResponse.characterId, addResponse.characterId);
  assert.equal(editResponse.characterName, 'NewName');

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'EditPilot',
    sessionKey: loginResponse.sessionKey,
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 1);
  assert.equal(listResponse.characters[0].id, addResponse.characterId);
  assert.equal(listResponse.characters[0].characterName, 'NewName');

  await closeClient(client);
  io.close();
  server.close();
});

test('character edit handles character not found for player', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgeEditPilot',
    'edge-edit@example.com',
    'edge-edit-pass'
  );

  const editResponsePromise = waitForEvent(client, CHARACTER_EDIT_RESPONSE_EVENT);
  client.emit(CHARACTER_EDIT_REQUEST_EVENT, {
    playerName: 'EdgeEditPilot',
    sessionKey: loginResponse.sessionKey,
    characterId: 'missing-character-id',
    characterName: 'GhostName',
  });

  const editResponse = await editResponsePromise;
  assert.equal(editResponse.success, false);
  assert.equal(editResponse.message, 'Character is not in player list');
  assert.equal(editResponse.playerName, 'EdgeEditPilot');
  assert.equal(editResponse.characterId, 'missing-character-id');

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'EdgeEditPilot',
    sessionKey: loginResponse.sessionKey,
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('character edit emits invalid session for wrong session key', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(
    client,
    'SessionEditPilot',
    'session-edit@example.com',
    'session-edit-pass'
  );

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_EDIT_REQUEST_EVENT, {
    playerName: 'SessionEditPilot',
    sessionKey: 'wrong-session-key',
    characterId: 'any-id',
    characterName: 'NewName',
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('game join marks a character as joined in the player character list', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'JoinPilot',
    'join@example.com',
    'join-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'JoinPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne',
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const gameJoinResponsePromise = waitForEvent(client, GAME_JOIN_RESPONSE_EVENT);
  client.emit(GAME_JOIN_REQUEST_EVENT, {
    playerName: 'joinpilot',
    sessionKey: loginResponse.sessionKey,
    characterId: addResponse.characterId,
  });
  const gameJoinResponse = await gameJoinResponsePromise;
  assert.equal(gameJoinResponse.success, true);
  assert.equal(gameJoinResponse.message, 'Character joined game successfully');
  assert.equal(gameJoinResponse.playerName, 'JoinPilot');
  assert.equal(gameJoinResponse.characterId, addResponse.characterId);

  const firstListPromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'JoinPilot',
    sessionKey: loginResponse.sessionKey,
  });
  const firstList = await firstListPromise;
  assert.equal(firstList.success, true);
  assert.equal(firstList.characters.length, 1);
  assert.equal(firstList.characters[0].inGame, true);
  assert.equal(typeof firstList.characters[0].gameJoinedAt, 'string');
  assert.equal(typeof firstList.characters[0].gameLastMessageReceivedAt, 'string');

  const secondListPromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'JoinPilot',
    sessionKey: loginResponse.sessionKey,
  });
  const secondList = await secondListPromise;
  assert.equal(secondList.success, true);
  assert.equal(secondList.characters.length, 1);
  assert.ok(
    Date.parse(secondList.characters[0].gameLastMessageReceivedAt) >=
      Date.parse(firstList.characters[0].gameLastMessageReceivedAt)
  );

  await closeClient(client);
  io.close();
  server.close();
});

test('game join handles character missing from player list', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgeJoinPilot',
    'edge-join@example.com',
    'edge-join-pass'
  );

  const gameJoinResponsePromise = waitForEvent(client, GAME_JOIN_RESPONSE_EVENT);
  client.emit(GAME_JOIN_REQUEST_EVENT, {
    playerName: 'EdgeJoinPilot',
    sessionKey: loginResponse.sessionKey,
    characterId: 'missing-character-id',
  });

  const gameJoinResponse = await gameJoinResponsePromise;
  assert.equal(gameJoinResponse.success, false);
  assert.equal(gameJoinResponse.message, 'Character is not in player list');
  assert.equal(gameJoinResponse.playerName, 'EdgeJoinPilot');
  assert.equal(gameJoinResponse.characterId, 'missing-character-id');

  await closeClient(client);
  io.close();
  server.close();
});

test('game join emits invalid session for wrong session key', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(
    client,
    'SessionJoinPilot',
    'session-join@example.com',
    'session-join-pass'
  );

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(GAME_JOIN_REQUEST_EVENT, {
    playerName: 'SessionJoinPilot',
    sessionKey: 'wrong-session-key',
    characterId: 'any-id',
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('celestial body upsert stores a scanned celestial body and returns the wrapped response', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'ScannerPilot',
    'scanner@example.com',
    'scanner-pass'
  );

  const characterAddPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'ScannerPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'ProbeOne',
  });
  const characterAddResponse = await characterAddPromise;
  assert.equal(characterAddResponse.success, true);

  const celestialBodyUpsertPromise = waitForEvent(client, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
  client.emit(CELESTIAL_BODY_UPSERT_REQUEST_EVENT, {
    playerName: 'ScannerPilot',
    sessionKey: loginResponse.sessionKey,
    celestialBody: createCelestialBody({
      id: 'cb-1',
      createdByCharacterId: characterAddResponse.characterId,
    }),
  });

  const celestialBodyResponse = await celestialBodyUpsertPromise;
  assert.equal(celestialBodyResponse.success, true);
  assert.equal(celestialBodyResponse.message, 'Celestial body recorded successfully');
  assert.equal(celestialBodyResponse.playerName, 'ScannerPilot');
  assert.equal(celestialBodyResponse.celestialBody.id, 'cb-1');
  assert.equal(celestialBodyResponse.celestialBody.spatial.solarSystemId, 'sol');
  assert.equal(
    celestialBodyResponse.celestialBody.createdByCharacterId,
    characterAddResponse.characterId
  );

  await closeClient(client);
  io.close();
  server.close();
});

test('celestial body upsert emits invalid session for wrong session key', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'ScannerSessionPilot',
    'scanner-session@example.com',
    'scanner-session-pass'
  );

  const characterAddPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'ScannerSessionPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'ProbeTwo',
  });
  const characterAddResponse = await characterAddPromise;
  assert.equal(characterAddResponse.success, true);

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CELESTIAL_BODY_UPSERT_REQUEST_EVENT, {
    playerName: 'ScannerSessionPilot',
    sessionKey: 'wrong-session-key',
    celestialBody: createCelestialBody({
      id: 'cb-2',
      catalogId: 'CAT-002',
      sourceScanId: 'scan-2',
      createdByCharacterId: characterAddResponse.characterId,
    }),
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('celestial body list returns sorted bodies filtered by spherical distance and limit', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'ScannerListPilot',
    'scanner-list@example.com',
    'scanner-list-pass'
  );

  const characterAddPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'ScannerListPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'ProbeThree',
  });
  const characterAddResponse = await characterAddPromise;
  assert.equal(characterAddResponse.success, true);

  const celestialBodiesToCreate = [
    createCelestialBody({
      id: 'cb-list-near',
      sourceScanId: 'scan-near',
      createdByCharacterId: characterAddResponse.characterId,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 3, y: 4, z: 0 },
        epochMs: 1713360000000,
      },
    }),
    createCelestialBody({
      id: 'cb-list-mid',
      sourceScanId: 'scan-mid',
      createdByCharacterId: characterAddResponse.characterId,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 0, y: 6, z: 8 },
        epochMs: 1713360000000,
      },
    }),
    createCelestialBody({
      id: 'cb-list-far',
      sourceScanId: 'scan-far',
      createdByCharacterId: characterAddResponse.characterId,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 100, y: 0, z: 0 },
        epochMs: 1713360000000,
      },
    }),
  ];

  for (const celestialBody of celestialBodiesToCreate) {
    const upsertPromise = waitForEvent(client, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
    client.emit(CELESTIAL_BODY_UPSERT_REQUEST_EVENT, {
      playerName: 'ScannerListPilot',
      sessionKey: loginResponse.sessionKey,
      celestialBody,
    });
    const upsertResponse = await upsertPromise;
    assert.equal(upsertResponse.success, true);
  }

  const listResponsePromise = waitForEvent(client, CELESTIAL_BODY_LIST_RESPONSE_EVENT);
  client.emit(CELESTIAL_BODY_LIST_REQUEST_EVENT, {
    playerName: 'ScannerListPilot',
    sessionKey: loginResponse.sessionKey,
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10,
    limit: 2,
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.message, 'Celestial body list retrieved successfully');
  assert.equal(listResponse.celestialBodies.length, 2);
  assert.equal(listResponse.celestialBodies[0].id, 'cb-list-near');
  assert.equal(listResponse.celestialBodies[0].distanceKm, 5);
  assert.equal(listResponse.celestialBodies[1].id, 'cb-list-mid');
  assert.equal(listResponse.celestialBodies[1].distanceKm, 10);

  await closeClient(client);
  io.close();
  server.close();
});

test('market inventory, buy, sell, and market ledger list flow works end-to-end', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'MarketFlowPilot',
    'market-flow@example.com',
    'market-flow-pass'
  );

  const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'MarketFlowPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'TraderCore',
  });
  const addCharacter = await addCharacterPromise;
  assert.equal(addCharacter.success, true);

  const inventoryPromise = waitForEvent(client, MARKET_INVENTORY_LIST_RESPONSE_EVENT);
  client.emit(MARKET_INVENTORY_LIST_REQUEST_EVENT, {
    playerName: 'MarketFlowPilot',
    sessionKey: loginResponse.sessionKey,
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    offset: 0,
    limit: 10,
  });
  const inventoryResponse = await inventoryPromise;
  assert.equal(inventoryResponse.success, true);
  assert.equal(Array.isArray(inventoryResponse.inventory), true);

  const buyPromise = waitForEvent(client, MARKET_BUY_RESPONSE_EVENT);
  client.emit(MARKET_BUY_REQUEST_EVENT, {
    requestId: 'flow-buy-1',
    playerName: 'MarketFlowPilot',
    characterId: addCharacter.characterId,
    sessionKey: loginResponse.sessionKey,
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 2,
  });
  const buyResponse = await buyPromise;
  assert.equal(buyResponse.success, true);
  assert.equal(buyResponse.transaction.itemId, 'iron');

  const sellPromise = waitForEvent(client, MARKET_SELL_RESPONSE_EVENT);
  client.emit(MARKET_SELL_REQUEST_EVENT, {
    requestId: 'flow-sell-1',
    playerName: 'MarketFlowPilot',
    characterId: addCharacter.characterId,
    sessionKey: loginResponse.sessionKey,
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });
  const sellResponse = await sellPromise;
  assert.equal(sellResponse.success, true);
  assert.equal(sellResponse.transaction.itemId, 'iron');

  const ledgerPromise = waitForEvent(client, MARKET_LEDGER_LIST_RESPONSE_EVENT);
  client.emit(MARKET_LEDGER_LIST_REQUEST_EVENT, {
    playerName: 'MarketFlowPilot',
    sessionKey: loginResponse.sessionKey,
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    characterId: addCharacter.characterId,
    itemId: 'iron',
  });
  const ledgerResponse = await ledgerPromise;

  assert.equal(ledgerResponse.success, true);
  assert.equal(Array.isArray(ledgerResponse.entries), true);
  assert.equal(ledgerResponse.entries.length >= 2, true);

  await closeClient(client);
  io.close();
  server.close();
});
