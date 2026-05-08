'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseService } = require('../src/db/service');
const { CelestialBody, Item, Player } = require('../src/db/models');

test('DatabaseService registerPlayer creates and returns normalized player object', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;
  const originalSave = Player.prototype.save;

  Player.findOne = async () => null;
  Player.prototype.save = async function save() {
    return this;
  };

  try {
    const created = await service.registerPlayer({
      playerId: 'p-1',
      playerName: '  OrbitFox  ',
      email: 'orbit@example.com',
      password: 'secret',
      preferredLocale: 'de',
    });

    assert.equal(created.playerId, 'p-1');
    assert.equal(created.playerName, '  OrbitFox  ');
    assert.equal(created.playerNameNormalized, 'orbitfox');
    assert.equal(created.preferredLocale, 'de');
    assert.deepEqual(created.characters, []);
  } finally {
    Player.findOne = originalFindOne;
    Player.prototype.save = originalSave;
  }
});

test('DatabaseService registerPlayer rejects duplicate player', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;

  Player.findOne = async () => ({ playerId: 'existing' });

  try {
    await assert.rejects(
      service.registerPlayer({
        playerId: 'p-2',
        playerName: 'OrbitFox',
        email: 'orbit@example.com',
        password: 'secret',
      }),
      /Player already exists/
    );
  } finally {
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService updateCharacter covers no-player, no-character, and success branches', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;

  const player = {
    characters: [{ id: 'c-1', characterName: 'Old' }],
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
    },
    toObject() {
      return {
        characters: this.characters,
        updatedAt: this.updatedAt,
      };
    },
  };

  let mode = 'missing-player';
  Player.findOne = async () => {
    if (mode === 'missing-player') {
      return null;
    }

    if (mode === 'missing-character') {
      return {
        characters: [{ id: 'different', characterName: 'Other' }],
        async save() {},
        toObject() {
          return { characters: this.characters };
        },
      };
    }

    if (mode === 'error') {
      throw new Error('update character failed');
    }

    return player;
  };

  try {
    assert.equal(await service.updateCharacter('pilot', 'c-1', { characterName: 'New' }), null);

    mode = 'missing-character';
    assert.equal(await service.updateCharacter('pilot', 'c-1', { characterName: 'New' }), null);

    mode = 'success';
    const updated = await service.updateCharacter('pilot', 'c-1', { characterName: 'New' });
    assert.equal(updated.characters[0].characterName, 'New');
    assert.equal(player.saveCalls, 1);

    mode = 'error';
    await assert.rejects(
      service.updateCharacter('pilot', 'c-1', { characterName: 'Again' }),
      /update character failed/
    );
  } finally {
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService updateCharacter maps canonical ship name to shipName before save', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;

  const player = {
    characters: [{ id: 'c-1', characterName: 'Pilot', ships: [] }],
    async save() {},
    toObject() {
      return { characters: this.characters };
    },
  };

  Player.findOne = async () => player;

  try {
    const updated = await service.updateCharacter('pilot', 'c-1', {
      ships: [{ id: 's-1', name: 'Scout Ship' }],
    });

    assert.equal(updated.characters[0].ships[0].name, 'Scout Ship');
    assert.equal(updated.characters[0].ships[0].shipName, 'Scout Ship');
  } finally {
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService addShip initializes ship list and appends data', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;

  const player = {
    characters: [{ id: 'c-1' }],
    async save() {},
    toObject() {
      return { characters: this.characters };
    },
  };

  Player.findOne = async () => player;

  try {
    const result = await service.addShip('pilot', 'c-1', { id: 's-1', shipName: 'Scout' });
    assert.equal(result.characters[0].ships.length, 1);
    assert.equal(result.characters[0].ships[0].id, 's-1');
  } finally {
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService mission methods add, replace, and list missions', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;

  const player = {
    characters: [{ id: 'c-1', missions: [] }],
    modifiedPaths: [],
    markModified(path) {
      this.modifiedPaths.push(path);
    },
    async save() {},
    toObject() {
      return { characters: this.characters };
    },
  };

  Player.findOne = async () => player;

  try {
    const added = await service.addOrUpdateMission('pilot', 'c-1', {
      missionId: 'm-1',
      status: 'available',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    assert.equal(added.characters[0].missions.length, 1);
    assert.equal(added.characters[0].missions[0].status, 'available');

    const replaced = await service.addOrUpdateMission('pilot', 'c-1', {
      missionId: 'm-1',
      status: 'accepted',
      updatedAt: '2026-05-02T00:00:00.000Z',
    });
    assert.equal(replaced.characters[0].missions.length, 1);
    assert.equal(replaced.characters[0].missions[0].status, 'accepted');
    assert.equal(player.modifiedPaths.length, 1);

    const missions = await service.getMissions('pilot', 'c-1');
    assert.equal(missions.length, 1);
    assert.equal(missions[0].missionId, 'm-1');

    const ships = await service.getShips('pilot', 'c-1');
    assert.deepEqual(ships, []);
  } finally {
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService celestial upsert requires id or composite key', async () => {
  const service = new DatabaseService();

  await assert.rejects(
    service.addOrUpdateCelestialBody({ missionId: 'm-1' }),
    /Celestial body upsert requires id or sourceScanId\+createdByCharacterId\+missionId/
  );
});

test('DatabaseService celestial upsert uses id query and returns document', async () => {
  const service = new DatabaseService();
  const originalFindOneAndUpdate = CelestialBody.findOneAndUpdate;

  let capturedQuery;
  let capturedOptions;
  CelestialBody.findOneAndUpdate = async (query, data, options) => {
    capturedQuery = query;
    capturedOptions = options;
    return {
      toObject() {
        return { ...data, persisted: true };
      },
    };
  };

  try {
    const result = await service.addOrUpdateCelestialBody({
      id: 'cb-1',
      solarSystemId: 'sol',
    });

    assert.deepEqual(capturedQuery, { id: 'cb-1' });
    assert.equal(capturedOptions.upsert, true);
    assert.equal(result.persisted, true);
  } finally {
    CelestialBody.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('DatabaseService clearAllPlayers clears all collections', async () => {
  const service = new DatabaseService();
  const originalPlayerDeleteMany = Player.deleteMany;
  const originalCelestialDeleteMany = CelestialBody.deleteMany;
  const originalItemDeleteMany = Item.deleteMany;

  const calls = [];
  Player.deleteMany = async () => {
    calls.push('player');
  };
  CelestialBody.deleteMany = async () => {
    calls.push('celestial');
  };
  Item.deleteMany = async () => {
    calls.push('item');
  };

  try {
    await service.clearAllPlayers();
    assert.deepEqual(calls, ['player', 'celestial', 'item']);
  } finally {
    Player.deleteMany = originalPlayerDeleteMany;
    CelestialBody.deleteMany = originalCelestialDeleteMany;
    Item.deleteMany = originalItemDeleteMany;
  }
});
