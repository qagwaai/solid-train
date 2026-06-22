'use strict';

const { MARKET_LIST_BY_LOCATION_RESPONSE_EVENT } = require('../model/market-list-by-location');
const {
  createGateLandmarkDescriptorPayload,
  createShipDescriptorPayloads,
  createStationDescriptorPayloads,
} = require('../model/external-object-descriptor-payloads');

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const GATE_LANDMARK_PAYLOAD = createGateLandmarkDescriptorPayload();
const SHIP_DESCRIPTOR_PAYLOAD = createShipDescriptorPayloads();
const STATION_DESCRIPTOR_PAYLOAD = createStationDescriptorPayloads();

function stableHashFromString(value) {
  const source = typeof value === 'string' ? value : '';
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickByStableHash(items, seed) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const index = stableHashFromString(seed) % items.length;
  return items[index] || null;
}

function cloneDescriptor(descriptor) {
  return descriptor ? { ...descriptor } : null;
}

function normalizeShipFamilyFromModel(model) {
  const normalizedModel = typeof model === 'string' ? model.trim().toLowerCase() : '';

  if (normalizedModel.includes('scout')) {
    return 'scout';
  }
  if (normalizedModel.includes('hauler')) {
    return 'hauler';
  }
  if (normalizedModel.includes('frigate')) {
    return 'frigate';
  }
  if (normalizedModel.includes('interceptor')) {
    return 'interceptor';
  }
  if (normalizedModel.includes('industrial')) {
    return 'industrial';
  }

  return null;
}

function findShipDescriptorByFamily(family) {
  if (!family) {
    return null;
  }

  return SHIP_DESCRIPTOR_PAYLOAD.find((descriptor) => descriptor.objectFamily === family) || null;
}

class MarketListByLocationMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  isValidSpatial(spatial) {
    return (
      Boolean(spatial) &&
      this.context.toNonEmptyString(spatial.solarSystemId) &&
      spatial.frame === 'barycentric' &&
      this.context.isTriple(spatial.positionKm) &&
      this.context.isFiniteNumber(spatial.epochMs)
    );
  }

  isValidTrajectory(trajectory) {
    if (trajectory == null) {
      return true;
    }

    const kind = this.context.toNonEmptyString(trajectory.kind);
    return kind === 'static' || kind === 'orbital-elements';
  }

  isTriple(value) {
    return this.context.isTriple(value);
  }

  toPositiveNumberOrZero(value) {
    if (!this.context.isFiniteNumber(value) || value < 0) {
      return null;
    }

    return value;
  }

  buildRouteEntityFeeds(route, feeds) {
    const nextRoute = route && typeof route === 'object' ? { ...route } : { kind: 'in-system' };

    if (Array.isArray(feeds?.gates) && feeds.gates.length > 0) {
      nextRoute.gates = feeds.gates;
    }

    if (Array.isArray(feeds?.stations) && feeds.stations.length > 0) {
      nextRoute.stations = feeds.stations;
    }

    if (Array.isArray(feeds?.encounterShips) && feeds.encounterShips.length > 0) {
      nextRoute.encounterShips = feeds.encounterShips;
    }

    return nextRoute;
  }

  buildGateFeedEntry(gate) {
    if (!gate || typeof gate !== 'object') {
      return null;
    }

    if (!this.isValidSpatial(gate.spatial)) {
      return null;
    }

    const gateTemplate = pickByStableHash(GATE_LANDMARK_PAYLOAD.gates, gate.gateId);
    if (!gateTemplate) {
      return null;
    }

    return {
      gateId: this.context.toNonEmptyString(gate.gateId),
      sourceSystemId: this.context.toNonEmptyString(gate.sourceSystemId),
      destSystemId: this.context.toNonEmptyString(gate.destSystemId),
      traversalCostAu: this.context.isFiniteNumber(gate.traversalCostAu) ? gate.traversalCostAu : 0,
      traversalTimeHours: this.context.isFiniteNumber(gate.traversalTimeHours)
        ? gate.traversalTimeHours
        : 0,
      spatial: {
        ...gate.spatial,
      },
      descriptor: cloneDescriptor(gateTemplate.descriptor),
      approachMetadata: {
        ...gateTemplate.approachMetadata,
      },
    };
  }

  buildStationFeedEntry(stationMarket) {
    if (!stationMarket || typeof stationMarket !== 'object') {
      return null;
    }

    const stationDescriptor = pickByStableHash(STATION_DESCRIPTOR_PAYLOAD, stationMarket.marketId);
    if (!stationDescriptor) {
      return null;
    }

    if (!this.isValidSpatial(stationMarket.spatial)) {
      return null;
    }

    return {
      marketId: this.context.toNonEmptyString(stationMarket.marketId),
      solarSystemId: this.context.toNonEmptyString(stationMarket.solarSystemId),
      marketName: this.context.toNonEmptyString(stationMarket.marketName),
      siteType: 'station',
      siteName: this.context.toNonEmptyString(stationMarket.siteName),
      spatial: {
        ...stationMarket.spatial,
      },
      descriptor: cloneDescriptor(stationDescriptor),
    };
  }

  buildEncounterShipFeedEntry(ship) {
    if (!ship || typeof ship !== 'object') {
      return null;
    }

    const ownership =
      ship.ownership && typeof ship.ownership === 'object' ? ship.ownership : { ownerType: 'unknown' };
    if (ownership.ownerType !== 'npc-pirate') {
      return null;
    }

    if (!this.isValidSpatial(ship.spatial)) {
      return null;
    }

    const modeledFamily = normalizeShipFamilyFromModel(ship.model);
    const descriptor =
      findShipDescriptorByFamily(modeledFamily) || pickByStableHash(SHIP_DESCRIPTOR_PAYLOAD, ship.id);

    return {
      shipId: this.context.toNonEmptyString(ship.id),
      shipName: this.context.toNonEmptyString(ship.shipName),
      model: this.context.toNonEmptyString(ship.model),
      tier: Number.isInteger(ship.tier) && ship.tier > 0 ? ship.tier : 1,
      ownership: {
        ownerType: this.context.toNonEmptyString(ownership.ownerType) || 'unknown',
        npcId: this.context.toNonEmptyString(ownership.npcId) || null,
        factionId: this.context.toNonEmptyString(ownership.factionId) || null,
      },
      spatial: {
        ...ship.spatial,
      },
      descriptor: cloneDescriptor(descriptor),
    };
  }

  async listRouteGatesAsync(solarSystemId) {
    let gateEntities = [];

    if (this.context.databaseService?.getJumpGatesAsync) {
      gateEntities = await this.context.databaseService.getJumpGatesAsync();
    } else {
      const gateGraph = await this.context.loadGateNetworkAsync();
      gateEntities = gateGraph.get(solarSystemId) || [];
    }

    return gateEntities
      .filter((gate) => this.context.toNonEmptyString(gate.sourceSystemId) === solarSystemId)
      .map((gate) => this.buildGateFeedEntry(gate))
      .filter((gateEntry) => Boolean(gateEntry));
  }

  async listRouteStationsAsync(solarSystemId, positionKm, distanceAu) {
    const nearbyStations = await this.context.getMarketsByLocationAsync({
      solarSystemId,
      positionKm,
      distanceAu,
      locationTypes: ['station'],
      limit: 16,
    });

    return nearbyStations
      .map((stationMarket) => this.buildStationFeedEntry(stationMarket))
      .filter((stationEntry) => Boolean(stationEntry));
  }

  async listEncounterShipsFromDatabaseAsync(solarSystemId, positionKm, distanceKm) {
    if (!this.context.databaseService?.findShipsNearPosition) {
      return [];
    }

    const dbResults = await this.context.databaseService.findShipsNearPosition({
      solarSystemId,
      positionKm,
      distanceKm,
      ownerTypes: ['npc-pirate'],
      limit: 16,
    });

    return dbResults
      .map((entry) => this.context.normalizeShip(entry.ship))
      .map((ship) => this.buildEncounterShipFeedEntry(ship))
      .filter((shipEntry) => Boolean(shipEntry));
  }

  listEncounterShipsFromInMemoryState(solarSystemId, positionKm, distanceKm) {
    const encounterShips = [];

    for (const characterList of this.context.charactersByPlayer.values()) {
      for (const character of Array.isArray(characterList) ? characterList : []) {
        for (const rawShip of Array.isArray(character?.ships) ? character.ships : []) {
          const normalizedShip = this.context.normalizeShip(rawShip);
          if (normalizedShip?.ownership?.ownerType !== 'npc-pirate') {
            continue;
          }

          if (!this.isValidSpatial(normalizedShip.spatial)) {
            continue;
          }

          if (normalizedShip.spatial.solarSystemId !== solarSystemId) {
            continue;
          }

          const shipDistanceKm = this.context.calculateDistanceKm(
            positionKm,
            normalizedShip.spatial.positionKm
          );
          if (shipDistanceKm > distanceKm) {
            continue;
          }

          const shipEntry = this.buildEncounterShipFeedEntry(normalizedShip);
          if (shipEntry) {
            encounterShips.push(shipEntry);
          }
        }
      }
    }

    return encounterShips;
  }

  async listEncounterShipsAsync(solarSystemId, positionKm, distanceAu) {
    const distanceKm = distanceAu * ASTRONOMICAL_UNIT_KM;
    const dbShips = await this.listEncounterShipsFromDatabaseAsync(
      solarSystemId,
      positionKm,
      distanceKm
    );
    const inMemoryShips = this.listEncounterShipsFromInMemoryState(solarSystemId, positionKm, distanceKm);

    const dedupedById = new Map();
    for (const shipEntry of [...inMemoryShips, ...dbShips]) {
      if (!dedupedById.has(shipEntry.shipId)) {
        dedupedById.set(shipEntry.shipId, shipEntry);
      }
    }

    return [...dedupedById.values()]
      .sort((left, right) => left.shipId.localeCompare(right.shipId))
      .slice(0, 16);
  }

  async collectRouteEntityFeeds(solarSystemId, positionKm, distanceAu) {
    const [gates, stations, encounterShips] = await Promise.all([
      this.listRouteGatesAsync(solarSystemId),
      this.listRouteStationsAsync(solarSystemId, positionKm, distanceAu),
      this.listEncounterShipsAsync(solarSystemId, positionKm, distanceAu),
    ]);

    return {
      gates,
      stations,
      encounterShips,
    };
  }

  toValidLimit(value) {
    if (value === undefined || value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value;
  }

  normalizeLocationTypes(value) {
    if (value === undefined || value === null) {
      return null;
    }

    if (!Array.isArray(value)) {
      return null;
    }

    const normalized = value
      .map((entry) => this.context.toNonEmptyString(entry).toLowerCase())
      .filter((entry) => Boolean(entry));

    return normalized;
  }

  /**
   * Build location-aware market list response, including route and docking metadata.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const positionKm = this.isTriple(payload?.positionKm)
      ? {
          x: payload.positionKm.x,
          y: payload.positionKm.y,
          z: payload.positionKm.z,
        }
      : null;
    const distanceAu = this.toPositiveNumberOrZero(payload?.distanceAu);
    const limit = this.toValidLimit(payload?.limit);
    const locationTypes = this.normalizeLocationTypes(payload?.locationTypes);
    const characterId = this.context.toNonEmptyString(payload?.characterId) || null;
    const shipId = this.context.toNonEmptyString(payload?.shipId) || null;

    if (!playerName || !solarSystemId || !positionKm || distanceAu === null) {
      return {
        success: false,
        message: 'playerName, solarSystemId, positionKm, and distanceAu are required',
        playerName,
        solarSystemId,
        markets: [],
        isDocked: false,
        dockedMarketId: null,
      };
    }

    if (payload?.limit !== undefined && limit === null) {
      return {
        success: false,
        message: 'limit must be a positive integer when provided',
        playerName,
        solarSystemId,
        markets: [],
        isDocked: false,
        dockedMarketId: null,
      };
    }

    if (payload?.locationTypes !== undefined && locationTypes === null) {
      return {
        success: false,
        message: 'locationTypes must be an array of non-empty strings when provided',
        playerName,
        solarSystemId,
        markets: [],
        isDocked: false,
        dockedMarketId: null,
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        solarSystemId,
        markets: [],
        isDocked: false,
        dockedMarketId: null,
      };
    }

    const nearbyMarkets = await this.context.getMarketsByLocationAsync({
      solarSystemId,
      positionKm,
      distanceAu,
      limit,
      locationTypes,
    });

    const routeFeeds = await this.collectRouteEntityFeeds(solarSystemId, positionKm, distanceAu);

    const docking = await this.context.resolveDockingStateAsync({
      playerName: player.playerName,
      characterId,
      shipId,
      markets: nearbyMarkets,
    });

    if (!nearbyMarkets.length) {
      return {
        success: true,
        message: 'No markets found within distance',
        playerName: player.playerName,
        solarSystemId,
        positionKm,
        distanceAu,
        locationTypes,
        markets: [],
        isDocked: docking.isDocked,
        dockedMarketId: docking.dockedMarketId,
      };
    }

    const projectedMarkets = nearbyMarkets.map((market) => ({
      marketId: market.marketId,
      solarSystemId: market.solarSystemId,
      marketName: market.marketName,
      siteType: market.siteType,
      siteName: market.siteName,
      isStarterMarket: Boolean(market.isStarterMarket),
      spatial: market.spatial || null,
      trajectory: market.trajectory || null,
      distanceAu: market.distanceAu,
      route: this.buildRouteEntityFeeds(market.route || null, routeFeeds),
      isDocked: Boolean(docking.perMarketDocked.get(market.marketId)),
      priceMultiplier: market.priceMultiplier,
      driftPercentPerHour: market.driftPercentPerHour,
      restockIntervalMinutes: market.restockIntervalMinutes,
    }));

    const invalidMarket = projectedMarkets.find((market) => {
      return !this.isValidSpatial(market.spatial) || !this.isValidTrajectory(market.trajectory);
    });

    if (invalidMarket) {
      return {
        success: false,
        message: `MarketListByLocation: market '${invalidMarket.marketId}' has invalid canonical spatial/trajectory fields`,
        playerName: player.playerName,
        solarSystemId,
        positionKm,
        distanceAu,
        locationTypes,
        markets: [],
        isDocked: false,
        dockedMarketId: null,
      };
    }

    return {
      success: true,
      message: 'Local market list retrieved successfully',
      playerName: player.playerName,
      solarSystemId,
      positionKm,
      distanceAu,
      locationTypes,
      isDocked: docking.isDocked,
      dockedMarketId: docking.dockedMarketId,
      markets: projectedMarkets,
    };
  }

  /**
   * Enforce session and emit market-list-by-location-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('market-list-by-location-request', payload, {
      level: 'debug',
    });


    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketListByLocationMessageHandler,
};
