'use strict';

const { normalizeStationPlacement } = require('../../model/station-placement');

async function validateStationPlacementHosts(CelestialBody, placement, solarSystemId) {
  if (!placement || !CelestialBody) {
    return;
  }
  const expectedSystemId = solarSystemId.trim().toLowerCase();
  const hostIds = [placement.primaryBodyId, placement.secondaryBodyId].filter(Boolean);
  if (
    placement.kind === 'lagrange-region' &&
    placement.primaryBodyId === placement.secondaryBodyId
  ) {
    throw Object.assign(
      new Error('Market stationPlacement Lagrange primary and secondary body IDs must differ'),
      { code: 'MARKET_PLACEMENT_HOST_INVALID' }
    );
  }

  for (const hostId of hostIds) {
    const host = await CelestialBody.findOne({ id: hostId }).lean();
    const hostSystemId = host?.spatial?.solarSystemId?.trim().toLowerCase();
    if (!host || hostSystemId !== expectedSystemId) {
      throw Object.assign(
        new Error(
          `Market stationPlacement host '${hostId}' is missing or not in solar system '${expectedSystemId}'`
        ),
        { code: 'MARKET_PLACEMENT_HOST_INVALID' }
      );
    }
    if (
      placement.kind === 'stellar-orbit' &&
      hostId === placement.primaryBodyId &&
      host.bodyType !== 'star'
    ) {
      throw Object.assign(
        new Error(`Market stationPlacement stellar primary '${hostId}' is not a star`),
        { code: 'MARKET_PLACEMENT_HOST_INVALID' }
      );
    }
  }
}

/**
 * Upsert a market by (marketId, solarSystemId).
 * @param {Object} ctx
 * @param {Object} Market
 * @param {Object} marketData
 * @returns {Promise<Object|null>}
 */
async function upsertMarket(ctx, Market, CelestialBody, marketData) {
  try {
    const marketId = ctx.toNonEmptyString(marketData?.marketId);
    const solarSystemId = ctx.toNonEmptyString(marketData?.solarSystemId);
    if (!marketId || !solarSystemId) {
      return null;
    }

    const writeData = { ...marketData };
    if (Object.prototype.hasOwnProperty.call(writeData, 'stationPlacement')) {
      const placement = normalizeStationPlacement(writeData.stationPlacement, writeData.trajectory);
      if (placement) {
        await validateStationPlacementHosts(CelestialBody, placement, solarSystemId);
        writeData.stationPlacement = placement;
      } else {
        delete writeData.stationPlacement;
      }
    }

    const persisted = await Market.findOneAndUpdate({ marketId, solarSystemId }, writeData, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
      runValidators: true,
    });

    return persisted ? persisted.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error upserting market: ${error.message}`);
    throw error;
  }
}

module.exports = {
  upsertMarket,
  validateStationPlacementHosts,
};
