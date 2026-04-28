'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseService } = require('../src/db/service');
const { Player } = require('../src/db/models');

test('DatabaseService.getPlayerByName finds legacy player documents missing normalized name', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;

  let capturedQuery;

  Player.findOne = async (query) => {
    capturedQuery = query;

    return {
      playerId: 'p-1',
      playerName: 'OrbitFox',
      playerNameNormalized: undefined,
      saveCalls: 0,
      async save() {
        this.saveCalls += 1;
      },
      toObject() {
        return {
          playerId: this.playerId,
          playerName: this.playerName,
          playerNameNormalized: this.playerNameNormalized
        };
      }
    };
  };

  try {
    const result = await service.getPlayerByName('orbitfox');

    assert.equal(capturedQuery.$or[0].playerNameNormalized, 'orbitfox');
    assert.equal(capturedQuery.$or[1].playerName.source, '^orbitfox$');
    assert.equal(capturedQuery.$or[1].playerName.flags, 'i');
    assert.equal(result.playerName, 'OrbitFox');
    assert.equal(result.playerNameNormalized, 'orbitfox');
  } finally {
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService.updatePlayer uses case-insensitive playerName query', async () => {
  const service = new DatabaseService();
  const originalFindOneAndUpdate = Player.findOneAndUpdate;

  let capturedQuery;
  let capturedUpdates;

  Player.findOneAndUpdate = async (query, updates) => {
    capturedQuery = query;
    capturedUpdates = updates;

    return {
      toObject() {
        return {
          playerName: 'OrbitFox',
          sessionKey: updates.sessionKey || null,
          socketId: updates.socketId || null
        };
      }
    };
  };

  try {
    const updated = await service.updatePlayer('ORBITFOX', {
      sessionKey: 'session-1',
      socketId: 'socket-1'
    });

    assert.equal(capturedQuery.$or[0].playerNameNormalized, 'orbitfox');
    assert.equal(capturedQuery.$or[1].playerName.source, '^orbitfox$');
    assert.equal(capturedQuery.$or[1].playerName.flags, 'i');
    assert.equal(capturedUpdates.sessionKey, 'session-1');
    assert.equal(capturedUpdates.socketId, 'socket-1');
    assert.ok(capturedUpdates.updatedAt instanceof Date);
    assert.equal(updated.playerName, 'OrbitFox');
  } finally {
    Player.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
