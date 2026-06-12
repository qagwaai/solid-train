'use strict';

const { GameState } = require('../model/game');
const orbitalMath = require('./context/orbital-math');
const marketService = require('./context/market-service');
const npcService = require('./context/npc-service');
const marketOperationsService = require('./context/market-operations-service');
const tradingService = require('./context/trading-service');
const inventoryService = require('./context/inventory-service');
const celestialOperationsService = require('./context/celestial-operations-service');
const playerService = require('./context/player-service');
const shipOperationsService = require('./context/ship-operations-service');
const dockingOperationsService = require('./context/docking-operations-service');
const gateOperationsService = require('./context/gate-operations-service');
const gameParticipationService = require('./context/game-participation-service');
const contextBootstrapService = require('./context/context-bootstrap-service');
const contextRuntimeService = require('./context/context-runtime-service');
const normalizers = require('./context/normalizers');
const { createLogger } = require('../logging/logger');

/**
 * Shared in-memory runtime context for handlers with optional DB-backed persistence.
 */
class MessageHandlerContext {
  constructor(options = {}) {
    const logger =
      options.logger ||
      createLogger({
        minLevel: options.logLevel || process.env.LOG_LEVEL || 'info',
        write:
          typeof options.log === 'function'
            ? (level, line, logOptions = {}) => options.log(line, { level, ...logOptions })
            : undefined,
      });

    this.registeredPlayers = options.registeredPlayers || new Map();
    this.charactersByPlayer = options.charactersByPlayer || new Map();
    this.celestialBodiesById = options.celestialBodiesById || new Map();
    this.itemsById = options.itemsById || new Map();
    this.npcBustsById = options.npcBustsById || new Map();
    this.seededNpcOwnersById = options.seededNpcOwnersById || new Map();
    this.marketsByKey = options.marketsByKey || new Map();
    this.databaseService = options.databaseService || null;
    this.game = options.game || new GameState();
    this.logger = logger;
    this.log = (line, logOptions = {}) => this.logger.log(line, logOptions);
    this.createId =
      options.createId ||
      (() => {
        throw new Error('createId is required');
      });
    this.getCurrentTimestamp = options.getCurrentTimestamp || (() => new Date().toISOString());
    this._gateGraph = null;
    this._seedDefaultsInitialized = false;
  }

