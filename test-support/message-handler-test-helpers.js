'use strict';

const {
  MessageHandlerContext
} = require('../src/handlers/message-handler-context');

function createTestContext() {
  const issuedIds = ['player-1', 'session-1', 'session-2', 'character-1'];

  return new MessageHandlerContext({
    createId: () => issuedIds.shift() || `generated-${issuedIds.length}`,
    getCurrentTimestamp: () => '2026-04-17T00:00:00.000Z'
  });
}

function createMockSocket(id = 'socket-1') {
  const events = [];

  return {
    id,
    events,
    emit(eventName, payload) {
      events.push({ eventName, payload });
    }
  };
}

function seedPlayer(context, overrides = {}) {
  const normalizedPlayerName = (overrides.playerName || 'PilotOne').toLowerCase();
  const player = {
    playerId: overrides.playerId || 'player-seeded',
    playerName: overrides.playerName || 'PilotOne',
    email: overrides.email || 'pilot@example.com',
    password: overrides.password || 'secret',
    sessionKey: overrides.sessionKey || null,
    socketId: overrides.socketId || null
  };

  context.registeredPlayers.set(normalizedPlayerName, player);
  context.setCharacters(normalizedPlayerName, overrides.characters || []);

  return player;
}

module.exports = {
  createMockSocket,
  createTestContext,
  seedPlayer
};