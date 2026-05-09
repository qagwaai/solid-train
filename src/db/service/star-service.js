'use strict';

/**
 * Read/write helpers for the stars collection (HYG-derived metadata).
 */

async function upsertStar(ctx, Star, starData) {
  if (!starData || typeof starData.hygId !== 'string' || !starData.hygId.trim()) {
    return null;
  }
  try {
    const persisted = await Star.findOneAndUpdate(
      { hygId: starData.hygId.trim() },
      { ...starData, hygId: starData.hygId.trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return persisted;
  } catch (error) {
    ctx.log(`[db-service] Error upserting star: ${error.message}`);
    throw error;
  }
}

async function upsertStars(ctx, Star, starsData) {
  if (!Array.isArray(starsData) || starsData.length === 0) return [];
  const results = [];
  for (const star of starsData) {
    const persisted = await upsertStar(ctx, Star, star);
    if (persisted) results.push(persisted);
  }
  return results;
}

async function getStarByHygId(ctx, Star, hygId) {
  const trimmed = ctx.toNonEmptyString(hygId);
  if (!trimmed) return null;
  try {
    return await Star.findOne({ hygId: trimmed }).lean();
  } catch (error) {
    ctx.log(`[db-service] Error fetching star by hygId: ${error.message}`);
    throw error;
  }
}

async function getStars(ctx, Star, query = {}) {
  try {
    const mongoQuery = {};
    const systemId = ctx.toNonEmptyString(query?.systemId);
    const spectralClass = ctx.toNonEmptyString(query?.spectralClass);
    if (systemId) mongoQuery.systemId = systemId;
    if (spectralClass) mongoQuery.spectralClass = spectralClass.toUpperCase();

    const limit =
      Number.isInteger(query?.limit) && query.limit > 0 ? Math.min(query.limit, 5000) : 0;

    let cursor = Star.find(mongoQuery);
    if (Number.isFinite(query?.maxDistanceParsec)) {
      cursor = cursor.where('distanceParsec').lte(query.maxDistanceParsec);
    }
    cursor = cursor.sort({ distanceParsec: 1 });
    if (limit) cursor = cursor.limit(limit);

    return await cursor.lean();
  } catch (error) {
    ctx.log(`[db-service] Error listing stars: ${error.message}`);
    throw error;
  }
}

module.exports = {
  upsertStar,
  upsertStars,
  getStarByHygId,
  getStars,
};
