'use strict';

const {
  MARKET_OWNER_STATE_KEY,
  SOLAR_SYSTEM_NPC_SEED_STATE_KEY,
} = require('../../model/solar-system-npc-seed');

function normalizeCredits(ctx, credits) {
  const current = credits?.current;
  const seeded = credits?.seeded;
  const min = credits?.variableRange?.min;
  const max = credits?.variableRange?.max;

  if (
    !ctx.isFiniteNumber(current) ||
    !ctx.isFiniteNumber(seeded) ||
    !ctx.isFiniteNumber(min) ||
    !ctx.isFiniteNumber(max)
  ) {
    return null;
  }

  return {
    current,
    seeded,
    variableRange: {
      min,
      max,
    },
  };
}

function normalizeOwnerRecord(ctx, ownerRecord) {
  const npcId = ctx.toNonEmptyString(ownerRecord?.npcId);
  const solarSystemId = ctx.toNonEmptyString(ownerRecord?.solarSystemId).toLowerCase();
  const marketId = ctx.toNonEmptyString(ownerRecord?.marketId);
  const marketName = ctx.toNonEmptyString(ownerRecord?.marketName);
  const locationName = ctx.toNonEmptyString(ownerRecord?.locationName);
  const name = ctx.toNonEmptyString(ownerRecord?.name);
  const seededAt = ctx.toNonEmptyString(ownerRecord?.seededAt);
  const updatedAt = ctx.toNonEmptyString(ownerRecord?.updatedAt || ownerRecord?.seededAt);
  const credits = normalizeCredits(ctx, ownerRecord?.credits);

  if (
    !npcId ||
    !solarSystemId ||
    !marketId ||
    !marketName ||
    !locationName ||
    !name ||
    !seededAt ||
    !updatedAt ||
    !credits
  ) {
    return null;
  }

  return {
    npcId,
    solarSystemId,
    marketId,
    marketName,
    locationName,
    name,
    credits,
    seededAt,
    updatedAt,
  };
}

function compareOwnerRecords(left, right) {
  return (
    left.solarSystemId.localeCompare(right.solarSystemId) ||
    left.marketId.localeCompare(right.marketId) ||
    left.npcId.localeCompare(right.npcId)
  );
}

