'use strict';

const { GameState } = require('../model/game');
const { MARKET_CATALOG, MARKET_CATALOG_BY_ID } = require('../model/market-catalog');
const { computeMidpointPrice } = require('../model/market-pricing');
const {
  SOLAR_SYSTEM_MARKET_SEED_VERSION,
  buildSeededMarketsForSolarSystem,
} = require('../model/solar-system-market-seed');
const { buildSeededGateNetwork } = require('../model/solar-system-gate-seed');
const routingService = require('./context/routing-service');
const orbitalMath = require('./context/orbital-math');
const dockingService = require('./context/docking-service');
const marketService = require('./context/market-service');
const persistenceBridge = require('./context/persistence-bridge');
const normalizers = require('./context/normalizers');
const SUPPORTED_LOCALES = new Set(['en', 'it']);
const DEFAULT_RESTOCK_INTERVAL_MINUTES = 60;
const MARKET_DOCKING_DISTANCE_KM = 50;
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const FALLBACK_ANCHOR_POSITION_KM = {
  'sol-sun': { x: 0, y: 0, z: 0 },
  'sol-mercury': { x: 57_909_227, y: 0, z: 0 },
  'sol-venus': { x: 108_209_475, y: 0, z: 0 },
  'sol-earth': { x: 149_597_870.7, y: 0, z: 0 },
  'sol-moon': { x: 149_982_270.7, y: 0, z: 0 },
  'sol-mars': { x: 227_943_824, y: 0, z: 0 },
  'sol-asteroid-belt': { x: 414_012_000, y: 0, z: 0 },
  'sol-jupiter': { x: 778_340_821, y: 0, z: 0 },
  'sol-saturn': { x: 1_426_666_422, y: 0, z: 0 },
  'sol-uranus': { x: 2_870_658_186, y: 0, z: 0 },
  'sol-neptune': { x: 4_498_396_441, y: 0, z: 0 },
  'sol-pluto': { x: 5_906_376_272, y: 0, z: 0 },
};

function buildMarketKey(marketId, solarSystemId) {
  return `${solarSystemId}:${marketId}`;
}

function getDefaultStockByRarity(rarity) {
  switch (rarity) {
    case 'Exotic':
      return 80;
    case 'Rare':
      return 260;
    case 'Uncommon':
      return 640;
    default:
      return 1200;
  }
}

function buildDefaultInventoryEntry(catalogEntry) {
  const maxStock = getDefaultStockByRarity(catalogEntry.rarity);

  return {
    itemId: catalogEntry.itemId,
    stock: maxStock,
    maxStock,
    restockPerInterval: Math.max(1, Math.round(maxStock * 0.08)),
    marketCanBuy: Boolean(catalogEntry.marketCanBuy),
    marketCanSell: Boolean(catalogEntry.marketCanSell),
  };
}

class MessageHandlerContext {
  constructor(options = {}) {
    this.registeredPlayers = options.registeredPlayers || new Map();
    this.charactersByPlayer = options.charactersByPlayer || new Map();
    this.celestialBodiesById = options.celestialBodiesById || new Map();
    this.itemsById = options.itemsById || new Map();
    this.marketsByKey = options.marketsByKey || new Map();
    this.databaseService = options.databaseService || null;
    this.game = options.game || new GameState();
    this.log = options.log || ((line) => process.stdout.write(`${line}\n`));
    this.createId =
      options.createId ||
      (() => {
        throw new Error('createId is required');
      });
    this.getCurrentTimestamp = options.getCurrentTimestamp || (() => new Date().toISOString());
    this._gateGraph = null;
    this._seedDefaultsInitialized = false;
  }

  async initializeAsync(options = {}) {
    const seedDefaults = options.seedDefaults !== false;
    if (!seedDefaults || this._seedDefaultsInitialized) {
      return {
        success: true,
        seededDefaults: false,
      };
    }

    if (this.marketsByKey.size === 0) {
      this.seedDefaultMarkets();
      this._seedDefaultsInitialized = true;
      return {
        success: true,
        seededDefaults: true,
      };
    }

    this._seedDefaultsInitialized = true;
    return {
      success: true,
      seededDefaults: false,
    };
  }

  seedDefaultMarkets() {
    const now = this.getCurrentTimestamp();
    const systemIds = ['sol', 'alpha-centauri', 'barnards-star'];

    for (const systemId of systemIds) {
      const defaults = buildSeededMarketsForSolarSystem(systemId, now);
      for (const market of defaults) {
        this.cacheMarket(this.createSeedMarketPayload(market, now));
      }
    }
  }

  createSeedMarketPayload(seedMarket, timestamp) {
    const source = this.toPlainObject(seedMarket) || {};
    const orbit = source.orbit ? this.normalizeMarketOrbit(source.orbit) : null;
    const siteType = this.inferMarketSiteType(source);
    const siteName =
      this.toNonEmptyString(source.siteName) ||
      this.toNonEmptyString(source.locationName) ||
      this.toNonEmptyString(source.marketName);
    const positionKm = this.normalizeTriple(source.positionKm);
    const spatial = positionKm
      ? {
          solarSystemId: this.toNonEmptyString(source.solarSystemId).toLowerCase(),
          frame: 'barycentric',
          positionKm,
          epochMs: this.isFiniteNumber(source?.spatial?.epochMs)
            ? source.spatial.epochMs
            : Date.parse(orbit?.epoch || timestamp),
        }
      : undefined;

    return {
      ...seedMarket,
      solarSystemId: this.toNonEmptyString(source.solarSystemId).toLowerCase(),
      siteType,
      siteName,
      ...(spatial ? { spatial } : {}),
      ...(orbit ? { trajectory: { kind: 'orbital-elements', orbit } } : {}),
      restockIntervalMinutes:
        Number.isInteger(seedMarket?.restockIntervalMinutes) &&
        seedMarket.restockIntervalMinutes > 0
          ? seedMarket.restockIntervalMinutes
          : DEFAULT_RESTOCK_INTERVAL_MINUTES,
      lastRestockAt: this.toNonEmptyString(seedMarket?.lastRestockAt) || timestamp,
      inventory: MARKET_CATALOG.map((catalogEntry) => buildDefaultInventoryEntry(catalogEntry)),
      ledger: [],
    };
  }

  normalizeMarketOrbit(value) {
    const source = this.toPlainObject(value);
    if (!source || typeof source !== 'object') {
      return null;
    }

    const hasOrbitInput = Boolean(
      this.toNonEmptyString(source.anchorBodyId) ||
      this.toNonEmptyString(source.anchorBodyName) ||
      this.toNonEmptyString(source.orbitType) ||
      this.isFiniteNumber(source.semiMajorAxisKm) ||
      this.isFiniteNumber(source.eccentricity) ||
      this.isFiniteNumber(source.inclinationDeg) ||
      this.isFiniteNumber(source.longitudeOfAscendingNodeDeg) ||
      this.isFiniteNumber(source.argumentOfPeriapsisDeg) ||
      this.isFiniteNumber(source.meanAnomalyAtEpochDeg) ||
      this.isFiniteNumber(source.orbitalPeriodSec) ||
      this.toNonEmptyString(source.epoch)
    );

    if (!hasOrbitInput) {
      return null;
    }

    return {
      anchorBodyId: this.toNonEmptyString(source.anchorBodyId),
      anchorBodyName: this.toNonEmptyString(source.anchorBodyName),
      orbitType: this.toNonEmptyString(source.orbitType) || 'elliptical',
      semiMajorAxisKm: this.isFiniteNumber(source.semiMajorAxisKm) ? source.semiMajorAxisKm : 0,
      eccentricity: this.isFiniteNumber(source.eccentricity) ? source.eccentricity : 0,
      inclinationDeg: this.isFiniteNumber(source.inclinationDeg) ? source.inclinationDeg : 0,
      longitudeOfAscendingNodeDeg: this.isFiniteNumber(source.longitudeOfAscendingNodeDeg)
        ? source.longitudeOfAscendingNodeDeg
        : 0,
      argumentOfPeriapsisDeg: this.isFiniteNumber(source.argumentOfPeriapsisDeg)
        ? source.argumentOfPeriapsisDeg
        : 0,
      meanAnomalyAtEpochDeg: this.isFiniteNumber(source.meanAnomalyAtEpochDeg)
        ? source.meanAnomalyAtEpochDeg
        : 0,
      orbitalPeriodSec: this.isFiniteNumber(source.orbitalPeriodSec) ? source.orbitalPeriodSec : 0,
      epoch: this.toNonEmptyString(source.epoch) || this.getCurrentTimestamp(),
    };
  }

