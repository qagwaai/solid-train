'use strict';

const routingService = require('./routing-service');

async function loadGateNetworkAsync(ctx) {
  return routingService.loadGateNetworkAsync(ctx);
}

async function getHopPathBetweenSystems(ctx, sourceSystemId, destSystemId) {
  return routingService.getHopPathBetweenSystems(ctx, sourceSystemId, destSystemId);
}

async function getRouteForMarketAsync(ctx, requestSolarSystemId, marketSolarSystemId) {
  return routingService.getRouteForMarketAsync(ctx, requestSolarSystemId, marketSolarSystemId);
}

module.exports = {
  loadGateNetworkAsync,
  getHopPathBetweenSystems,
  getRouteForMarketAsync,
};
