'use strict';

const { ITEM_LIST_BY_OWNER_RESPONSE_EVENT } = require('../model/item-list-by-owner');
const { normalizeOwnership } = require('./context/ship-ownership');

class ItemListByOwnerMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const correlationId = this.context.toNonEmptyString(payload?.correlationId) || '-';
    const ownerRaw = payload?.owner;

    if (!playerName) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'playerName is required',
        items: [],
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: 'Player is not registered',
        items: [],
      };
    }

    const ownerNormalization = normalizeOwnership(this.context, {
      ...ownerRaw,
      playerId:
        this.context.toNonEmptyString(ownerRaw?.playerId) ||
        (ownerRaw?.ownerType === 'player-character'
          ? this.context.toNonEmptyString(player.playerId)
          : null),
    });

    if (ownerNormalization.error) {
      return {
        success: false,
        reason: 'OWNERSHIP_VALIDATION_FAILED',
        message: ownerNormalization.error,
        items: [],
      };
    }

    const owner = {
      ownerType: ownerNormalization.ownerType,
      playerId: ownerNormalization.playerId,
      characterId: ownerNormalization.characterId,
      npcId: ownerNormalization.npcId,
      factionId: ownerNormalization.factionId,
    };

    // Cross-player blocking: player-character owner must match actor's playerId
    if (
      owner.ownerType === 'player-character' &&
      owner.playerId !== this.context.toNonEmptyString(player.playerId)
    ) {
      return {
        success: false,
        reason: 'ITEM_LIST_OWNER_FORBIDDEN',
        message: 'Actor does not have permission to list items for another player',
        items: [],
      };
    }

    // Collect matching items from context
    const allItems = this.context.getAllItems ? this.context.getAllItems() : [];
    const matchingItems = allItems.filter((item) => {
      const itemOwnership = item?.ownership;
      if (!itemOwnership) return false;
      if (itemOwnership.ownerType !== owner.ownerType) return false;
      if (owner.ownerType === 'player-character') {
        return (
          itemOwnership.playerId === owner.playerId &&
          (!owner.characterId || itemOwnership.characterId === owner.characterId)
        );
      }
      if (owner.ownerType === 'npc-pirate') {
        return itemOwnership.npcId === owner.npcId;
      }
      return true;
    });

    return {
      success: true,
      message: 'Item list by owner retrieved successfully',
      correlationId,
      owner,
      items: matchingItems,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('item-list-by-owner-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(ITEM_LIST_BY_OWNER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ItemListByOwnerMessageHandler,
};
