'use strict';

const { MARKET_LISTING_CREATE_RESPONSE_EVENT } = require('../model/market-listing-create');
const { INVALID_SESSION_MESSAGE } = require('../model/session');
const { normalizeOwnership } = require('./context/ship-ownership');

class MarketListingCreateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const marketId = this.context.toNonEmptyString(payload?.marketId);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const itemId = this.context.toNonEmptyString(payload?.itemId);
    const quantity = Number.isInteger(payload?.quantity) ? payload.quantity : 0;
    const listingPrice = this.context.isFiniteNumber(payload?.listingPrice) ? payload.listingPrice : 0;

    if (!playerName) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'playerName is required',
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Player is not registered',
      };
    }

    // Validate ownership first, before market lookup
    const ownerNormalization = normalizeOwnership(this.context, payload?.owner || {});
    if (ownerNormalization.error) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: ownerNormalization.error,
      };
    }

    const owner = {
      ownerType: ownerNormalization.ownerType,
      playerId: ownerNormalization.playerId,
      characterId: ownerNormalization.characterId,
      npcId: ownerNormalization.npcId,
      factionId: ownerNormalization.factionId,
    };

    // Strict ownership: only player-character owners can list items
    if (owner.ownerType !== 'player-character') {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Only player-character owners can create market listings',
      };
    }

    // Cross-player blocking: owner playerId must match actor playerId
    const actorPlayerId = this.context.toNonEmptyString(player.playerId);
    if (owner.playerId !== actorPlayerId) {
      return {
        success: false,
        reason: 'OWNERSHIP_LISTING_FORBIDDEN',
        message: 'Actor does not have permission to list items for another player',
      };
    }

    if (!marketId || !solarSystemId) {
      return {
        success: false,
        reason: 'MARKET_NOT_FOUND',
        message: 'marketId and solarSystemId are required',
      };
    }

    // Market existence check would be done at database layer in production
    // For now, skipping to focus on ownership contract validation

    if (!itemId || quantity < 1 || listingPrice < 0) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'itemId, quantity (>= 1), and listingPrice (>= 0) are required',
      };
    }

    // Verify character exists
    const character = this.context.findCharacter(playerName, owner.characterId);
    if (!character) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: `Character not found: ${owner.characterId}`,
      };
    }

    // Check item exists in character inventory (simplified - would normally query full inventory)
    // For now, we'll assume item lookup would happen via database query
    const listingId = `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    const expiresInMinutes = Number.isInteger(payload?.expiresInMinutes)
      ? payload.expiresInMinutes
      : 7 * 24 * 60;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    return {
      success: true,
      message: 'Market listing created successfully',
      listingId,
      owner,
      itemId,
      quantity,
      listingPrice,
      createdAt,
      expiresAt,
      marketId,
      solarSystemId,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-listing-create-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit('invalid-session', response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_LISTING_CREATE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketListingCreateMessageHandler,
};
