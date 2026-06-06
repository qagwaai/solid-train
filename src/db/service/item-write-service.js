'use strict';

/**
 * Write operations for globally persisted items.
 */

/**
 * Insert one or more item documents.
 * @param {Object} ctx
 * @param {Object} Item
 * @param {Object[]} itemsData
 * @returns {Promise<Object[]>}
 */
async function addItems(ctx, Item, itemsData) {
  try {
    if (!Array.isArray(itemsData) || itemsData.length === 0) {
      return [];
    }

    const items = await Item.insertMany(itemsData, { ordered: true });
    return items.map((item) => item.toObject());
  } catch (error) {
    ctx.log(`[db-service] Error adding items: ${error.message}`);
    throw error;
  }
}

/**
 * Delete items by logical ids.
 * @param {Object} ctx
 * @param {Object} Item
 * @param {string[]} itemIds
 * @returns {Promise<void>}
 */
async function deleteItemsByIds(ctx, Item, itemIds) {
  try {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return;
    }

    await Item.deleteMany({ id: { $in: itemIds } });
  } catch (error) {
    ctx.log(`[db-service] Error deleting items: ${error.message}`);
    throw error;
  }
}

/**
 * Update one item by logical id.
 * @param {Object} ctx
 * @param {Object} Item
 * @param {string} itemId
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
async function updateItemById(ctx, Item, itemId, updates) {
  try {
    const result = await Item.findOneAndUpdate(
      { id: itemId },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean();

    return result;
  } catch (error) {
    ctx.log(`[db-service] Error updating item: ${error.message}`);
    throw error;
  }
}

module.exports = {
  addItems,
  deleteItemsByIds,
  updateItemById,
};
