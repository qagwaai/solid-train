'use strict';

const {
  SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
  buildSeededCelestialBodiesForSolarSystem,
} = require('../../model/solar-system-celestial-seed');

async function seedSolarSystemCelestialBodiesAsync(ctx, request = {}) {
  const solarSystemId = ctx.toNonEmptyString(request?.solarSystemId).toLowerCase() || 'sol';
  const asOf = ctx.toNonEmptyString(request?.asOf) || ctx.getCurrentTimestamp();
  const force = Boolean(request?.force);
  const bodies = buildSeededCelestialBodiesForSolarSystem(solarSystemId, asOf);

  if (bodies.length === 0) {
    return {
      success: false,
      reason: 'UNSUPPORTED_SOLAR_SYSTEM',
      solarSystemId,
      bodyCount: 0,
    };
  }

  if (!ctx.databaseService) {
    for (const body of bodies) {
      const normalized = ctx.normalizeCelestialBody(body);
      ctx.celestialBodiesById.set(normalized.id, normalized);
    }
    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
      bodyCount: bodies.length,
      source: 'in-memory',
    };
  }

  try {
    const existingSeedState =
      await ctx.databaseService.getSolarSystemCelestialSeedState(solarSystemId);
    const isCurrentVersion =
      existingSeedState && existingSeedState.seedVersion === SOLAR_SYSTEM_CELESTIAL_SEED_VERSION;

    if (!force && isCurrentVersion) {
      const persisted = await ctx.databaseService.getCelestialBodies({ solarSystemId });
      if (Array.isArray(persisted) && persisted.length > 0) {
        for (const body of persisted) {
          const normalized = ctx.normalizeCelestialBody(body);
          ctx.celestialBodiesById.set(normalized.id, normalized);
        }
        return {
          success: true,
          solarSystemId,
          seedVersion: SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
          bodyCount: persisted.length,
          source: 'database-cache',
        };
      }
    }

    for (const body of bodies) {
      await ctx.databaseService.addOrUpdateCelestialBody(body);
    }

    await ctx.databaseService.setSolarSystemCelestialSeedState(
      solarSystemId,
      SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
      asOf
    );

    const persisted = await ctx.databaseService.getCelestialBodies({ solarSystemId });
    const toCache = persisted.length > 0 ? persisted : bodies;
    for (const body of toCache) {
      const normalized = ctx.normalizeCelestialBody(body);
      ctx.celestialBodiesById.set(normalized.id, normalized);
    }

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
      bodyCount: toCache.length,
      source: 'database-upsert',
    };
  } catch (error) {
    ctx.log(`[context] Error seeding solar system celestial bodies: ${error.message}`);

    for (const body of bodies) {
      const normalized = ctx.normalizeCelestialBody(body);
      ctx.celestialBodiesById.set(normalized.id, normalized);
    }

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
      bodyCount: bodies.length,
      source: 'in-memory-fallback',
    };
  }
}

function getCelestialBody(ctx, celestialBodyId) {
  const normalizedCelestialBodyId = ctx.toNonEmptyString(celestialBodyId);

  if (!normalizedCelestialBodyId) {
    return null;
  }

  return ctx.celestialBodiesById.get(normalizedCelestialBodyId) || null;
}

async function getCelestialBodyByIdAsync(ctx, celestialBodyId) {
  const normalizedCelestialBodyId = ctx.toNonEmptyString(celestialBodyId);
  if (!normalizedCelestialBodyId) {
    return null;
  }

  const cached = getCelestialBody(ctx, normalizedCelestialBodyId);
  if (cached) {
    return cached;
  }

  const celestialBody = await ctx.withDbOrNull(
    'fetching celestial body by id from DB',
    (databaseService) => databaseService.getCelestialBodyById(normalizedCelestialBodyId)
  );
  if (!celestialBody) {
    return null;
  }

  const normalized = ctx.normalizeCelestialBody(celestialBody);
  ctx.celestialBodiesById.set(normalized.id, normalized);
  return normalized;
}

async function getCelestialBodiesAsync(ctx, query = {}) {
  const normalizedSolarSystemId = ctx.toNonEmptyString(query?.solarSystemId);
  const normalizedCreatedByCharacterId = ctx.toNonEmptyString(query?.createdByCharacterId);
  const normalizedMissionId = ctx.toNonEmptyString(query?.missionId);
  const normalizedStateValues = Array.isArray(query?.stateValues)
    ? query.stateValues
        .map((stateValue) => ctx.toNonEmptyString(stateValue))
        .filter((stateValue) => Boolean(stateValue))
    : [];

  const cacheMatches = Array.from(ctx.celestialBodiesById.values())
    .map((celestialBody) => ctx.normalizeCelestialBody(celestialBody))
    .filter((celestialBody) => {
      if (
        normalizedSolarSystemId &&
        celestialBody.spatial?.solarSystemId !== normalizedSolarSystemId
      ) {
        return false;
      }

      if (
        normalizedCreatedByCharacterId &&
        celestialBody.createdByCharacterId !== normalizedCreatedByCharacterId
      ) {
        return false;
      }

      if (normalizedMissionId && celestialBody.missionId !== normalizedMissionId) {
        return false;
      }

      if (
        normalizedStateValues.length > 0 &&
        !normalizedStateValues.includes(celestialBody.state)
      ) {
        return false;
      }

      return true;
    });

  const fromDb = await ctx.withDbOrNull('fetching celestial bodies from DB', (databaseService) =>
    databaseService.getCelestialBodies({
      solarSystemId: normalizedSolarSystemId || undefined,
      createdByCharacterId: normalizedCreatedByCharacterId || undefined,
      missionId: normalizedMissionId || undefined,
      stateValues: normalizedStateValues.length > 0 ? normalizedStateValues : undefined,
    })
  );

  if (Array.isArray(fromDb)) {
    const mergedById = new Map();
    for (const celestialBody of cacheMatches) {
      mergedById.set(celestialBody.id, celestialBody);
    }

    for (const celestialBody of fromDb) {
      const normalizedCelestialBody = ctx.normalizeCelestialBody(celestialBody);
      ctx.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
      mergedById.set(normalizedCelestialBody.id, normalizedCelestialBody);
    }

    return [...mergedById.values()];
  }

  return cacheMatches;
}

