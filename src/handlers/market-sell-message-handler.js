'use strict';

const { MARKET_SELL_RESPONSE_EVENT, MARKET_SELL_FAILURE_REASONS } = require('../model/market-sell');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

class MarketSellMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const marketId = this.context.toNonEmptyString(payload?.marketId);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const itemId = this.context.toNonEmptyString(payload?.itemId).toLowerCase();
    const quantity = Number.isInteger(payload?.quantity)
      ? payload.quantity
      : Number(payload?.quantity);
    const requestId = this.context.toNonEmptyString(payload?.requestId) || null;

    if (
      !playerName ||
      !characterId ||
      !marketId ||
      !solarSystemId ||
      !itemId ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return {
        success: false,
        message:
          'playerName, characterId, marketId, solarSystemId, itemId, and positive integer quantity are required',
        reason: MARKET_SELL_FAILURE_REASONS.INVALID_PAYLOAD,
        requestId,
      };
    }

    const result = await this.context.executeMarketTransactionAsync({
      playerName,
      characterId,
      marketId,
      solarSystemId,
      itemId,
      quantity,
      direction: 'sell',
      requestId,
      transactionId: this.context.toNonEmptyString(payload?.transactionId),
    });

    if (!result.success) {
      return {
        success: false,
        message: this.messageForReason(result.reason),
        reason: result.reason,
        requestId,
      };
    }

    return {
      success: true,
      message: 'Market sell transaction completed',
      requestId,
      transaction: result.transaction,
    };
  }

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

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-sell-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_SELL_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketSellMessageHandler,
};
