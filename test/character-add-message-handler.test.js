'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CharacterAddMessageHandler
} = require('../src/handlers/character-add-message-handler');
const {
  CHARACTER_ADD_RESPONSE_EVENT
} = require('../src/model/character-add');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('CharacterAddMessageHandler adds a character and emits response', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'BuilderPilot',
    sessionKey: 'session-1'
  });
  const handler = new CharacterAddMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'builderpilot',
    sessionKey: 'session-1',
    characterName: 'RangerOne'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Character added successfully',
    playerName: 'BuilderPilot',
    characterName: 'RangerOne',
    characterId: 'player-1'
  });
  assert.equal(socket.events[0].eventName, CHARACTER_ADD_RESPONSE_EVENT);
  assert.deepEqual(context.getCharacters('builderpilot'), [
    {
      id: 'player-1',
      characterName: 'RangerOne',
      createdAt: '2026-04-17T00:00:00.000Z',
      ships: [
        {
          id: 'player-1-ship-1',
          name: 'RangerOne Ship 1',
          model: 'Scavenger Pod',
          tier: 1,
          createdAt: '2026-04-17T00:00:00.000Z',
          inventory: [
            {
              itemId: 'player-1-ship-1-item-1',
              itemType: 'expendable-dart-drone'
            }
          ],
          status: null,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 0, y: 0, z: 0 },
            epochMs: 1776384000000
          },
          launchable: true,
          damageProfile: null
        }
      ],
      missions: [
        {
          missionId: 'first-target',
          status: 'available',
          updatedAt: '2026-04-17T00:00:00.000Z',
          startedAt: undefined,
          inProgressAt: undefined,
          failedAt: undefined,
          completedAt: undefined,
          failureReason: undefined,
          statusDetail: undefined
        }
      ],
      creditLedger: [
        {
          type: 'put',
          amount: 425,
          description: 'Starting credits',
          timestamp: '2026-04-17T00:00:00.000Z',
          referenceId: null
        }
      ],
      credits: 425
    }
  ]);
  assert.deepEqual(context.getItem('player-1-ship-1-item-1'), {
    id: 'player-1-ship-1-item-1',
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    state: 'contained',
    damageStatus: 'intact',
    container: {
      containerType: 'ship',
      containerId: 'player-1-ship-1'
    },
    owningPlayerId: 'player-seeded',
    owningCharacterId: 'player-1',
    kinematics: null,
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
    destroyedAt: null,
    destroyedReason: null,
    launchable: true,
    quantity: 1
  });
});

test('CharacterAddMessageHandler rejects invalid sessions before mutating state', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'BuilderPilot',
    sessionKey: 'session-1'
  });
  const handler = new CharacterAddMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'BuilderPilot',
    sessionKey: 'wrong-session',
    characterName: 'GhostUnit'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.deepEqual(context.getCharacters('builderpilot'), []);
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});