async function deleteCelestialBodyByIdAsync(ctx, celestialBodyId) {
  const normalizedCelestialBodyId = ctx.toNonEmptyString(celestialBodyId);
  if (!normalizedCelestialBodyId) {
    return false;
  }

  await ctx.withDb('deleting celestial body in DB', (databaseService) =>
    databaseService.deleteCelestialBodyById(normalizedCelestialBodyId)
  );

  return ctx.celestialBodiesById.delete(normalizedCelestialBodyId);
}

async function addOrUpdateCelestialBodyAsync(ctx, celestialBody) {
  const normalizedCelestialBody = ctx.normalizeCelestialBody(celestialBody);

  await ctx.withDb('adding/updating celestial body in DB', (databaseService) =>
    databaseService.addOrUpdateCelestialBody(normalizedCelestialBody)
  );

  ctx.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
  return normalizedCelestialBody;
}

async function getCelestialBodiesNearPositionAsync(ctx, query) {
  const solarSystemId = ctx.toNonEmptyString(query?.solarSystemId);
  const positionKm = query?.positionKm;
  const distanceKm = query?.distanceKm;
  const createdByCharacterId = ctx.toNonEmptyString(query?.createdByCharacterId);
  const missionId = ctx.toNonEmptyString(query?.missionId);
  const stateValues = Array.isArray(query?.stateValues)
    ? query.stateValues
        .map((stateValue) => ctx.toNonEmptyString(stateValue))
        .filter((stateValue) => Boolean(stateValue))
    : [];
  const limit = query?.limit;

  if (
    !solarSystemId ||
    !ctx.isTriple(positionKm) ||
    !ctx.isFiniteNumber(distanceKm) ||
    distanceKm < 0
  ) {
    return [];
  }

  let results = [];

  const cacheResults = Array.from(ctx.celestialBodiesById.values())
    .map((celestialBody) => ctx.normalizeCelestialBody(celestialBody))
    .filter((celestialBody) => {
      if (celestialBody.spatial?.solarSystemId !== solarSystemId) {
        return false;
      }

      if (createdByCharacterId && celestialBody.createdByCharacterId !== createdByCharacterId) {
        return false;
      }

      if (missionId && celestialBody.missionId !== missionId) {
        return false;
      }

      if (stateValues.length > 0 && !stateValues.includes(celestialBody.state)) {
        return false;
      }

      return true;
    })
    .map((celestialBody) => {
      const legacyPositionKm = celestialBody?.location?.positionKm;
      const bodyPositionKm = celestialBody?.spatial?.positionKm || legacyPositionKm;
      if (!ctx.isTriple(bodyPositionKm)) {
        return null;
      }

      const candidateDistanceKm = ctx.calculateDistanceKm(positionKm, bodyPositionKm);
      if (candidateDistanceKm > distanceKm) {
        return null;
      }

      return {
        celestialBody,
        distanceKm: candidateDistanceKm,
      };
    })
    .filter((entry) => Boolean(entry));

  const fromDb = await ctx.withDbOrNull('finding celestial bodies from DB', (databaseService) =>
    databaseService.findCelestialBodiesNearPosition({
      solarSystemId,
      positionKm,
      distanceKm,
      createdByCharacterId: createdByCharacterId || undefined,
      missionId: missionId || undefined,
      stateValues: stateValues.length > 0 ? stateValues : undefined,
    })
  );

  if (Array.isArray(fromDb)) {
    const fromDbResults = fromDb.map((entry) => {
      const normalizedCelestialBody = ctx.normalizeCelestialBody(entry.celestialBody);
      ctx.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
      return {
        celestialBody: normalizedCelestialBody,
        distanceKm: entry.distanceKm,
      };
    });

    const mergedById = new Map();
    for (const entry of cacheResults) {
      mergedById.set(entry.celestialBody.id, entry);
    }
    for (const entry of fromDbResults) {
      mergedById.set(entry.celestialBody.id, entry);
    }

    results = [...mergedById.values()].sort((left, right) => left.distanceKm - right.distanceKm);
  } else {
    results = cacheResults.sort((left, right) => left.distanceKm - right.distanceKm);
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    return results;
  }

  return results.slice(0, limit);
}

module.exports = {
  seedSolarSystemCelestialBodiesAsync,
  getCelestialBody,
  getCelestialBodyByIdAsync,
  getCelestialBodiesAsync,
  deleteCelestialBodyByIdAsync,
  addOrUpdateCelestialBodyAsync,
  getCelestialBodiesNearPositionAsync,
};
