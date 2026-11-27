'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSocketHandlers } = require('../src/handlers/socket-handler-registry');
const { RegisterMessageHandler } = require('../src/handlers/register-message-handler');
const { LoginMessageHandler } = require('../src/handlers/login-message-handler');
const { createSchemaValidator } = require('../src/model/schema-validator');
const { createTestContext } = require('../test-support/message-handler-test-helpers');
const loginResponse = require('../api/schemas/login-response.schema.json');
const registerResponse = require('../api/schemas/register-response.schema.json');

const ajv = createSchemaValidator();
const validateLogin = ajv.compile(loginResponse);
const validateRegister = ajv.compile(registerResponse);
const correlationId = '68bd4d59-2ef4-4a51-bb7b-763e530c1270';

function mockSocket() {
  const listeners = new Map();
  const events = [];
  return {
    id: 'socket',
    events,
    on(name, callback) {
      listeners.set(name, callback);
    },
    emit(name, payload) {
      events.push({ name, payload });
    },
    async trigger(name, payload) {
      await listeners.get(name)(payload);
      return events.at(-1).payload;
    },
  };
}

test('register then login return closed correlated responses with typed failures', async () => {
  const ctx = createTestContext({ seedDefaults: false });
  const s = mockSocket();
  registerSocketHandlers(
    s,
    {
      registerMessageHandler: new RegisterMessageHandler(ctx),
      loginMessageHandler: new LoginMessageHandler(ctx),
    },
    ctx
  );
  const credentials = { playerName: 'Pilot', password: 'secret', correlationId };
  let response = await s.trigger('register', { ...credentials, email: 'pilot@example.com' });
  assert.equal(validateRegister(response), true, JSON.stringify(validateRegister.errors));
  assert.equal(response.success, true);
  assert.equal(response.correlationId, correlationId);
  assert.equal('requestIdentity' in response, false);
  response = await s.trigger('login', {
    ...credentials,
    requestIdentity: { operation: 'game-join', entityType: 'game-session', containerId: 'other' },
  });
  assert.equal(response.success, true);
  assert.equal(response.correlationId, correlationId);
  assert.equal(validateLogin(response), true, JSON.stringify(validateLogin.errors));
  response = await s.trigger('register', { ...credentials, email: 'pilot@example.com' });
  assert.equal(response.reason, 'player_exists');
  assert.equal(validateRegister(response), true, JSON.stringify(validateRegister.errors));
  response = await s.trigger('login', { ...credentials, password: 'wrong' });
  assert.equal(response.reason, 'invalid_credentials');
  assert.equal(validateLogin(response), true, JSON.stringify(validateLogin.errors));
  response = await s.trigger('login', credentials);
  assert.equal(response.success, true);
  assert.equal(validateLogin(response), true, JSON.stringify(validateLogin.errors));
  assert.equal(response.correlationId, correlationId);
  assert.equal('requestIdentity' in response, false);
  const count = s.events.length;
  await s.trigger('login', { ...credentials, correlationId: 'invalid', requestId: correlationId });
  assert.equal(s.events.length, count);
  await s.trigger('register', {
    ...credentials,
    email: 'pilot@example.com',
    correlationId: null,
    requestId: correlationId,
  });
  assert.equal(s.events.length, count);
});

test('login rejects invalid stored identity without rotating a session', async () => {
  const ctx = createTestContext({ seedDefaults: false });
  ctx.registeredPlayers.set('pilot', { playerName: 'Pilot', playerId: ' ', password: 'secret' });
  const s = mockSocket();
  registerSocketHandlers(s, { loginMessageHandler: new LoginMessageHandler(ctx) }, ctx);
  const response = await s.trigger('login', {
    playerName: 'Pilot',
    password: 'secret',
    correlationId,
  });
  assert.equal(response.reason, 'outcome_unknown');
  assert.equal('playerId' in response, false);
  assert.equal('sessionKey' in response, false);
  assert.equal(ctx.registeredPlayers.get('pilot').sessionKey, undefined);
  assert.equal(validateLogin(response), true, JSON.stringify(validateLogin.errors));
  assert.equal(
    validateLogin({ success: true, message: 'ok', playerId: ' ', sessionKey: 's', correlationId }),
    false
  );
});

test('login lookup errors fail closed rather than using a cached player', async () => {
  const ctx = createTestContext({ seedDefaults: false });
  ctx.registeredPlayers.set('pilot', { playerName: 'Pilot', playerId: 'id', password: 'secret' });
  ctx.databaseService = {
    async getPlayerByName() {
      throw new Error('private storage detail');
    },
  };
  const s = mockSocket();
  registerSocketHandlers(s, { loginMessageHandler: new LoginMessageHandler(ctx) }, ctx);
  const response = await s.trigger('login', {
    playerName: 'Pilot',
    password: 'secret',
    correlationId,
  });
  assert.equal(response.reason, 'outcome_unknown');
  assert.equal(response.message.includes('private'), false);
  assert.equal(validateLogin(response), true, JSON.stringify(validateLogin.errors));
});
