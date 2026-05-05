'use strict';

const {
  MARKET_QUOTE_RESPONSE_EVENT,
  MARKET_QUOTE_FAILURE_REASONS
} = require('../model/market-quote');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class MarketQuoteMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const marketId = this.context.toNonEmptyString(payload?.marketId);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const itemId = this.context.toNonEmptyString(payload?.itemId).toLowerCase();
    const direction = this.context.toNonEmptyString(payload?.direction).toLowerCase();
    const quantity = Number.isInteger(payload?.quantity)
      ? payload.quantity
      : Number(payload?.quantity);
    const requestId = this.context.toNonEmptyString(payload?.requestId) || null;

    if (!playerName || !characterId || !marketId || !solarSystemId || !itemId || !direction) {
      return {
        success: false,
        message: 'playerName, characterId, marketId, solarSystemId, itemId, and direction are required',
        reason: MARKET_QUOTE_FAILURE_REASONS.INVALID_PAYLOAD,
        requestId
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        reason: MARKET_QUOTE_FAILURE_REASONS.PLAYER_NOT_REGISTERED,
        requestId
      };
    }

    const character = this.context.findCharacter(player.playerName, characterId);
    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        reason: MARKET_QUOTE_FAILURE_REASONS.CHARACTER_NOT_FOUND,
        requestId
      };
    }

    const quoteResult = await this.context.getMarketQuoteAsync({
      marketId,
      solarSystemId,
      itemId,
      direction,
      quantity,
      asOf: this.context.getCurrentTimestamp()
    });

    if (!quoteResult.success) {
      return {
        success: false,
        message: this.messageForReason(quoteResult.reason),
        reason: quoteResult.reason,
        requestId
      };
    }

    return {
      success: true,
      message: 'Market quote retrieved successfully',
      playerName: player.playerName,
      characterId,
      quote: quoteResult.quote,
      requestId
    };
  }

  messageForReason(reason) {
    switch (reason) {
    case MARKET_QUOTE_FAILURE_REASONS.MARKET_NOT_FOUND:
      return 'Market was not found';
    case MARKET_QUOTE_FAILURE_REASONS.ITEM_NOT_FOUND:
      return 'Item was not found in market catalog';
    case MARKET_QUOTE_FAILURE_REASONS.ITEM_NOT_TRADEABLE:
      return 'Item is not tradeable at this market';
    case MARKET_QUOTE_FAILURE_REASONS.INVALID_DIRECTION:
      return 'direction must be buy or sell';
    case MARKET_QUOTE_FAILURE_REASONS.INVALID_QUANTITY:
      return 'quantity must be a positive integer';
    case MARKET_QUOTE_FAILURE_REASONS.MARKET_DOES_NOT_BUY_ITEM:
      return 'Market does not buy this item';
    default:
      return 'Unable to quote item';
    }
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-quote-request', payload);

    if (!await this.context.hasValidSessionAsync(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_QUOTE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketQuoteMessageHandler
};
