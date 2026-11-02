'use strict';

const {
  SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY,
} = require('../../model/solar-system-celestial-seed');

/**
 * Seed state lives in one game-state document per solar system (D48), keyed
 * `solar-system-celestial-seed-state:<solarSystemId>`, so seeding thousands of
 * exoplanet systems never rewrites one shared array.
 */
function seedStateKey(solarSystemId) {
  return `${SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY}:${solarSystemId}`;
}

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
      key: seedStateKey(normalizedSolarSystemId),
    }).lean();
    if (!state?.value) {
      return null;
    }

    return {
      solarSystemId: normalizedSolarSystemId,
      seedVersion: ctx.toNonEmptyString(state.value.seedVersion),
      seededAt: ctx.toNonEmptyString(state.value.seededAt),
    };
  } catch (error) {
    ctx.log(`[db-service] Error fetching celestial seed state: ${error.message}`);
    throw error;
  }
}

/**
 * Persist celestial body catalog seed state for a solar system.
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

    const key = seedStateKey(normalizedSolarSystemId);
    return await GameStateDocument.findOneAndUpdate(
      { key },
      {
        key,
        value: {
          solarSystemId: normalizedSolarSystemId,
          seedVersion: normalizedSeedVersion,
          seededAt: normalizedSeededAt,
        },
        updatedAt: new Date(),
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }
    ).lean();
  } catch (error) {
    ctx.log(`[db-service] Error setting celestial seed state: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getSolarSystemCelestialSeedState,
  seedStateKey,
  setSolarSystemCelestialSeedState,
};
