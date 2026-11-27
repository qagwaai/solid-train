'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSocketHandlers } = require('../src/handlers/socket-handler-registry');
const { GameJoinMessageHandler } = require('../src/handlers/game-join-message-handler');
const { createSchemaValidator } = require('../src/model/schema-validator');
const requestSchema = require('../api/schemas/game-join-request.schema.json');
const responseSchema = require('../api/schemas/game-join-response.schema.json');
const { createTestContext, seedPlayer } = require('../test-support/message-handler-test-helpers');

const validateRequest = createSchemaValidator().compile(requestSchema);
const validateResponse = createSchemaValidator().compile(responseSchema);
const request = {
  playerName: 'pilot',
  sessionKey: 'session',
  characterId: 'char-1',
  correlationId: '68bd4d59-2ef4-4a51-bb7b-763e530c1270',
  requestIdentity: { operation: 'game-join', entityType: 'game-session', containerId: 'char-1' },
};

function socket() {
  const listeners = new Map();
  const events = [];
  return {
    events,
    on(name, fn) {
      listeners.set(name, fn);
    },
    emit(name, payload) {
      events.push({ name, payload });
    },
    has(name) {
      return listeners.has(name);
    },
    async trigger(name, payload) {
      await listeners.get(name)(payload);
    },
  };
}

test('canonical join listener echoes exact request context on success and failures', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'Pilot',
    sessionKey: 'session',
    characters: [{ id: 'char-1', characterName: 'Character' }],
  });
  const s = socket();
  registerSocketHandlers(
    s,
    { gameJoinMessageHandler: new GameJoinMessageHandler(context) },
    context
  );
  assert.equal(s.has('game-join-request'), true);
  assert.equal(s.has('game-join'), false);
  assert.equal(validateRequest(request), true, JSON.stringify(validateRequest.errors));
  await s.trigger('game-join-request', request);
  let response = s.events.at(-1).payload;
  assert.equal(validateResponse(response), true, JSON.stringify(validateResponse.errors));
  assert.equal(response.success, true);
  assert.equal(response.playerName, request.playerName);
  assert.equal(response.characterId, request.characterId);
  assert.equal(response.correlationId, request.correlationId);
  assert.deepEqual(response.requestIdentity, request.requestIdentity);
  await s.trigger('game-join-request', { ...request, sessionKey: 'wrong' });
  assert.equal(s.events.at(-2).name, 'invalid-session');
  response = s.events.at(-1).payload;
  assert.equal(response.reason, 'invalid_session');
  assert.equal(validateResponse(response), true, JSON.stringify(validateResponse.errors));
  assert.equal(response.playerName, request.playerName);
  assert.deepEqual(response.requestIdentity, request.requestIdentity);
  assert.equal(response.correlationId, request.correlationId);
  const count = s.events.length;
  await s.trigger('game-join-request', {
    ...request,
    requestIdentity: { ...request.requestIdentity, containerId: 'other' },
  });
  assert.equal(s.events.length, count);
  await s.trigger('game-join-request', { ...request, correlationId: null });
  assert.equal(s.events.length, count);
});

test('join handler exceptions return a correlated uncertain outcome without leaking details', async () => {
  const s = socket();
  registerSocketHandlers(
    s,
    {
      gameJoinMessageHandler: {
        async handle() {
          throw new Error('private failure');
        },
      },
    },
    {
      async hasValidSessionAsync() {
        return true;
      },
    }
  );
  await s.trigger('game-join-request', request);
  const response = s.events.at(-1).payload;
  assert.equal(response.reason, 'outcome_unknown');
  assert.equal(response.message.includes('private'), false);
  assert.equal(response.correlationId, request.correlationId);
  assert.deepEqual(response.requestIdentity, request.requestIdentity);
  assert.equal(validateResponse(response), true, JSON.stringify(validateResponse.errors));
});
