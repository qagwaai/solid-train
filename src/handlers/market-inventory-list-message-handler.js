'use strict';

const { MARKET_INVENTORY_LIST_RESPONSE_EVENT } = require('../model/market-inventory-list');

class MarketInventoryListMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate inventory query and build paginated market inventory response.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
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
        limit,
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
        limit,
      };
    }

    const result = await this.context.getMarketInventoryAsync({
      marketId,
      solarSystemId,
      offset,
      limit,
      asOf: this.context.getCurrentTimestamp(),
    });

    if (!result.success) {
      return {
        success: false,
        message: 'Market was not found',
        reason: result.reason,
        inventory: [],
        total: 0,
        offset,
        limit,
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
      asOf: result.asOf,
    };
  }

  /**
   * Enforce session and emit market-inventory-list-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('market-inventory-list-request', payload);


    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_INVENTORY_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketInventoryListMessageHandler,
};
