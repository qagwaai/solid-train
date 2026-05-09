'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const playerService = require('../src/handlers/context/player-service');

function createCtx(overrides = {}) {
  return {
    registeredPlayers: new Map(),
    charactersByPlayer: new Map(),
    normalizePlayerName(value) {
      return typeof value === 'string' ? value.trim().toLowerCase() : '';
    },
    normalizeLocale(value) {
      const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
      return ['en', 'it'].includes(normalized) ? normalized : 'en';
    },
    toNonEmptyString(value) {
      return typeof value === 'string' ? value.trim() : '';
    },
    normalizeCharacter(character) {
      return {
        ...character,
        id: typeof character?.id === 'string' ? character.id : '',
      };
    },
    ...overrides,
  };
}

test('cachePlayer merges with existing player session/socket defaults', () => {
  const ctx = createCtx();
  ctx.registeredPlayers.set('pilotone', {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    socketId: 'socket-1',
    preferredLocale: 'en',
  });

  const merged = playerService.cachePlayer(ctx, {
    playerName: 'PilotOne',
    preferredLocale: 'it',
  });

  assert.equal(merged.playerName, 'PilotOne');
  assert.equal(merged.sessionKey, 'session-1');
  assert.equal(merged.socketId, 'socket-1');
  assert.equal(merged.preferredLocale, 'it');
});

test('getPlayer returns null for invalid names and missing players', () => {
  const ctx = createCtx();
  ctx.registeredPlayers.set('pilotone', { playerName: 'PilotOne' });

  assert.equal(playerService.getPlayer(ctx, ''), null);
  assert.equal(playerService.getPlayer(ctx, 'missing'), null);
  assert.deepEqual(playerService.getPlayer(ctx, 'PilotOne'), { playerName: 'PilotOne' });
});

test('setCharacters/getCharacters round-trip by normalized key', () => {
  const ctx = createCtx();
  const characters = [{ id: 'character-1' }, { id: 'character-2' }];

  playerService.setCharacters(ctx, 'pilotone', characters);
  const readBack = playerService.getCharacters(ctx, 'pilotone');

  assert.equal(readBack.length, 2);
  assert.equal(readBack[0].id, 'character-1');
  assert.equal(readBack[1].id, 'character-2');
});

test('cacheCharacters normalizes and stores under normalized player name', () => {
  const ctx = createCtx();

  const cached = playerService.cacheCharacters(ctx, 'PilotOne', [{ id: 'c-1' }, { id: 'c-2' }]);

  assert.equal(cached.length, 2);
  assert.equal(playerService.getCharacters(ctx, 'pilotone').length, 2);
});

test('hasValidSession requires matching player session key', () => {
  const ctx = createCtx();
  playerService.cachePlayer(ctx, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    preferredLocale: 'en',
  });

  assert.equal(
    playerService.hasValidSession(ctx, { playerName: 'PilotOne', sessionKey: 'session-1' }),
    true
  );
  assert.equal(
    playerService.hasValidSession(ctx, { playerName: 'PilotOne', sessionKey: 'wrong' }),
    false
  );
  assert.equal(
    playerService.hasValidSession(ctx, { playerName: 'missing', sessionKey: 'x' }),
    false
  );
});
