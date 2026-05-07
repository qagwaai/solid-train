'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseService } = require('../src/db/service');
const { CelestialBody, Item, Player } = require('../src/db/models');

test('DatabaseService simple helpers normalize values and geometry', () => {
  const service = new DatabaseService();

  assert.equal(service.toNonEmptyString('  hello  '), 'hello');
  assert.equal(service.toNonEmptyString(123), '');
  assert.equal(service.escapeRegExp('a+b?c'), 'a\\+b\\?c');
  assert.equal(service.buildPlayerNameQuery('  OrbitFox  ').$or[0].playerNameNormalized, 'orbitfox');
  assert.equal(service.buildPlayerNameQuery('   '), null);
  assert.equal(service.isFiniteNumber(12.3), true);
  assert.equal(service.isFiniteNumber(Number.NaN), false);
  assert.equal(service.isTriple({ x: 1, y: 2, z: 3 }), true);
  assert.equal(service.isTriple({ x: 1, y: 2 }), false);
  assert.equal(service.calculateDistanceKm({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 }), 13);
});

test('DatabaseService getPlayerById forwards query and returns object or null', async () => {
  const service = new DatabaseService();
  const originalFindOne = Player.findOne;

  let capturedQuery;
  Player.findOne = async (query) => {
    capturedQuery = query;
    if (query.playerId === 'p-null') {
      return null;
    }

    return {
      toObject() {
        return { playerId: query.playerId, playerName: 'OrbitFox' };
      }
    };
  };

  try {
    const found = await service.getPlayerById('p-1');
    assert.deepEqual(capturedQuery, { playerId: 'p-1' });
    assert.equal(found.playerName, 'OrbitFox');

    const missing = await service.getPlayerById('p-null');
    assert.equal(missing, null);
  } finally {
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService add/get/delete character short-circuits invalid playerName', async () => {
  const service = new DatabaseService();
  const originalFindOneAndUpdate = Player.findOneAndUpdate;
  const originalFindOne = Player.findOne;

  let findOneAndUpdateCalls = 0;
  let findOneCalls = 0;
  Player.findOneAndUpdate = async () => {
    findOneAndUpdateCalls += 1;
    return null;
  };
  Player.findOne = async () => {
    findOneCalls += 1;
    return null;
  };

  try {
    assert.equal(await service.addCharacter('   ', { id: 'c-1' }), null);
    assert.deepEqual(await service.getCharacters('   '), []);
    assert.equal(await service.deleteCharacter('   ', 'c-1'), null);
    assert.equal(findOneAndUpdateCalls, 0);
    assert.equal(findOneCalls, 0);
  } finally {
    Player.findOneAndUpdate = originalFindOneAndUpdate;
    Player.findOne = originalFindOne;
  }
});

test('DatabaseService item methods handle empty inputs and basic queries', async () => {
  const service = new DatabaseService();
  const originalInsertMany = Item.insertMany;
  const originalDeleteMany = Item.deleteMany;
  const originalFind = Item.find;
  const originalFindOneAndUpdate = Item.findOneAndUpdate;

  let insertManyCalls = 0;
  let deleteManyCalls = 0;
  let findCalls = 0;
  let findQuery;
  let updateQuery;
  let updatePayload;

  Item.insertMany = async (items) => {
    insertManyCalls += 1;
    return items.map((item) => ({ toObject: () => item }));
  };
  Item.deleteMany = async () => {
    deleteManyCalls += 1;
  };
  Item.find = (query) => {
    findCalls += 1;
    findQuery = query;
    return {
      lean: async () => [{ id: 'i-1' }]
    };
  };
  Item.findOneAndUpdate = (query, payload) => {
    updateQuery = query;
    updatePayload = payload;
    return {
      lean: async () => ({ id: 'i-1', quantity: 2 })
    };
  };

  try {
    assert.deepEqual(await service.addItems([]), []);
    assert.equal(insertManyCalls, 0);

    const inserted = await service.addItems([{ id: 'i-1' }]);
    assert.equal(insertManyCalls, 1);
    assert.deepEqual(inserted, [{ id: 'i-1' }]);

    await service.deleteItemsByIds([]);
    assert.equal(deleteManyCalls, 0);

    await service.deleteItemsByIds(['i-1']);
    assert.equal(deleteManyCalls, 1);

    assert.deepEqual(await service.getItemsByIds([]), []);
    assert.equal(findCalls, 0);

    const byIds = await service.getItemsByIds(['i-1']);
    assert.equal(findCalls, 1);
    assert.deepEqual(findQuery, { id: { $in: ['i-1'] } });
    assert.deepEqual(byIds, [{ id: 'i-1' }]);

    const byContainer = await service.getItemsByContainer('ship', 'ship-1');
    assert.equal(findCalls, 2);
    assert.deepEqual(findQuery, {
      'container.containerType': 'ship',
      'container.containerId': 'ship-1'
    });
    assert.deepEqual(byContainer, [{ id: 'i-1' }]);

    const updated = await service.updateItemById('i-1', { quantity: 2 });
    assert.deepEqual(updateQuery, { id: 'i-1' });
    assert.deepEqual(updatePayload, { $set: { quantity: 2 } });
    assert.deepEqual(updated, { id: 'i-1', quantity: 2 });
  } finally {
    Item.insertMany = originalInsertMany;
    Item.deleteMany = originalDeleteMany;
    Item.find = originalFind;
    Item.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('DatabaseService celestial body methods cover invalid and filtered query paths', async () => {
  const service = new DatabaseService();
  const originalCelestialFind = CelestialBody.find;
  const originalCelestialFindOne = CelestialBody.findOne;
  const originalCelestialDeleteOne = CelestialBody.deleteOne;

  let capturedFindQuery;
  CelestialBody.find = (query) => {
    capturedFindQuery = query;
    return {
      lean: async () => [
        {
          id: 'cb-near',
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 3, y: 4, z: 0 }, epochMs: 0 },
          createdByCharacterId: 'char-1',
          missionId: 'm-1',
          state: 'active'
        },
        {
          id: 'cb-far',
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 100, y: 0, z: 0 }, epochMs: 0 },
          createdByCharacterId: 'char-1',
          missionId: 'm-1',
          state: 'active'
        }
      ]
    };
  };
  CelestialBody.findOne = (query) => ({
    lean: async () => (query.id === 'cb-1' ? { id: 'cb-1' } : null)
  });
  CelestialBody.deleteOne = async (query) => ({ deletedCount: query.id === 'cb-1' ? 1 : 0 });

  try {
    assert.deepEqual(await service.findCelestialBodiesNearPosition({}), []);

    const near = await service.findCelestialBodiesNearPosition({
      solarSystemId: 'sol',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceKm: 10,
      createdByCharacterId: 'char-1',
      missionId: 'm-1',
      stateValues: ['active']
    });
    assert.equal(near.length, 1);
    assert.equal(near[0].celestialBody.id, 'cb-near');
    assert.equal(capturedFindQuery['spatial.solarSystemId'], 'sol');
    assert.deepEqual(capturedFindQuery.state, { $in: ['active'] });

    const scoped = await service.getCelestialBodies({
      solarSystemId: 'sol',
      createdByCharacterId: 'char-1',
      missionId: 'm-1',
      stateValues: ['active']
    });
    assert.equal(scoped.length, 2);

    assert.equal(await service.getCelestialBodyById(''), null);
    assert.deepEqual(await service.getCelestialBodyById('cb-1'), { id: 'cb-1' });
    assert.equal(await service.getCelestialBodyById('missing'), null);

    assert.equal(await service.deleteCelestialBodyById(''), false);
    assert.equal(await service.deleteCelestialBodyById('cb-1'), true);
    assert.equal(await service.deleteCelestialBodyById('missing'), false);
  } finally {
    CelestialBody.find = originalCelestialFind;
    CelestialBody.findOne = originalCelestialFindOne;
    CelestialBody.deleteOne = originalCelestialDeleteOne;
  }
});

test('DatabaseService findItemsNearPosition filters candidates by exact spherical distance', async () => {
  const service = new DatabaseService();
  const originalItemFind = Item.find;

  let capturedQuery;
  Item.find = (query) => {
    capturedQuery = query;
    return {
      lean: async () => [
        {
          id: 'item-near',
          itemType: 'iron',
          kinematics: {
            position: { x: 6, y: 8, z: 0 },
            reference: { solarSystemId: 'sol' }
          }
        },
        {
          id: 'item-far',
          itemType: 'iron',
          kinematics: {
            position: { x: 40, y: 0, z: 0 },
            reference: { solarSystemId: 'sol' }
          }
        }
      ]
    };
  };

  try {
    assert.deepEqual(await service.findItemsNearPosition({}), []);

    const results = await service.findItemsNearPosition({
      solarSystemId: 'sol',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceKm: 10,
      itemType: 'iron'
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].item.id, 'item-near');
    assert.equal(results[0].distanceKm, 10);
    assert.equal(capturedQuery['kinematics.reference.solarSystemId'], 'sol');
    assert.equal(capturedQuery.itemType, 'iron');
  } finally {
    Item.find = originalItemFind;
  }
});
