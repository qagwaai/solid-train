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
  MISSION_UPSERT_ALIAS_REQUEST_EVENT,
  MISSION_UPSERT_ALIAS_RESPONSE_EVENT,
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

test('mission upsert alias request emits alias response event', async () => {
  const { server, io } = createServer();
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const loginResponse = await registerAndLogin(
      client,
      'AliasPilot',
      'alias@example.com',
      'alias-pass'
    );

    const addCharacterPromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'AliasPilot',
      sessionKey: loginResponse.sessionKey,
      characterName: 'AliasCharacter',
    });
    const addCharacter = await addCharacterPromise;
    assert.equal(addCharacter.success, true);

    const aliasResponsePromise = waitForEvent(client, MISSION_UPSERT_ALIAS_RESPONSE_EVENT);
    client.emit(MISSION_UPSERT_ALIAS_REQUEST_EVENT, {
      playerName: 'AliasPilot',
      characterId: addCharacter.characterId,
      missionId: 'first-target',
      status: 'started',
      sessionKey: loginResponse.sessionKey,
    });

    const aliasResponse = await aliasResponsePromise;
    assert.equal(aliasResponse.success, true);
    assert.equal(aliasResponse.characterId, addCharacter.characterId);
    assert.equal(aliasResponse.mission.missionId, 'first-target');
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
  const starterSubsystemTypes = ['propulsion-manifold', 'sensor-array', 'power-distribution-bus', 'ship-tractor-beam'];
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
    status: 'started',
    sessionKey: loginResponse.sessionKey,
  });
  const addMission = await addMissionPromise;

  assert.equal(addMission.success, true);
  assert.equal(addMission.message, 'Mission recorded successfully');
  assert.equal(addMission.playerName, 'MissionSocketPilot');
  assert.equal(addMission.characterId, addCharacter.characterId);
  assert.equal(addMission.mission.missionId, 'first-target');
  assert.equal(addMission.mission.status, 'started');

  const listMissionsPromise = waitForEvent(client, MISSION_LIST_RESPONSE_EVENT);
  client.emit(MISSION_LIST_REQUEST_EVENT, {
    playerName: 'MissionSocketPilot',
    characterId: addCharacter.characterId,
    statuses: ['started'],
    sessionKey: loginResponse.sessionKey,
  });
  const listMissions = await listMissionsPromise;

  assert.equal(listMissions.success, true);
  assert.equal(listMissions.message, 'Mission list retrieved successfully');
  assert.equal(listMissions.playerName, 'MissionSocketPilot');
  assert.equal(listMissions.characterId, addCharacter.characterId);
  assert.equal(listMissions.missions.length, 1);
  assert.equal(listMissions.missions[0].missionId, 'first-target');
  assert.equal(listMissions.missions[0].status, 'started');

  await closeClient(client);
  io.close();
  server.close();
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
