'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');
const {
  listen,
  connectClient,
  waitForEvent,
  closeClient,
  registerAndLogin
} = require('../test-support/socket-test-helpers');
const {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT
} = require('../src/model/character-add');
const {
  createMongoTestHarness
} = require('../test-support/mongodb-test-helpers');

let mongoHarness = null;
let server = null;
let io = null;
let port = null;

test.before(async () => {
  mongoHarness = await createMongoTestHarness();

  const created = createServer({
    port: '4600',
    databaseService: mongoHarness.databaseService
  });

  server = created.server;
  io = created.io;
  port = await listen(server);
});

test.after(async () => {
  if (io) {
    io.close();
  }

  if (server) {
    server.close();
  }

  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

test.beforeEach(async () => {
  await mongoHarness.clearDatabase();
});

test('Socket.IO + Mongo smoke: register → login → add character → persisted in Mongo', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    // Register + login
    const loginResponse = await registerAndLogin(
      client,
      'MongoPilot',
      'mongo@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;

    // Add a character
    const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
    client.emit(CHARACTER_ADD_REQUEST_EVENT, {
      playerName: 'MongoPilot',
      sessionKey,
      characterName: 'Cosmonova'
    });
    const addResponse = await addResponsePromise;

    assert.equal(addResponse.success, true);
    assert.equal(addResponse.characterName, 'Cosmonova');
    assert.equal(typeof addResponse.characterId, 'string');
    assert.ok(addResponse.characterId.length > 0);

    const { characterId } = addResponse;

    // Verify the player and character were persisted to Mongo
    const persisted = await mongoHarness.databaseService.getPlayerByName('MongoPilot');
    assert.ok(persisted, 'player should exist in Mongo');
    assert.equal(persisted.playerName, 'MongoPilot');

    const characters = Array.isArray(persisted.characters) ? persisted.characters : [];
    const savedCharacter = characters.find((c) => c.id === characterId);
    assert.ok(savedCharacter, 'character should be persisted in Mongo');
    assert.equal(savedCharacter.characterName, 'Cosmonova');
    assert.ok(Array.isArray(savedCharacter.creditLedger), 'creditLedger should be an array');
    assert.ok(Array.isArray(savedCharacter.ships), 'ships should be an array');
  } finally {
    await closeClient(client);
  }
});
