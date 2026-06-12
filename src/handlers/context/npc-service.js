'use strict';

const {
  SOLAR_SYSTEM_NPC_SEED_VERSION,
  buildSeededNpcsForSolarSystem,
} = require('../../model/solar-system-npc-seed');

function cacheSeededNpcBust(ctx, seededNpc) {
  const normalizedNpcId = ctx.toNonEmptyString(seededNpc?.npcId);
  if (!normalizedNpcId) {
    return;
  }

  ctx.npcBustsById.set(normalizedNpcId, {
    npcId: normalizedNpcId,
    deterministicSeed: seededNpc.deterministicSeed,
    descriptor: seededNpc.descriptor,
    appliedOverrides: Array.isArray(seededNpc.appliedOverrides) ? seededNpc.appliedOverrides : [],
  });
}

function cacheSeededNpcOwner(ctx, ownerRecord) {
  const normalizedNpcId = ctx.toNonEmptyString(ownerRecord?.npcId);
  const normalizedSolarSystemId = ctx.toNonEmptyString(ownerRecord?.solarSystemId).toLowerCase();
  const normalizedMarketId = ctx.toNonEmptyString(ownerRecord?.marketId);
  if (!normalizedNpcId || !normalizedSolarSystemId || !normalizedMarketId) {
    return null;
  }

  const credits = ownerRecord?.credits;
  if (
    !ctx.isFiniteNumber(credits?.current) ||
    !ctx.isFiniteNumber(credits?.seeded) ||
    !ctx.isFiniteNumber(credits?.variableRange?.min) ||
    !ctx.isFiniteNumber(credits?.variableRange?.max)
  ) {
    return null;
  }

  const cached = {
    npcId: normalizedNpcId,
    solarSystemId: normalizedSolarSystemId,
    marketId: normalizedMarketId,
    marketName: ctx.toNonEmptyString(ownerRecord?.marketName),
    locationName: ctx.toNonEmptyString(ownerRecord?.locationName),
    name: ctx.toNonEmptyString(ownerRecord?.name),
    credits: {
      current: credits.current,
      seeded: credits.seeded,
      variableRange: {
        min: credits.variableRange.min,
        max: credits.variableRange.max,
      },
    },
    seededAt: ctx.toNonEmptyString(ownerRecord?.seededAt),
    updatedAt: ctx.toNonEmptyString(ownerRecord?.updatedAt || ownerRecord?.seededAt),
  };

  ctx.seededNpcOwnersById.set(normalizedNpcId, cached);
  return cached;
}

function getSeededNpcOwner(ctx, npcId) {
  const normalizedNpcId = ctx.toNonEmptyString(npcId);
  if (!normalizedNpcId) {
    return null;
  }

  return ctx.seededNpcOwnersById.get(normalizedNpcId) || null;
}

function compareOwnerRecords(left, right) {
  return (
    left.solarSystemId.localeCompare(right.solarSystemId) ||
    left.marketId.localeCompare(right.marketId) ||
    left.npcId.localeCompare(right.npcId)
  );
}

async function getSeededNpcOwnersAsync(ctx, query = {}) {
  const normalizedSolarSystemId = ctx.toNonEmptyString(query?.solarSystemId).toLowerCase();
  const normalizedNpcId = ctx.toNonEmptyString(query?.npcId);
  const normalizedMarketId = ctx.toNonEmptyString(query?.marketId);

  if (ctx.databaseService?.getSeededNpcOwners) {
    const owners = await ctx.databaseService.getSeededNpcOwners({
      solarSystemId: normalizedSolarSystemId,
      npcId: normalizedNpcId,
      marketId: normalizedMarketId,
    });

    const filtered = owners
      .map((owner) => cacheSeededNpcOwner(ctx, owner))
      .filter((owner) => Boolean(owner))
      .sort(compareOwnerRecords);

    if (filtered.length > 0 || normalizedNpcId || normalizedSolarSystemId || normalizedMarketId) {
      return filtered;
    }
  }

  return Array.from(ctx.seededNpcOwnersById.values())
    .filter((owner) => {
      if (normalizedSolarSystemId && owner.solarSystemId !== normalizedSolarSystemId) {
        return false;
      }
      if (normalizedNpcId && owner.npcId !== normalizedNpcId) {
        return false;
      }
      if (normalizedMarketId && owner.marketId !== normalizedMarketId) {
        return false;
      }
      return true;
    })
    .sort(compareOwnerRecords);
}

