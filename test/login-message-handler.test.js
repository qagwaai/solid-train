'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LoginMessageHandler
} = require('../src/handlers/login-message-handler');
const {
  LOGIN_RESPONSE_EVENT,
  LOGIN_FAILURE_REASONS
} = require('../src/model/login');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('LoginMessageHandler authenticates and rotates session key', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerId: 'player-1',
    playerName: 'OrbitFox',
    password: 'safe-pass'
  });
  const handler = new LoginMessageHandler(context);
  const socket = createMockSocket('socket-login');

  const response = await handler.handle(socket, {
    playerName: 'orbitfox',
    password: 'safe-pass'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Login successful',
    playerId: 'player-1',
    sessionKey: 'player-1'
  });
  assert.equal(socket.events[0].eventName, LOGIN_RESPONSE_EVENT);
  assert.equal(context.getPlayer('OrbitFox').sessionKey, 'player-1');
  assert.equal(context.getPlayer('OrbitFox').socketId, 'socket-login');
  assert.equal(context.getPlayer('OrbitFox').preferredLocale, 'en');
});

test('LoginMessageHandler rejects password mismatches', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'NovaWing',
    password: 'correct-password'
  });
  const handler = new LoginMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'novawing',
    password: 'wrong-password'
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Password does not match',
    reason: LOGIN_FAILURE_REASONS.PASSWORD_MISMATCH
  });
  assert.equal(socket.events[0].eventName, LOGIN_RESPONSE_EVENT);
});

test('LoginMessageHandler hydrates player from database when memory is empty', async () => {
  const context = createTestContext();
  context.databaseService = {
    async getPlayerByName(playerName) {
      if (playerName.toLowerCase() !== 'orbitfox') {
        return null;
      }

      return {
        playerId: 'player-db-1',
        playerName: 'OrbitFox',
        email: 'orbitfox@example.com',
        password: 'safe-pass',
        sessionKey: null,
        socketId: null
      };
    },
    async updatePlayer() {
      return null;
    },
    async getCharacters(playerName) {
      if (playerName.toLowerCase() !== 'orbitfox') {
        return [];
      }

      return [
        {
          id: 'char-1',
          characterName: 'RangerOne',
          createdAt: '2026-04-20T00:00:00.000Z',
          ships: []
        }
      ];
    }
  };

  const handler = new LoginMessageHandler(context);
  const socket = createMockSocket('socket-db-login');

  const response = await handler.handle(socket, {
    playerName: 'orbitfox',
    password: 'safe-pass'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Login successful',
    playerId: 'player-db-1',
    sessionKey: 'player-1'
  });
  assert.equal(socket.events[0].eventName, LOGIN_RESPONSE_EVENT);
  assert.equal(context.getPlayer('OrbitFox').socketId, 'socket-db-login');
  assert.equal(context.getPlayer('OrbitFox').sessionKey, 'player-1');
  assert.deepEqual(context.getCharacters('orbitfox'), [
    {
      id: 'char-1',
      characterName: 'RangerOne',
      createdAt: '2026-04-20T00:00:00.000Z',
      ships: [],
      missions: [],
      creditLedger: [],
      credits: 0
    }
  ]);
});

test('LoginMessageHandler normalizes legacy character name fields from database', async () => {
  const context = createTestContext();
  context.databaseService = {
    async getPlayerByName() {
      return {
        playerId: 'player-db-legacy-1',
        playerName: 'LegacyPilot',
        email: 'legacy@example.com',
        password: 'safe-pass',
        sessionKey: null,
        socketId: null
      };
    },
    async updatePlayer() {
      return null;
    },
    async getCharacters() {
      return [
        {
          id: 'legacy-char-1',
          name: 'Legacy Ranger',
          createdAt: '2026-04-20T00:00:00.000Z',
          ships: [{ id: 'd-1', name: 'Legacy Ship', createdAt: '2026-04-20T00:00:00.000Z', spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 } }]
        }
      ];
    }
  };

  const handler = new LoginMessageHandler(context);
  const socket = createMockSocket('socket-legacy-login');

  const response = await handler.handle(socket, {
    playerName: 'LegacyPilot',
    password: 'safe-pass'
  });

  assert.equal(response.success, true);
  assert.equal(socket.events[0].eventName, LOGIN_RESPONSE_EVENT);
  assert.deepEqual(context.getCharacters('legacypilot'), [
    {
      id: 'legacy-char-1',
      name: 'Legacy Ranger',
      characterName: 'Legacy Ranger',
      createdAt: '2026-04-20T00:00:00.000Z',
      ships: [
        {
          id: 'd-1',
          name: 'Legacy Ship',
          model: 'Scavenger Pod',
          tier: 1,
          inventory: [],
          createdAt: '2026-04-20T00:00:00.000Z',
          status: null,
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
          launchable: true,
          damageProfile: null
        }
      ],
      missions: [],
      creditLedger: [],
      credits: 0
    }
  ]);
});

test('LoginMessageHandler accepts locale and persists normalized base code', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerId: 'player-1',
    playerName: 'OrbitFox',
    password: 'safe-pass',
    preferredLocale: 'en'
  });
  const handler = new LoginMessageHandler(context);

  const response = await handler.handle(createMockSocket('socket-login-locale'), {
    playerName: 'orbitfox',
    password: 'safe-pass',
    locale: 'it-IT'
  });

  assert.equal(response.success, true);
  assert.equal(context.getPlayer('OrbitFox').preferredLocale, 'it');
});

test('LoginMessageHandler falls back unknown locale to en', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerId: 'player-1',
    playerName: 'OrbitFox',
    password: 'safe-pass',
    preferredLocale: 'it'
  });
  const handler = new LoginMessageHandler(context);

  const response = await handler.handle(createMockSocket('socket-login-unknown-locale'), {
    playerName: 'orbitfox',
    password: 'safe-pass',
    locale: 'es-MX'
  });

  assert.equal(response.success, true);
  assert.equal(context.getPlayer('OrbitFox').preferredLocale, 'en');
});

test('LoginMessageHandler keeps existing locale when locale is omitted', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerId: 'player-1',
    playerName: 'OrbitFox',
    password: 'safe-pass',
    preferredLocale: 'it'
  });
  const handler = new LoginMessageHandler(context);

  const response = await handler.handle(createMockSocket('socket-login-no-locale'), {
    playerName: 'orbitfox',
    password: 'safe-pass'
  });

  assert.equal(response.success, true);
  assert.equal(context.getPlayer('OrbitFox').preferredLocale, 'it');
});