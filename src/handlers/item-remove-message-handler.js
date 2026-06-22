'use strict';

const { ITEM_REMOVE_RESPONSE_EVENT } = require('../model/item-remove');
const { ITEM_STATE } = require('../model/canonical-items');
const {
  resolveCorrelationId,
  normalizeRequestIdentity,
} = require('./correlation-metadata');

class ItemRemoveMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'item-remove',
        entityTypeCandidates: [payload?.itemType, 'unknown'],
        containerIdCandidates: [payload?.shipId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  async buildParsed(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const shipId = this.context.toNonEmptyString(payload?.shipId);
    const itemId = this.context.toNonEmptyString(payload?.itemId);
    const expectedItemType = this.context.toNonEmptyString(payload?.itemType);
    const reason = this.context.toNonEmptyString(payload?.reason);

    if (!playerName || !characterId || !shipId || !itemId) {
      return {
        error: 'playerName, characterId, shipId, and itemId are required',
        playerName,
        characterId,
        shipId,
        itemId,
      };
    }

    const player = await this.context.ensurePlayerLoadedAsync(playerName);
    if (!player) {
      return {
        error: 'Player is not registered',
        playerName,
        characterId,
        shipId,
        itemId,
      };
    }

    await this.context.getCharactersAsync(player.playerName);
    const character = this.context.findCharacter(player.playerName, characterId);
    if (!character) {
      return {
        error: 'Character is not in player list',
        playerName: player.playerName,
        characterId,
        shipId,
        itemId,
      };
    }

    const ship = Array.isArray(character.ships)
      ? character.ships.find((candidate) => candidate.id === shipId)
      : null;
    if (!ship) {
      return {
        error: 'Ship is not in character list',
        playerName: player.playerName,
        characterId,
        shipId,
        itemId,
      };
    }

    const inventory = Array.isArray(ship.inventory) ? ship.inventory : [];
    const inventoryReference = inventory.find((reference) => reference.itemId === itemId);
    if (!inventoryReference) {
      return {
        error: 'Item is not in ship inventory',
        playerName: player.playerName,
        characterId,
        shipId,
        itemId,
      };
    }

    const [item] = await this.context.getItemsByIdsAsync([itemId]);
    if (!item) {
      return {
        error: 'Item does not exist',
        playerName: player.playerName,
        characterId,
        shipId,
        itemId,
      };
    }

    if (expectedItemType && this.context.toNonEmptyString(item.itemType) !== expectedItemType) {
      return {
        error: 'itemType does not match persisted item',
        playerName: player.playerName,
        characterId,
        shipId,
        itemId,
      };
    }

    return {
      player,
      character,
      ship,
      item,
      playerName: player.playerName,
      characterId,
      shipId,
      itemId,
      itemType: this.context.toNonEmptyString(item.itemType),
      reason,
    };
  }

  async removeItem(parsed, correlationId) {
    const now = this.context.getCurrentTimestamp();
    const nextShips = Array.isArray(parsed.character.ships)
      ? parsed.character.ships.map((ship) => {
          if (ship.id !== parsed.shipId) {
            return ship;
          }

          const inventory = Array.isArray(ship.inventory) ? ship.inventory : [];
          return {
            ...ship,
            inventory: inventory.filter((reference) => reference.itemId !== parsed.itemId),
          };
        })
      : [];

    await this.context.updateCharacterAsync(
      parsed.playerName,
      parsed.characterId,
      {
        ships: nextShips,
      },
      {
        correlationId,
      }
    );

    const updatedItem = await this.context.updateItemAsync(parsed.itemId, {
      state: ITEM_STATE.DESTROYED,
      container: null,
      launchable: false,
      destroyedAt: parsed.item.destroyedAt || now,
      destroyedReason: parsed.reason || `removed-by-request:${parsed.shipId}`,
      updatedAt: now,
    });

    return (
      updatedItem || {
        ...parsed.item,
        state: ITEM_STATE.DESTROYED,
        container: null,
        launchable: false,
        destroyedAt: parsed.item.destroyedAt || now,
        destroyedReason: parsed.reason || `removed-by-request:${parsed.shipId}`,
        updatedAt: now,
      }
    );
  }

  /**
   * Remove a ship-contained item and emit item-remove-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('item-remove-request', payload);
    const correlationId = resolveCorrelationId(
      payload,
      this.context.toNonEmptyString.bind(this.context)
    );
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload);


    this.context.refreshCharacterPresence(payload);

    const parsed = await this.buildParsed(payload);
    const response = {
      success: !parsed.error,
      message: parsed.error || 'Item removed successfully',
      correlationId,
      requestIdentity,
      playerName: this.context.toNonEmptyString(parsed.playerName || payload?.playerName),
      characterId: this.context.toNonEmptyString(parsed.characterId || payload?.characterId),
      shipId: this.context.toNonEmptyString(parsed.shipId || payload?.shipId),
      itemId: this.context.toNonEmptyString(parsed.itemId || payload?.itemId),
      itemType: this.context.toNonEmptyString(parsed.itemType || payload?.itemType),
    };

    if (response.success) {
      try {
        response.item = await this.removeItem(parsed, correlationId);
      } catch (error) {
        this.context.log(
          `[item-remove-handler] Failed to remove item: correlationId=${correlationId} error=${error.message}`
        );
        response.success = false;
        response.message = 'Failed to remove item: database error';
        delete response.item;
      }
    }

    socket.emit(ITEM_REMOVE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ItemRemoveMessageHandler,
};
