'use strict';

const dockingService = require('./docking-service');

async function resolveDockingStateAsync(ctx, request = {}) {
  return dockingService.resolveDockingStateAsync(ctx, request);
}

module.exports = {
  resolveDockingStateAsync,
};
