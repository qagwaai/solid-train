'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { Player } = require('../src/db/models');
const { appendCharacterLedgerEntryAsync } = require('../src/handlers/context/market-service');

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

test('Credit ledger Mongo round-trip preserves IDs for new, appended and legacy movements', async () => {
  const service = mongoHarness.databaseService;
  await service.registerPlayer({
    playerId: 'ledger-player',
    playerName: 'LedgerPilot',
    email: 'ledger@example.com',
    password: 'secret-1',
  });
  const context = new MessageHandlerContext({ databaseService: service });
  const movement = {
    type: 'put',
    amount: 425,
    description: 'Starting credits',
    timestamp: '2026-05-05T00:00:00.000Z',
    referenceId: null,
  };
  for (const id of ['ledger-character', 'legacy-character']) {
    await context.addCharacterAsync('LedgerPilot', {
      id,
      characterName: id,
      createdAt: '2026-05-05T00:00:00.000Z',
      creditLedger: [movement],
    });
  }
  const first = await service.getCharacters('LedgerPilot');
  assert.ok(first[0].creditLedger[0].id);
  assert.equal(
    first[0].creditLedger[0].id,
    context.getCharacters('ledgerpilot')[0].creditLedger[0].id
  );

  await Player.collection.updateOne(
    { playerName: 'LedgerPilot' },
    {
      $unset: { 'characters.1.creditLedger.0.id': '' },
    }
  );
  const coldContext = new MessageHandlerContext({ databaseService: service });
  const hydrated = await coldContext.getCharactersAsync('LedgerPilot', { strict: true });
  const legacyId = hydrated[1].creditLedger[0].id;
  assert.equal(legacyId, first[1].creditLedger[0].id);
  const secondColdContext = new MessageHandlerContext({ databaseService: service });
  assert.equal(
    (await secondColdContext.getCharactersAsync('LedgerPilot'))[1].creditLedger[0].id,
    legacyId
  );

  // Saving a different character must not fail validation on the legacy character.
  await service.updateCharacter('LedgerPilot', 'ledger-character', { characterName: 'Renamed' });
  assert.equal((await service.getCharacters('LedgerPilot'))[1].creditLedger[0].id, legacyId);
  await appendCharacterLedgerEntryAsync(coldContext, 'LedgerPilot', 'ledger-character', {
    ...movement,
    type: 'take',
    amount: 25,
    description: 'Purchase',
  });
  const persisted = await service.getCharacters('LedgerPilot');
  assert.equal(persisted[0].creditLedger.length, 2);
  assert.equal(persisted[0].creditLedger[0].id, first[0].creditLedger[0].id);
  assert.notEqual(persisted[0].creditLedger[0].id, persisted[0].creditLedger[1].id);
  assert.equal(
    persisted[0].creditLedger[1].id,
    coldContext.getCharacters('ledgerpilot')[0].creditLedger[1].id
  );
  assert.equal(coldContext.calculateCharacterCredits(persisted[0]), 400);
});
