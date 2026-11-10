'use strict';

const COPPER_VALE_SEED_LIFECYCLE_STATE_KEY = 'copper-vale-seed-lifecycle:exo-gj-9066';

async function getCopperValeSeedLifecycleState(ctx, GameStateDocument) {
  try {
    const document = await GameStateDocument.findOne({
      key: COPPER_VALE_SEED_LIFECYCLE_STATE_KEY,
    }).lean();
    return document?.value ? structuredClone(document.value) : null;
  } catch (error) {
    ctx.log(`[db-service] Error fetching Copper Vale seed lifecycle state: ${error.message}`);
    throw error;
  }
}

async function setCopperValeSeedLifecycleState(ctx, GameStateDocument, value) {
  try {
    return await GameStateDocument.findOneAndUpdate(
      { key: COPPER_VALE_SEED_LIFECYCLE_STATE_KEY },
      {
        key: COPPER_VALE_SEED_LIFECYCLE_STATE_KEY,
        value: structuredClone(value),
        updatedAt: new Date(),
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }
    ).lean();
  } catch (error) {
    ctx.log(`[db-service] Error saving Copper Vale seed lifecycle state: ${error.message}`);
    throw error;
  }
}

module.exports = {
  COPPER_VALE_SEED_LIFECYCLE_STATE_KEY,
  getCopperValeSeedLifecycleState,
  setCopperValeSeedLifecycleState,
};
