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
    const mongoQuery = solarSystemId ? { solarSystemId } : {};
    return await Market.find(mongoQuery).lean();
  } catch (error) {
    ctx.log(`[db-service] Error fetching markets: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getMarkets,
};
