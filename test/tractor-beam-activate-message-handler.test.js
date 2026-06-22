'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TractorBeamActivateMessageHandler,
} = require('../src/handlers/tractor-beam-activate-message-handler');
const {
  TRACTOR_BEAM_ACTIVATE_RESPONSE_EVENT,
} = require('../src/model/tractor-beam-activate');

const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function seedTractorScenario(context, { includeTractorBeam = true } = {}) {
  const inventory = includeTractorBeam
    ? [
        {
          itemId: 'ship-1-starter-ship-tractor-beam',
          itemType: 'ship-tractor-beam',
        },
      ]
    : [];

  seedPlayer(context, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            inventory,
            createdAt: '2026-04-17T00:00:00.000Z',
          },
        ],
      },
    ],
  });
}

function createActivatePayload(overrides = {}) {
  return {
    playerName: 'PilotOne',
    characterId: 'character-1',
    shipId: 'ship-1',
    sessionKey: 'session-1',
    correlationId: '0b45f0c0-9777-4cd9-abce-429f95bc4b03',
    requestIdentity: {
      operation: 'tractor-beam-activate',
      entityType: 'ship-tractor-beam',
      containerId: 'ship-1',
    },
    targetItemId: 'debris-item-1',
    targetCelestialBodyId: 'cb-1',
    ...overrides,
  };
}

test('TractorBeamActivateMessageHandler echoes correlationId and requestIdentity on success and validation error', async () => {
  const successContext = createTestContext();
  seedTractorScenario(successContext, { includeTractorBeam: true });
  const successHandler = new TractorBeamActivateMessageHandler(successContext);

  const successSocket = createMockSocket();
  const successRequest = createActivatePayload();
  const successResponse = await successHandler.handle(successSocket, successRequest);

  assert.equal(successResponse.success, true);
  assert.equal(successResponse.correlationId, successRequest.correlationId);
  assert.deepEqual(successResponse.requestIdentity, successRequest.requestIdentity);

  const errorContext = createTestContext();
  seedTractorScenario(errorContext, { includeTractorBeam: false });
  const errorHandler = new TractorBeamActivateMessageHandler(errorContext);

  const errorSocket = createMockSocket();
  const errorRequest = createActivatePayload({
    correlationId: '58ec06e5-0234-4d98-8d5d-c8d4f31fbf8a',
    requestIdentity: {
      operation: 'tractor-beam-activate',
      entityType: 'ship-tractor-beam',
      containerId: 'ship-9',
    },
  });
  const errorResponse = await errorHandler.handle(errorSocket, errorRequest);

  assert.equal(errorResponse.success, false);
  assert.equal(errorResponse.correlationId, errorRequest.correlationId);
  assert.deepEqual(errorResponse.requestIdentity, errorRequest.requestIdentity);
});

test('TractorBeamActivateMessageHandler activates when ship has tractor beam equipped', async () => {
  const context = createTestContext();
  seedTractorScenario(context, { includeTractorBeam: true });
  const handler = new TractorBeamActivateMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, createActivatePayload());

  assert.equal(response.success, true);
  assert.equal(response.message, 'Tractor beam activated');
  assert.equal(response.tractorBeamItemId, 'ship-1-starter-ship-tractor-beam');
  assert.equal(response.activated, true);
  assert.equal(socket.events[0].eventName, TRACTOR_BEAM_ACTIVATE_RESPONSE_EVENT);
});
