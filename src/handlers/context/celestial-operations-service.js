'use strict';

const {
  buildSeededCelestialBodiesForSolarSystem,
  getSolarSystemCelestialSeedVersion,
} = require('../../model/solar-system-celestial-seed');
const {
  assertCatalogIdentityAssignments,
  CatalogIdentityError,
} = require('../../model/catalog-identity');
const { assertUniverseRelationships } = require('../../model/celestial-universe-metadata');
const {
  mergeCelestialSeed,
  assertUniverseTransition,
} = require('../../model/celestial-seed-ownership');

const CATALOG_PERSISTENCE_BATCH_SIZE = 50;

function assertNonSolSeedReadback(solarSystemId, expected, persisted) {
  if (solarSystemId === 'sol') return;
  const persistedIds = new Set(persisted.map((body) => body.id));
  if (expected.some((body) => !persistedIds.has(body.id))) {
    throw new Error('Non-Sol seed readback is missing expected durable bodies');
  }
}

async function seedSolarSystemCelestialBodiesAsync(ctx, request = {}) {
  const solarSystemId = ctx.toNonEmptyString(request?.solarSystemId).toLowerCase() || 'sol';
  const asOf = ctx.toNonEmptyString(request?.asOf) || ctx.getCurrentTimestamp();
  const force = Boolean(request?.force);
  const seedVersion = getSolarSystemCelestialSeedVersion(solarSystemId);
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
    try {
      const updates = [];
      for (const body of bodies) {
        if (!force && ctx.celestialBodiesById.has(body.id)) continue;
        const ownedBody =
          solarSystemId === 'sol'
            ? body
            : mergeCelestialSeed(ctx.celestialBodiesById.get(body.id), body);
        updates.push(ctx.normalizeCelestialBody(ownedBody));
      }
      for (const normalized of updates) ctx.celestialBodiesById.set(normalized.id, normalized);
    } catch (error) {
      ctx.log(`[context] Error applying celestial seed ownership: ${error.message}`);
      throw error;
    }
    return {
      success: true,
      solarSystemId,
      seedVersion,
      bodyCount: bodies.length,
      source: 'in-memory',
    };
  }

  try {
    const existingSeedState =
      await ctx.databaseService.getSolarSystemCelestialSeedState(solarSystemId);
    const isCurrentVersion = existingSeedState && existingSeedState.seedVersion === seedVersion;

    if (!force && isCurrentVersion) {
      const persisted = await ctx.databaseService.getCelestialBodies({ solarSystemId });
      if (Array.isArray(persisted) && persisted.length > 0) {
        assertNonSolSeedReadback(solarSystemId, bodies, persisted);
        const normalizedBodies = persisted.map((body) => ctx.normalizeCelestialBody(body));
        // Clear any stale entries for this system before caching fresh data
        for (const [key, value] of ctx.celestialBodiesById.entries()) {
          if (value.spatial?.solarSystemId === solarSystemId) {
            ctx.celestialBodiesById.delete(key);
          }
        }

        for (const normalized of normalizedBodies) {
          ctx.celestialBodiesById.set(normalized.id, normalized);
        }
        return {
          success: true,
          solarSystemId,
          seedVersion,
          bodyCount: persisted.length,
          source: 'database-cache',
        };
      }
    }

    for (let offset = 0; offset < bodies.length; offset += CATALOG_PERSISTENCE_BATCH_SIZE) {
      const batch = bodies.slice(offset, offset + CATALOG_PERSISTENCE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((body) =>
          ctx.databaseService.addOrUpdateCelestialBody(body, {
            preserveGameplay: solarSystemId !== 'sol',
          })
        )
      );
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
      if (results.some((result) => result.status === 'fulfilled' && !result.value?.id)) {
        throw new Error('Celestial seed persistence returned no durable body');
      }
    }

    const persisted = await ctx.databaseService.getCelestialBodies({ solarSystemId });
    assertNonSolSeedReadback(solarSystemId, bodies, persisted);
    const toCache = persisted.length > 0 ? persisted : bodies;
    const normalizedBodies = toCache.map((body) => ctx.normalizeCelestialBody(body));
    await ctx.databaseService.setSolarSystemCelestialSeedState(solarSystemId, seedVersion, asOf);

    // Clear any stale entries for this system before caching fresh data
    for (const [key, value] of ctx.celestialBodiesById.entries()) {
      if (value.spatial?.solarSystemId === solarSystemId) {
        ctx.celestialBodiesById.delete(key);
      }
    }

    for (const normalized of normalizedBodies) {
      ctx.celestialBodiesById.set(normalized.id, normalized);
    }

    return {
      success: true,
      solarSystemId,
      seedVersion,
      bodyCount: toCache.length,
      source: 'database-upsert',
    };
  } catch (error) {
    ctx.log(`[context] Error seeding solar system celestial bodies: ${error.message}`);
    if (error instanceof CatalogIdentityError) throw error;
    if (solarSystemId !== 'sol') {
      return {
        success: false,
        reason: 'CELESTIAL_SEED_FAILED',
        message: error.message,
        solarSystemId,
        seedVersion,
        bodyCount: 0,
        source: 'database-error',
      };
    }

    // Clear any stale entries for this system before caching fresh data
    for (const [key, value] of ctx.celestialBodiesById.entries()) {
      if (value.spatial?.solarSystemId === solarSystemId) {
        ctx.celestialBodiesById.delete(key);
      }
    }

    for (const body of bodies) {
      const normalized = ctx.normalizeCelestialBody(body);
      ctx.celestialBodiesById.set(normalized.id, normalized);
    }

    return {
      success: true,
      solarSystemId,
      seedVersion,
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

function countBy(values, keyOf) {
  const counts = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * Live per-system counts for solar-system-list (D51, D55): markets and
 * asteroids (catalog plus character discoveries), each from one grouped DB
 * query, or from the in-memory caches when no database is configured.
 * @returns {Promise<{ marketCounts: Map<string, number>, asteroidCounts: Map<string, number> }>}
 */
async function getSolarSystemLiveCountsAsync(ctx) {
  const fromDb = await ctx.withDbOrNull(
    'counting solar system markets and asteroids',
    async (db) =>
      typeof db.getMarketCountsBySolarSystem === 'function' &&
      typeof db.getCelestialBodyCountsBySolarSystem === 'function'
        ? {
            marketCounts: await db.getMarketCountsBySolarSystem(),
            asteroidCounts: await db.getCelestialBodyCountsBySolarSystem('asteroid'),
          }
        : null
  );
  if (fromDb) {
    return fromDb;
  }
  return {
    marketCounts: countBy(ctx.marketsByKey.values(), (market) =>
      ctx.toNonEmptyString(market?.solarSystemId).toLowerCase()
    ),
    asteroidCounts: countBy(ctx.celestialBodiesById.values(), (body) =>
      body?.bodyType === 'asteroid' ? body.spatial?.solarSystemId : null
    ),
  };
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

    const results = [...mergedById.values()];

    // Safety check: log if duplicates are somehow still present
    const seenIds = new Set();
    const duplicates = [];
    for (const result of results) {
      if (seenIds.has(result.id)) {
        duplicates.push(result.id);
      } else {
        seenIds.add(result.id);
      }
    }
    if (duplicates.length > 0) {
      ctx.log(
        `[celestial-operations] WARNING: getCelestialBodiesAsync returned duplicate IDs: ${duplicates.join(', ')}`
      );
    }

    return results;
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
  const previous = ctx.celestialBodiesById.get(celestialBody.id);
  if (celestialBody.catalogIdentity === undefined && previous?.catalogIdentity !== undefined) {
    celestialBody = { ...celestialBody, catalogIdentity: previous.catalogIdentity };
  }
  if (celestialBody.universeMetadata === undefined && previous?.universeMetadata) {
    celestialBody = { ...celestialBody, universeMetadata: previous.universeMetadata };
  }
  const normalizedCelestialBody = ctx.normalizeCelestialBody(celestialBody);
  assertUniverseTransition(previous, normalizedCelestialBody);
  assertCatalogIdentityAssignments([
    ...Array.from(ctx.celestialBodiesById.values()).filter(
      (body) => body.id !== normalizedCelestialBody.id
    ),
    normalizedCelestialBody,
  ]);
  if (normalizedCelestialBody.universeMetadata && !ctx.databaseService) {
    assertUniverseRelationships([
      ...Array.from(ctx.celestialBodiesById.values()).filter(
        (body) => body.id !== normalizedCelestialBody.id
      ),
      normalizedCelestialBody,
    ]);
  }

  const persisted = await ctx.withDb('adding/updating celestial body in DB', (databaseService) =>
    databaseService.addOrUpdateCelestialBody(normalizedCelestialBody)
  );
  if (ctx.databaseService && !persisted?.id) {
    ctx.log('[context] Celestial body persistence returned no durable body');
    throw new Error('Celestial body persistence returned no durable body');
  }

  const result = persisted ? ctx.normalizeCelestialBody(persisted) : normalizedCelestialBody;
  ctx.celestialBodiesById.set(result.id, result);
  return result;
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

  let results;

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
  getSolarSystemLiveCountsAsync,
};
