'use strict';

async function upsertNpcBust(ctx, NpcBust, npcId, deterministicSeed, descriptor, appliedOverrides) {
  try {
    const normalizedNpcId = ctx.toNonEmptyString(npcId);
    if (!normalizedNpcId) {
      return null;
    }

    const record = await NpcBust.findOneAndUpdate(
      { npcId: normalizedNpcId },
      {
        npcId: normalizedNpcId,
        deterministicSeed,
        descriptor,
        appliedOverrides: Array.isArray(appliedOverrides) ? appliedOverrides : [],
        updatedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return record ? record.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error upserting NPC bust: ${error.message}`);
    throw error;
  }
}

async function getNpcBust(ctx, NpcBust, npcId) {
  try {
    const normalizedNpcId = ctx.toNonEmptyString(npcId);
    if (!normalizedNpcId) {
      return null;
    }

    const record = await NpcBust.findOne({ npcId: normalizedNpcId }).lean();
    return record || null;
  } catch (error) {
    ctx.log(`[db-service] Error fetching NPC bust: ${error.message}`);
    throw error;
  }
}

module.exports = {
  upsertNpcBust,
  getNpcBust,
};
