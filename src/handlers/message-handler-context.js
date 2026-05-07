'use strict';

const { GameState } = require('../model/game');
const { MARKET_CATALOG, MARKET_CATALOG_BY_ID } = require('../model/market-catalog');
const { computeMidpointPrice } = require('../model/market-pricing');
const {
  SOLAR_SYSTEM_MARKET_SEED_VERSION,
  buildSeededMarketsForSolarSystem
} = require('../model/solar-system-market-seed');
const { buildSeededGateNetwork } = require('../model/solar-system-gate-seed');
const SUPPORTED_LOCALES = new Set(['en', 'it']);
const DEFAULT_RESTOCK_INTERVAL_MINUTES = 60;
const MARKET_DOCKING_DISTANCE_KM = 50;
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;

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
    marketCanSell: Boolean(catalogEntry.marketCanSell)
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
    this.createId = options.createId || (() => {
      throw new Error('createId is required');
    });
    this.getCurrentTimestamp =
      options.getCurrentTimestamp || (() => new Date().toISOString());
    this._gateGraph = null;

    if (this.marketsByKey.size === 0) {
      this.seedDefaultMarkets();
    }
  }

  seedDefaultMarkets() {
    const now = new Date().toISOString();
    const systemIds = ['sol', 'alpha-centauri', 'barnards-star'];

    for (const systemId of systemIds) {
      const defaults = buildSeededMarketsForSolarSystem(systemId, now);
      for (const market of defaults) {
        this.cacheMarket(this.createSeedMarketPayload(market, now));
      }
    }
  }

  createSeedMarketPayload(seedMarket, timestamp) {
    return {
      ...seedMarket,
      restockIntervalMinutes: Number.isInteger(seedMarket?.restockIntervalMinutes)
        && seedMarket.restockIntervalMinutes > 0
        ? seedMarket.restockIntervalMinutes
        : DEFAULT_RESTOCK_INTERVAL_MINUTES,
      lastRestockAt: this.toNonEmptyString(seedMarket?.lastRestockAt) || timestamp,
      inventory: MARKET_CATALOG.map((catalogEntry) => buildDefaultInventoryEntry(catalogEntry)),
      ledger: []
    };
  }

  normalizeMarketOrbit(value) {
    const source = this.toPlainObject(value) || {};

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
      epoch: this.toNonEmptyString(source.epoch) || this.getCurrentTimestamp()
    };
  }

  isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  isTriple(value) {
    return Boolean(value)
      && this.isFiniteNumber(value.x)
      && this.isFiniteNumber(value.y)
      && this.isFiniteNumber(value.z);
  }

  normalizeTriple(value) {
    if (!this.isTriple(value)) {
      return null;
    }

    return {
      x: value.x,
      y: value.y,
      z: value.z
    };
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
      epochMs
    };
  }

  // Convert legacy location/kinematics to spatial (backward compatibility)
  convertLegacyShipToSpatial(ship) {
    const source = this.toPlainObject(ship) || {};

    // If spatial already exists, use it
    if (source.spatial) {
      return source.spatial;
    }

    // Try to build from legacy kinematics
    if (source.kinematics && source.kinematics.reference) {
      const ref = source.kinematics.reference;
      const position = source.kinematics.position || (source.location?.positionKm);

      if (this.isTriple(position) && this.toNonEmptyString(ref.solarSystemId)) {
        return {
          solarSystemId: ref.solarSystemId,
          frame: 'barycentric',
          positionKm: position,
          epochMs: ref.epochMs || 0
        };
      }
    }

    // Try legacy location
    if (source.location && this.isTriple(source.location.positionKm)) {
      return {
        solarSystemId: source.solarSystemId || 'sol',
        frame: 'barycentric',
        positionKm: source.location.positionKm,
        epochMs: 0
      };
    }

    return null;
  }

  // Convert legacy kinematics to motion (backward compatibility)
  convertLegacyShipToMotion(ship) {
    const source = this.toPlainObject(ship) || {};

    // If motion already exists, use it
    if (source.motion) {
      return source.motion;
    }

    // Try to build from legacy kinematics
    if (source.kinematics && this.isTriple(source.kinematics.velocity)) {
      return {
        velocityKmPerSec: source.kinematics.velocity
      };
    }

    return null;
  }

  // Convert legacy celestial body fields to spatial (backward compatibility)
  convertLegacyCelestialBodyToSpatial(body) {
    const source = this.toPlainObject(body) || {};

    // If spatial already exists, use it
    if (source.spatial) {
      return source.spatial;
    }

    // Try to build from legacy location + solarSystemId
    if (source.location && this.isTriple(source.location.positionKm)) {
      return {
        solarSystemId: source.solarSystemId || 'sol',
        frame: 'barycentric',
        positionKm: source.location.positionKm,
        epochMs: 0
      };
    }

    return null;
  }

  // Convert legacy kinematics to motion/physical (backward compatibility)
  convertLegacyCelestialBodyToMotionAndPhysical(body) {
    const source = this.toPlainObject(body) || {};
    const motion = {};
    const physical = {};
    let hasMotion = false;
    let hasPhysical = false;

    if (source.kinematics) {
      if (this.isTriple(source.kinematics.velocityKmPerSec)) {
        motion.velocityKmPerSec = source.kinematics.velocityKmPerSec;
        hasMotion = true;
      }

      if (this.isTriple(source.kinematics.angularVelocityRadPerSec)) {
        motion.angularVelocityRadPerSec = source.kinematics.angularVelocityRadPerSec;
        hasMotion = true;
      }

      if (this.isFiniteNumber(source.kinematics.estimatedMassKg)) {
        physical.estimatedMassKg = source.kinematics.estimatedMassKg;
        hasPhysical = true;
      }

      if (this.isFiniteNumber(source.kinematics.estimatedDiameterM)) {
        physical.estimatedDiameterM = source.kinematics.estimatedDiameterM;
        hasPhysical = true;
      }
    }

    return {
      motion: hasMotion ? motion : null,
      physical: hasPhysical ? physical : null
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
      ...(angularVelocityRadPerSec ? { angularVelocityRadPerSec } : {})
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
      ...(estimatedDiameterM !== undefined ? { estimatedDiameterM } : {})
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
      scanState: ['unscanned', 'scanned'].includes(scanState) ? scanState : 'unscanned'
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
      kind
    };

    if (kind === 'orbital-elements' && source.orbit) {
      trajectory.orbit = this.normalizeMarketOrbit(source.orbit);
    }

    return trajectory;
  }

  calculateDistanceKm(fromPositionKm, toPositionKm) {
    const dx = toPositionKm.x - fromPositionKm.x;
    const dy = toPositionKm.y - fromPositionKm.y;
    const dz = toPositionKm.z - fromPositionKm.z;

    return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
  }

  calculateDistanceAu(fromPositionKm, toPositionKm) {
    return this.calculateDistanceKm(fromPositionKm, toPositionKm) / ASTRONOMICAL_UNIT_KM;
  }

  async loadGateNetworkAsync() {
    if (this._gateGraph !== null) {
      return this._gateGraph;
    }

    const gates = this.databaseService
      ? await this.databaseService.getJumpGatesAsync()
      : buildSeededGateNetwork();

    const graph = new Map();
    for (const gate of gates) {
      if (!graph.has(gate.sourceSystemId)) {
        graph.set(gate.sourceSystemId, []);
      }
      graph.get(gate.sourceSystemId).push(gate);
    }

    this._gateGraph = graph;
    return graph;
  }

  async getHopPathBetweenSystems(sourceSystemId, destSystemId) {
    if (sourceSystemId === destSystemId) {
      return { hops: 0, path: [] };
    }

    const graph = await this.loadGateNetworkAsync();
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
            path: [...current.path, gate.gateId]
          });
        }
      }
    }

    return null;
  }

  async getRouteForMarketAsync(requestSolarSystemId, marketSolarSystemId) {
    if (marketSolarSystemId === requestSolarSystemId) {
      return { kind: 'in-system' };
    }

    const hopPath = await this.getHopPathBetweenSystems(requestSolarSystemId, marketSolarSystemId);
    if (hopPath) {
      return { kind: 'gate-route', hops: hopPath.hops };
    }

    return { kind: 'no-route' };
  }

  toNonEmptyString(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  normalizeLocale(value) {
    const raw = this.toNonEmptyString(value).toLowerCase();
    if (!raw) {
      return 'en';
    }

    const base = raw.split('-')[0];
    return SUPPORTED_LOCALES.has(base) ? base : 'en';
  }

  normalizePlayerName(value) {
    const playerName = this.toNonEmptyString(value);

    if (!playerName) {
      return '';
    }

    return playerName.toLowerCase();
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
      preferredLocale: this.normalizeLocale(
        playerData.preferredLocale ?? existing.preferredLocale
      )
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
    const defaults = catalogEntry ? buildDefaultInventoryEntry(catalogEntry) : {
      itemId: this.toNonEmptyString(source.itemId),
      stock: 0,
      maxStock: 0,
      restockPerInterval: 0,
      marketCanBuy: false,
      marketCanSell: false
    };

    return {
      itemId: defaults.itemId,
      stock: Number.isInteger(source.stock) && source.stock >= 0 ? source.stock : defaults.stock,
      maxStock: Number.isInteger(source.maxStock) && source.maxStock >= 0
        ? source.maxStock
        : defaults.maxStock,
      restockPerInterval: Number.isInteger(source.restockPerInterval) && source.restockPerInterval >= 0
        ? source.restockPerInterval
        : defaults.restockPerInterval,
      marketCanBuy: source.marketCanBuy != null ? Boolean(source.marketCanBuy) : defaults.marketCanBuy,
      marketCanSell: source.marketCanSell != null ? Boolean(source.marketCanSell) : defaults.marketCanSell
    };
  }

  normalizeMarket(market) {
    const source = this.toPlainObject(market) || {};
    const marketId = this.toNonEmptyString(source.marketId);
    const solarSystemId = this.toNonEmptyString(source.solarSystemId);
    const orbit = this.normalizeMarketOrbit(source.orbit);
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
      if (!positionKm && orbit && this.isFiniteNumber(orbit.semiMajorAxisKm) && source.solarSystemId) {
        // Fallback: use semi-major axis as approximate position (only for static markets)
        positionKm = { x: orbit.semiMajorAxisKm, y: 0, z: 0 };
      }

      if (positionKm && solarSystemId) {
        spatial = {
          solarSystemId,
          frame: 'barycentric',
          positionKm,
          epochMs: source.spatial?.epochMs || Date.parse(orbit?.epoch || new Date().toISOString())
        };
      }
    }

    // Handle trajectory: wrap orbit if present
    let trajectory = null;
    if (orbit && (orbit.anchorBodyId || Object.keys(orbit).length > 0)) {
      trajectory = {
        kind: 'orbital-elements',
        orbit
      };
    }

    const result = {
      marketId,
      solarSystemId,
      marketName: this.toNonEmptyString(source.marketName),
      siteType: this.toNonEmptyString(source.siteType) || this.toNonEmptyString(source.locationType),
      siteName: this.toNonEmptyString(source.siteName) || this.toNonEmptyString(source.locationName),
      isStarterMarket: Boolean(source.isStarterMarket),
      priceMultiplier: this.isFiniteNumber(source.priceMultiplier) && source.priceMultiplier > 0
        ? source.priceMultiplier
        : 1,
      driftPercentPerHour: this.isFiniteNumber(source.driftPercentPerHour) && source.driftPercentPerHour >= 0
        ? source.driftPercentPerHour
        : 0,
      restockIntervalMinutes: Number.isInteger(source.restockIntervalMinutes)
        && source.restockIntervalMinutes > 0
        ? source.restockIntervalMinutes
        : DEFAULT_RESTOCK_INTERVAL_MINUTES,
      lastRestockAt: this.toNonEmptyString(source.lastRestockAt) || this.getCurrentTimestamp(),
      inventory,
      ledger
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
    const solarSystemId = this.toNonEmptyString(request?.solarSystemId).toLowerCase() || 'sol';
    const asOf = this.toNonEmptyString(request?.asOf) || this.getCurrentTimestamp();
    const force = Boolean(request?.force);
    const seeded = buildSeededMarketsForSolarSystem(solarSystemId, asOf);

    if (seeded.length === 0) {
      return {
        success: false,
        reason: 'UNSUPPORTED_SOLAR_SYSTEM',
        solarSystemId,
        marketCount: 0
      };
    }

    const payloads = seeded.map((market) => this.createSeedMarketPayload(market, asOf));

    if (!this.databaseService) {
      for (const market of payloads) {
        this.cacheMarket(market);
      }

      return {
        success: true,
        solarSystemId,
        seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
        marketCount: payloads.length,
        source: 'in-memory'
      };
    }

    try {
      const existingSeedState = await this.databaseService.getSolarSystemMarketSeedState(solarSystemId);
      const isCurrentVersion = existingSeedState
        && existingSeedState.seedVersion === SOLAR_SYSTEM_MARKET_SEED_VERSION;

      if (!force && isCurrentVersion) {
        const persistedMarkets = await this.databaseService.getMarkets({ solarSystemId });
        if (Array.isArray(persistedMarkets) && persistedMarkets.length > 0) {
          for (const market of persistedMarkets) {
            this.cacheMarket(market);
          }

          return {
            success: true,
            solarSystemId,
            seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
            marketCount: persistedMarkets.length,
            source: 'database-cache'
          };
        }
      }

      for (const market of payloads) {
        await this.databaseService.upsertMarket(market);
      }

      await this.databaseService.setSolarSystemMarketSeedState(
        solarSystemId,
        SOLAR_SYSTEM_MARKET_SEED_VERSION,
        asOf
      );

      const persistedMarkets = await this.databaseService.getMarkets({ solarSystemId });
      const marketsToCache = persistedMarkets.length > 0 ? persistedMarkets : payloads;
      for (const market of marketsToCache) {
        this.cacheMarket(market);
      }

      return {
        success: true,
        solarSystemId,
        seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
        marketCount: marketsToCache.length,
        source: 'database-upsert'
      };
    } catch (error) {
      this.log(`[context] Error seeding solar system markets: ${error.message}`);

      for (const market of payloads) {
        this.cacheMarket(market);
      }

      return {
        success: true,
        solarSystemId,
        seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
        marketCount: payloads.length,
        source: 'in-memory-fallback'
      };
    }
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
      reversalOfTransactionId: this.toNonEmptyString(source.reversalOfTransactionId) || null
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
    const normalizedSolarSystemId = this.toNonEmptyString(solarSystemId);
    if (!normalizedMarketId) {
      return null;
    }

    if (normalizedSolarSystemId) {
      return this.marketsByKey.get(buildMarketKey(normalizedMarketId, normalizedSolarSystemId)) || null;
    }

    const allMarkets = Array.from(this.marketsByKey.values());
    return allMarkets.find((market) => market.marketId === normalizedMarketId) || null;
  }

  applyMarketRestock(market, nowTimestamp) {
    const asOf = new Date(nowTimestamp);
    const lastRestock = new Date(market.lastRestockAt);
    if (Number.isNaN(asOf.getTime()) || Number.isNaN(lastRestock.getTime())) {
      market.lastRestockAt = this.getCurrentTimestamp();
      return market;
    }

    const elapsedMinutes = Math.floor((asOf.getTime() - lastRestock.getTime()) / (60 * 1000));
    const intervalMinutes = Math.max(1, market.restockIntervalMinutes);
    const intervals = Math.floor(elapsedMinutes / intervalMinutes);
    if (intervals <= 0) {
      return market;
    }

    market.inventory = market.inventory.map((entry) => ({
      ...entry,
      stock: Math.min(
        entry.maxStock,
        entry.stock + (entry.restockPerInterval * intervals)
      )
    }));

    const advancedAt = new Date(lastRestock.getTime() + (intervals * intervalMinutes * 60 * 1000));
    market.lastRestockAt = advancedAt.toISOString();
    this.cacheMarket(market);
    return market;
  }

  async getMarketsAsync(query = {}) {
    const normalizedSolarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const nowTimestamp = this.toNonEmptyString(query?.asOf) || this.getCurrentTimestamp();

    return Array.from(this.marketsByKey.values())
      .filter((market) => !normalizedSolarSystemId || market.solarSystemId === normalizedSolarSystemId)
      .map((market) => this.applyMarketRestock({ ...market }, nowTimestamp))
      .sort((left, right) => left.marketName.localeCompare(right.marketName));
  }

  normalizeAngleRadians(value) {
    const twoPi = Math.PI * 2;
    const normalized = value % twoPi;
    return normalized < 0 ? normalized + twoPi : normalized;
  }

  solveEccentricAnomaly(meanAnomalyRad, eccentricity) {
    let eccentricAnomaly = meanAnomalyRad;

    for (let index = 0; index < 8; index += 1) {
      const delta = (eccentricAnomaly - (eccentricity * Math.sin(eccentricAnomaly)) - meanAnomalyRad)
        / (1 - (eccentricity * Math.cos(eccentricAnomaly)));
      eccentricAnomaly -= delta;

      if (Math.abs(delta) < 1e-8) {
        break;
      }
    }

    return eccentricAnomaly;
  }

  rotatePerifocalVector(perifocalVector, orbit) {
    const omega = (orbit.argumentOfPeriapsisDeg * Math.PI) / 180;
    const inclination = (orbit.inclinationDeg * Math.PI) / 180;
    const ascendingNode = (orbit.longitudeOfAscendingNodeDeg * Math.PI) / 180;

    const cosOmega = Math.cos(omega);
    const sinOmega = Math.sin(omega);
    const cosI = Math.cos(inclination);
    const sinI = Math.sin(inclination);
    const cosNode = Math.cos(ascendingNode);
    const sinNode = Math.sin(ascendingNode);

    const px = perifocalVector.x;
    const py = perifocalVector.y;
    const pz = perifocalVector.z;

    const x = (
      (cosNode * cosOmega - sinNode * sinOmega * cosI) * px
      + (-cosNode * sinOmega - sinNode * cosOmega * cosI) * py
      + (sinNode * sinI) * pz
    );
    const y = (
      (sinNode * cosOmega + cosNode * sinOmega * cosI) * px
      + (-sinNode * sinOmega + cosNode * cosOmega * cosI) * py
      + (-cosNode * sinI) * pz
    );
    const z = ((sinOmega * sinI) * px) + ((cosOmega * sinI) * py) + (cosI * pz);

    return { x, y, z };
  }

  computeRelativeOrbitPositionKm(orbit, timestamp) {
    const a = Math.max(0, orbit.semiMajorAxisKm);
    const e = Math.max(0, Math.min(0.99, orbit.eccentricity));
    const periodSec = Math.max(1, orbit.orbitalPeriodSec);
    const epochMs = Date.parse(orbit.epoch);
    const timestampMs = Date.parse(timestamp);
    const baselineMs = Number.isNaN(epochMs) ? timestampMs : epochMs;
    const nowMs = Number.isNaN(timestampMs) ? baselineMs : timestampMs;

    const meanMotionRadPerSec = (Math.PI * 2) / periodSec;
    const elapsedSec = (nowMs - baselineMs) / 1000;
    const meanAnomalyAtEpoch = (orbit.meanAnomalyAtEpochDeg * Math.PI) / 180;
    const meanAnomaly = this.normalizeAngleRadians(meanAnomalyAtEpoch + (meanMotionRadPerSec * elapsedSec));
    const eccentricAnomaly = this.solveEccentricAnomaly(meanAnomaly, e);

    const xPerifocal = a * (Math.cos(eccentricAnomaly) - e);
    const yPerifocal = a * Math.sqrt(1 - (e * e)) * Math.sin(eccentricAnomaly);

    return this.rotatePerifocalVector(
      { x: xPerifocal, y: yPerifocal, z: 0 },
      orbit
    );
  }

  async resolveMarketPositionKmAsync(market, timestamp) {
    // If spatial is available, use its position directly
    if (this.isTriple(market?.spatial?.positionKm)) {
      return market.spatial.positionKm;
    }

    // Fallback: compute from orbit + anchor body
    const orbit = this.normalizeMarketOrbit(market?.orbit || market?.trajectory?.orbit);
    if (!orbit || !orbit.anchorBodyId) {
      return { x: 0, y: 0, z: 0 };
    }

    const relative = this.computeRelativeOrbitPositionKm(orbit, timestamp || this.getCurrentTimestamp());
    const anchorBody = await this.getCelestialBodyByIdAsync(orbit.anchorBodyId);
    const anchorPosition = this.isTriple(anchorBody?.spatial?.positionKm)
      ? anchorBody.spatial.positionKm
      : (this.isTriple(anchorBody?.location?.positionKm)
        ? anchorBody.location.positionKm
        : { x: 0, y: 0, z: 0 });

    return {
      x: anchorPosition.x + relative.x,
      y: anchorPosition.y + relative.y,
      z: anchorPosition.z + relative.z
    };
  }

  getShipPositionKm(ship) {
    if (this.isTriple(ship?.spatial?.positionKm)) {
      return ship.spatial.positionKm;
    }

    // Fallback for legacy data (should be removed after migration)
    if (this.isTriple(ship?.kinematics?.position)) {
      return ship.kinematics.position;
    }

    if (this.isTriple(ship?.location?.positionKm)) {
      return ship.location.positionKm;
    }

    return null;
  }

  async resolveDockingStateAsync(request = {}) {
    const playerName = this.toNonEmptyString(request.playerName);
    const characterId = this.toNonEmptyString(request.characterId);
    const shipId = this.toNonEmptyString(request.shipId);
    const markets = Array.isArray(request.markets) ? request.markets : [];

    if (!playerName || !characterId || markets.length === 0) {
      return {
        isDocked: false,
        dockedMarketId: null,
        perMarketDocked: new Map()
      };
    }

    const character = this.findCharacter(playerName, characterId);
    if (!character) {
      return {
        isDocked: false,
        dockedMarketId: null,
        perMarketDocked: new Map()
      };
    }

    const ships = Array.isArray(character.ships) ? character.ships : [];
    const ship = shipId
      ? ships.find((candidate) => this.toNonEmptyString(candidate?.id) === shipId) || null
      : ships[0] || null;
    const shipPositionKm = this.getShipPositionKm(ship);
    if (!shipPositionKm) {
      return {
        isDocked: false,
        dockedMarketId: null,
        perMarketDocked: new Map()
      };
    }

    const nearestDock = markets
      .map((market) => ({
        marketId: market.marketId,
        distanceKm: this.calculateDistanceKm(shipPositionKm, market.positionKm)
      }))
      .filter((entry) => entry.distanceKm <= MARKET_DOCKING_DISTANCE_KM)
      .sort((left, right) => left.distanceKm - right.distanceKm)[0] || null;

    const dockedMarketId = nearestDock ? nearestDock.marketId : null;
    const perMarketDocked = new Map(
      markets.map((market) => [market.marketId, market.marketId === dockedMarketId])
    );

    return {
      isDocked: Boolean(dockedMarketId),
      dockedMarketId,
      perMarketDocked
    };
  }

  async getMarketsByLocationAsync(query = {}) {
    const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const positionKm = query?.positionKm;
    const distanceAu = query?.distanceAu;
    const asOf = this.toNonEmptyString(query?.asOf) || this.getCurrentTimestamp();
    const limit = Number.isInteger(query?.limit) && query.limit > 0 ? query.limit : null;
    const locationTypes = Array.isArray(query?.locationTypes)
      ? query.locationTypes
        .map((value) => this.toNonEmptyString(value).toLowerCase())
        .filter((value) => Boolean(value))
      : [];

    if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceAu) || distanceAu < 0) {
      return [];
    }

    const maxDistanceKm = distanceAu * ASTRONOMICAL_UNIT_KM;
    const allMarkets = await this.getMarketsAsync({ asOf });
    const results = [];

    for (const market of allMarkets) {
      const normalizedLocationType = this.toNonEmptyString(market.siteType || market.locationType).toLowerCase();
      if (locationTypes.length > 0 && !locationTypes.includes(normalizedLocationType)) {
        continue;
      }

      if (market.solarSystemId === solarSystemId) {
        const marketPositionKm = await this.resolveMarketPositionKmAsync(market, asOf);
        const computedDistanceKm = this.calculateDistanceKm(positionKm, marketPositionKm);

        if (computedDistanceKm > maxDistanceKm) {
          continue;
        }

        const computedDistanceAu = parseFloat((computedDistanceKm / ASTRONOMICAL_UNIT_KM).toFixed(3));
        results.push({
          ...market,
          positionKm: marketPositionKm,
          _sortKey: 0,
          _sortSecondary: computedDistanceKm,
          distanceAu: computedDistanceAu,
          route: { kind: 'in-system' }
        });
      } else {
        const route = await this.getRouteForMarketAsync(solarSystemId, market.solarSystemId);
        results.push({
          ...market,
          _sortKey: route.kind === 'gate-route' ? 1 : 2,
          _sortSecondary: route.kind === 'gate-route' ? route.hops : 0,
          distanceAu: null,
          route
        });
      }
    }

    const sorted = results.sort((a, b) => {
      if (a._sortKey !== b._sortKey) return a._sortKey - b._sortKey;
      return a._sortSecondary - b._sortSecondary;
    });
    const limited = limit ? sorted.slice(0, limit) : sorted;
    return limited.map(({ _sortKey: _k, _sortSecondary: _s, ...rest }) => rest);
  }

  async getMarketQuoteAsync(request = {}) {
    const marketId = this.toNonEmptyString(request.marketId);
    const solarSystemId = this.toNonEmptyString(request.solarSystemId);
    const itemId = this.toNonEmptyString(request.itemId).toLowerCase();
    const direction = this.toNonEmptyString(request.direction).toLowerCase();
    const quantity = Number.isInteger(request.quantity) ? request.quantity : Number(request.quantity);
    const asOf = this.toNonEmptyString(request.asOf) || this.getCurrentTimestamp();

    const market = this.getMarket(marketId, solarSystemId);
    if (!market) {
      return { success: false, reason: 'MARKET_NOT_FOUND' };
    }

    const catalogEntry = MARKET_CATALOG_BY_ID.get(itemId);
    if (!catalogEntry) {
      return { success: false, reason: 'ITEM_NOT_FOUND' };
    }

    if (direction !== 'buy' && direction !== 'sell') {
      return { success: false, reason: 'INVALID_DIRECTION' };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, reason: 'INVALID_QUANTITY' };
    }

    const hydratedMarket = this.applyMarketRestock({ ...market }, asOf);
    const inventoryEntry = hydratedMarket.inventory.find((entry) => entry.itemId === itemId);
    if (!inventoryEntry || !inventoryEntry.marketCanSell) {
      return { success: false, reason: 'ITEM_NOT_TRADEABLE' };
    }

    if (direction === 'sell' && !inventoryEntry.marketCanBuy) {
      return { success: false, reason: 'MARKET_DOES_NOT_BUY_ITEM' };
    }

    const pricing = computeMidpointPrice({
      baseMidpointPrice: catalogEntry.baseMidpointPrice,
      marketMultiplier: hydratedMarket.priceMultiplier,
      marketId: hydratedMarket.marketId,
      itemId,
      timestamp: asOf,
      driftPercentPerHour: hydratedMarket.driftPercentPerHour
    });

    return {
      success: true,
      quote: {
        marketId: hydratedMarket.marketId,
        solarSystemId: hydratedMarket.solarSystemId,
        itemId,
        itemType: catalogEntry.itemType,
        displayName: catalogEntry.displayName,
        rarity: catalogEntry.rarity,
        direction,
        quantity,
        unitPrice: pricing.midpointPrice,
        totalPrice: pricing.midpointPrice * quantity,
        availableStock: inventoryEntry.stock,
        marketCanBuy: inventoryEntry.marketCanBuy,
        marketCanSell: inventoryEntry.marketCanSell,
        marketMultiplier: hydratedMarket.priceMultiplier,
        driftMultiplier: pricing.driftMultiplier,
        quotedAt: asOf
      }
    };
  }

  async getMarketInventoryAsync(query = {}) {
    const marketId = this.toNonEmptyString(query?.marketId);
    const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const offset = Number.isInteger(query?.offset) && query.offset >= 0 ? query.offset : 0;
    const limit = Number.isInteger(query?.limit) && query.limit > 0 ? query.limit : 50;
    const asOf = this.toNonEmptyString(query?.asOf) || this.getCurrentTimestamp();

    const market = this.getMarket(marketId, solarSystemId);
    if (!market) {
      return {
        success: false,
        reason: 'MARKET_NOT_FOUND',
        inventory: [],
        total: 0,
        offset,
        limit
      };
    }

    const hydratedMarket = this.applyMarketRestock({ ...market }, asOf);
    const inventory = hydratedMarket.inventory
      .map((entry) => {
        const catalogEntry = MARKET_CATALOG_BY_ID.get(entry.itemId);
        if (!catalogEntry) {
          return null;
        }

        return {
          itemId: entry.itemId,
          itemType: catalogEntry.itemType,
          displayName: catalogEntry.displayName,
          rarity: catalogEntry.rarity,
          stock: entry.stock,
          maxStock: entry.maxStock,
          restockPerInterval: entry.restockPerInterval,
          marketCanBuy: entry.marketCanBuy,
          marketCanSell: entry.marketCanSell
        };
      })
      .filter((entry) => Boolean(entry))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));

    return {
      success: true,
      marketId: hydratedMarket.marketId,
      solarSystemId: hydratedMarket.solarSystemId,
      marketName: hydratedMarket.marketName,
      inventory: inventory.slice(offset, offset + limit),
      total: inventory.length,
      offset,
      limit,
      asOf
    };
  }

  async getMarketLedgerAsync(query = {}) {
    const marketId = this.toNonEmptyString(query?.marketId);
    const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const characterId = this.toNonEmptyString(query?.characterId);
    const itemId = this.toNonEmptyString(query?.itemId).toLowerCase();
    const direction = this.toNonEmptyString(query?.direction).toLowerCase();
    const offset = Number.isInteger(query?.offset) && query.offset >= 0 ? query.offset : 0;
    const limit = Number.isInteger(query?.limit) && query.limit > 0 ? query.limit : 50;
    const startAt = this.toNonEmptyString(query?.startAt);
    const endAt = this.toNonEmptyString(query?.endAt);

    const market = this.getMarket(marketId, solarSystemId);
    if (!market) {
      return {
        success: false,
        reason: 'MARKET_NOT_FOUND',
        entries: [],
        total: 0,
        offset,
        limit
      };
    }

    const startAtMs = startAt ? Date.parse(startAt) : Number.NEGATIVE_INFINITY;
    const endAtMs = endAt ? Date.parse(endAt) : Number.POSITIVE_INFINITY;

    const filtered = market.ledger
      .filter((entry) => {
        if (characterId && entry.characterId !== characterId) {
          return false;
        }
        if (itemId && entry.itemId !== itemId) {
          return false;
        }
        if (direction && entry.direction !== direction) {
          return false;
        }

        const timestampMs = Date.parse(entry.timestamp);
        if (!Number.isNaN(startAtMs) && timestampMs < startAtMs) {
          return false;
        }
        if (!Number.isNaN(endAtMs) && timestampMs > endAtMs) {
          return false;
        }
        return true;
      })
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

    return {
      success: true,
      marketId: market.marketId,
      solarSystemId: market.solarSystemId,
      entries: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit
    };
  }

  async getCharacterTradeItemsAsync(playerName, characterId, itemId) {
    const character = this.findCharacter(playerName, characterId);
    if (!character) {
      return [];
    }

    const ships = Array.isArray(character.ships) ? character.ships : [];
    const containers = await Promise.all(
      ships.map((ship) => this.getItemsByContainerAsync('ship', this.toNonEmptyString(ship.id)))
    );

    return containers
      .flat()
      .map((item) => this.normalizeItem(item))
      .filter((item) => (
        item.owningCharacterId === characterId
        && item.state === 'contained'
        && item.itemType === itemId
      ));
  }

  async applyMarketStockDeltaAsync(marketId, solarSystemId, itemId, delta) {
    const market = this.getMarket(marketId, solarSystemId);
    if (!market) {
      return false;
    }

    const nextMarket = this.normalizeMarket({ ...market });
    nextMarket.inventory = nextMarket.inventory.map((entry) => {
      if (entry.itemId !== itemId) {
        return entry;
      }

      const nextStock = Math.max(0, Math.min(entry.maxStock, entry.stock + delta));
      return {
        ...entry,
        stock: nextStock
      };
    });

    this.cacheMarket(nextMarket);
    return true;
  }

  async appendCharacterLedgerEntryAsync(playerName, characterId, entry) {
    const character = this.findCharacter(playerName, characterId);
    if (!character) {
      return false;
    }

    const creditLedger = Array.isArray(character.creditLedger) ? [...character.creditLedger] : [];
    creditLedger.push(this.normalizeCreditLedgerEntry(entry));
    await this.updateCharacterAsync(playerName, characterId, {
      creditLedger,
      credits: this.calculateCharacterCredits({ creditLedger })
    });
    return true;
  }

  async appendMarketLedgerEntryAsync(marketId, solarSystemId, entry) {
    const market = this.getMarket(marketId, solarSystemId);
    if (!market) {
      return false;
    }

    const nextMarket = this.normalizeMarket({ ...market });
    nextMarket.ledger = [...nextMarket.ledger, this.normalizeMarketLedgerEntry(entry)];
    this.cacheMarket(nextMarket);
    return true;
  }

  async addTradeItemToCharacterAsync(player, character, itemId, quantity) {
    const normalizedItemId = this.toNonEmptyString(itemId).toLowerCase();
    const tradeItems = await this.getCharacterTradeItemsAsync(
      player.playerName,
      character.id,
      normalizedItemId
    );
    const now = this.getCurrentTimestamp();

    if (tradeItems.length > 0) {
      const target = tradeItems[0];
      await this.updateItemAsync(target.id, {
        quantity: target.quantity + quantity,
        updatedAt: now
      });
      return true;
    }

    const ships = Array.isArray(character.ships) ? character.ships : [];
    const targetShipId = this.toNonEmptyString(ships[0]?.id);
    if (!targetShipId) {
      return false;
    }

    const catalogEntry = MARKET_CATALOG_BY_ID.get(normalizedItemId);
    const newItem = {
      id: `${character.id}-${normalizedItemId}-${this.createId()}`,
      itemType: normalizedItemId,
      displayName: catalogEntry?.displayName || normalizedItemId,
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: targetShipId
      },
      owningPlayerId: this.toNonEmptyString(player.playerId),
      owningCharacterId: character.id,
      kinematics: null,
      createdAt: now,
      updatedAt: now,
      destroyedAt: null,
      destroyedReason: null,
      launchable: false,
      quantity
    };

    await this.addItemsAsync([newItem]);
    return true;
  }

  async removeTradeItemFromCharacterAsync(playerName, characterId, itemId, quantity) {
    let remaining = quantity;
    const tradeItems = await this.getCharacterTradeItemsAsync(playerName, characterId, itemId);
    const normalizedItems = tradeItems.sort((left, right) => left.id.localeCompare(right.id));

    for (const item of normalizedItems) {
      if (remaining <= 0) {
        break;
      }

      if (item.quantity > remaining) {
        await this.updateItemAsync(item.id, {
          quantity: item.quantity - remaining,
          updatedAt: this.getCurrentTimestamp()
        });
        remaining = 0;
        break;
      }

      remaining -= item.quantity;
      await this.syncShipInventoryReferenceForItemAsync(playerName, item, {
        ...item,
        container: null
      });
      await this.deleteItemsAsync([item.id]);
    }

    return remaining === 0;
  }

  async executeMarketTransactionAsync(request = {}) {
    const playerName = this.toNonEmptyString(request.playerName);
    const characterId = this.toNonEmptyString(request.characterId);
    const marketId = this.toNonEmptyString(request.marketId);
    const solarSystemId = this.toNonEmptyString(request.solarSystemId);
    const itemId = this.toNonEmptyString(request.itemId).toLowerCase();
    const direction = this.toNonEmptyString(request.direction).toLowerCase();
    const quantity = Number.isInteger(request.quantity) ? request.quantity : Number(request.quantity);
    const requestId = this.toNonEmptyString(request.requestId) || null;

    const player = this.getPlayer(playerName);
    if (!player) {
      return { success: false, reason: 'PLAYER_NOT_REGISTERED' };
    }

    const character = this.findCharacter(player.playerName, characterId);
    if (!character) {
      return { success: false, reason: 'CHARACTER_NOT_FOUND' };
    }

    const quoteResult = await this.getMarketQuoteAsync({
      marketId,
      solarSystemId,
      itemId,
      direction,
      quantity,
      asOf: this.getCurrentTimestamp()
    });
    if (!quoteResult.success) {
      return quoteResult;
    }

    const quote = quoteResult.quote;
    if (direction === 'buy' && quote.availableStock < quantity) {
      return { success: false, reason: 'INSUFFICIENT_MARKET_STOCK' };
    }

    if (direction === 'buy' && this.calculateCharacterCredits(character) < quote.totalPrice) {
      return { success: false, reason: 'INSUFFICIENT_CREDITS' };
    }

    const ownedItems = direction === 'sell'
      ? await this.getCharacterTradeItemsAsync(player.playerName, character.id, itemId)
      : [];
    const ownedQuantity = ownedItems.reduce((total, item) => total + item.quantity, 0);
    if (direction === 'sell' && ownedQuantity < quantity) {
      return { success: false, reason: 'INSUFFICIENT_ITEM_QUANTITY' };
    }

    if (direction === 'buy') {
      const ships = Array.isArray(character.ships) ? character.ships : [];
      if (ships.length === 0) {
        return { success: false, reason: 'NO_SHIP_AVAILABLE' };
      }
    }

    const transactionId = this.toNonEmptyString(request.transactionId) || this.createId();
    const timestamp = this.getCurrentTimestamp();
    const characterLedgerEntry = {
      type: direction === 'buy' ? 'take' : 'put',
      amount: quote.totalPrice,
      description: `Market ${direction}: ${quote.displayName} x${quantity}`,
      timestamp,
      referenceId: transactionId
    };
    const marketLedgerEntry = {
      transactionId,
      requestId,
      characterId,
      itemId,
      direction,
      quantity,
      unitPrice: quote.unitPrice,
      totalPrice: quote.totalPrice,
      timestamp,
      reversalOfTransactionId: null
    };

    let stockApplied = false;
    let itemsApplied = false;
    let characterLedgerApplied = false;
    let marketLedgerApplied = false;

    try {
      await this.applyMarketStockDeltaAsync(
        marketId,
        solarSystemId,
        itemId,
        direction === 'buy' ? -quantity : quantity
      );
      stockApplied = true;

      if (direction === 'buy') {
        itemsApplied = await this.addTradeItemToCharacterAsync(player, character, itemId, quantity);
      } else {
        itemsApplied = await this.removeTradeItemFromCharacterAsync(
          player.playerName,
          character.id,
          itemId,
          quantity
        );
      }

      if (!itemsApplied) {
        throw new Error('Item mutation failed');
      }

      await this.appendCharacterLedgerEntryAsync(player.playerName, character.id, characterLedgerEntry);
      characterLedgerApplied = true;

      await this.appendMarketLedgerEntryAsync(marketId, solarSystemId, marketLedgerEntry);
      marketLedgerApplied = true;

      const updatedCharacter = this.findCharacter(player.playerName, character.id);
      const updatedMarket = this.getMarket(marketId, solarSystemId);
      const inventoryEntry = updatedMarket?.inventory?.find((entry) => entry.itemId === itemId) || null;

      return {
        success: true,
        transaction: {
          transactionId,
          requestId,
          marketId,
          solarSystemId,
          characterId,
          itemId,
          direction,
          quantity,
          unitPrice: quote.unitPrice,
          totalPrice: quote.totalPrice,
          timestamp,
          characterCredits: updatedCharacter
            ? this.calculateCharacterCredits(updatedCharacter)
            : null,
          marketStock: inventoryEntry?.stock ?? null
        }
      };
    } catch (error) {
      if (stockApplied) {
        await this.applyMarketStockDeltaAsync(
          marketId,
          solarSystemId,
          itemId,
          direction === 'buy' ? quantity : -quantity
        );
      }

      if (characterLedgerApplied) {
        await this.appendCharacterLedgerEntryAsync(player.playerName, character.id, {
          type: direction === 'buy' ? 'put' : 'take',
          amount: quote.totalPrice,
          description: `Reversal for transaction ${transactionId}`,
          timestamp: this.getCurrentTimestamp(),
          referenceId: transactionId
        });
      }

      if (marketLedgerApplied) {
        await this.appendMarketLedgerEntryAsync(marketId, solarSystemId, {
          ...marketLedgerEntry,
          transactionId: this.createId(),
          direction: 'reversal',
          reversalOfTransactionId: transactionId,
          timestamp: this.getCurrentTimestamp()
        });
      }

      this.log(`[context] Market transaction failed: ${error.message}`);
      return {
        success: false,
        reason: characterLedgerApplied || marketLedgerApplied
          ? 'PARTIAL_WRITE_REVERSED'
          : 'TRANSACTION_FAILED'
      };
    }
  }

  toPlainObject(value) {
    if (value && typeof value.toObject === 'function') {
      return value.toObject();
    }

    return value;
  }

  normalizeShip(ship) {
    const source = this.toPlainObject(ship) || {};
    const shipName = this.toNonEmptyString(source.name) || this.toNonEmptyString(source.shipName);
    const inventory = Array.isArray(source.inventory)
      ? source.inventory
        .map((entry) => this.normalizeInventoryItemReference(entry))
        .filter((entry) => Boolean(entry))
      : [];

    // Try to get spatial from direct field or convert from legacy
    let spatial = this.normalizeSpatialState(source.spatial) || this.convertLegacyShipToSpatial(ship);
    let motion = this.normalizeMotionState(source.motion) || this.convertLegacyShipToMotion(ship);

    // If still no spatial, this is an error
    if (!spatial) {
      throw new Error('Ship: spatial state is required. Provide spatial with solarSystemId, frame:\'barycentric\', positionKm, and epochMs.');
    }

    return {
      id: this.toNonEmptyString(source.id),
      name: shipName || source.name || source.shipName || '',
      status: this.toNonEmptyString(source.status) || null,
      model: this.toNonEmptyString(source.model) || 'Scavenger Pod',
      tier: Number.isInteger(source.tier) && source.tier >= 1 && source.tier <= 10
        ? source.tier
        : 1,
      createdAt: this.toNonEmptyString(source.createdAt),
      inventory,
      spatial,
      ...(motion ? { motion } : {}),
      launchable: source.launchable != null ? Boolean(source.launchable) : true,
      damageProfile: source.damageProfile != null ? source.damageProfile : null,
      ...(this._normalizeDriveProfile(source.driveProfile) !== null
        ? { driveProfile: this._normalizeDriveProfile(source.driveProfile) }
        : {})
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

    if (!id || !name
      || typeof rangeAu !== 'number' || !Number.isFinite(rangeAu) || rangeAu <= 0
      || typeof cruiseSpeedAuPerHour !== 'number' || !Number.isFinite(cruiseSpeedAuPerHour) || cruiseSpeedAuPerHour <= 0
      || typeof fuelCostPerAu !== 'number' || !Number.isFinite(fuelCostPerAu) || fuelCostPerAu <= 0) {
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
      itemType
    };
  }

  normalizeItem(item) {
    const source = this.toPlainObject(item) || {};
    const normalizedKinematics = source.kinematics ? {
      position: source.kinematics.position ? { ...source.kinematics.position } : null,
      velocity: source.kinematics.velocity ? { ...source.kinematics.velocity } : null,
      reference: source.kinematics.reference ? { ...source.kinematics.reference } : null
    } : null;
    const normalizedContainer = source.container ? {
      containerType: this.toNonEmptyString(source.container.containerType),
      containerId: this.toNonEmptyString(source.container.containerId)
    } : null;

    return {
      ...source,
      id: this.toNonEmptyString(source.id),
      itemType: this.toNonEmptyString(source.itemType),
      displayName: this.toNonEmptyString(source.displayName),
      state: this.toNonEmptyString(source.state),
      damageStatus: this.toNonEmptyString(source.damageStatus),
      container: normalizedContainer,
      owningPlayerId: this.toNonEmptyString(source.owningPlayerId),
      owningCharacterId: this.toNonEmptyString(source.owningCharacterId),
      kinematics: normalizedKinematics,
      createdAt: this.toNonEmptyString(source.createdAt),
      updatedAt: this.toNonEmptyString(source.updatedAt),
      destroyedAt: this.toNonEmptyString(source.destroyedAt) || null,
      destroyedReason: this.toNonEmptyString(source.destroyedReason) || null,
      launchable: source.launchable != null ? Boolean(source.launchable) : true,
      quantity: Number.isInteger(source.quantity) && source.quantity > 0 ? source.quantity : 1
    };
  }

  normalizeCreditLedgerEntry(entry) {
    const source = this.toPlainObject(entry) || {};

    return {
      type: this.toNonEmptyString(source.type),
      amount: typeof source.amount === 'number' ? source.amount : 0,
      description: this.toNonEmptyString(source.description),
      timestamp: this.toNonEmptyString(source.timestamp),
      referenceId: this.toNonEmptyString(source.referenceId) || null
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
      credits
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
      statusDetail: typeof source.statusDetail === 'string' ? source.statusDetail : undefined
    };
  }

  normalizeCelestialBody(celestialBody) {
    const source = this.toPlainObject(celestialBody) || {};

    // Try to get spatial from direct field or convert from legacy
    let spatial = this.normalizeSpatialState(source.spatial) || this.convertLegacyCelestialBodyToSpatial(celestialBody);
    let motion = this.normalizeMotionState(source.motion);
    let physical = this.normalizePhysicalState(source.physical);

    if (!spatial) {
      // Try converting legacy kinematics for motion/physical
      const { motion: legacyMotion, physical: legacyPhysical } = this.convertLegacyCelestialBodyToMotionAndPhysical(celestialBody);
      if (!motion) motion = legacyMotion;
      if (!physical) physical = legacyPhysical;

      throw new Error('CelestialBody: spatial state is required. Provide spatial with solarSystemId, frame:\'barycentric\', positionKm, and epochMs.');
    }

    // Convert legacy kinematics to motion/physical if not provided
    if (!motion || !physical) {
      const { motion: legacyMotion, physical: legacyPhysical } = this.convertLegacyCelestialBodyToMotionAndPhysical(celestialBody);
      if (!motion) motion = legacyMotion;
      if (!physical) physical = legacyPhysical;
    }

    // Normalize observability - provide defaults if not present
    let observability = this.normalizeObservabilityState(source.observability);
    if (!observability) {
      // Fallback: try to construct from legacy scanState/visibility fields
      observability = {
        visibility: source.visibility || 'visible',
        scanState: source.scanState || 'scanned'
      };
    }

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
      composition: source.composition ? {
        rarity: this.toNonEmptyString(source.composition.rarity),
        material: this.toNonEmptyString(source.composition.material),
        textureColor: this.toNonEmptyString(source.composition.textureColor)
      } : null,
      state: this.toNonEmptyString(source.state) || 'active',
      destroyedAt: this.toNonEmptyString(source.destroyedAt) || null,
      destroyedReason: this.toNonEmptyString(source.destroyedReason) || null,
      debrisSeed: Number.isInteger(source.debrisSeed) ? source.debrisSeed : null,
      debris: Array.isArray(source.debris)
        ? source.debris.map((entry) => ({
          material: this.toNonEmptyString(entry?.material),
          rarity: this.toNonEmptyString(entry?.rarity),
          quantity: Number.isInteger(entry?.quantity) && entry.quantity > 0 ? entry.quantity : 1,
          itemType: this.toNonEmptyString(entry?.itemType)
        }))
        : []
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

    if (!this.databaseService) {
      return null;
    }

    try {
      const celestialBody = await this.databaseService.getCelestialBodyById(
        normalizedCelestialBodyId
      );
      if (!celestialBody) {
        return null;
      }

      const normalized = this.normalizeCelestialBody(celestialBody);
      this.celestialBodiesById.set(normalized.id, normalized);
      return normalized;
    } catch (error) {
      this.log(`[context] Error fetching celestial body by id from DB: ${error.message}`);
      return null;
    }
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
        if (normalizedSolarSystemId && celestialBody.spatial?.solarSystemId !== normalizedSolarSystemId) {
          return false;
        }

        if (
          normalizedCreatedByCharacterId
          && celestialBody.createdByCharacterId !== normalizedCreatedByCharacterId
        ) {
          return false;
        }

        if (normalizedMissionId && celestialBody.missionId !== normalizedMissionId) {
          return false;
        }

        if (
          normalizedStateValues.length > 0
          && !normalizedStateValues.includes(celestialBody.state)
        ) {
          return false;
        }

        return true;
      });

    if (this.databaseService) {
      try {
        const fromDb = await this.databaseService.getCelestialBodies({
          solarSystemId: normalizedSolarSystemId || undefined,
          createdByCharacterId: normalizedCreatedByCharacterId || undefined,
          missionId: normalizedMissionId || undefined,
          stateValues: normalizedStateValues.length > 0 ? normalizedStateValues : undefined
        });

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
      } catch (error) {
        this.log(`[context] Error fetching celestial bodies from DB: ${error.message}`);
      }
    }

    return cacheMatches;
  }

  async deleteCelestialBodyByIdAsync(celestialBodyId) {
    const normalizedCelestialBodyId = this.toNonEmptyString(celestialBodyId);
    if (!normalizedCelestialBodyId) {
      return false;
    }

    if (this.databaseService) {
      try {
        await this.databaseService.deleteCelestialBodyById(normalizedCelestialBodyId);
      } catch (error) {
        this.log(`[context] Error deleting celestial body in DB: ${error.message}`);
        throw error;
      }
    }

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

    if (this.databaseService) {
      try {
        const items = await this.databaseService.getItemsByIds(normalizedItemIds);
        const dbItems = this.cacheItems(items);
        for (const item of dbItems) {
          cachedById.set(item.id, item);
        }
      } catch (error) {
        this.log(`[context] Error fetching items from DB: ${error.message}`);
      }
    }

    return normalizedItemIds
      .map((itemId) => cachedById.get(itemId) || null)
      .filter((item) => Boolean(item))
      .map((item) => this.normalizeItem(item));
  }

  async addItemsAsync(items) {
    const normalizedItems = this.cacheItems(items);

    if (this.databaseService) {
      try {
        await this.databaseService.addItems(normalizedItems);
      } catch (error) {
        for (const item of normalizedItems) {
          this.itemsById.delete(item.id);
        }
        this.log(`[context] Error adding items in DB: ${error.message}`);
        throw error;
      }
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

    if (this.databaseService) {
      try {
        await this.databaseService.deleteItemsByIds(normalizedItemIds);
      } catch (error) {
        this.log(`[context] Error deleting items in DB: ${error.message}`);
        throw error;
      }
    }

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

    if (this.databaseService) {
      try {
        await this.databaseService.updateItemById(normalizedItemId, updatedItem);
      } catch (error) {
        this.log(`[context] Error updating item in DB: ${error.message}`);
      }
    }

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
        item.container?.containerType === normalizedContainerType
        && item.container?.containerId === normalizedContainerId
    );

    if (this.databaseService) {
      try {
        const items = await this.databaseService.getItemsByContainer(
          normalizedContainerType,
          normalizedContainerId
        );

        const dbItems = this.cacheItems(items);
        const mergedById = new Map();

        for (const item of cachedMatches) {
          mergedById.set(item.id, this.normalizeItem(item));
        }

        for (const item of dbItems) {
          mergedById.set(item.id, item);
        }

        return [...mergedById.values()];
      } catch (error) {
        this.log(`[context] Error fetching items by container from DB: ${error.message}`);
      }
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
      this.toNonEmptyString(nextItem?.container?.containerType) === 'ship'
      && Boolean(normalizedNextShipId)
      && Boolean(normalizedNextCharacterId)
      && Boolean(normalizedNextItemType);

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
        if (shouldAttachToShip
          && characterId === normalizedNextCharacterId
          && ship.id === normalizedNextShipId) {
          nextInventory = [
            ...filteredInventory,
            {
              itemId: nextItem.id,
              itemType: normalizedNextItemType
            }
          ];
        }

        if (wasRemoved || nextInventory.length !== inventory.length) {
          changed = true;
          return {
            ...ship,
            inventory: nextInventory
          };
        }

        return ship;
      });

      if (changed) {
        await this.updateCharacterAsync(canonicalPlayerName, characterId, {
          ships: nextShips
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
      inventory: [...referencedInOrder, ...additionalContainedItems]
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
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    if (!normalizedPlayerName) {
      return null;
    }

    let player = this.getPlayer(normalizedPlayerName);
    if (player || !this.databaseService) {
      return player;
    }

    await this.getPlayerAsync(normalizedPlayerName);
    player = this.getPlayer(normalizedPlayerName);
    return player;
  }

  async hasValidSessionAsync(payload) {
    const sessionKey = this.toNonEmptyString(payload?.sessionKey);
    if (!sessionKey) {
      return false;
    }

    const player = await this.ensurePlayerLoadedAsync(payload?.playerName);
    if (!player || !player.sessionKey) {
      return false;
    }

    return player.sessionKey === sessionKey;
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
      timestamp: now
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
      timestamp: now
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
      characterName: normalizedCharacterName
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
      characterId: normalizedCharacterId
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
    if (this.databaseService) {
      try {
        const player = await this.databaseService.getPlayerByName(playerName);
        if (player) {
          this.cachePlayer(player);
        }
        return player;
      } catch (error) {
        this.log(`[context] Error fetching player from DB: ${error.message}`);
        return null;
      }
    }
    return this.getPlayer(playerName);
  }

  async getCharactersAsync(playerName) {
    if (this.databaseService) {
      try {
        const characters = await this.databaseService.getCharacters(playerName);
        return this.cacheCharacters(playerName, characters);
      } catch (error) {
        this.log(`[context] Error fetching characters from DB: ${error.message}`);
        return [];
      }
    }
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    return this.getCharacters(normalizedPlayerName);
  }

  async registerPlayerAsync(playerData) {
    if (this.databaseService) {
      try {
        const result = await this.databaseService.registerPlayer(playerData);
        // Also cache in memory for session tracking
        const normalizedPlayerName = playerData.playerName.toLowerCase();
        this.registeredPlayers.set(normalizedPlayerName, {
          ...playerData,
          sessionKey: null,
          socketId: null
        });
        this.charactersByPlayer.set(normalizedPlayerName, []);
        return result;
      } catch (error) {
        this.log(`[context] Error registering player in DB: ${error.message}`);
        throw error;
      }
    }
    // Fallback: in-memory registration
    const normalizedPlayerName = playerData.playerName.toLowerCase();
    this.registeredPlayers.set(normalizedPlayerName, {
      ...playerData,
      sessionKey: null,
      socketId: null
    });
    this.charactersByPlayer.set(normalizedPlayerName, []);
    return playerData;
  }

  async updatePlayerAsync(playerName, updates) {
    if (this.databaseService) {
      try {
        await this.databaseService.updatePlayer(playerName, updates);
      } catch (error) {
        this.log(`[context] Error updating player in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory for session tracking
    const player = this.getPlayer(playerName);
    if (player) {
      Object.assign(player, updates);
    }
  }

  async addCharacterAsync(playerName, characterData) {
    if (this.databaseService) {
      try {
        await this.databaseService.addCharacter(playerName, characterData);
      } catch (error) {
        this.log(`[context] Error adding character in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const characters = this.getCharacters(normalizedPlayerName);
    characters.push(this.normalizeCharacter(characterData));
    this.setCharacters(normalizedPlayerName, characters);
  }

  async deleteCharacterAsync(playerName, characterId) {
    if (this.databaseService) {
      try {
        await this.databaseService.deleteCharacter(playerName, characterId);
      } catch (error) {
        this.log(`[context] Error deleting character in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const characters = this.getCharacters(normalizedPlayerName);
    const filtered = characters.filter((c) => c.id !== characterId);
    this.setCharacters(normalizedPlayerName, filtered);
  }

  async updateCharacterAsync(playerName, characterId, updates) {
    if (this.databaseService) {
      try {
        await this.databaseService.updateCharacter(playerName, characterId, updates);
      } catch (error) {
        this.log(`[context] Error updating character in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const character = this.findCharacter(playerName, characterId);
    if (character) {
      Object.assign(character, updates);
    }
  }

  async addShipAsync(playerName, characterId, shipData) {
    if (this.databaseService) {
      try {
        await this.databaseService.addShip(playerName, characterId, shipData);
      } catch (error) {
        this.log(`[context] Error adding ship in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const character = this.findCharacter(playerName, characterId);
    if (character) {
      if (!character.ships) {
        character.ships = [];
      }
      character.ships.push(shipData);
    }
  }

  async addOrUpdateMissionAsync(playerName, characterId, missionData) {
    if (this.databaseService) {
      try {
        await this.databaseService.addOrUpdateMission(playerName, characterId, missionData);
      } catch (error) {
        this.log(`[context] Error adding/updating mission in DB: ${error.message}`);
        throw error;
      }
    }

    const character = this.findCharacter(playerName, characterId);
    if (!character) {
      return;
    }

    if (!Array.isArray(character.missions)) {
      character.missions = [];
    }

    const missionIndex = character.missions.findIndex(
      (mission) => mission.missionId === missionData.missionId
    );
    if (missionIndex >= 0) {
      // Update existing mission by index
      character.missions[missionIndex] = missionData;
    } else {
      // Add new mission
      character.missions.push(missionData);
    }
  }

  async getMissionsAsync(playerName, characterId) {
    if (this.databaseService) {
      try {
        const missions = await this.databaseService.getMissions(playerName, characterId);
        const character = this.findCharacter(playerName, characterId);
        const normalizedMissions = Array.isArray(missions)
          ? missions.map((mission) => this.normalizeMission(mission))
          : [];

        if (character) {
          character.missions = normalizedMissions;
        }

        return normalizedMissions;
      } catch (error) {
        this.log(`[context] Error fetching missions from DB: ${error.message}`);
      }
    }

    const character = this.findCharacter(playerName, characterId);
    if (!character || !Array.isArray(character.missions)) {
      return [];
    }

    return character.missions.map((mission) => this.normalizeMission(mission));
  }

  async addOrUpdateCelestialBodyAsync(celestialBody) {
    const normalizedCelestialBody = this.normalizeCelestialBody(celestialBody);

    if (this.databaseService) {
      try {
        await this.databaseService.addOrUpdateCelestialBody(normalizedCelestialBody);
      } catch (error) {
        this.log(`[context] Error adding/updating celestial body in DB: ${error.message}`);
        throw error;
      }
    }

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

    if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceKm) || distanceKm < 0) {
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
        const bodyPositionKm = celestialBody?.spatial?.positionKm || celestialBody?.location?.positionKm;
        if (!this.isTriple(bodyPositionKm)) {
          return null;
        }

        const candidateDistanceKm = this.calculateDistanceKm(positionKm, bodyPositionKm);
        if (candidateDistanceKm > distanceKm) {
          return null;
        }

        return {
          celestialBody,
          distanceKm: candidateDistanceKm
        };
      })
      .filter((entry) => Boolean(entry));

    if (this.databaseService) {
      try {
        const fromDb = await this.databaseService.findCelestialBodiesNearPosition({
          solarSystemId,
          positionKm,
          distanceKm,
          createdByCharacterId: createdByCharacterId || undefined,
          missionId: missionId || undefined,
          stateValues: stateValues.length > 0 ? stateValues : undefined
        });

        const fromDbResults = fromDb.map((entry) => {
          const normalizedCelestialBody = this.normalizeCelestialBody(entry.celestialBody);
          this.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
          return {
            celestialBody: normalizedCelestialBody,
            distanceKm: entry.distanceKm
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
      } catch (error) {
        this.log(`[context] Error finding celestial bodies from DB: ${error.message}`);
        results = cacheResults.sort((left, right) => left.distanceKm - right.distanceKm);
      }
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

    if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceKm) || distanceKm < 0) {
      return [];
    }

    let results = [];

    const cacheResults = Array.from(this.itemsById.values())
      .map((item) => this.normalizeItem(item))
      .filter((item) => {
        if (item.kinematics?.reference?.solarSystemId !== solarSystemId) {
          return false;
        }

        if (itemType && item.itemType !== itemType) {
          return false;
        }

        return true;
      })
      .map((item) => {
        const itemPositionKm = item?.kinematics?.position;
        if (!this.isTriple(itemPositionKm)) {
          return null;
        }

        const candidateDistanceKm = this.calculateDistanceKm(positionKm, itemPositionKm);
        if (candidateDistanceKm > distanceKm) {
          return null;
        }

        return {
          item,
          distanceKm: candidateDistanceKm
        };
      })
      .filter((entry) => Boolean(entry));

    if (this.databaseService) {
      try {
        const fromDb = await this.databaseService.findItemsNearPosition({
          solarSystemId,
          positionKm,
          distanceKm,
          itemType: itemType || undefined
        });

        const fromDbResults = fromDb.map((entry) => {
          const normalizedItem = this.normalizeItem(entry.item);
          this.itemsById.set(normalizedItem.id, normalizedItem);
          return {
            item: normalizedItem,
            distanceKm: entry.distanceKm
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
      } catch (error) {
        this.log(`[context] Error finding items from DB: ${error.message}`);
        results = cacheResults.sort((left, right) => left.distanceKm - right.distanceKm);
      }
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
  MessageHandlerContext
};