async function getSolarSystemNpcSeedSummaryAsync(ctx, solarSystemId = '') {
  const normalizedSolarSystemId = ctx.toNonEmptyString(solarSystemId).toLowerCase();
  const owners = await getSeededNpcOwnersAsync(ctx, {
    solarSystemId: normalizedSolarSystemId,
  });

  return {
    solarSystemId: normalizedSolarSystemId,
    npcCount: owners.length,
    seededNpcIds: owners.map((owner) => owner.npcId),
    seededOwners: owners.map((owner) => ({
      npcId: owner.npcId,
      solarSystemId: owner.solarSystemId,
      marketId: owner.marketId,
      marketName: owner.marketName,
      locationName: owner.locationName,
      name: owner.name,
      credits: { ...owner.credits },
      seededAt: owner.seededAt,
      updatedAt: owner.updatedAt,
    })),
  };
}

async function getMarketOwnerAsync(ctx, marketId, solarSystemId = '') {
  const owners = await getSeededNpcOwnersAsync(ctx, {
    marketId,
    solarSystemId,
  });

  return owners[0] || null;
}

async function buildSeededNpcProfile(ctx, owner) {
  if (!owner) {
    return null;
  }

  const bust = await ctx.getNpcBustAsync(owner.npcId);
  return {
    ...owner,
    bust: bust
      ? {
          npcId: bust.npcId,
          deterministicSeed: bust.deterministicSeed,
          descriptor: bust.descriptor,
          appliedOverrides: Array.isArray(bust.appliedOverrides) ? bust.appliedOverrides : [],
        }
      : null,
  };
}

async function getSeededNpcProfilesAsync(ctx, query = {}) {
  const owners = await getSeededNpcOwnersAsync(ctx, query);

  return Promise.all(owners.map((owner) => buildSeededNpcProfile(ctx, owner)));
}

async function getSeededNpcProfilesWithOwnedMarketsAsync(ctx, query = {}) {
  const profiles = await getSeededNpcProfilesAsync(ctx, query);

  return Promise.all(
    profiles.map(async (profile) => ({
      ...profile,
      ownedMarkets: await getNpcOwnedMarketsAsync(ctx, profile.npcId),
    }))
  );
}

async function getNpcOwnedMarketsAsync(ctx, npcId) {
  const profiles = await getSeededNpcProfilesAsync(ctx, { npcId });
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return [];
  }

  return Promise.all(
    profiles.map(async (profile) => {
      if (typeof ctx.getMarketWithOwnerProfileAsync === 'function') {
        return ctx.getMarketWithOwnerProfileAsync(profile.marketId, profile.solarSystemId);
      }

      const market = typeof ctx.getMarket === 'function'
        ? ctx.getMarket(profile.marketId, profile.solarSystemId)
        : null;

      return market
        ? {
            ...market,
            owner: profile,
          }
        : null;
    })
  ).then((markets) => markets.filter((market) => Boolean(market)));
}

async function getSeededNpcCreditsAsync(ctx, npcId) {
  const profile = await getSeededNpcProfileAsync(ctx, npcId);
  return profile ? { ...profile.credits } : null;
}

async function getMarketOwnerCreditsAsync(ctx, marketId, solarSystemId = '') {
  const profile = await getMarketOwnerProfileAsync(ctx, marketId, solarSystemId);
  return profile ? { ...profile.credits } : null;
}

async function updateSeededNpcCreditsAsync(ctx, npcId, currentCredits, updatedAt = '') {
  const normalizedNpcId = ctx.toNonEmptyString(npcId);
  const timestamp = ctx.toNonEmptyString(updatedAt) || ctx.getCurrentTimestamp();
  if (!normalizedNpcId || !ctx.isFiniteNumber(currentCredits)) {
    return null;
  }

  const existingOwner = await getSeededNpcProfileAsync(ctx, normalizedNpcId);
  if (!existingOwner) {
    return null;
  }

  const minCredits = existingOwner.credits.variableRange.min;
  const maxCredits = existingOwner.credits.variableRange.max;
  const clampedCredits = Math.max(minCredits, Math.min(maxCredits, currentCredits));

  const nextOwnerRecord = {
    ...existingOwner,
    credits: {
      ...existingOwner.credits,
      current: clampedCredits,
    },
    updatedAt: timestamp,
  };

  cacheSeededNpcOwner(ctx, nextOwnerRecord);

  if (!ctx.databaseService?.updateSeededNpcOwnerCredits) {
    return buildSeededNpcProfile(ctx, nextOwnerRecord);
  }

  const persisted = await ctx.databaseService.updateSeededNpcOwnerCredits(
    normalizedNpcId,
    clampedCredits,
    timestamp
  );

  if (!persisted) {
    return null;
  }

  cacheSeededNpcOwner(ctx, persisted);
  return buildSeededNpcProfile(ctx, persisted);
}