  isFiniteNumber(value) {
    return normalizers.isFiniteNumber(this, value);
  }

  isTriple(value) {
    return normalizers.isTriple(this, value);
  }

  normalizeTriple(value) {
    return normalizers.normalizeTriple(this, value);
  }

  normalizeSpatialState(value) {
    const source = this.toPlainObject(value) || {};
    const solarSystemId = this.toNonEmptyString(source.solarSystemId);
    const frame = this.toNonEmptyString(source.frame) || 'barycentric';
    const positionKm = this.normalizeTriple(source.positionKm);
    const epochMs = this.isFiniteNumber(source.epochMs) ? source.epochMs : 0;

    if (!solarSystemId || frame !== 'barycentric' || !positionKm) {
      return null;
    }

    return {
      solarSystemId,
      frame: 'barycentric',
      positionKm,
      epochMs,
    };
  }

  normalizeMotionState(value) {
    if (!value) {
      return null;
    }

    const source = this.toPlainObject(value);
    const velocityKmPerSec = this.normalizeTriple(source.velocityKmPerSec);
    const angularVelocityRadPerSec = this.normalizeTriple(source.angularVelocityRadPerSec);

    if (!velocityKmPerSec) {
      return null;
    }

    return {
      velocityKmPerSec,
      ...(angularVelocityRadPerSec ? { angularVelocityRadPerSec } : {}),
    };
  }

  normalizePhysicalState(value) {
    if (!value) {
      return null;
    }

    const source = this.toPlainObject(value);
    const estimatedMassKg = this.isFiniteNumber(source.estimatedMassKg)
      ? source.estimatedMassKg
      : undefined;
    const estimatedDiameterM = this.isFiniteNumber(source.estimatedDiameterM)
      ? source.estimatedDiameterM
      : undefined;

    if (estimatedMassKg === undefined && estimatedDiameterM === undefined) {
      return null;
    }

    return {
      ...(estimatedMassKg !== undefined ? { estimatedMassKg } : {}),
      ...(estimatedDiameterM !== undefined ? { estimatedDiameterM } : {}),
    };
  }

  normalizeObservabilityState(value) {
    const source = this.toPlainObject(value) || {};
    const visibility = this.toNonEmptyString(source.visibility);
    const scanState = this.toNonEmptyString(source.scanState);

    return {
      visibility: ['visible', 'not-visible', 'cloaked'].includes(visibility)
        ? visibility
        : 'not-visible',
      scanState: ['unscanned', 'scanned'].includes(scanState) ? scanState : 'unscanned',
    };
  }

  normalizeTrajectoryDescriptor(value) {
    if (!value) {
      return null;
    }

    const source = this.toPlainObject(value);
    const kind = this.toNonEmptyString(source.kind);

    if (!['static', 'orbital-elements'].includes(kind)) {
      return null;
    }

    const trajectory = {
      kind,
    };

    if (kind === 'orbital-elements' && source.orbit) {
      const orbit = this.normalizeMarketOrbit(source.orbit);
      if (orbit) {
        trajectory.orbit = orbit;
      }
    }

    return trajectory;
  }

  calculateDistanceKm(fromPositionKm, toPositionKm) {
    return orbitalMath.calculateDistanceKm(this, fromPositionKm, toPositionKm);
  }

  calculateDistanceAu(fromPositionKm, toPositionKm) {
    return orbitalMath.calculateDistanceAu(this, fromPositionKm, toPositionKm);
  }

  async withDb(operationName, operation) {
    if (!this.databaseService) {
      return null;
    }

    try {
      return await operation(this.databaseService);
    } catch (error) {
      this.log(`[context] Error ${operationName}: ${error.message}`);
      throw error;
    }
  }

  async withDbOrNull(operationName, operation) {
    if (!this.databaseService) {
      return null;
    }

    try {
      return await operation(this.databaseService);
    } catch (error) {
      this.log(`[context] Error ${operationName}: ${error.message}`);
      return null;
    }
  }

  async loadGateNetworkAsync() {
    return routingService.loadGateNetworkAsync(this);
  }

  async getHopPathBetweenSystems(sourceSystemId, destSystemId) {
    return routingService.getHopPathBetweenSystems(this, sourceSystemId, destSystemId);
  }

  async getRouteForMarketAsync(requestSolarSystemId, marketSolarSystemId) {
    return routingService.getRouteForMarketAsync(this, requestSolarSystemId, marketSolarSystemId);
  }

  toNonEmptyString(value) {
    return normalizers.toNonEmptyString(this, value);
  }

  normalizeLocale(value) {
    return normalizers.normalizeLocale(this, value);
  }

  normalizePlayerName(value) {
    return normalizers.normalizePlayerName(this, value);
  }

