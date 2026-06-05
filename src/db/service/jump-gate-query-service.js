'use strict';

/**
 * Load active jump gates for route graph construction.
 * Returns [] when DB fallback is enabled or query fails to keep routing resilient.
 * @param {Object} ctx
 * @param {Object} JumpGate
 * @returns {Promise<Object[]>}
 */
async function getJumpGatesAsync(ctx, JumpGate) {
  if (ctx.useInMemoryFallback) {
    return [];
  }

  try {
    const gates = await JumpGate.find({ isActive: true }).lean();
    return gates.map((gate) => ({
      gateId: gate.gateId,
      sourceSystemId: gate.sourceSystemId,
      destSystemId: gate.destSystemId,
      traversalCostAu: gate.traversalCostAu,
      traversalTimeHours: gate.traversalTimeHours,
      spatial: gate.spatial || null,
    }));
  } catch (error) {
    ctx.log(`[db-service] Error loading jump gates: ${error.message}`);
    return [];
  }
}

module.exports = {
  getJumpGatesAsync,
};
