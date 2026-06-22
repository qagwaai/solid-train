'use strict';

const { MARKET_BUY_RESPONSE_EVENT, MARKET_BUY_FAILURE_REASONS } = require('../model/market-buy');
const { buildMarketTransactionResponse } = require('./market-transaction-utils');

class MarketBuyMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate payload and execute buy transaction in context layer.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    return buildMarketTransactionResponse(
      this.context, payload, 'buy', MARKET_BUY_FAILURE_REASONS,
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
      case MARKET_BUY_FAILURE_REASONS.PLAYER_NOT_REGISTERED:
        return 'Player is not registered';
      case MARKET_BUY_FAILURE_REASONS.CHARACTER_NOT_FOUND:
        return 'Character is not in player list';
      case MARKET_BUY_FAILURE_REASONS.MARKET_NOT_FOUND:
        return 'Market was not found';
      case MARKET_BUY_FAILURE_REASONS.ITEM_NOT_FOUND:
        return 'Item was not found in market catalog';
      case MARKET_BUY_FAILURE_REASONS.ITEM_NOT_TRADEABLE:
        return 'Item is not tradeable at this market';
      case MARKET_BUY_FAILURE_REASONS.INVALID_QUANTITY:
        return 'Quantity is invalid for requested market purchase';
      case MARKET_BUY_FAILURE_REASONS.INSUFFICIENT_CREDITS:
        return 'Insufficient credits for purchase';
      case MARKET_BUY_FAILURE_REASONS.INSUFFICIENT_MARKET_STOCK:
        return 'Insufficient market stock';
      case MARKET_BUY_FAILURE_REASONS.NO_SHIP_AVAILABLE:
        return 'Character has no ship to receive purchased cargo';
      case MARKET_BUY_FAILURE_REASONS.PARTIAL_WRITE_REVERSED:
        return 'Transaction partially wrote and was reversed';
      default:
        return 'Market buy transaction failed';
    }
  }

  /**
   * Enforce session, execute buy flow, and emit market-buy-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('market-buy-request', payload);


    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_BUY_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketBuyMessageHandler,
};
