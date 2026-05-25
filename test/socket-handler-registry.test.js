'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSocketHandlers } = require('../src/handlers/socket-handler-registry');

function createMockSocket() {
  const listeners = new Map();
  const events = [];

  return {
    events,
    on(eventName, callback) {
      listeners.set(eventName, callback);
    },
    emit(eventName, payload) {
      events.push({ eventName, payload });
    },
    async trigger(eventName, payload) {
      const callback = listeners.get(eventName);
      assert.ok(callback, `Expected listener for ${eventName}`);
      await callback(payload);
    },
  };
}

test('registerSocketHandlers injects correlation echo for handlers that omit it', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    characterListMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('character-list-response', {
          success: true,
          message: 'ok',
          playerName: 'PilotOne',
          characters: [],
        });
      },
    },
  });

  await socket.trigger('character-list-request', {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    correlationId: '4b80fba6-5f6d-4798-8b33-c2d7fb5365fc',
    requestIdentity: {
      operation: 'character-list',
      entityType: 'character',
      containerId: 'character-1',
    },
  });

  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, 'character-list-response');
  assert.equal(socket.events[0].payload.correlationId, '4b80fba6-5f6d-4798-8b33-c2d7fb5365fc');
  assert.deepEqual(socket.events[0].payload.requestIdentity, {
    operation: 'character-list',
    entityType: 'character',
    containerId: 'character-1',
  });
});

test('registerSocketHandlers preserves existing correlation echo from hardened handlers', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    itemUpsertMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('item-upsert-response', {
          success: true,
          message: 'ok',
          correlationId: 'handler-correlation-id',
          requestIdentity: {
            operation: 'item-upsert',
            entityType: 'expendable-dart-drone',
            containerId: 'ship-1',
          },
        });
      },
    },
  });

  await socket.trigger('item-upsert-request', {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    correlationId: 'request-correlation-id',
    requestIdentity: {
      operation: 'item-upsert',
      entityType: 'expendable-dart-drone',
      containerId: 'ship-1',
    },
  });

  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, 'item-upsert-response');
  assert.equal(socket.events[0].payload.correlationId, 'handler-correlation-id');
  assert.deepEqual(socket.events[0].payload.requestIdentity, {
    operation: 'item-upsert',
    entityType: 'expendable-dart-drone',
    containerId: 'ship-1',
  });
});

test('registerSocketHandlers does not inject correlation fields into invalid-session event', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    shipListMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('invalid-session', { message: 'Invalid session' });
      },
    },
  });

  await socket.trigger('ship-list-request', {
    playerName: 'PilotOne',
    sessionKey: 'wrong-session',
    correlationId: '57f8d524-ac75-4f82-8fbc-f89e417d4954',
    requestIdentity: {
      operation: 'ship-list',
      entityType: 'ship',
      containerId: 'character-1',
    },
  });

  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, 'invalid-session');
  assert.deepEqual(socket.events[0].payload, { message: 'Invalid session' });
});
