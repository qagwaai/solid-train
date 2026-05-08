'use strict';

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

async function updateItemById(ctx, Item, itemId, updates) {
  try {
    const result = await Item.findOneAndUpdate(
      { id: itemId },
      { $set: updates },
      { new: true }
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
