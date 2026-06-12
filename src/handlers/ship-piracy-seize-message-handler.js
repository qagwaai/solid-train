'use strict';

const { SHIP_PIRACY_SEIZE_RESPONSE_EVENT } = require('../model/ship-piracy-seize');
const { INVALID_SESSION_MESSAGE } = require('../model/session');
const { normalizeOwnership } = require('./context/ship-ownership');

class ShipPiracySeizeMessageHandler {
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

    // Validate seizing owner — must be npc-pirate
    const seizingNorm = normalizeOwnership(this.context, payload?.seizingOwner || {});
    if (seizingNorm.error) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: seizingNorm.error,
      };
    }

    if (seizingNorm.ownerType !== 'npc-pirate') {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Piracy seizing owner must be an npc-pirate',
      };
    }

    const seizingOwner = {
      ownerType: seizingNorm.ownerType,
      playerId: seizingNorm.playerId,
      characterId: seizingNorm.characterId,
      npcId: seizingNorm.npcId,
      factionId: seizingNorm.factionId,
    };

    // Find the ship across all characters
    let targetShip = null;
    for (const characters of this.context.charactersByPlayer.values()) {
      if (!Array.isArray(characters)) continue;
      for (const char of characters) {
        const ships = Array.isArray(char?.ships) ? char.ships : [];
        const found = ships.find(
          (s) => this.context.toNonEmptyString(s?.id) === shipId
        );
        if (found) {
          targetShip = found;
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

    // Target must be player-character owned for piracy
    const currentNorm = normalizeOwnership(this.context, targetShip.ownership || {});
    if (currentNorm.error || currentNorm.ownerType !== 'player-character') {
      return {
        success: false,
        reason: 'PIRACY_SEIZE_INVALID_TARGET',
        message: 'Piracy can only target player-character owned ships',
      };
    }

    const previousOwner = {
      ownerType: currentNorm.ownerType,
      playerId: currentNorm.playerId,
      characterId: currentNorm.characterId,
      npcId: currentNorm.npcId,
      factionId: currentNorm.factionId,
    };

    const seizedAt = new Date().toISOString();

    // Update in-memory ship ownership
    targetShip.ownership = seizingOwner;
    const existingHistory = Array.isArray(targetShip.ownershipHistory) ? targetShip.ownershipHistory : [];
    targetShip.ownershipHistory = [
      ...existingHistory,
      {
        at: seizedAt,
        reason: 'piracy',
        fromOwner: previousOwner,
        toOwner: seizingOwner,
        actor: {
          ownerType: 'npc-pirate',
          npcId: seizingNorm.npcId,
          factionId: seizingNorm.factionId,
        },
      },
    ];

    return {
      success: true,
      message: 'Ship seized by piracy',
      shipId,
      seizingOwner,
      previousOwner,
      seizedAt,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-piracy-seize-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit('invalid-session', response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SHIP_PIRACY_SEIZE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipPiracySeizeMessageHandler,
};
