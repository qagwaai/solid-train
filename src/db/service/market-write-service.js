'use strict';

async function upsertMarket(ctx, Market, marketData) {
  try {
    const marketId = ctx.toNonEmptyString(marketData?.marketId);
    const solarSystemId = ctx.toNonEmptyString(marketData?.solarSystemId);
    if (!marketId || !solarSystemId) {
      return null;
    }

    const persisted = await Market.findOneAndUpdate(
      { marketId, solarSystemId },
      marketData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return persisted ? persisted.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error upserting market: ${error.message}`);
    throw error;
  }
}

module.exports = {
  upsertMarket
};
