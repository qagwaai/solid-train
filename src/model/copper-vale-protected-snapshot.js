'use strict';

const { CelestialBody, Market, GameStateDocument } = require('../db/models');
const { createHash } = require('node:crypto');
const { sha256, SYSTEM_ID } = require('./copper-vale-seed-lifecycle');
const { COPPER_VALE_SEED_LIFECYCLE_STATE_KEY } = require('../db/service/copper-vale-seed-lifecycle-state-service');

// Raw BSON-backed document hashes include IDs, timestamps and unknown fields.
/**
 * @param {any} db
 * @param {{ addedMarketIds?: string[], journalKey?: string }} [options]
 */
async function protectedSnapshot(db, { addedMarketIds, journalKey } = {}) {
  /** @type {Map<string, any>} */
  const filters = new Map();
  filters.set(CelestialBody.collection.name, addedMarketIds ? {} : { 'spatial.solarSystemId': { $ne: SYSTEM_ID } });
  filters.set(Market.collection.name, addedMarketIds ? { marketId: { $nin: addedMarketIds } } : { solarSystemId: { $ne: SYSTEM_ID } });
  filters.set(GameStateDocument.collection.name, { key: { $ne: journalKey || COPPER_VALE_SEED_LIFECYCLE_STATE_KEY } });
  const snapshot = {};
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    const hashes = [];
    for await (const document of db.collection(name).find(filters.get(name) || {}, { raw: true }).sort({ _id: 1 })) {
      // Raw BSON includes numeric storage types, dates, IDs, unknown fields and
      // field order. Decoding/re-serializing would weaken byte-level evidence.
      if (!Buffer.isBuffer(document)) throw new Error(`Raw BSON snapshot unavailable for ${name}`);
      hashes.push(createHash('sha256').update(document).digest('hex'));
    }
    if (hashes.length) snapshot[name] = { count: hashes.length, sha256: sha256(hashes) };
  }
  return snapshot;
}

module.exports = { protectedSnapshot };
