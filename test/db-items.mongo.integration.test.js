'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { ITEM_STATE, ITEM_DAMAGE_STATUS } = require('../src/model/canonical-items');

let mongoHarness = null;

function createItem(overrides = {}) {
  return {
    id: overrides.id || 'item-1',
    itemType: overrides.itemType || 'iron',
    displayName: overrides.displayName || 'Iron',
    tier: overrides.tier !== undefined ? overrides.tier : 1,
    state: overrides.state || ITEM_STATE.CONTAINED,
    damageStatus: overrides.damageStatus || ITEM_DAMAGE_STATUS.INTACT,
    container: overrides.container || { containerType: 'ship', containerId: 'ship-1' },
    owningPlayerId: overrides.owningPlayerId || 'player-1',
    owningCharacterId: overrides.owningCharacterId || 'character-1',
    spatial: overrides.spatial || {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 100, y: 200, z: 300 },
      epochMs: 1713360000000,
    },
    ...(overrides.motion !== undefined
      ? { motion: overrides.motion }
      : {
          motion: {
            velocityKmPerSec: { x: 0, y: 0, z: 0 },
          },
        }),
    createdAt: overrides.createdAt || '2026-05-07T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-05-07T00:00:00.000Z',
    destroyedAt: overrides.destroyedAt || null,
    destroyedReason: overrides.destroyedReason || null,
    launchable: overrides.launchable !== undefined ? overrides.launchable : false,
    quantity: overrides.quantity !== undefined ? overrides.quantity : 2,
  };
}

test.before(async () => {
  mongoHarness = await createMongoTestHarness();
});

test.after(async () => {
  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

test.beforeEach(async () => {
  await mongoHarness.clearDatabase();
});

test('Items Mongo round-trip: add, read, query, update, and delete', async () => {
  const service = mongoHarness.databaseService;

  const inserted = await service.addItems([
    createItem({
      id: 'item-1',
      itemType: 'iron',
      tier: 10,
      quantity: 2,
      state: ITEM_STATE.DEPLOYED,
      container: null,
    }),
    createItem({
      id: 'item-2',
      itemType: 'copper',
      container: { containerType: 'ship', containerId: 'ship-2' },
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 1000, y: 1000, z: 1000 },
        epochMs: 1713360000000,
      },
      motion: {
        velocityKmPerSec: { x: 0, y: 0, z: 0 },
      },
    }),
  ]);
  assert.equal(inserted.length, 2);

  const byIds = await service.getItemsByIds(['item-1', 'item-2']);
  assert.equal(byIds.length, 2);
  assert.equal(byIds[0].tier, 10);

  const byContainer = await service.getItemsByContainer('ship', 'ship-1');
  assert.equal(byContainer.length, 1);
  assert.equal(byContainer[0].id, 'item-1');
  assert.equal(byContainer[0].tier, 10);

  const near = await service.findItemsNearPosition({
    solarSystemId: 'sol',
    positionKm: { x: 100, y: 200, z: 300 },
    distanceKm: 5,
  });
  assert.equal(near.length, 1);
  assert.equal(near[0].item.id, 'item-1');

  const updated = await service.updateItemById('item-1', {
    quantity: 7,
    updatedAt: '2026-05-07T00:10:00.000Z',
  });
  assert.equal(updated.quantity, 7);
  assert.equal(updated.tier, 10);

  await service.deleteItemsByIds(['item-1']);
  const afterDelete = await service.getItemsByIds(['item-1', 'item-2']);
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'item-2');
});

test('Items Mongo negative paths: empty IDs and invalid near query return empty', async () => {
  const service = mongoHarness.databaseService;

  assert.deepEqual(await service.getItemsByIds([]), []);
  assert.deepEqual(
    await service.findItemsNearPosition({
      solarSystemId: 'sol',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceKm: -1,
    }),
    []
  );
});
