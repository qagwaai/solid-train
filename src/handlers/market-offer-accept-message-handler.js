'use strict';

const { MARKET_OFFER_ACCEPT_RESPONSE_EVENT } = require('../model/market-offer-accept');
const { normalizeOwnership } = require('./context/ship-ownership');

class MarketOfferAcceptMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const offerId = this.context.toNonEmptyString(payload?.offerId);
    const listingId = this.context.toNonEmptyString(payload?.listingId);
    const shipId = this.context.toNonEmptyString(payload?.shipId);

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

    if (!offerId || !listingId) {
      return {
        success: false,
        reason: 'OFFER_NOT_FOUND',
        message: 'offerId and listingId are required',
      };
    }

    // Validate listing owner
    const listingOwnerNormalization = normalizeOwnership(this.context, payload?.listingOwner || {});
    if (listingOwnerNormalization.error) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: listingOwnerNormalization.error,
      };
    }

    const listingOwner = {
      ownerType: listingOwnerNormalization.ownerType,
      playerId: listingOwnerNormalization.playerId,
      characterId: listingOwnerNormalization.characterId,
      npcId: listingOwnerNormalization.npcId,
      factionId: listingOwnerNormalization.factionId,
    };

    // Strict ownership: only player-character can accept offers
    if (listingOwner.ownerType !== 'player-character') {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Only player-character listing owners can accept offers',
      };
    }

    // Cross-player blocking: acceptor must be listing owner
    const actorPlayerId = this.context.toNonEmptyString(player.playerId);
    if (listingOwner.playerId !== actorPlayerId) {
      return {
        success: false,
        reason: 'OWNERSHIP_ACCEPT_FORBIDDEN',
        message: 'Only listing owner can accept this offer',
      };
    }

    // Verify character exists
    const character = this.context.findCharacter(playerName, listingOwner.characterId);
    if (!character) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: `Character not found: ${listingOwner.characterId}`,
      };
    }

    const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const completedAt = new Date().toISOString();

    // Get offeror ownership from payload for trade history (optional)
    let offerorOwner = null;
    if (payload?.offerorOwner) {
      const offerorOwnerNormalization = normalizeOwnership(this.context, payload.offerorOwner);
      if (!offerorOwnerNormalization.error) {
        offerorOwner = {
          ownerType: offerorOwnerNormalization.ownerType,
          playerId: offerorOwnerNormalization.playerId,
          characterId: offerorOwnerNormalization.characterId,
          npcId: offerorOwnerNormalization.npcId,
          factionId: offerorOwnerNormalization.factionId,
        };
      }
    }

    const tradeHistory = {
      at: completedAt,
      offerId,
      listingOwner,
      ...(offerorOwner ? { offerorOwner } : {}),
      acceptorCharacterId: listingOwner.characterId,
    };

    return {
      success: true,
      message: 'Offer accepted and trade completed successfully',
      offerId,
      listingId,
      tradeId,
      completedAt,
      tradeHistory,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('market-offer-accept-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MARKET_OFFER_ACCEPT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MarketOfferAcceptMessageHandler,
};
