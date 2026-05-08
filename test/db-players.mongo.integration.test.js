'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');

let mongoHarness = null;

test.before(async () => {
  mongoHarness = await createMongoTestHarness();
});

test.after(async () => {
  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

test.beforeEach(async () => {
  await mongoHarness.clearDatabase();
});

test('Players Mongo round-trip: register, read, update, character CRUD, and clear', async () => {
  const service = mongoHarness.databaseService;

  const created = await service.registerPlayer({
    playerId: 'player-mongo-1',
    playerName: 'MongoPilot',
    email: 'mongo@example.com',
    password: 'secret-1',
  });
  assert.equal(created.playerNameNormalized, 'mongopilot');

  const byName = await service.getPlayerByName('mongopilot');
  assert.equal(byName.playerId, 'player-mongo-1');

  const updatedPlayer = await service.updatePlayer('MONGOPILOT', {
    sessionKey: 'session-1',
    socketId: 'socket-1',
  });
  assert.equal(updatedPlayer.sessionKey, 'session-1');
  assert.equal(updatedPlayer.socketId, 'socket-1');

  const withCharacter = await service.addCharacter('MongoPilot', {
    id: 'character-1',
    characterName: 'Cosmonova',
    createdAt: '2026-05-07T00:00:00.000Z',
    ships: [],
    missions: [],
    creditLedger: [],
  });
  assert.equal(withCharacter.characters.length, 1);

  const characters = await service.getCharacters('MongoPilot');
  assert.equal(characters.length, 1);
  assert.equal(characters[0].characterName, 'Cosmonova');

  const renamed = await service.updateCharacter('MongoPilot', 'character-1', {
    characterName: 'Cosmonova Prime',
  });
  assert.equal(renamed.characters[0].characterName, 'Cosmonova Prime');

  const afterDelete = await service.deleteCharacter('MongoPilot', 'character-1');
  assert.equal(afterDelete.characters.length, 0);

  await service.clearAllPlayers();
  const afterClear = await service.getPlayerByName('MongoPilot');
  assert.equal(afterClear, null);
});

test('Players Mongo negative paths: empty playerName short-circuits', async () => {
  const service = mongoHarness.databaseService;

  assert.equal(await service.getPlayerByName(''), null);
  assert.equal(await service.updatePlayer('', { sessionKey: 'x' }), null);
  assert.deepEqual(await service.getCharacters(''), []);
});
