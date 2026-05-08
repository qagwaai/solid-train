'use strict';

const { SOLAR_SYSTEM_MARKET_SEED_STATE_KEY } = require('../../model/solar-system-market-seed');

async function getSolarSystemMarketSeedState(ctx, GameStateDocument, solarSystemId) {
  try {
    const normalizedSolarSystemId = ctx.toNonEmptyString(solarSystemId).toLowerCase();
    if (!normalizedSolarSystemId) {
      return null;
    }

    const state = await GameStateDocument.findOne({
      key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY,
    }).lean();

    const systems = Array.isArray(state?.value?.systems) ? state.value.systems : [];
    const match = systems.find(
      (entry) =>
        ctx.toNonEmptyString(entry?.solarSystemId).toLowerCase() === normalizedSolarSystemId
    );

    if (!match) {
      return null;
    }

    return {
      solarSystemId: normalizedSolarSystemId,
      seedVersion: ctx.toNonEmptyString(match.seedVersion),
      seededAt: ctx.toNonEmptyString(match.seededAt),
    };
  } catch (error) {
    ctx.log(`[db-service] Error fetching market seed state: ${error.message}`);
    throw error;
  }
}

async function setSolarSystemMarketSeedState(
  ctx,
  GameStateDocument,
  solarSystemId,
  seedVersion,
  seededAt
) {
  try {
    const normalizedSolarSystemId = ctx.toNonEmptyString(solarSystemId).toLowerCase();
    const normalizedSeedVersion = ctx.toNonEmptyString(seedVersion);
    const normalizedSeededAt = ctx.toNonEmptyString(seededAt);

    if (!normalizedSolarSystemId || !normalizedSeedVersion || !normalizedSeededAt) {
      return null;
    }

    const state = await GameStateDocument.findOne({
      key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY,
    });

    const systems = Array.isArray(state?.value?.systems)
      ? state.value.systems.map((entry) => ({
          solarSystemId: ctx.toNonEmptyString(entry?.solarSystemId).toLowerCase(),
          seedVersion: ctx.toNonEmptyString(entry?.seedVersion),
          seededAt: ctx.toNonEmptyString(entry?.seededAt),
        }))
      : [];

    const filtered = systems.filter((entry) => entry.solarSystemId !== normalizedSolarSystemId);
    filtered.push({
      solarSystemId: normalizedSolarSystemId,
      seedVersion: normalizedSeedVersion,
      seededAt: normalizedSeededAt,
    });

    const persisted = await GameStateDocument.findOneAndUpdate(
      { key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY },
      {
        key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY,
        value: { systems: filtered },
        updatedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return persisted;
  } catch (error) {
    ctx.log(`[db-service] Error setting market seed state: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getSolarSystemMarketSeedState,
  setSolarSystemMarketSeedState,
};
