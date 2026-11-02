'use strict';

/**
 * Fetch markets, optionally filtered by solar system.
 * @param {Object} ctx
 * @param {Object} Market
 * @param {{ solarSystemId?: string }} [query]
 * @returns {Promise<Object[]>}
 */
async function getMarkets(ctx, Market, query = {}) {
  try {
    const solarSystemId = ctx.toNonEmptyString(query?.solarSystemId);
    // Preserve legacy mixed-case system records rather than missing them and
    // accidentally inserting a second set during revision reconciliation.
    const escapedSystemId = solarSystemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mongoQuery = solarSystemId
      ? { solarSystemId: new RegExp(`^${escapedSystemId}$`, 'i') }
      : {};
    return await Market.find(mongoQuery).lean();
  } catch (error) {
    ctx.log(`[db-service] Error fetching markets: ${error.message}`);
    throw error;
  }
}

/**
 * Market counts for every solar system in one grouped query (D51).
 * @returns {Promise<Map<string, number>>} lowercase solarSystemId ? count
 */
async function getMarketCountsBySolarSystem(ctx, Market) {
  try {
    const rows = await Market.aggregate([
      { $group: { _id: { $toLower: '$solarSystemId' }, count: { $sum: 1 } } },
    ]);
    return new Map(rows.filter((row) => row._id).map((row) => [row._id, row.count]));
  } catch (error) {
    ctx.log(`[db-service] Error counting markets: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getMarketCountsBySolarSystem,
  getMarkets,
};
