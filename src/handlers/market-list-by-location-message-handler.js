'use strict';

const {
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT
} = require('../model/market-list-by-location');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class MarketListByLocationMessageHandler {
  constructor(context) {
    this.context = context;
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
        z: payload.positionKm.z
      }
      : null;
    const distanceKm = this.toPositiveNumberOrZero(payload?.distanceKm);
    const limit = this.toValidLimit(payload?.limit);
    const locationTypes = this.normalizeLocationTypes(payload?.locationTypes);
    const characterId = this.context.toNonEmptyString(payload?.characterId) || null;
    const shipId = this.context.toNonEmptyString(payload?.shipId) || null;

    if (!playerName || !solarSystemId || !positionKm || distanceKm === null) {
      return {
        success: false,
        message: 'playerName, solarSystemId, positionKm, and distanceKm are required',
        playerName,
        solarSystemId,
        markets: [],
        isDocked: false,
        dockedMarketId: null
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
        dockedMarketId: null
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
        dockedMarketId: null
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
        dockedMarketId: null
      };
    }

    const nearbyMarkets = await this.context.getMarketsByLocationAsync({
      solarSystemId,
      positionKm,
      distanceKm,
      limit,
      locationTypes
    });

    const docking = await this.context.resolveDockingStateAsync({
      playerName: player.playerName,
      characterId,
      shipId,
      markets: nearbyMarkets
    });

    if (!nearbyMarkets.length) {
      return {
        success: true,
        message: 'No markets found within distance',
        playerName: player.playerName,
        solarSystemId,
        positionKm,
        distanceKm,
        locationTypes,
        markets: [],
        isDocked: docking.isDocked,
        dockedMarketId: docking.dockedMarketId
      };
    }

    return {
      success: true,
      message: 'Local market list retrieved successfully',
      playerName: player.playerName,
      solarSystemId,
      positionKm,
      distanceKm,
      locationTypes,
      isDocked: docking.isDocked,
      dockedMarketId: docking.dockedMarketId,
      markets: nearbyMarkets.map((market) => ({
        marketId: market.marketId,
        solarSystemId: market.solarSystemId,
        marketName: market.marketName,
        siteType: market.siteType,
        siteName: market.siteName,
        isStarterMarket: Boolean(market.isStarterMarket),
        spatial: market.spatial || null,
        trajectory: market.trajectory || null,
        distanceKm: market.distanceKm,
        isDocked: Boolean(docking.perMarketDocked.get(market.marketId)),
        priceMultiplier: market.priceMultiplier,
        driftPercentPerHour: market.driftPercentPerHour,
        restockIntervalMinutes: market.restockIntervalMinutes
      }))
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-list-by-location-request', payload);

    if (!await this.context.hasValidSessionAsync(payload)) {
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
  MarketListByLocationMessageHandler
};
