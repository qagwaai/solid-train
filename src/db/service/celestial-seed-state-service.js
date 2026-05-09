'use strict';

const {
  SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY,
} = require('../../model/solar-system-celestial-seed');

/**
 * Retrieve persisted celestial body catalog seed state for a solar system.
 * @param {Object} ctx
 * @param {Object} GameStateDocument
 * @param {string} solarSystemId
 * @returns {Promise<{ solarSystemId: string, seedVersion: string, seededAt: string }|null>}
 */
async function getSolarSystemCelestialSeedState(ctx, GameStateDocument, solarSystemId) {
  try {
    const normalizedSolarSystemId = ctx.toNonEmptyString(solarSystemId).toLowerCase();
    if (!normalizedSolarSystemId) {
      return null;
    }

    const state = await GameStateDocument.findOne({
      key: SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY,
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
    ctx.log(`[db-service] Error fetching celestial seed state: ${error.message}`);
    throw error;
  }
}

/**
 * Persist celestial body catalog seed state for a solar system (replace-or-insert entry).
 * @param {Object} ctx
 * @param {Object} GameStateDocument
 * @param {string} solarSystemId
 * @param {string} seedVersion
 * @param {string} seededAt
 * @returns {Promise<Object|null>}
 */
async function setSolarSystemCelestialSeedState(
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
      key: SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY,
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
      { key: SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY },
      {
        key: SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY,
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
    ctx.log(`[db-service] Error setting celestial seed state: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getSolarSystemCelestialSeedState,
  setSolarSystemCelestialSeedState,
};
