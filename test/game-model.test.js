'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GameState,
  GAME_IDLE_TIMEOUT_MS
} = require('../src/model/game');

test('GameState tracks joinedAt and lastMessageReceivedAt when joining', () => {
  const game = new GameState();

  const participant = game.joinCharacter({
    playerName: 'PilotOne',
    normalizedPlayerName: 'pilotone',
    characterId: 'character-1',
    characterName: 'RangerOne',
    timestamp: '2026-04-17T00:00:00.000Z'
  });

  assert.equal(participant.joinedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(participant.lastMessageReceivedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(game.getAllParticipants().length, 1);
});

test('GameState touchParticipants refreshes heartbeat timestamp', () => {
  const game = new GameState();
  game.joinCharacter({
    playerName: 'PilotOne',
    normalizedPlayerName: 'pilotone',
    characterId: 'character-1',
    characterName: 'RangerOne',
    timestamp: '2026-04-17T00:00:00.000Z'
  });

  const touched = game.touchParticipants({
    normalizedPlayerName: 'pilotone',
    characterId: 'character-1',
    timestamp: '2026-04-17T00:10:00.000Z'
  });

  assert.equal(touched.length, 1);
  assert.equal(touched[0].lastMessageReceivedAt, '2026-04-17T00:10:00.000Z');
});

test('GameState detaches idle characters after inactivity timeout', () => {
  const game = new GameState({ idleTimeoutMs: GAME_IDLE_TIMEOUT_MS });
  game.joinCharacter({
    playerName: 'PilotOne',
    normalizedPlayerName: 'pilotone',
    characterId: 'character-1',
    characterName: 'RangerOne',
    timestamp: '2026-04-17T00:00:00.000Z'
  });

  const detached = game.detachIdleCharacters('2026-04-17T00:30:00.001Z');

  assert.equal(detached.length, 1);
  assert.equal(detached[0].characterId, 'character-1');
  assert.equal(game.getAllParticipants().length, 0);
});