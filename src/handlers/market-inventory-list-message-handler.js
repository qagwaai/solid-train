'use strict';

const {
  MARKET_INVENTORY_LIST_RESPONSE_EVENT
} = require('../model/market-inventory-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class MarketInventoryListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const marketId = this.context.toNonEmptyString(payload?.marketId);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const offset = Number.isInteger(payload?.offset) ? payload.offset : 0;
    const limit = Number.isInteger(payload?.limit) ? payload.limit : 50;

    if (!playerName || !marketId || !solarSystemId) {
      return {
        success: false,
        message: 'playerName, marketId, and solarSystemId are required',
        inventory: [],
        total: 0,
        offset,
        limit
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        inventory: [],
        total: 0,
        offset,
        limit
      };
    }

    const result = await this.context.getMarketInventoryAsync({
      marketId,
      solarSystemId,
      offset,
      limit,
      asOf: this.context.getCurrentTimestamp()
    });

    if (!result.success) {
      return {
        success: false,
        message: 'Market was not found',
        reason: result.reason,
        inventory: [],
        total: 0,
        offset,
        limit
      };
    }

    return {
      success: true,
      message: 'Market inventory retrieved successfully',
      playerName: player.playerName,
      marketId: result.marketId,
      solarSystemId: result.solarSystemId,
      marketName: result.marketName,
      inventory: result.inventory,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      asOf: result.asOf
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-inventory-list-request', payload);

    if (!await this.context.hasValidSessionAsync(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_INVENTORY_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketInventoryListMessageHandler
};