async function adjustSeededNpcCreditsAsync(ctx, npcId, creditDelta, updatedAt = '') {
  const normalizedNpcId = ctx.toNonEmptyString(npcId);
  const timestamp = ctx.toNonEmptyString(updatedAt) || ctx.getCurrentTimestamp();
  if (!normalizedNpcId || !ctx.isFiniteNumber(creditDelta)) {
    return null;
  }

  const existingOwner = await getSeededNpcProfileAsync(ctx, normalizedNpcId);
  if (!existingOwner) {
    return null;
  }

  return updateSeededNpcCreditsAsync(
    ctx,
    normalizedNpcId,
    existingOwner.credits.current + creditDelta,
    timestamp
  );
}

async function updateMarketOwnerCreditsAsync(
  ctx,
  marketId,
  solarSystemId,
  currentCredits,
  updatedAt = ''
) {
  const owner = await getMarketOwnerAsync(ctx, marketId, solarSystemId);
  if (!owner) {
    return null;
  }

  return updateSeededNpcCreditsAsync(ctx, owner.npcId, currentCredits, updatedAt);
}

async function adjustMarketOwnerCreditsAsync(
  ctx,
  marketId,
  solarSystemId,
  creditDelta,
  updatedAt = ''
) {
  const owner = await getMarketOwnerAsync(ctx, marketId, solarSystemId);
  if (!owner) {
    return null;
  }

  return adjustSeededNpcCreditsAsync(ctx, owner.npcId, creditDelta, updatedAt);
}

async function getSeededNpcProfileAsync(ctx, npcId) {
  const profiles = await getSeededNpcProfilesAsync(ctx, { npcId });
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return null;
  }

  return profiles[0];
}

async function getMarketOwnerProfileAsync(ctx, marketId, solarSystemId = '') {
  const owner = await getMarketOwnerAsync(ctx, marketId, solarSystemId);
  if (!owner) {
    return null;
  }

  return getSeededNpcProfileAsync(ctx, owner.npcId);
}

function buildOwnerRecord(seededNpc, timestamp) {
  return {
    npcId: seededNpc.npcId,
    solarSystemId: seededNpc.solarSystemId,
    marketId: seededNpc.marketId,
    marketName: seededNpc.marketName,
    locationName: seededNpc.locationName,
    name: seededNpc.name,
    credits: seededNpc.credits,
    seededAt: seededNpc.seededAt || timestamp,
    updatedAt: timestamp,
  };
}

function cacheSeededNpc(ctx, seededNpc, timestamp = '') {
  cacheSeededNpcBust(ctx, seededNpc);
  return cacheSeededNpcOwner(
    ctx,
    buildOwnerRecord(seededNpc, ctx.toNonEmptyString(timestamp) || ctx.getCurrentTimestamp())
  );
}

function buildSeededNpcSummary(ownerRecord) {
  if (!ownerRecord) {
    return null;
  }

  return {
    npcId: ownerRecord.npcId,
    solarSystemId: ownerRecord.solarSystemId,
    marketId: ownerRecord.marketId,
    marketName: ownerRecord.marketName,
    locationName: ownerRecord.locationName,
    name: ownerRecord.name,
    credits: ownerRecord.credits,
    seededAt: ownerRecord.seededAt,
    updatedAt: ownerRecord.updatedAt,
  };
}

function logSeededNpc(ctx, seededNpc, source) {
  ctx.log(
    `[npc-seed] Seeded NPC ${seededNpc.npcId} (${seededNpc.name}) for ${seededNpc.marketId} at ${seededNpc.locationName} via ${source}`
  );
}

async function hydratePersistedNpcBusts(ctx, owners) {
  for (const owner of owners) {
    const bust = await ctx.getNpcBustAsync(owner.npcId);
    if (!bust) {
      return false;
    }
  }

  return true;
}

