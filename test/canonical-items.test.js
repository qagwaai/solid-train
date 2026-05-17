const { describe, it } = require('node:test');
'use strict';

const assert = require('node:assert/strict');
const { ALL_ITEMS, getItemByType, craftableItems, rawMaterials } = require('../src/model/canonical-items');

describe('canonical-items.js', () => {
  it('should include all craftable items from the CSV', () => {
    // Spot check a few known craftable items
    const scavenger = getItemByType('scavenger-dart');
    assert(scavenger, 'scavenger-dart should exist');
    assert.equal(scavenger.displayName, 'Scavenger Dart');
    assert.equal(scavenger.category, 'Unit');
    assert(Array.isArray(scavenger.craftingRequirements));
    assert(scavenger.craftingRequirements.length > 0);
  });

  it('should include all raw materials from the CSV', () => {
    const carbon = getItemByType('carbon');
    assert(carbon, 'carbon should exist');
    assert.equal(carbon.displayName, 'Carbon');
    assert.equal(carbon.rarity, 'Common');
    assert.equal(carbon.miningRequirement, 'Basic Mining Laser (Tier 1)');
  });

  it('should include hull-patch-kit with required mission defaults', () => {
    const hullPatchKit = getItemByType('hull-patch-kit');
    assert(hullPatchKit, 'hull-patch-kit should exist');
    assert.equal(hullPatchKit.displayName, 'Hull Patch Kit');
    assert.equal(hullPatchKit.tier, 1);
    assert.equal(hullPatchKit.launchable, false);
    assert.equal(hullPatchKit.state, 'contained');
    assert.equal(hullPatchKit.damageStatus, 'intact');
    assert(Array.isArray(hullPatchKit.requiredMaterials));
    assert.equal(hullPatchKit.requiredMaterials.length, 1);
    assert.deepEqual(hullPatchKit.requiredMaterials[0], {
      material: 'Iron',
      quantity: 1,
      acceptedItemTypes: ['iron', 'iron-ore', 'iron-raw-material'],
    });
  });

  it('should return null for unknown itemType', () => {
    const unknown = getItemByType('not-a-real-item');
    assert.equal(unknown, null);
  });

  it('ALL_ITEMS should include all craftable and raw items', () => {
    for (const item of craftableItems) {
      assert(ALL_ITEMS.includes(item), `ALL_ITEMS missing craftable: ${item.itemType}`);
    }
    for (const item of rawMaterials) {
      assert(ALL_ITEMS.includes(item), `ALL_ITEMS missing raw: ${item.itemType}`);
    }
  });
});
