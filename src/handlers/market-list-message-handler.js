'use strict';

const {
  MARKET_LIST_RESPONSE_EVENT
} = require('../model/market-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class MarketListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);

    if (!playerName) {
      return {
        success: false,
        message: 'playerName is required',
        playerName,
        markets: []
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        markets: []
      };
    }

    const markets = await this.context.getMarketsAsync({ solarSystemId });

    return {
      success: true,
      message: 'Market list retrieved successfully',
      playerName: player.playerName,
      solarSystemId: solarSystemId || null,
      markets: markets.map((market) => ({
        marketId: market.marketId,
        solarSystemId: market.solarSystemId,
        marketName: market.marketName,
        locationType: market.locationType,
        locationName: market.locationName,
        isStarterMarket: Boolean(market.isStarterMarket),
        orbit: market.orbit,
        priceMultiplier: market.priceMultiplier,
        driftPercentPerHour: market.driftPercentPerHour,
        restockIntervalMinutes: market.restockIntervalMinutes
      }))
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-list-request', payload);

    if (!await this.context.hasValidSessionAsync(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketListMessageHandler
};
