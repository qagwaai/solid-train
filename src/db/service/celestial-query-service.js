'use strict';

async function getCelestialBodyById(ctx, CelestialBody, celestialBodyId) {
  try {
    if (!celestialBodyId || typeof celestialBodyId !== 'string') {
      return null;
    }

    const celestialBody = await CelestialBody.findOne({ id: celestialBodyId.trim() }).lean();
    return celestialBody || null;
  } catch (error) {
    ctx.log(`[db-service] Error fetching celestial body by id: ${error.message}`);
    throw error;
  }
}

async function findCelestialBodiesNearPosition(ctx, CelestialBody, query) {
  const solarSystemId = typeof query?.solarSystemId === 'string'
    ? query.solarSystemId.trim()
    : '';
  const positionKm = query?.positionKm;
  const distanceKm = query?.distanceKm;
  const createdByCharacterId = typeof query?.createdByCharacterId === 'string'
    ? query.createdByCharacterId.trim()
    : '';
  const missionId = typeof query?.missionId === 'string'
    ? query.missionId.trim()
    : '';
  const stateValues = Array.isArray(query?.stateValues)
    ? query.stateValues
      .map((stateValue) => (typeof stateValue === 'string' ? stateValue.trim() : ''))
      .filter((stateValue) => Boolean(stateValue))
    : [];

  if (!solarSystemId || !ctx.isTriple(positionKm) || !ctx.isFiniteNumber(distanceKm) || distanceKm < 0) {
    return [];
  }

  try {
    const boundsQuery = {
      'spatial.solarSystemId': solarSystemId,
      'spatial.positionKm.x': {
        $gte: positionKm.x - distanceKm,
        $lte: positionKm.x + distanceKm
      },
      'spatial.positionKm.y': {
        $gte: positionKm.y - distanceKm,
        $lte: positionKm.y + distanceKm
      },
      'spatial.positionKm.z': {
        $gte: positionKm.z - distanceKm,
        $lte: positionKm.z + distanceKm
      }
    };

    if (createdByCharacterId) {
      boundsQuery.createdByCharacterId = createdByCharacterId;
    }

    if (missionId) {
      boundsQuery.missionId = missionId;
    }

    if (stateValues.length > 0) {
      boundsQuery.state = { $in: stateValues };
    }

    const candidates = await CelestialBody.find(boundsQuery).lean();

    return candidates
      .map((celestialBody) => {
        const bodyPositionKm = celestialBody?.spatial?.positionKm;
        if (!ctx.isTriple(bodyPositionKm)) {
          return null;
        }

        const candidateDistanceKm = ctx.calculateDistanceKm(positionKm, bodyPositionKm);
        if (candidateDistanceKm > distanceKm) {
          return null;
        }

        return {
          celestialBody,
          distanceKm: candidateDistanceKm
        };
      })
      .filter((entry) => Boolean(entry))
      .sort((left, right) => left.distanceKm - right.distanceKm);
  } catch (error) {
    ctx.log(`[db-service] Error finding celestial bodies near position: ${error.message}`);
    throw error;
  }
}

async function getCelestialBodies(ctx, CelestialBody, query = {}) {
  try {
    const mongoQuery = {};
    const solarSystemId = ctx.toNonEmptyString(query?.solarSystemId);
    const createdByCharacterId = ctx.toNonEmptyString(query?.createdByCharacterId);
    const missionId = ctx.toNonEmptyString(query?.missionId);
    const stateValues = Array.isArray(query?.stateValues)
      ? query.stateValues
        .map((stateValue) => ctx.toNonEmptyString(stateValue))
        .filter((stateValue) => Boolean(stateValue))
      : [];

    if (solarSystemId) {
      mongoQuery.solarSystemId = solarSystemId;
    }

    if (createdByCharacterId) {
      mongoQuery.createdByCharacterId = createdByCharacterId;
    }

    if (missionId) {
      mongoQuery.missionId = missionId;
    }

    if (stateValues.length > 0) {
      mongoQuery.state = { $in: stateValues };
    }

    return await CelestialBody.find(mongoQuery).lean();
  } catch (error) {
    ctx.log(`[db-service] Error fetching celestial bodies: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getCelestialBodyById,
  findCelestialBodiesNearPosition,
  getCelestialBodies
};
