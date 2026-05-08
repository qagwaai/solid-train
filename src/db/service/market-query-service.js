'use strict';

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