async function seedSolarSystemNpcsAsync(ctx, request = {}) {
  const solarSystemId = ctx.toNonEmptyString(request?.solarSystemId).toLowerCase() || 'sol';
  const asOf = ctx.toNonEmptyString(request?.asOf) || ctx.getCurrentTimestamp();
  const force = Boolean(request?.force);
  const seeded = buildSeededNpcsForSolarSystem(solarSystemId, asOf);

  if (seeded.length === 0) {
    return {
      success: false,
      reason: 'UNSUPPORTED_SOLAR_SYSTEM',
      solarSystemId,
      npcCount: 0,
      seededNpcIds: [],
      seededOwners: [],
    };
  }

  if (!ctx.databaseService) {
    const seededOwners = [];
    for (const seededNpc of seeded) {
      const owner = cacheSeededNpc(ctx, seededNpc, asOf);
      seededOwners.push(buildSeededNpcSummary(owner));
      logSeededNpc(ctx, seededNpc, 'in-memory');
    }

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_NPC_SEED_VERSION,
      npcCount: seeded.length,
      seededNpcIds: seeded.map((seededNpc) => seededNpc.npcId),
      seededOwners: seededOwners.filter((owner) => Boolean(owner)),
      source: 'in-memory',
    };
  }

  try {
    const existingSeedState = await ctx.databaseService.getSolarSystemNpcSeedState(solarSystemId);
    const isCurrentVersion =
      existingSeedState && existingSeedState.seedVersion === SOLAR_SYSTEM_NPC_SEED_VERSION;

    if (!force && isCurrentVersion) {
      const persistedOwners = await ctx.databaseService.getSeededNpcOwners({ solarSystemId });
      if (Array.isArray(persistedOwners) && persistedOwners.length > 0) {
        for (const owner of persistedOwners) {
          cacheSeededNpcOwner(ctx, owner);
        }
        const hasAllBusts = await hydratePersistedNpcBusts(ctx, persistedOwners);
        if (hasAllBusts) {
          return {
            success: true,
            solarSystemId,
            seedVersion: SOLAR_SYSTEM_NPC_SEED_VERSION,
            npcCount: persistedOwners.length,
            seededNpcIds: persistedOwners.map((owner) => owner.npcId),
            seededOwners: persistedOwners
              .map((owner) => buildSeededNpcSummary(owner))
              .filter((owner) => Boolean(owner)),
            source: 'database-cache',
          };
        }
      }
    }

    const seededOwners = [];
    for (const seededNpc of seeded) {
      await ctx.upsertNpcBustAsync(
        seededNpc.npcId,
        seededNpc.deterministicSeed,
        seededNpc.descriptor,
        seededNpc.appliedOverrides
      );
      const ownerRecord = buildOwnerRecord(seededNpc, asOf);
      cacheSeededNpc(ctx, seededNpc, asOf);
      const persistedOwner = await ctx.databaseService.upsertSeededNpcOwner(ownerRecord);
      seededOwners.push(buildSeededNpcSummary(persistedOwner || ownerRecord));
      logSeededNpc(ctx, seededNpc, 'database-upsert');
    }

    await ctx.databaseService.setSolarSystemNpcSeedState(
      solarSystemId,
      SOLAR_SYSTEM_NPC_SEED_VERSION,
      asOf
    );

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_NPC_SEED_VERSION,
      npcCount: seeded.length,
      seededNpcIds: seeded.map((seededNpc) => seededNpc.npcId),
      seededOwners: seededOwners.filter((owner) => Boolean(owner)),
      source: 'database-upsert',
    };
  } catch (error) {
    ctx.log(`[context] Error seeding solar system NPCs: ${error.message}`);

    const seededOwners = [];
    for (const seededNpc of seeded) {
      const owner = cacheSeededNpc(ctx, seededNpc, asOf);
      seededOwners.push(buildSeededNpcSummary(owner));
      logSeededNpc(ctx, seededNpc, 'in-memory-fallback');
    }

    return {
      success: true,
      solarSystemId,
      seedVersion: SOLAR_SYSTEM_NPC_SEED_VERSION,
      npcCount: seeded.length,
      seededNpcIds: seeded.map((seededNpc) => seededNpc.npcId),
      seededOwners: seededOwners.filter((owner) => Boolean(owner)),
      source: 'in-memory-fallback',
    };
  }
}

module.exports = {
  cacheSeededNpc,
  cacheSeededNpcBust,
  cacheSeededNpcOwner,
  getSeededNpcOwner,
  getSeededNpcOwnersAsync,
  getSolarSystemNpcSeedSummaryAsync,
  getSeededNpcProfilesAsync,
  getSeededNpcProfilesWithOwnedMarketsAsync,
  getNpcOwnedMarketsAsync,
  getSeededNpcCreditsAsync,
  getMarketOwnerCreditsAsync,
  adjustSeededNpcCreditsAsync,
  updateMarketOwnerCreditsAsync,
  adjustMarketOwnerCreditsAsync,
  updateSeededNpcCreditsAsync,
  getMarketOwnerAsync,
  getSeededNpcProfileAsync,
  getMarketOwnerProfileAsync,
  seedSolarSystemNpcsAsync,
};