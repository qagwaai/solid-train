'use strict';

const {
  MARKET_LEDGER_LIST_RESPONSE_EVENT
} = require('../model/market-ledger-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class MarketLedgerListMessageHandler {
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
        entries: [],
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
        entries: [],
        total: 0,
        offset,
        limit
      };
    }

    const result = await this.context.getMarketLedgerAsync({
      marketId,
      solarSystemId,
      characterId: payload?.characterId,
      itemId: payload?.itemId,
      direction: payload?.direction,
      startAt: payload?.startAt,
      endAt: payload?.endAt,
      offset,
      limit
    });

    if (!result.success) {
      return {
        success: false,
        message: 'Market was not found',
        reason: result.reason,
        entries: [],
        total: 0,
        offset,
        limit
      };
    }

    return {
      success: true,
      message: 'Market ledger retrieved successfully',
      playerName: player.playerName,
      marketId: result.marketId,
      solarSystemId: result.solarSystemId,
      entries: result.entries,
      total: result.total,
      offset: result.offset,
      limit: result.limit
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-ledger-list-request', payload);

    if (!await this.context.hasValidSessionAsync(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_LEDGER_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketLedgerListMessageHandler
};
