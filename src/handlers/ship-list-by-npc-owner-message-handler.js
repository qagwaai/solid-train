'use strict';

const { SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT } = require('../model/ship-list-by-npc-owner');
const { normalizeOwnership } = require('./context/ship-ownership');

class ShipListByNpcOwnerMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const correlationId = this.context.toNonEmptyString(payload?.correlationId) || '-';
    const npcOwnerRaw = payload?.npcOwner;

    if (!playerName) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'playerName is required',
        ships: [],
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Player is not registered',
        ships: [],
      };
    }

    const ownerNorm = normalizeOwnership(this.context, npcOwnerRaw || {});
    if (ownerNorm.error) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: ownerNorm.error,
        ships: [],
      };
    }

    if (ownerNorm.ownerType !== 'npc-pirate') {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'npcOwner.ownerType must be npc-pirate',
        ships: [],
      };
    }

    const npcOwner = {
      ownerType: ownerNorm.ownerType,
      npcId: ownerNorm.npcId,
      factionId: ownerNorm.factionId,
    };

    // Scan all characters for ships owned by this NPC
    const ships = [];
    for (const characters of this.context.charactersByPlayer.values()) {
      if (!Array.isArray(characters)) continue;
      for (const character of characters) {
        const characterShips = Array.isArray(character?.ships) ? character.ships : [];
        for (const ship of characterShips) {
          const normalizedShip = this.context.normalizeShip(ship);
          const shipOwnership = normalizeOwnership(this.context, normalizedShip.ownership || {});
          if (
            !shipOwnership.error &&
            shipOwnership.ownerType === 'npc-pirate' &&
            shipOwnership.npcId === npcOwner.npcId
          ) {
            ships.push(normalizedShip);
          }
        }
      }
    }

    return {
      success: true,
      message: 'NPC ship list retrieved successfully',
      correlationId,
      npcOwner,
      ships,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-list-by-npc-owner-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipListByNpcOwnerMessageHandler,
};
