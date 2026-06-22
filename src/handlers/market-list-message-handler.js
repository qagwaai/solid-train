'use strict';

const { MARKET_LIST_RESPONSE_EVENT } = require('../model/market-list');

class MarketListMessageHandler {
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

  /**
   * Build market-list response and enforce canonical spatial/trajectory shape.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);

    if (!playerName) {
      return {
        success: false,
        message: 'playerName is required',
        playerName,
        markets: [],
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        markets: [],
      };
    }

    const markets = await this.context.getMarketsAsync({ solarSystemId });
    const BARYCENTER = { x: 0, y: 0, z: 0 };

    const projectedMarkets = markets.map((market) => {
      const positionKm = market.spatial?.positionKm || BARYCENTER;
      const distanceAu = parseFloat(
        (this.context.calculateDistanceKm(BARYCENTER, positionKm) / 149_597_870.7).toFixed(6)
      );
      return {
        marketId: market.marketId,
        solarSystemId: market.solarSystemId,
        marketName: market.marketName,
        siteType: market.siteType,
        siteName: market.siteName,
        isStarterMarket: Boolean(market.isStarterMarket),
        spatial: market.spatial || null,
        trajectory: market.trajectory || null,
        distanceAu,
        priceMultiplier: market.priceMultiplier,
        driftPercentPerHour: market.driftPercentPerHour,
        restockIntervalMinutes: market.restockIntervalMinutes,
      };
    });

    const invalidMarket = projectedMarkets.find((market) => {
      return !this.isValidSpatial(market.spatial) || !this.isValidTrajectory(market.trajectory);
    });

    if (invalidMarket) {
      return {
        success: false,
        message: `MarketList: market '${invalidMarket.marketId}' has invalid canonical spatial/trajectory fields`,
        playerName: player.playerName,
        solarSystemId: solarSystemId || null,
        markets: [],
      };
    }

    return {
      success: true,
      message: 'Market list retrieved successfully',
      playerName: player.playerName,
      solarSystemId: solarSystemId || null,
      markets: projectedMarkets,
    };
  }

  /**
   * Enforce session and emit market-list-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('market-list-request', payload);


    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketListMessageHandler,
};
