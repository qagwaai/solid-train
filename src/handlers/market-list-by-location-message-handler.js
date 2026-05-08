'use strict';

const { MARKET_LIST_BY_LOCATION_RESPONSE_EVENT } = require('../model/market-list-by-location');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

class MarketListByLocationMessageHandler {
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
      route: market.route || null,
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

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-list-by-location-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketListByLocationMessageHandler,
};