  getPlayer(playerName) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);

    if (!normalizedPlayerName) {
      return null;
    }

    return this.registeredPlayers.get(normalizedPlayerName) || null;
  }

  cachePlayer(playerData) {
    if (!playerData || !playerData.playerName) {
      return null;
    }

    const normalizedPlayerName = this.normalizePlayerName(playerData.playerName);
    if (!normalizedPlayerName) {
      return null;
    }

    const existing = this.registeredPlayers.get(normalizedPlayerName) || {};
    const merged = {
      ...existing,
      ...playerData,
      sessionKey: playerData.sessionKey ?? existing.sessionKey ?? null,
      socketId: playerData.socketId ?? existing.socketId ?? null,
      preferredLocale: this.normalizeLocale(playerData.preferredLocale ?? existing.preferredLocale),
    };

    this.registeredPlayers.set(normalizedPlayerName, merged);
    return merged;
  }

  getCharacters(normalizedPlayerName) {
    return this.charactersByPlayer.get(normalizedPlayerName) || [];
  }

  setCharacters(normalizedPlayerName, characters) {
    this.charactersByPlayer.set(normalizedPlayerName, characters);
  }

  normalizeMarketInventoryEntry(entry) {
    const source = this.toPlainObject(entry) || {};
    const catalogEntry = MARKET_CATALOG_BY_ID.get(this.toNonEmptyString(source.itemId));
    const defaults = catalogEntry
      ? buildDefaultInventoryEntry(catalogEntry)
      : {
          itemId: this.toNonEmptyString(source.itemId),
          stock: 0,
          maxStock: 0,
          restockPerInterval: 0,
          marketCanBuy: false,
          marketCanSell: false,
        };

    return {
      itemId: defaults.itemId,
      stock: Number.isInteger(source.stock) && source.stock >= 0 ? source.stock : defaults.stock,
      maxStock:
        Number.isInteger(source.maxStock) && source.maxStock >= 0
          ? source.maxStock
          : defaults.maxStock,
      restockPerInterval:
        Number.isInteger(source.restockPerInterval) && source.restockPerInterval >= 0
          ? source.restockPerInterval
          : defaults.restockPerInterval,
      marketCanBuy:
        source.marketCanBuy != null ? Boolean(source.marketCanBuy) : defaults.marketCanBuy,
      marketCanSell:
        source.marketCanSell != null ? Boolean(source.marketCanSell) : defaults.marketCanSell,
    };
  }

  normalizeMarketSiteTypeValue(value) {
    const normalized = this.toNonEmptyString(value).toLowerCase();
    if (!normalized) {
      return '';
    }

    if (
      normalized === 'station' ||
      normalized === 'surface-settlement' ||
      normalized === 'free-floating'
    ) {
      return normalized;
    }

    if (normalized.includes('station') || normalized.includes('orbital')) {
      return 'station';
    }

    if (normalized.includes('surface') || normalized.includes('settlement')) {
      return 'surface-settlement';
    }

    if (
      normalized.includes('free') ||
      normalized.includes('belt') ||
      normalized.includes('drift')
    ) {
      return 'free-floating';
    }

    return '';
  }

  inferMarketSiteType(source) {
    const explicit = this.normalizeMarketSiteTypeValue(source.siteType || source.locationType);
    if (explicit) {
      return explicit;
    }

    const marketId = this.toNonEmptyString(source.marketId).toLowerCase();
    const marketName = this.toNonEmptyString(source.marketName).toLowerCase();
    const siteName = this.toNonEmptyString(source.siteName || source.locationName).toLowerCase();

    const combined = `${marketId} ${marketName} ${siteName}`;
    if (combined.includes('belt') || combined.includes('drift')) {
      return 'free-floating';
    }

    if (combined.includes('surface') || combined.includes('settlement')) {
      return 'surface-settlement';
    }

    return 'station';
  }

  normalizeMarket(market) {
    const source = this.toPlainObject(market) || {};
    const marketId = this.toNonEmptyString(source.marketId);
    const solarSystemId = this.toNonEmptyString(source.solarSystemId).toLowerCase();
    const orbit = this.normalizeMarketOrbit(source.orbit || source.trajectory?.orbit);
    const rawInventory = Array.isArray(source.inventory)
      ? source.inventory
      : MARKET_CATALOG.map((catalogEntry) => buildDefaultInventoryEntry(catalogEntry));
    const inventory = rawInventory
      .map((entry) => this.normalizeMarketInventoryEntry(entry))
      .filter((entry) => Boolean(entry.itemId));
    const ledger = Array.isArray(source.ledger)
      ? source.ledger.map((entry) => this.normalizeMarketLedgerEntry(entry))
      : [];

    // Handle spatial: use provided spatial or compute from orbit + legacy positionKm
    let spatial = this.normalizeSpatialState(source.spatial);
    if (!spatial) {
      // Backward compatibility: try to construct spatial from legacy fields
      let positionKm = source.positionKm ? this.normalizeTriple(source.positionKm) : null;
      if (!positionKm && orbit && orbit.semiMajorAxisKm > 0 && source.solarSystemId) {
        // Fallback: use semi-major axis as approximate position (only for static markets)
        positionKm = { x: orbit.semiMajorAxisKm, y: 0, z: 0 };
      }

      if (positionKm && solarSystemId) {
        spatial = {
          solarSystemId,
          frame: 'barycentric',
          positionKm,
          epochMs: source.spatial?.epochMs || Date.parse(orbit?.epoch || new Date().toISOString()),
        };
      }
    }

    // Handle trajectory: preserve canonical trajectory if present, otherwise wrap normalized orbit.
    let trajectory = this.normalizeTrajectoryDescriptor(source.trajectory);
    if (!trajectory && orbit) {
      trajectory = {
        kind: 'orbital-elements',
        orbit,
      };
    }

    const result = {
      marketId,
      solarSystemId,
      marketName: this.toNonEmptyString(source.marketName),
      siteType: this.inferMarketSiteType(source),
      siteName:
        this.toNonEmptyString(source.siteName) ||
        this.toNonEmptyString(source.locationName) ||
        this.toNonEmptyString(source.marketName),
      isStarterMarket: Boolean(source.isStarterMarket),
      priceMultiplier:
        this.isFiniteNumber(source.priceMultiplier) && source.priceMultiplier > 0
          ? source.priceMultiplier
          : 1,
      driftPercentPerHour:
        this.isFiniteNumber(source.driftPercentPerHour) && source.driftPercentPerHour >= 0
          ? source.driftPercentPerHour
          : 0,
      restockIntervalMinutes:
        Number.isInteger(source.restockIntervalMinutes) && source.restockIntervalMinutes > 0
          ? source.restockIntervalMinutes
          : DEFAULT_RESTOCK_INTERVAL_MINUTES,
      lastRestockAt: this.toNonEmptyString(source.lastRestockAt) || this.getCurrentTimestamp(),
      inventory,
      ledger,
    };

    if (spatial) {
      result.spatial = spatial;
    }

    if (trajectory) {
      result.trajectory = trajectory;
    }

    // Preserve legacy fields for backward compatibility during transition
    if (source.locationType && !source.siteType) {
      result.locationType = this.toNonEmptyString(source.locationType);
    }

    if (source.locationName && !source.siteName) {
      result.locationName = this.toNonEmptyString(source.locationName);
    }

    if (source.positionKm && !spatial) {
      result.positionKm = source.positionKm;
    }

    if (source.orbit && !trajectory) {
      result.orbit = orbit;
    }

    return result;
  }

  async seedSolarSystemMarketsAsync(request = {}) {
    return marketService.seedSolarSystemMarketsAsync(this, request);
  }

  normalizeMarketLedgerEntry(entry) {
    const source = this.toPlainObject(entry) || {};

    return {
      transactionId: this.toNonEmptyString(source.transactionId),
      requestId: this.toNonEmptyString(source.requestId) || null,
      characterId: this.toNonEmptyString(source.characterId),
      itemId: this.toNonEmptyString(source.itemId),
      direction: this.toNonEmptyString(source.direction),
      quantity: Number.isInteger(source.quantity) ? source.quantity : 0,
      unitPrice: Number.isInteger(source.unitPrice) ? source.unitPrice : 0,
      totalPrice: Number.isInteger(source.totalPrice) ? source.totalPrice : 0,
      timestamp: this.toNonEmptyString(source.timestamp),
      reversalOfTransactionId: this.toNonEmptyString(source.reversalOfTransactionId) || null,
    };
  }

  cacheMarket(market) {
    const normalized = this.normalizeMarket(market);
    if (!normalized.marketId || !normalized.solarSystemId) {
      return null;
    }

    this.marketsByKey.set(
      buildMarketKey(normalized.marketId, normalized.solarSystemId),
      normalized
    );
    return normalized;
  }

  getMarket(marketId, solarSystemId = '') {
    const normalizedMarketId = this.toNonEmptyString(marketId);
    const normalizedSolarSystemId = this.toNonEmptyString(solarSystemId).toLowerCase();
    if (!normalizedMarketId) {
      return null;
    }

    if (normalizedSolarSystemId) {
      return (
        this.marketsByKey.get(buildMarketKey(normalizedMarketId, normalizedSolarSystemId)) || null
      );
    }

    const allMarkets = Array.from(this.marketsByKey.values());
    return allMarkets.find((market) => market.marketId === normalizedMarketId) || null;
  }

  applyMarketRestock(market, nowTimestamp) {
    return marketService.applyMarketRestock(this, market, nowTimestamp);
  }

  async getMarketsAsync(query = {}) {
    return marketService.getMarketsAsync(this, query);
  }

  normalizeAngleRadians(value) {
    return orbitalMath.normalizeAngleRadians(this, value);
  }

  solveEccentricAnomaly(meanAnomalyRad, eccentricity) {
    return orbitalMath.solveEccentricAnomaly(this, meanAnomalyRad, eccentricity);
  }

  rotatePerifocalVector(perifocalVector, orbit) {
    return orbitalMath.rotatePerifocalVector(this, perifocalVector, orbit);
  }

  computeRelativeOrbitPositionKm(orbit, timestamp) {
    return orbitalMath.computeRelativeOrbitPositionKm(this, orbit, timestamp);
  }

  async resolveMarketPositionKmAsync(market, timestamp) {
    return orbitalMath.resolveMarketPositionKmAsync(this, market, timestamp);
  }

  getShipPositionKm(ship) {
    return orbitalMath.getShipPositionKm(this, ship);
  }

  async resolveDockingStateAsync(request = {}) {
    return dockingService.resolveDockingStateAsync(this, request);
  }

  async getMarketsByLocationAsync(query = {}) {
    return marketService.getMarketsByLocationAsync(this, query);
  }

  async getMarketQuoteAsync(request = {}) {
    return marketService.getMarketQuoteAsync(this, request);
  }

  async getMarketInventoryAsync(query = {}) {
    return marketService.getMarketInventoryAsync(this, query);
  }

  async getMarketLedgerAsync(query = {}) {
    return marketService.getMarketLedgerAsync(this, query);
  }

  async getCharacterTradeItemsAsync(playerName, characterId, itemId) {
    return marketService.getCharacterTradeItemsAsync(this, playerName, characterId, itemId);
  }

  async applyMarketStockDeltaAsync(marketId, solarSystemId, itemId, delta) {
    return marketService.applyMarketStockDeltaAsync(this, marketId, solarSystemId, itemId, delta);
  }

  async appendCharacterLedgerEntryAsync(playerName, characterId, entry) {
    return marketService.appendCharacterLedgerEntryAsync(this, playerName, characterId, entry);
  }

  async appendMarketLedgerEntryAsync(marketId, solarSystemId, entry) {
    return marketService.appendMarketLedgerEntryAsync(this, marketId, solarSystemId, entry);
  }

  async addTradeItemToCharacterAsync(player, character, itemId, quantity) {
    return marketService.addTradeItemToCharacterAsync(this, player, character, itemId, quantity);
  }

  async removeTradeItemFromCharacterAsync(playerName, characterId, itemId, quantity) {
    return marketService.removeTradeItemFromCharacterAsync(
      this,
      playerName,
      characterId,
      itemId,
      quantity
    );
  }

  async executeMarketTransactionAsync(request = {}) {
    return marketService.executeMarketTransactionAsync(this, request);
  }

  toPlainObject(value) {
    return normalizers.toPlainObject(this, value);
  }

  normalizeShip(ship) {
    const source = this.toPlainObject(ship) || {};
    const shipName = this.toNonEmptyString(source.name) || this.toNonEmptyString(source.shipName);
    const inventory = Array.isArray(source.inventory)
      ? source.inventory
          .map((entry) => this.normalizeInventoryItemReference(entry))
          .filter((entry) => Boolean(entry))
      : [];

    let spatial = this.normalizeSpatialState(source.spatial);
    let motion = this.normalizeMotionState(source.motion);

    // If still no spatial, this is an error
    if (!spatial) {
      throw new Error(
        "Ship: spatial state is required. Provide spatial with solarSystemId, frame:'barycentric', positionKm, and epochMs."
      );
    }

    return {
      id: this.toNonEmptyString(source.id),
      name: shipName || source.name || source.shipName || '',
      status: this.toNonEmptyString(source.status) || null,
      model: this.toNonEmptyString(source.model) || 'Scavenger Pod',
      tier:
        Number.isInteger(source.tier) && source.tier >= 1 && source.tier <= 10 ? source.tier : 1,
      createdAt: this.toNonEmptyString(source.createdAt),
      inventory,
      spatial,
      ...(motion ? { motion } : {}),
      launchable: source.launchable != null ? Boolean(source.launchable) : true,
      damageProfile: source.damageProfile != null ? source.damageProfile : null,
      ...(this._normalizeDriveProfile(source.driveProfile) !== null
        ? { driveProfile: this._normalizeDriveProfile(source.driveProfile) }
        : {}),
    };
  }

  _normalizeDriveProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      return null;
    }

    const id = this.toNonEmptyString(profile.id);
    const name = this.toNonEmptyString(profile.name);
    const rangeAu = profile.rangeAu;
    const cruiseSpeedAuPerHour = profile.cruiseSpeedAuPerHour;
    const fuelCostPerAu = profile.fuelCostPerAu;

    if (
      !id ||
      !name ||
      typeof rangeAu !== 'number' ||
      !Number.isFinite(rangeAu) ||
      rangeAu <= 0 ||
      typeof cruiseSpeedAuPerHour !== 'number' ||
      !Number.isFinite(cruiseSpeedAuPerHour) ||
      cruiseSpeedAuPerHour <= 0 ||
      typeof fuelCostPerAu !== 'number' ||
      !Number.isFinite(fuelCostPerAu) ||
      fuelCostPerAu <= 0
    ) {
      this.log('[normalizeShip] driveProfile failed validation; omitting field');
      return null;
    }

    return { id, name, rangeAu, cruiseSpeedAuPerHour, fuelCostPerAu };
  }

  normalizeInventoryItemReference(reference) {
    const source = this.toPlainObject(reference) || {};
    const itemId = this.toNonEmptyString(source.itemId);
    const itemType = this.toNonEmptyString(source.itemType);

    if (!itemId || !itemType) {
      return null;
    }

    return {
      itemId,
      itemType,
    };
  }

  /**
   * Internal converter for pre-canonical item documents that still carry
   * `kinematics: { position, velocity, reference: { solarSystemId, epochMs, ... } }`.
   *
   * Maps to canonical `spatial` + optional `motion`. Returns `{ spatial, motion }`
   * with either field potentially null when input is unusable.
   *
   * Body-centered references are dropped: items are barycentric-only post-cutover.
   * TEMPORARY — scheduled for removal alongside the legacy `kinematics` schema field
   * (per MESSAGE_CONTRACT.md sunset 2026-06-30).
   */
  _convertLegacyItemKinematics(kinematics) {
    if (!kinematics || typeof kinematics !== 'object') {
      return { spatial: null, motion: null };
    }

    const reference = kinematics.reference || {};
    const solarSystemId = this.toNonEmptyString(reference.solarSystemId);
    const positionKm = this.normalizeTriple(kinematics.position);
    const epochMs = this.isFiniteNumber(reference.epochMs) ? reference.epochMs : null;

    const spatial =
      solarSystemId && positionKm && epochMs !== null
        ? {
            solarSystemId,
            frame: 'barycentric',
            positionKm,
            epochMs,
          }
        : null;

    const velocityKmPerSec = this.normalizeTriple(kinematics.velocity);
    const motion = velocityKmPerSec ? { velocityKmPerSec } : null;

    return { spatial, motion };
  }

  normalizeItem(item) {
    const source = this.toPlainObject(item) || {};
    const normalizedContainer = source.container
      ? {
          containerType: this.toNonEmptyString(source.container.containerType),
          containerId: this.toNonEmptyString(source.container.containerId),
        }
      : null;

    let spatial = this.normalizeSpatialState(source.spatial);
    let motion = this.normalizeMotionState(source.motion);

    if (!spatial && source.kinematics) {
      const converted = this._convertLegacyItemKinematics(source.kinematics);
      spatial = spatial || converted.spatial;
      motion = motion || converted.motion;
    }

    const { kinematics: _legacyKinematics, ...rest } = source;

    return {
      ...rest,
      id: this.toNonEmptyString(source.id),
      itemType: this.toNonEmptyString(source.itemType),
      displayName: this.toNonEmptyString(source.displayName),
      state: this.toNonEmptyString(source.state),
      damageStatus: this.toNonEmptyString(source.damageStatus),
      container: normalizedContainer,
      owningPlayerId: this.toNonEmptyString(source.owningPlayerId),
      owningCharacterId: this.toNonEmptyString(source.owningCharacterId),
      spatial,
      ...(motion ? { motion } : {}),
      createdAt: this.toNonEmptyString(source.createdAt),
      updatedAt: this.toNonEmptyString(source.updatedAt),
      destroyedAt: this.toNonEmptyString(source.destroyedAt) || null,
      destroyedReason: this.toNonEmptyString(source.destroyedReason) || null,
      launchable: source.launchable != null ? Boolean(source.launchable) : true,
      quantity: Number.isInteger(source.quantity) && source.quantity > 0 ? source.quantity : 1,
    };
  }

  normalizeCreditLedgerEntry(entry) {
    const source = this.toPlainObject(entry) || {};

    return {
      type: this.toNonEmptyString(source.type),
      amount: typeof source.amount === 'number' ? source.amount : 0,
      description: this.toNonEmptyString(source.description),
      timestamp: this.toNonEmptyString(source.timestamp),
      referenceId: this.toNonEmptyString(source.referenceId) || null,
    };
  }

  calculateCharacterCredits(character) {
    const source = this.toPlainObject(character) || {};
    const creditLedger = Array.isArray(source.creditLedger)
      ? source.creditLedger.map((entry) => this.normalizeCreditLedgerEntry(entry))
      : [];

    return creditLedger.reduce((total, entry) => {
      return entry.type === 'put' ? total + entry.amount : total - entry.amount;
    }, 0);
  }

  normalizeCharacter(character) {
    const source = this.toPlainObject(character) || {};
    const characterName =
      this.toNonEmptyString(source.characterName) || this.toNonEmptyString(source.name);
    const ships = Array.isArray(source.ships)
      ? source.ships.map((ship) => this.normalizeShip(ship))
      : [];
    const missions = Array.isArray(source.missions)
      ? source.missions.map((mission) => this.normalizeMission(mission))
      : [];
    const creditLedger = Array.isArray(source.creditLedger)
      ? source.creditLedger.map((entry) => this.normalizeCreditLedgerEntry(entry))
      : [];
    const credits = creditLedger.reduce((total, entry) => {
      return entry.type === 'put' ? total + entry.amount : total - entry.amount;
    }, 0);

    return {
      ...source,
      characterName: characterName || source.characterName || source.name || '',
      ships,
      missions,
      creditLedger,
      credits,
    };
  }

  normalizeMission(mission) {
    const source = this.toPlainObject(mission) || {};

    return {
      ...source,
      missionId: this.toNonEmptyString(source.missionId),
      status: this.toNonEmptyString(source.status),
      startedAt: this.toNonEmptyString(source.startedAt) || undefined,
      inProgressAt: this.toNonEmptyString(source.inProgressAt) || undefined,
      failedAt: this.toNonEmptyString(source.failedAt) || undefined,
      completedAt: this.toNonEmptyString(source.completedAt) || undefined,
      updatedAt: this.toNonEmptyString(source.updatedAt) || undefined,
      failureReason: typeof source.failureReason === 'string' ? source.failureReason : undefined,
      statusDetail: typeof source.statusDetail === 'string' ? source.statusDetail : undefined,
    };
  }

  normalizeCelestialBody(celestialBody) {
    const source = this.toPlainObject(celestialBody) || {};

    let spatial = this.normalizeSpatialState(source.spatial);
    let motion = this.normalizeMotionState(source.motion);
    let physical = this.normalizePhysicalState(source.physical);

    if (!spatial) {
      throw new Error(
        "CelestialBody: spatial state is required. Provide spatial with solarSystemId, frame:'barycentric', positionKm, and epochMs."
      );
    }

    const observability = this.normalizeObservabilityState(source.observability);

    return {
      id: this.toNonEmptyString(source.id),
      catalogId: this.toNonEmptyString(source.catalogId),
      sourceScanId: this.toNonEmptyString(source.sourceScanId),
      createdByCharacterId: this.toNonEmptyString(source.createdByCharacterId),
      missionId: this.toNonEmptyString(source.missionId) || null,
      missionInstanceId: this.toNonEmptyString(source.missionInstanceId) || null,
      createdAt: this.toNonEmptyString(source.createdAt),
      updatedAt: this.toNonEmptyString(source.updatedAt),
      spatial,
      ...(motion ? { motion } : {}),
      ...(physical ? { physical } : {}),
      observability,
      composition: source.composition
        ? {
            rarity: this.toNonEmptyString(source.composition.rarity),
            material: this.toNonEmptyString(source.composition.material),
            textureColor: this.toNonEmptyString(source.composition.textureColor),
          }
        : null,
      state: this.toNonEmptyString(source.state) || 'active',
      destroyedAt: this.toNonEmptyString(source.destroyedAt) || null,
      destroyedReason: this.toNonEmptyString(source.destroyedReason) || null,
      debrisSeed: Number.isInteger(source.debrisSeed) ? source.debrisSeed : null,
      debris: Array.isArray(source.debris)
        ? source.debris.map((entry) => ({
            material: this.toNonEmptyString(entry?.material),
            rarity: this.toNonEmptyString(entry?.rarity),
            quantity: Number.isInteger(entry?.quantity) && entry.quantity > 0 ? entry.quantity : 1,
            itemType: this.toNonEmptyString(entry?.itemType),
          }))
        : [],
    };
  }

  getCelestialBody(celestialBodyId) {
    const normalizedCelestialBodyId = this.toNonEmptyString(celestialBodyId);

    if (!normalizedCelestialBodyId) {
      return null;
    }

    return this.celestialBodiesById.get(normalizedCelestialBodyId) || null;
  }

  async getCelestialBodyByIdAsync(celestialBodyId) {
    const normalizedCelestialBodyId = this.toNonEmptyString(celestialBodyId);
    if (!normalizedCelestialBodyId) {
      return null;
    }

    const cached = this.getCelestialBody(normalizedCelestialBodyId);
    if (cached) {
      return cached;
    }

    const celestialBody = await this.withDbOrNull(
      'fetching celestial body by id from DB',
      (databaseService) => databaseService.getCelestialBodyById(normalizedCelestialBodyId)
    );
    if (!celestialBody) {
      return null;
    }

    const normalized = this.normalizeCelestialBody(celestialBody);
    this.celestialBodiesById.set(normalized.id, normalized);
    return normalized;
  }

  async getCelestialBodiesAsync(query = {}) {
    const normalizedSolarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const normalizedCreatedByCharacterId = this.toNonEmptyString(query?.createdByCharacterId);
    const normalizedMissionId = this.toNonEmptyString(query?.missionId);
    const normalizedStateValues = Array.isArray(query?.stateValues)
      ? query.stateValues
          .map((stateValue) => this.toNonEmptyString(stateValue))
          .filter((stateValue) => Boolean(stateValue))
      : [];

    const cacheMatches = Array.from(this.celestialBodiesById.values())
      .map((celestialBody) => this.normalizeCelestialBody(celestialBody))
      .filter((celestialBody) => {
        if (
          normalizedSolarSystemId &&
          celestialBody.spatial?.solarSystemId !== normalizedSolarSystemId
        ) {
          return false;
        }

        if (
          normalizedCreatedByCharacterId &&
          celestialBody.createdByCharacterId !== normalizedCreatedByCharacterId
        ) {
          return false;
        }

        if (normalizedMissionId && celestialBody.missionId !== normalizedMissionId) {
          return false;
        }

        if (
          normalizedStateValues.length > 0 &&
          !normalizedStateValues.includes(celestialBody.state)
        ) {
          return false;
        }

        return true;
      });

    const fromDb = await this.withDbOrNull('fetching celestial bodies from DB', (databaseService) =>
      databaseService.getCelestialBodies({
        solarSystemId: normalizedSolarSystemId || undefined,
        createdByCharacterId: normalizedCreatedByCharacterId || undefined,
        missionId: normalizedMissionId || undefined,
        stateValues: normalizedStateValues.length > 0 ? normalizedStateValues : undefined,
      })
    );

    if (Array.isArray(fromDb)) {
      const mergedById = new Map();
      for (const celestialBody of cacheMatches) {
        mergedById.set(celestialBody.id, celestialBody);
      }

      for (const celestialBody of fromDb) {
        const normalizedCelestialBody = this.normalizeCelestialBody(celestialBody);
        this.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
        mergedById.set(normalizedCelestialBody.id, normalizedCelestialBody);
      }

      return [...mergedById.values()];
    }

    return cacheMatches;
  }

  async deleteCelestialBodyByIdAsync(celestialBodyId) {
    const normalizedCelestialBodyId = this.toNonEmptyString(celestialBodyId);
    if (!normalizedCelestialBodyId) {
      return false;
    }

    await this.withDb('deleting celestial body in DB', (databaseService) =>
      databaseService.deleteCelestialBodyById(normalizedCelestialBodyId)
    );

    return this.celestialBodiesById.delete(normalizedCelestialBodyId);
  }

  getItem(itemId) {
    const normalizedItemId = this.toNonEmptyString(itemId);

    if (!normalizedItemId) {
      return null;
    }

    return this.itemsById.get(normalizedItemId) || null;
  }

  cacheCharacters(playerName, characters) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    if (!normalizedPlayerName) {
      return [];
    }

    const clonedCharacters = Array.isArray(characters)
      ? characters.map((character) => this.normalizeCharacter(character))
      : [];

    this.setCharacters(normalizedPlayerName, clonedCharacters);
    return clonedCharacters;
  }

  cacheItems(items) {
    const normalizedItems = Array.isArray(items)
      ? items.map((item) => this.normalizeItem(item)).filter((item) => Boolean(item.id))
      : [];

    for (const item of normalizedItems) {
      this.itemsById.set(item.id, item);
    }

    return normalizedItems;
  }

  async getItemsByIdsAsync(itemIds) {
    const normalizedItemIds = Array.isArray(itemIds)
      ? itemIds.map((itemId) => this.toNonEmptyString(itemId)).filter((itemId) => Boolean(itemId))
      : [];

    if (normalizedItemIds.length === 0) {
      return [];
    }

    const cachedById = new Map(
      normalizedItemIds
        .map((itemId) => [itemId, this.getItem(itemId)])
        .filter(([, item]) => Boolean(item))
        .map(([itemId, item]) => [itemId, this.normalizeItem(item)])
    );

    const itemsFromDb = await this.withDbOrNull('fetching items from DB', (databaseService) =>
      databaseService.getItemsByIds(normalizedItemIds)
    );

    if (Array.isArray(itemsFromDb)) {
      const dbItems = this.cacheItems(itemsFromDb);
      for (const item of dbItems) {
        cachedById.set(item.id, item);
      }
    }

    return normalizedItemIds
      .map((itemId) => cachedById.get(itemId) || null)
      .filter((item) => Boolean(item))
      .map((item) => this.normalizeItem(item));
  }

  async addItemsAsync(items) {
    const normalizedItems = this.cacheItems(items);

    try {
      await this.withDb('adding items in DB', (databaseService) =>
        databaseService.addItems(normalizedItems)
      );
    } catch (error) {
      for (const item of normalizedItems) {
        this.itemsById.delete(item.id);
      }
      throw error;
    }

    return normalizedItems;
  }

  async deleteItemsAsync(itemIds) {
    const normalizedItemIds = Array.isArray(itemIds)
      ? itemIds.map((itemId) => this.toNonEmptyString(itemId)).filter((itemId) => Boolean(itemId))
      : [];

    if (normalizedItemIds.length === 0) {
      return;
    }

    await this.withDb('deleting items in DB', (databaseService) =>
      databaseService.deleteItemsByIds(normalizedItemIds)
    );

    for (const itemId of normalizedItemIds) {
      this.itemsById.delete(itemId);
    }
  }

  async updateItemAsync(itemId, updates) {
    const normalizedItemId = this.toNonEmptyString(itemId);
    if (!normalizedItemId) {
      return null;
    }

    const existing = this.getItem(normalizedItemId);
    if (!existing) {
      return null;
    }

    const updatedItem = this.normalizeItem({ ...existing, ...updates });
    this.itemsById.set(normalizedItemId, updatedItem);

    await this.withDbOrNull('updating item in DB', (databaseService) =>
      databaseService.updateItemById(normalizedItemId, updatedItem)
    );

    return updatedItem;
  }

  async getItemsByContainerAsync(containerType, containerId) {
    const normalizedContainerType = this.toNonEmptyString(containerType);
    const normalizedContainerId = this.toNonEmptyString(containerId);

    if (!normalizedContainerType || !normalizedContainerId) {
      return [];
    }

    const cachedMatches = [...this.itemsById.values()].filter(
      (item) =>
        item.container?.containerType === normalizedContainerType &&
        item.container?.containerId === normalizedContainerId
    );

    const itemsFromDb = await this.withDbOrNull(
      'fetching items by container from DB',
      (databaseService) =>
        databaseService.getItemsByContainer(normalizedContainerType, normalizedContainerId)
    );

    if (Array.isArray(itemsFromDb)) {
      const dbItems = this.cacheItems(itemsFromDb);
      const mergedById = new Map();

      for (const item of cachedMatches) {
        mergedById.set(item.id, this.normalizeItem(item));
      }

      for (const item of dbItems) {
        mergedById.set(item.id, item);
      }

      return [...mergedById.values()];
    }

    return cachedMatches.map((item) => this.normalizeItem(item));
  }

  async syncShipInventoryReferenceForItemAsync(playerName, previousItem, nextItem) {
    const canonicalPlayerName = this.toNonEmptyString(playerName);
    if (!canonicalPlayerName || !nextItem?.id) {
      return;
    }

    await this.getCharactersAsync(canonicalPlayerName);

    const normalizedPreviousCharacterId = this.toNonEmptyString(previousItem?.owningCharacterId);
    const normalizedNextCharacterId = this.toNonEmptyString(nextItem?.owningCharacterId);
    const normalizedNextItemType = this.toNonEmptyString(nextItem?.itemType);
    const normalizedNextShipId = this.toNonEmptyString(nextItem?.container?.containerId);
    const shouldAttachToShip =
      this.toNonEmptyString(nextItem?.container?.containerType) === 'ship' &&
      Boolean(normalizedNextShipId) &&
      Boolean(normalizedNextCharacterId) &&
      Boolean(normalizedNextItemType);

    const candidateCharacterIds = new Set(
      [normalizedPreviousCharacterId, normalizedNextCharacterId].filter((value) => Boolean(value))
    );

    for (const characterId of candidateCharacterIds) {
      const character = this.findCharacter(canonicalPlayerName, characterId);
      if (!character) {
        continue;
      }

      const ships = Array.isArray(character.ships) ? character.ships : [];
      let changed = false;

      const nextShips = ships.map((ship) => {
        const inventory = Array.isArray(ship.inventory) ? ship.inventory : [];
        const filteredInventory = inventory.filter((entry) => entry?.itemId !== nextItem.id);
        const wasRemoved = filteredInventory.length !== inventory.length;

        let nextInventory = filteredInventory;
        if (
          shouldAttachToShip &&
          characterId === normalizedNextCharacterId &&
          ship.id === normalizedNextShipId
        ) {
          nextInventory = [
            ...filteredInventory,
            {
              itemId: nextItem.id,
              itemType: normalizedNextItemType,
            },
          ];
        }

        if (wasRemoved || nextInventory.length !== inventory.length) {
          changed = true;
          return {
            ...ship,
            inventory: nextInventory,
          };
        }

        return ship;
      });

      if (changed) {
        await this.updateCharacterAsync(canonicalPlayerName, characterId, {
          ships: nextShips,
        });
      }
    }
  }

  async hydrateShipAsync(ship) {
    const normalizedShip = this.normalizeShip(ship);
    const inventoryReferences = Array.isArray(normalizedShip.inventory)
      ? normalizedShip.inventory
      : [];
    const inventoryItemIds = inventoryReferences.map((reference) => reference.itemId);
    const referencedItems = await this.getItemsByIdsAsync(inventoryItemIds);
    const containedItems = normalizedShip.id
      ? await this.getItemsByContainerAsync('ship', normalizedShip.id)
      : [];

    const itemsById = new Map();
    for (const item of containedItems) {
      itemsById.set(item.id, item);
    }
    for (const item of referencedItems) {
      itemsById.set(item.id, item);
    }

    const referencedInOrder = inventoryReferences
      .map((reference) => itemsById.get(reference.itemId) || null)
      .filter((item) => Boolean(item));

    const additionalContainedItems = containedItems.filter(
      (item) => !inventoryItemIds.includes(item.id)
    );

    return {
      ...normalizedShip,
      inventory: [...referencedInOrder, ...additionalContainedItems],
    };
  }

  async hydrateShipsAsync(ships) {
    if (!Array.isArray(ships) || ships.length === 0) {
      return [];
    }

    return Promise.all(ships.map((ship) => this.hydrateShipAsync(ship)));
  }

  hasValidSession(payload) {
    const player = this.getPlayer(payload?.playerName);
    const sessionKey = this.toNonEmptyString(payload?.sessionKey);

    if (!player || !sessionKey || !player.sessionKey) {
      return false;
    }

    return player.sessionKey === sessionKey;
  }

  async ensurePlayerLoadedAsync(playerName) {
    return persistenceBridge.ensurePlayerLoadedAsync(this, playerName);
  }

  async hasValidSessionAsync(payload) {
    return persistenceBridge.hasValidSessionAsync(this, payload);
  }

  logHandlerMessage(messageType, payload) {
    const player = this.toNonEmptyString(payload?.playerName) || '-';
    const character =
      this.toNonEmptyString(payload?.characterId) ||
      this.toNonEmptyString(payload?.characterName) ||
      '-';
    const sessionId = this.toNonEmptyString(payload?.sessionKey) || '-';

    this.log(
      `[handler] messageType=${messageType} player=${player} character=${character} sessionId=${sessionId}`
    );
  }

  findCharacter(playerName, characterId) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const normalizedCharacterId = this.toNonEmptyString(characterId);

    if (!normalizedPlayerName || !normalizedCharacterId) {
      return null;
    }

    const characters = this.getCharacters(normalizedPlayerName);
    return characters.find((character) => character.id === normalizedCharacterId) || null;
  }

  joinCharacterToGame(playerName, character) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    if (!normalizedPlayerName || !character) {
      return null;
    }

    const now = this.getCurrentTimestamp();
    const participant = this.game.joinCharacter({
      playerName,
      normalizedPlayerName,
      characterId: character.id,
      characterName: character.characterName,
      timestamp: now,
    });

    character.inGame = true;
    character.gameJoinedAt = participant.joinedAt;
    character.gameLastMessageReceivedAt = participant.lastMessageReceivedAt;

    return participant;
  }

  touchJoinedCharacters(payload) {
    const normalizedPlayerName = this.normalizePlayerName(payload?.playerName);
    if (!normalizedPlayerName) {
      return [];
    }

    const now = this.getCurrentTimestamp();
    const characterId = this.toNonEmptyString(payload?.characterId);
    const touched = this.game.touchParticipants({
      normalizedPlayerName,
      characterId: characterId || '',
      timestamp: now,
    });

    for (const participant of touched) {
      const character = this.findCharacter(
        participant.normalizedPlayerName,
        participant.characterId
      );

      if (!character) {
        continue;
      }

      character.inGame = true;
      character.gameJoinedAt = participant.joinedAt;
      character.gameLastMessageReceivedAt = participant.lastMessageReceivedAt;
    }

    return touched;
  }

  renameJoinedCharacter(playerName, characterId, characterName) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const normalizedCharacterId = this.toNonEmptyString(characterId);
    const normalizedCharacterName = this.toNonEmptyString(characterName);

    if (!normalizedPlayerName || !normalizedCharacterId || !normalizedCharacterName) {
      return null;
    }

    return this.game.updateCharacterName({
      normalizedPlayerName,
      characterId: normalizedCharacterId,
      characterName: normalizedCharacterName,
    });
  }

  detachCharacterFromGame(playerName, characterId) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const normalizedCharacterId = this.toNonEmptyString(characterId);

    if (!normalizedPlayerName || !normalizedCharacterId) {
      return null;
    }

    const detached = this.game.detachCharacter({
      normalizedPlayerName,
      characterId: normalizedCharacterId,
    });

    const character = this.findCharacter(normalizedPlayerName, normalizedCharacterId);
    if (character) {
      character.inGame = false;
      character.gameJoinedAt = null;
      character.gameLastMessageReceivedAt = null;
    }

    return detached;
  }

  detachIdleGameCharacters() {
    const now = this.getCurrentTimestamp();
    const detached = this.game.detachIdleCharacters(now);

    for (const participant of detached) {
      const character = this.findCharacter(
        participant.normalizedPlayerName,
        participant.characterId
      );

      if (!character) {
        continue;
      }

      character.inGame = false;
      character.gameJoinedAt = null;
      character.gameLastMessageReceivedAt = null;
    }

    return detached;
  }

  /**
   * Async database methods - use MongoDB if available, fall back to in-memory
   */

  async getPlayerAsync(playerName) {
    return persistenceBridge.getPlayerAsync(this, playerName);
  }

  async getCharactersAsync(playerName) {
    return persistenceBridge.getCharactersAsync(this, playerName);
  }

  async registerPlayerAsync(playerData) {
    return persistenceBridge.registerPlayerAsync(this, playerData);
  }

  async updatePlayerAsync(playerName, updates) {
    return persistenceBridge.updatePlayerAsync(this, playerName, updates);
  }

  async addCharacterAsync(playerName, characterData) {
    return persistenceBridge.addCharacterAsync(this, playerName, characterData);
  }

  async deleteCharacterAsync(playerName, characterId) {
    return persistenceBridge.deleteCharacterAsync(this, playerName, characterId);
  }

  async updateCharacterAsync(playerName, characterId, updates) {
    return persistenceBridge.updateCharacterAsync(this, playerName, characterId, updates);
  }

  async addShipAsync(playerName, characterId, shipData) {
    return persistenceBridge.addShipAsync(this, playerName, characterId, shipData);
  }

  async addOrUpdateMissionAsync(playerName, characterId, missionData) {
    return persistenceBridge.addOrUpdateMissionAsync(this, playerName, characterId, missionData);
  }

  async getMissionsAsync(playerName, characterId) {
    return persistenceBridge.getMissionsAsync(this, playerName, characterId);
  }

  async addOrUpdateCelestialBodyAsync(celestialBody) {
    const normalizedCelestialBody = this.normalizeCelestialBody(celestialBody);

    await this.withDb('adding/updating celestial body in DB', (databaseService) =>
      databaseService.addOrUpdateCelestialBody(normalizedCelestialBody)
    );

    this.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
    return normalizedCelestialBody;
  }

  async getCelestialBodiesNearPositionAsync(query) {
    const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const positionKm = query?.positionKm;
    const distanceKm = query?.distanceKm;
    const createdByCharacterId = this.toNonEmptyString(query?.createdByCharacterId);
    const missionId = this.toNonEmptyString(query?.missionId);
    const stateValues = Array.isArray(query?.stateValues)
      ? query.stateValues
          .map((stateValue) => this.toNonEmptyString(stateValue))
          .filter((stateValue) => Boolean(stateValue))
      : [];
    const limit = query?.limit;

    if (
      !solarSystemId ||
      !this.isTriple(positionKm) ||
      !this.isFiniteNumber(distanceKm) ||
      distanceKm < 0
    ) {
      return [];
    }

    let results = [];

    const cacheResults = Array.from(this.celestialBodiesById.values())
      .map((celestialBody) => this.normalizeCelestialBody(celestialBody))
      .filter((celestialBody) => {
        if (celestialBody.spatial?.solarSystemId !== solarSystemId) {
          return false;
        }

        if (createdByCharacterId && celestialBody.createdByCharacterId !== createdByCharacterId) {
          return false;
        }

        if (missionId && celestialBody.missionId !== missionId) {
          return false;
        }

        if (stateValues.length > 0 && !stateValues.includes(celestialBody.state)) {
          return false;
        }

        return true;
      })
      .map((celestialBody) => {
        const legacyPositionKm = /** @type {any} */ (celestialBody)?.location?.positionKm;
        const bodyPositionKm = celestialBody?.spatial?.positionKm || legacyPositionKm;
        if (!this.isTriple(bodyPositionKm)) {
          return null;
        }

        const candidateDistanceKm = this.calculateDistanceKm(positionKm, bodyPositionKm);
        if (candidateDistanceKm > distanceKm) {
          return null;
        }

        return {
          celestialBody,
          distanceKm: candidateDistanceKm,
        };
      })
      .filter((entry) => Boolean(entry));

    const fromDb = await this.withDbOrNull('finding celestial bodies from DB', (databaseService) =>
      databaseService.findCelestialBodiesNearPosition({
        solarSystemId,
        positionKm,
        distanceKm,
        createdByCharacterId: createdByCharacterId || undefined,
        missionId: missionId || undefined,
        stateValues: stateValues.length > 0 ? stateValues : undefined,
      })
    );

    if (Array.isArray(fromDb)) {
      const fromDbResults = fromDb.map((entry) => {
        const normalizedCelestialBody = this.normalizeCelestialBody(entry.celestialBody);
        this.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
        return {
          celestialBody: normalizedCelestialBody,
          distanceKm: entry.distanceKm,
        };
      });

      const mergedById = new Map();
      for (const entry of cacheResults) {
        mergedById.set(entry.celestialBody.id, entry);
      }
      for (const entry of fromDbResults) {
        mergedById.set(entry.celestialBody.id, entry);
      }

      results = [...mergedById.values()].sort((left, right) => left.distanceKm - right.distanceKm);
    } else {
      results = cacheResults.sort((left, right) => left.distanceKm - right.distanceKm);
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      return results;
    }

    return results.slice(0, limit);
  }

  async getItemsNearPositionAsync(query) {
    const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const positionKm = query?.positionKm;
    const distanceKm = query?.distanceKm;
    const itemType = this.toNonEmptyString(query?.itemType);
    const limit = query?.limit;

    if (
      !solarSystemId ||
      !this.isTriple(positionKm) ||
      !this.isFiniteNumber(distanceKm) ||
      distanceKm < 0
    ) {
      return [];
    }

    let results = [];

    const cacheResults = Array.from(this.itemsById.values())
      .map((item) => this.normalizeItem(item))
      .filter((item) => {
        if (item.spatial?.solarSystemId !== solarSystemId) {
          return false;
        }

        if (itemType && item.itemType !== itemType) {
          return false;
        }

        return true;
      })
      .map((item) => {
        const itemPositionKm = item?.spatial?.positionKm;
        if (!this.isTriple(itemPositionKm)) {
          return null;
        }

        const candidateDistanceKm = this.calculateDistanceKm(positionKm, itemPositionKm);
        if (candidateDistanceKm > distanceKm) {
          return null;
        }

        return {
          item,
          distanceKm: candidateDistanceKm,
        };
      })
      .filter((entry) => Boolean(entry));

    const fromDb = await this.withDbOrNull('finding items from DB', (databaseService) =>
      databaseService.findItemsNearPosition({
        solarSystemId,
        positionKm,
        distanceKm,
        itemType: itemType || undefined,
      })
    );

    if (Array.isArray(fromDb)) {
      const fromDbResults = fromDb.map((entry) => {
        const normalizedItem = this.normalizeItem(entry.item);
        this.itemsById.set(normalizedItem.id, normalizedItem);
        return {
          item: normalizedItem,
          distanceKm: entry.distanceKm,
        };
      });

      const mergedById = new Map();
      for (const entry of cacheResults) {
        mergedById.set(entry.item.id, entry);
      }
      for (const entry of fromDbResults) {
        mergedById.set(entry.item.id, entry);
      }

      results = [...mergedById.values()].sort((left, right) => left.distanceKm - right.distanceKm);
    } else {
      results = cacheResults.sort((left, right) => left.distanceKm - right.distanceKm);
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      return results;
    }

    return results.slice(0, limit);
  }
}

module.exports = {
  MessageHandlerContext,
};
