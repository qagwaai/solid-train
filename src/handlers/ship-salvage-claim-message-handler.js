'use strict';

const { SHIP_SALVAGE_CLAIM_RESPONSE_EVENT } = require('../model/ship-salvage-claim');
const { INVALID_SESSION_MESSAGE } = require('../model/session');
const { normalizeOwnership } = require('./context/ship-ownership');

class ShipSalvageClaimMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
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

    if (!shipId) {
      return {
        success: false,
        reason: 'SHIP_NOT_FOUND',
        message: 'shipId is required',
      };
    }

    // Validate claimant ownership — must be player-character
    const claimantNorm = normalizeOwnership(this.context, payload?.claimantOwner || {});
    if (claimantNorm.error) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: claimantNorm.error,
      };
    }

    if (claimantNorm.ownerType !== 'player-character') {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Salvage claimant must be a player-character',
      };
    }

    // Cross-player blocking
    const actorPlayerId = this.context.toNonEmptyString(player.playerId);
    if (claimantNorm.playerId !== actorPlayerId) {
      return {
        success: false,
        reason: 'SALVAGE_CLAIM_FORBIDDEN',
        message: 'Actor does not have permission to claim salvage for another player',
      };
    }

    // Verify character exists
    const character = this.context.findCharacter(playerName, claimantNorm.characterId);
    if (!character) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: `Character not found: ${claimantNorm.characterId}`,
      };
    }

    // Find the ship across all characters
    let targetShip = null;
    let targetCharacterShips = null;
    for (const characters of this.context.charactersByPlayer.values()) {
      if (!Array.isArray(characters)) continue;
      for (const char of characters) {
        const ships = Array.isArray(char?.ships) ? char.ships : [];
        const found = ships.find(
          (s) => this.context.toNonEmptyString(s?.id) === shipId
        );
        if (found) {
          targetShip = found;
          targetCharacterShips = ships;
          break;
        }
      }
      if (targetShip) break;
    }

    if (!targetShip) {
      return {
        success: false,
        reason: 'SHIP_NOT_FOUND',
        message: `Ship not found: ${shipId}`,
      };
    }

    // Validate current ownership — must be unowned or unknown
    const currentNorm = normalizeOwnership(this.context, targetShip.ownership || {});
    if (currentNorm.error || (currentNorm.ownerType !== 'unowned' && currentNorm.ownerType !== 'unknown')) {
      return {
        success: false,
        reason: 'SALVAGE_ALREADY_OWNED',
        message: 'Ship is already owned and cannot be salvage claimed',
      };
    }

    const claimantOwner = {
      ownerType: claimantNorm.ownerType,
      playerId: claimantNorm.playerId,
      characterId: claimantNorm.characterId,
      npcId: claimantNorm.npcId,
      factionId: claimantNorm.factionId,
    };

    const claimedAt = new Date().toISOString();
    const previousOwnerType = currentNorm.ownerType;

    // Record transfer via DB service if available
    if (this.context.db && typeof this.context.db.transferShipOwnership === 'function') {
      await this.context.db.transferShipOwnership({
        shipId,
        fromOwner: { ownerType: previousOwnerType, playerId: null, characterId: null, npcId: null, factionId: null },
        toOwner: claimantOwner,
        actorPlayerId: actorPlayerId,
        actorCharacterId: claimantNorm.characterId,
        transferReason: 'salvage',
      });
    }

    // Update in-memory ship ownership
    targetShip.ownership = claimantOwner;
    const existingHistory = Array.isArray(targetShip.ownershipHistory) ? targetShip.ownershipHistory : [];
    targetShip.ownershipHistory = [
      ...existingHistory,
      {
        at: claimedAt,
        reason: 'salvage',
        fromOwner: { ownerType: previousOwnerType, playerId: null, characterId: null, npcId: null, factionId: null },
        toOwner: claimantOwner,
        actor: {
          ownerType: 'player-character',
          playerId: actorPlayerId,
          characterId: claimantNorm.characterId,
        },
      },
    ];

    return {
      success: true,
      message: 'Ship salvage claim successful',
      shipId,
      claimantOwner,
      previousOwnerType,
      claimedAt,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-salvage-claim-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit('invalid-session', response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SHIP_SALVAGE_CLAIM_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipSalvageClaimMessageHandler,
};
