'use strict';

const { createHash } = require('node:crypto');

const BULK_WRITE_BATCH_SIZE = 1000;

/**
 * Replace a reference collection (stars, solar_systems) with the in-memory
 * catalog in bulk (D49). A content hash stored in a game-state document skips
 * the write entirely when the catalog has not changed since the last startup.
 *
 * @param {Object} ctx
 * @param {Object} Model - Mongoose model for the collection
 * @param {Object} GameStateDocument
 * @param {Object} options
 * @param {string} options.stateKey - game-state key holding the last synced hash
 * @param {string} options.keyField - unique key field (for example 'starId' or 'id')
 * @param {Object[]} options.records
 * @returns {Promise<{ skipped: boolean, hash: string, upserted: number, removed: number }>}
 */
async function syncCatalogCollection(ctx, Model, GameStateDocument, options) {
  const { stateKey, keyField, records } = options;
  const valid = (Array.isArray(records) ? records : []).filter(
    (record) => typeof record?.[keyField] === 'string' && record[keyField].trim()
  );
  const hash = createHash('sha256').update(JSON.stringify(valid)).digest('hex');
  try {
    const state = await GameStateDocument.findOne({ key: stateKey }).lean();
    if (state?.value?.hash === hash) {
      return { skipped: true, hash, upserted: 0, removed: 0 };
    }

    let upserted = 0;
    for (let offset = 0; offset < valid.length; offset += BULK_WRITE_BATCH_SIZE) {
      const batch = valid.slice(offset, offset + BULK_WRITE_BATCH_SIZE);
      await Model.bulkWrite(
        batch.map((record) => ({
          replaceOne: {
            filter: { [keyField]: record[keyField] },
            replacement: record,
            upsert: true,
          },
        })),
        { ordered: false }
      );
      upserted += batch.length;
    }
    const removal = await Model.deleteMany({
      [keyField]: { $nin: valid.map((record) => record[keyField]) },
    });

    await GameStateDocument.findOneAndUpdate(
      { key: stateKey },
      {
        key: stateKey,
        value: { hash, recordCount: valid.length, syncedAt: new Date().toISOString() },
        updatedAt: new Date(),
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    return { skipped: false, hash, upserted, removed: removal?.deletedCount || 0 };
  } catch (error) {
    ctx.log(`[db-service] Error syncing ${stateKey}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  BULK_WRITE_BATCH_SIZE,
  syncCatalogCollection,
};
