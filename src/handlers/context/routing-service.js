'use strict';

const { buildSeededGateNetwork } = require('../../model/solar-system-gate-seed');

async function loadGateNetworkAsync(ctx) {
  if (ctx._gateGraph !== null) {
    return ctx._gateGraph;
  }

  const gates = ctx.databaseService
    ? await ctx.databaseService.getJumpGatesAsync()
    : buildSeededGateNetwork();

  const graph = new Map();
  for (const gate of gates) {
    if (!graph.has(gate.sourceSystemId)) {
      graph.set(gate.sourceSystemId, []);
    }
    graph.get(gate.sourceSystemId).push(gate);
  }

  ctx._gateGraph = graph;
  return graph;
}

async function getHopPathBetweenSystems(ctx, sourceSystemId, destSystemId) {
  if (sourceSystemId === destSystemId) {
    return { hops: 0, path: [] };
  }

  const graph = await loadGateNetworkAsync(ctx);
  const visited = new Set([sourceSystemId]);
  const queue = [{ systemId: sourceSystemId, hops: 0, path: [] }];

  while (queue.length > 0) {
    const current = queue.shift();
    const outgoing = graph.get(current.systemId) || [];

    for (const gate of outgoing) {
      if (gate.destSystemId === destSystemId) {
        return { hops: current.hops + 1, path: [...current.path, gate.gateId] };
      }

      if (!visited.has(gate.destSystemId)) {
        visited.add(gate.destSystemId);
        queue.push({
          systemId: gate.destSystemId,
          hops: current.hops + 1,
          path: [...current.path, gate.gateId],
        });
      }
    }
  }

  return null;
}

async function getRouteForMarketAsync(ctx, requestSolarSystemId, marketSolarSystemId) {
  if (marketSolarSystemId === requestSolarSystemId) {
    return { kind: 'in-system' };
  }

  const hopPath = await getHopPathBetweenSystems(ctx, requestSolarSystemId, marketSolarSystemId);
  if (hopPath) {
    return { kind: 'gate-route', hops: hopPath.hops };
  }

  return { kind: 'no-route' };
}

module.exports = {
  loadGateNetworkAsync,
  getHopPathBetweenSystems,
  getRouteForMarketAsync,
};