async function getSolarSystemNpcSeedState(ctx, GameStateDocument, solarSystemId) {
  try {
    const normalizedSolarSystemId = ctx.toNonEmptyString(solarSystemId).toLowerCase();
    if (!normalizedSolarSystemId) {
      return null;
    }

    const state = await GameStateDocument.findOne({
      key: SOLAR_SYSTEM_NPC_SEED_STATE_KEY,
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
    ctx.log(`[db-service] Error fetching NPC seed state: ${error.message}`);
    throw error;
  }
}

async function setSolarSystemNpcSeedState(ctx, GameStateDocument, solarSystemId, seedVersion, seededAt) {
  try {
    const normalizedSolarSystemId = ctx.toNonEmptyString(solarSystemId).toLowerCase();
    const normalizedSeedVersion = ctx.toNonEmptyString(seedVersion);
    const normalizedSeededAt = ctx.toNonEmptyString(seededAt);

    if (!normalizedSolarSystemId || !normalizedSeedVersion || !normalizedSeededAt) {
      return null;
    }

    const state = await GameStateDocument.findOne({
      key: SOLAR_SYSTEM_NPC_SEED_STATE_KEY,
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

    return GameStateDocument.findOneAndUpdate(
      { key: SOLAR_SYSTEM_NPC_SEED_STATE_KEY },
      {
        key: SOLAR_SYSTEM_NPC_SEED_STATE_KEY,
        value: { systems: filtered },
        updatedAt: new Date(),
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }
    ).lean();
  } catch (error) {
    ctx.log(`[db-service] Error setting NPC seed state: ${error.message}`);
    throw error;
  }
}

async function getSeededNpcOwners(ctx, GameStateDocument, query = {}) {
  try {
    const normalizedSolarSystemId = ctx.toNonEmptyString(query?.solarSystemId).toLowerCase();
    const normalizedNpcId = ctx.toNonEmptyString(query?.npcId);
    const normalizedMarketId = ctx.toNonEmptyString(query?.marketId);

    const state = await GameStateDocument.findOne({ key: MARKET_OWNER_STATE_KEY }).lean();
    const owners = Array.isArray(state?.value?.owners)
      ? state.value.owners
          .map((entry) => normalizeOwnerRecord(ctx, entry))
          .filter((entry) => Boolean(entry))
      : [];

    return owners
      .filter((entry) => {
      if (normalizedSolarSystemId && entry.solarSystemId !== normalizedSolarSystemId) {
        return false;
      }

      if (normalizedNpcId && entry.npcId !== normalizedNpcId) {
        return false;
      }

      if (normalizedMarketId && entry.marketId !== normalizedMarketId) {
        return false;
      }

      return true;
      })
      .sort(compareOwnerRecords);
  } catch (error) {
    ctx.log(`[db-service] Error fetching seeded NPC owners: ${error.message}`);
    throw error;
  }
}

async function upsertSeededNpcOwner(ctx, GameStateDocument, ownerRecord) {
  try {
    const normalizedOwnerRecord = normalizeOwnerRecord(ctx, ownerRecord);
    if (!normalizedOwnerRecord) {
      return null;
    }

    const state = await GameStateDocument.findOne({ key: MARKET_OWNER_STATE_KEY });
    const owners = Array.isArray(state?.value?.owners)
      ? state.value.owners
          .map((entry) => normalizeOwnerRecord(ctx, entry))
          .filter((entry) => Boolean(entry))
      : [];

    const filtered = owners.filter((entry) => entry.npcId !== normalizedOwnerRecord.npcId);
    filtered.push(normalizedOwnerRecord);

    await GameStateDocument.findOneAndUpdate(
      { key: MARKET_OWNER_STATE_KEY },
      {
        key: MARKET_OWNER_STATE_KEY,
        value: { owners: filtered },
        updatedAt: new Date(),
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }
    );

    return normalizedOwnerRecord;
  } catch (error) {
    ctx.log(`[db-service] Error upserting seeded NPC owner: ${error.message}`);
    throw error;
  }
}

async function updateSeededNpcOwnerCredits(
  ctx,
  GameStateDocument,
  npcId,
  currentCredits,
  updatedAt
) {
  try {
    const normalizedNpcId = ctx.toNonEmptyString(npcId);
    const normalizedUpdatedAt = ctx.toNonEmptyString(updatedAt);

    if (!normalizedNpcId || !ctx.isFiniteNumber(currentCredits) || !normalizedUpdatedAt) {
      return null;
    }

    const state = await GameStateDocument.findOne({ key: MARKET_OWNER_STATE_KEY });
    const owners = Array.isArray(state?.value?.owners)
      ? state.value.owners
          .map((entry) => normalizeOwnerRecord(ctx, entry))
          .filter((entry) => Boolean(entry))
      : [];

    const existingOwner = owners.find((entry) => entry.npcId === normalizedNpcId);
    if (!existingOwner) {
      return null;
    }

    const minCredits = existingOwner.credits.variableRange.min;
    const maxCredits = existingOwner.credits.variableRange.max;
    const clampedCredits = Math.max(minCredits, Math.min(maxCredits, currentCredits));

    const updatedOwner = {
      ...existingOwner,
      credits: {
        ...existingOwner.credits,
        current: clampedCredits,
      },
      updatedAt: normalizedUpdatedAt,
    };

    const filtered = owners.filter((entry) => entry.npcId !== normalizedNpcId);
    filtered.push(updatedOwner);

    await GameStateDocument.findOneAndUpdate(
      { key: MARKET_OWNER_STATE_KEY },
      {
        key: MARKET_OWNER_STATE_KEY,
        value: { owners: filtered },
        updatedAt: new Date(),
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }
    );

    return updatedOwner;
  } catch (error) {
    ctx.log(`[db-service] Error updating seeded NPC owner credits: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getSolarSystemNpcSeedState,
  setSolarSystemNpcSeedState,
  getSeededNpcOwners,
  upsertSeededNpcOwner,
  updateSeededNpcOwnerCredits,
};