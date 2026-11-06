'use strict';

const { normalizeAlias } = require('../../model/system-naming');
const { buildSolarSystemSearchTerms } = require('../../model/solar-system-search');

/**
 * Read/write helpers for the solar_systems collection.
 */

async function upsertSolarSystem(ctx, SolarSystem, systemData) {
  if (!systemData || typeof systemData.id !== 'string' || !systemData.id.trim()) {
    return null;
  }
  const id = systemData.id.trim().toLowerCase();
  const record = { ...systemData, id };
  try {
    const persisted = await SolarSystem.findOneAndUpdate(
      { id },
      { ...record, searchTerms: buildSolarSystemSearchTerms(record) },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
    return persisted;
  } catch (error) {
    ctx.log(`[db-service] Error upserting solar system: ${error.message}`);
    throw error;
  }
}

async function upsertSolarSystems(ctx, SolarSystem, systemsData) {
  if (!Array.isArray(systemsData) || systemsData.length === 0) return [];
  const results = [];
  for (const system of systemsData) {
    const persisted = await upsertSolarSystem(ctx, SolarSystem, system);
    if (persisted) results.push(persisted);
  }
  return results;
}

async function getSolarSystemById(ctx, SolarSystem, id) {
  const trimmed = ctx.toNonEmptyString(id).toLowerCase();
  if (!trimmed) return null;
  try {
    return await SolarSystem.findOne({ id: trimmed }).lean();
  } catch (error) {
    ctx.log(`[db-service] Error fetching solar system: ${error.message}`);
    throw error;
  }
}

async function getSolarSystems(ctx, SolarSystem, query = {}) {
  try {
    const mongoQuery = {};
    const source = ctx.toNonEmptyString(query?.source);
    if (source) mongoQuery.source = source;

    const search = ctx.toNonEmptyString(query?.search);
    if (search) {
      const normalizedSearch = normalizeAlias(search);
      if (normalizedSearch) {
        const escaped = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        mongoQuery.searchTerms = new RegExp(escaped);
      }
    }

    const limit =
      Number.isInteger(query?.limit) && query.limit > 0 ? Math.min(query.limit, 1000) : 0;
    let cursor = SolarSystem.find(mongoQuery).sort({ distanceParsec: 1, id: 1 });
    if (Number.isFinite(query?.maxDistanceParsec)) {
      cursor = cursor.where('distanceParsec').lte(query.maxDistanceParsec);
    }
    if (limit) cursor = cursor.limit(limit);

    return await cursor.lean();
  } catch (error) {
    ctx.log(`[db-service] Error listing solar systems: ${error.message}`);
    throw error;
  }
}

module.exports = {
  upsertSolarSystem,
  upsertSolarSystems,
  getSolarSystemById,
  getSolarSystems,
};