  /**
   * Initialize seeded runtime defaults (markets, registry caches, etc).
   * This explicit method exists for static tooling; delegated methods remain
   * attached below for runtime parity with other context capabilities.
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  initializeAsync(options = {}) {
    return contextBootstrapService.initializeAsync(this, options);
  }
}

function defineDelegatedMethods(prototype, service, methodNames) {
  for (const methodName of methodNames) {
    prototype[methodName] = function delegateToService(...args) {
      return service[methodName](this, ...args);
    };
  }
}

function defineMappedDelegatedMethods(prototype, service, methodMap) {
  for (const [methodName, serviceMethodName] of Object.entries(methodMap)) {
    prototype[methodName] = function delegateToMappedService(...args) {
      return service[serviceMethodName](this, ...args);
    };
  }
}

defineDelegatedMethods(MessageHandlerContext.prototype, contextBootstrapService, [
  'initializeAsync',
  'seedDefaultMarkets',
  'createSeedMarketPayload',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, normalizers, [
  'normalizeMarketOrbit',
  'isFiniteNumber',
  'isTriple',
  'normalizeTriple',
  'normalizeSpatialState',
  'normalizeMotionState',
  'normalizePhysicalState',
  'normalizeObservabilityState',
  'normalizeTrajectoryDescriptor',
  'toNonEmptyString',
  'normalizeLocale',
  'normalizePlayerName',
  'normalizeMarketInventoryEntry',
  'normalizeMarketSiteTypeValue',
  'inferMarketSiteType',
  'normalizeMarket',
  'normalizeMarketLedgerEntry',
  'toPlainObject',
  'normalizeShip',
  'normalizeInventoryItemReference',
  'normalizeItem',
  'normalizeCreditLedgerEntry',
  'calculateCharacterCredits',
  'normalizeCharacter',
  'normalizeMission',
  'normalizeCelestialBody',
]);

defineMappedDelegatedMethods(MessageHandlerContext.prototype, normalizers, {
  _normalizeDriveProfile: 'normalizeDriveProfile',
  _convertLegacyItemKinematics: 'convertLegacyItemKinematics',
});

defineDelegatedMethods(MessageHandlerContext.prototype, contextRuntimeService, [
  'withDb',
  'withDbOrNull',
  'logHandlerMessage',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, orbitalMath, [
  'calculateDistanceKm',
  'calculateDistanceAu',
  'normalizeAngleRadians',
  'solveEccentricAnomaly',
  'rotatePerifocalVector',
  'computeRelativeOrbitPositionKm',
  'resolveMarketPositionKmAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, gateOperationsService, [
  'loadGateNetworkAsync',
  'getHopPathBetweenSystems',
  'getRouteForMarketAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, marketService, [
  'seedSolarSystemMarketsAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, npcService, ['seedSolarSystemNpcsAsync']);

defineDelegatedMethods(MessageHandlerContext.prototype, npcService, [
  'cacheSeededNpcOwner',
  'getSeededNpcOwner',
  'getSeededNpcOwnersAsync',
  'getSolarSystemNpcSeedSummaryAsync',
  'getSeededNpcProfilesAsync',
  'getSeededNpcProfilesWithOwnedMarketsAsync',
  'getNpcOwnedMarketsAsync',
  'getSeededNpcCreditsAsync',
  'getMarketOwnerCreditsAsync',
  'adjustSeededNpcCreditsAsync',
  'updateMarketOwnerCreditsAsync',
  'adjustMarketOwnerCreditsAsync',
  'updateSeededNpcCreditsAsync',
  'getMarketOwnerAsync',
  'getSeededNpcProfileAsync',
  'getMarketOwnerProfileAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, celestialOperationsService, [
  'seedSolarSystemCelestialBodiesAsync',
  'getCelestialBody',
  'getCelestialBodyByIdAsync',
  'getCelestialBodiesAsync',
  'deleteCelestialBodyByIdAsync',
  'addOrUpdateCelestialBodyAsync',
  'getCelestialBodiesNearPositionAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, marketOperationsService, [
  'cacheMarket',
  'getMarket',
  'getMarketWithOwnerProfileAsync',
  'applyMarketRestock',
  'getMarketsAsync',
  'getMarketsWithOwnerProfilesAsync',
  'getMarketsByLocationAsync',
  'getMarketsByLocationWithOwnerProfilesAsync',
  'getMarketQuoteAsync',
  'getMarketInventoryAsync',
  'getMarketLedgerAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, tradingService, [
  'getCharacterTradeItemsAsync',
  'applyMarketStockDeltaAsync',
  'appendCharacterLedgerEntryAsync',
  'appendMarketLedgerEntryAsync',
  'addTradeItemToCharacterAsync',
  'removeTradeItemFromCharacterAsync',
  'executeMarketTransactionAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, shipOperationsService, [
  'getShipPositionKm',
  'hydrateShipAsync',
  'hydrateShipsAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, dockingOperationsService, [
  'resolveDockingStateAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, playerService, [
  'getPlayer',
  'cachePlayer',
  'getCharacters',
  'setCharacters',
  'cacheCharacters',
  'hasValidSession',
  'ensurePlayerLoadedAsync',
  'hasValidSessionAsync',
  'getPlayerAsync',
  'getCharactersAsync',
  'registerPlayerAsync',
  'updatePlayerAsync',
  'addCharacterAsync',
  'deleteCharacterAsync',
  'updateCharacterAsync',
  'updateCharacterBustAsync',
  'getCharacterBustAsync',
  'upsertNpcBustAsync',
  'getNpcBustAsync',
  'addShipAsync',
  'addOrUpdateMissionAsync',
  'getMissionsAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, inventoryService, [
  'getItem',
  'cacheItems',
  'getItemsByIdsAsync',
  'addItemsAsync',
  'deleteItemsAsync',
  'updateItemAsync',
  'getItemsByContainerAsync',
  'syncShipInventoryReferenceForItemAsync',
  'getItemsNearPositionAsync',
]);

defineDelegatedMethods(MessageHandlerContext.prototype, gameParticipationService, [
  'findCharacter',
  'joinCharacterToGame',
  'touchJoinedCharacters',
  'renameJoinedCharacter',
  'detachCharacterFromGame',
  'detachIdleGameCharacters',
]);

module.exports = {
  MessageHandlerContext,
};
