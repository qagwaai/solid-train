'use strict';

const { MARKET_SELL_RESPONSE_EVENT, MARKET_SELL_FAILURE_REASONS } = require('../model/market-sell');
const { buildMarketTransactionResponse } = require('./market-transaction-utils');

class MarketSellMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate payload and execute sell transaction in context layer.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    return buildMarketTransactionResponse(
      this.context, payload, 'sell', MARKET_SELL_FAILURE_REASONS,
      this.messageForReason.bind(this)
    );
  }

  /**
   * Map failure reasons to stable client-facing messages.
   * @param {string} reason
   * @returns {string}
   */
  messageForReason(reason) {
    switch (reason) {
      case MARKET_SELL_FAILURE_REASONS.PLAYER_NOT_REGISTERED:
        return 'Player is not registered';
      case MARKET_SELL_FAILURE_REASONS.CHARACTER_NOT_FOUND:
        return 'Character is not in player list';
      case MARKET_SELL_FAILURE_REASONS.MARKET_NOT_FOUND:
        return 'Market was not found';
      case MARKET_SELL_FAILURE_REASONS.ITEM_NOT_FOUND:
        return 'Item was not found in market catalog';
      case MARKET_SELL_FAILURE_REASONS.ITEM_NOT_TRADEABLE:
        return 'Item is not tradeable at this market';
      case MARKET_SELL_FAILURE_REASONS.MARKET_DOES_NOT_BUY_ITEM:
        return 'Market does not buy this item';
      case MARKET_SELL_FAILURE_REASONS.INSUFFICIENT_ITEM_QUANTITY:
        return 'Insufficient item quantity to sell';
      case MARKET_SELL_FAILURE_REASONS.PARTIAL_WRITE_REVERSED:
        return 'Transaction partially wrote and was reversed';
      default:
        return 'Market sell transaction failed';
    }
  }

  /**
   * Enforce session, execute sell flow, and emit market-sell-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('market-sell-request', payload);


    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_SELL_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketSellMessageHandler,
};
