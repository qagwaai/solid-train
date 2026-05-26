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
    hasListener(eventName) {
      return listeners.has(eventName);
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

test('registerSocketHandlers does not register upsert-item-request anymore', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    itemUpsertMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('item-upsert-response', {
          success: true,
          message: 'ok',
        });
      },
    },
  });

  assert.equal(socket.hasListener('upsert-item-request'), false);
  assert.equal(socket.hasListener('item-upsert-request'), true);
  assert.equal(socket.events.length, 0);
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

test('registerSocketHandlers blocks mismatched response channel emissions', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    shipListByOwnerMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('list-missions-response', {
          success: true,
          message: 'wrong-channel',
        });
      },
    },
  });

  await socket.trigger('ship-list-by-owner-request', {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    correlationId: '35ff5f80-b755-4d0b-b72a-cb24f017ab50',
    requestIdentity: {
      operation: 'ship-list-by-owner',
      entityType: 'ship',
      containerId: 'player-character:character-1',
    },
  });

  assert.equal(socket.events.length, 0);
});

test('registerSocketHandlers keeps correlation metadata isolated across overlapping requests', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    shipListByOwnerMessageHandler: {
      async handle(currentSocket) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        currentSocket.emit('ship-list-by-owner-response', {
          success: true,
          message: 'ship-owner-ok',
          ships: [],
        });
      },
    },
    missionListMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('list-missions-response', {
          success: true,
          message: 'mission-list-ok',
          missions: [],
        });
      },
    },
  });

  const shipRequestPromise = socket.trigger('ship-list-by-owner-request', {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    correlationId: '58f2cc38-68c6-48ba-ba3e-2ca78f65d926',
    requestIdentity: {
      operation: 'ship-list-by-owner',
      entityType: 'ship',
      containerId: 'player-character:character-1',
    },
  });

  const missionRequestPromise = socket.trigger('list-missions-request', {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characterId: 'character-1',
    correlationId: '7a11cba8-bad6-4143-9424-ea1177cac8a0',
    requestIdentity: {
      operation: 'list-missions',
      entityType: 'mission',
      containerId: 'character-1',
    },
  });

  await Promise.all([shipRequestPromise, missionRequestPromise]);

  assert.equal(socket.events.length, 2);
  const shipResponse = socket.events.find((event) => event.eventName === 'ship-list-by-owner-response');
  const missionResponse = socket.events.find((event) => event.eventName === 'list-missions-response');

  assert.ok(shipResponse);
  assert.ok(missionResponse);

  assert.equal(shipResponse.payload.correlationId, '58f2cc38-68c6-48ba-ba3e-2ca78f65d926');
  assert.equal(shipResponse.payload.requestIdentity.operation, 'ship-list-by-owner');

  assert.equal(missionResponse.payload.correlationId, '7a11cba8-bad6-4143-9424-ea1177cac8a0');
  assert.equal(missionResponse.payload.requestIdentity.operation, 'list-missions');
});

test('registerSocketHandlers canonicalizes mission-list operation to list-missions', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    missionListMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('list-missions-response', {
          success: true,
          message: 'ok',
          missions: [],
        });
      },
    },
  });

  await socket.trigger('list-missions-request', {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characterId: 'character-1',
    correlationId: '7a11cba8-bad6-4143-9424-ea1177cac8a0',
    requestIdentity: {
      operation: 'mission-list',
      entityType: 'mission',
      containerId: 'character-1',
    },
  });

  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, 'list-missions-response');
  assert.equal(socket.events[0].payload.requestIdentity.operation, 'list-missions');
});

test('registerSocketHandlers blocks legacy add-mission-response for mission-upsert requests', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    missionUpsertMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('add-mission-response', {
          success: true,
          message: 'Mission recorded successfully',
          mission: {
            missionId: 'first-target',
            status: 'started',
          },
        });
      },
    },
  });

  await socket.trigger('mission-upsert-request', {
    playerName: 'PilotOne',
    characterId: 'character-1',
    sessionKey: 'session-1',
    missionId: 'first-target',
    status: 'started',
    correlationId: 'f5d5cc38-e8f1-4e58-b775-1b86800fbc8c',
    requestIdentity: {
      operation: 'mission-upsert',
      entityType: 'mission',
      containerId: 'character-1',
    },
  });

  assert.equal(socket.events.length, 0);
});

test('registerSocketHandlers emits mission-upsert-response for canonical mission-upsert requests only', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    missionUpsertMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('mission-upsert-response', {
          success: true,
          message: 'Mission recorded successfully',
          mission: {
            missionId: 'first-target',
            status: 'started',
          },
        });
      },
    },
  });

  await socket.trigger('mission-upsert-request', {
    playerName: 'PilotOne',
    characterId: 'character-1',
    sessionKey: 'session-1',
    missionId: 'first-target',
    status: 'started',
    correlationId: 'f5d5cc38-e8f1-4e58-b775-1b86800fbc8c',
    requestIdentity: {
      operation: 'mission-upsert',
      entityType: 'mission',
      containerId: 'character-1',
    },
  });

  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, 'mission-upsert-response');
});

test('registerSocketHandlers does not register add-mission-request anymore', async () => {
  const socket = createMockSocket();
  registerSocketHandlers(socket, {
    missionUpsertMessageHandler: {
      async handle(currentSocket) {
        currentSocket.emit('mission-upsert-response', {
          success: true,
          message: 'Mission recorded successfully',
          mission: {
            missionId: 'first-target',
            status: 'started',
          },
        });
      },
    },
  });

  assert.equal(socket.hasListener('add-mission-request'), false);
  assert.equal(socket.events.length, 0);
});
