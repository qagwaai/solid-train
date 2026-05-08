'use strict';

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
    }));
  } catch (error) {
    ctx.log(`[db-service] Error loading jump gates: ${error.message}`);
    return [];
  }
}

module.exports = {
  getJumpGatesAsync,
};
