'use strict';

const { MARKET_OFFER_CREATE_RESPONSE_EVENT } = require('../model/market-offer-create');
const { normalizeOwnership } = require('./context/ship-ownership');

class MarketOfferCreateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const listingId = this.context.toNonEmptyString(payload?.listingId);
    const offerPrice = this.context.isFiniteNumber(payload?.offerPrice) ? payload.offerPrice : -1;
    const quantity = Number.isInteger(payload?.quantity) ? payload.quantity : 0;

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

    if (!listingId || offerPrice < 0 || quantity < 1) {
      return {
        success: false,
        reason: 'LISTING_NOT_FOUND',
        message: 'listingId, offerPrice (>= 0), and quantity (>= 1) are required',
      };
    }

    // Validate offeror ownership
    const offerorNormalization = normalizeOwnership(this.context, payload?.offerorOwner || {});
    if (offerorNormalization.error) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: offerorNormalization.error,
      };
    }

    const offerorOwner = {
      ownerType: offerorNormalization.ownerType,
      playerId: offerorNormalization.playerId,
      characterId: offerorNormalization.characterId,
      npcId: offerorNormalization.npcId,
      factionId: offerorNormalization.factionId,
    };

    // Strict ownership: only player-character can make offers
    if (offerorOwner.ownerType !== 'player-character') {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Only player-character owners can make market offers',
      };
    }

    // Cross-player blocking: offeror playerId must match actor playerId
    const actorPlayerId = this.context.toNonEmptyString(player.playerId);
    if (offerorOwner.playerId !== actorPlayerId) {
      return {
        success: false,
        reason: 'OWNERSHIP_OFFER_FORBIDDEN',
        message: 'Actor does not have permission to make offers for another player',
      };
    }

    // Verify character exists
    const character = this.context.findCharacter(playerName, offerorOwner.characterId);
    if (!character) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: `Character not found: ${offerorOwner.characterId}`,
      };
    }

    const offerId = `offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    return {
      success: true,
      message: 'Market offer created successfully',
      offerId,
      listingId,
      offerorOwner,
      offerPrice,
      quantity,
      createdAt,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-offer-create-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_OFFER_CREATE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketOfferCreateMessageHandler,
};
