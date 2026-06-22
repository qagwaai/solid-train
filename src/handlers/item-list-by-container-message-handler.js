'use strict';

const { ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT } = require('../model/item-list-by-container');
const { ITEM_CONTAINER_TYPE_VALUES } = require('../model/canonical-items');

const VALID_CONTAINER_TYPES = ITEM_CONTAINER_TYPE_VALUES;

class ItemListByContainerMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate container query, fetch matching items, and emit container list response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('item-list-by-container-request', payload);


    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const player = this.context.getPlayer(playerName);

    if (!player) {
      const response = {
        success: false,
        message: 'Player is not registered',
        playerName,
      };
      socket.emit(ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT, response);
      return response;
    }

    const containerType = this.context.toNonEmptyString(payload?.containerType);
    const containerId = this.context.toNonEmptyString(payload?.containerId);

    if (!VALID_CONTAINER_TYPES.includes(containerType)) {
      const response = {
        success: false,
        message: `containerType must be one of: ${VALID_CONTAINER_TYPES.join(', ')}`,
        playerName: player.playerName,
      };
      socket.emit(ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT, response);
      return response;
    }

    if (!containerId) {
      const response = {
        success: false,
        message: 'containerId is required',
        playerName: player.playerName,
      };
      socket.emit(ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT, response);
      return response;
    }

    let items;
    try {
      items = await this.context.getItemsByContainerAsync(containerType, containerId, {
        playerName: player.playerName,
        owningPlayerId: this.context.toNonEmptyString(player.playerId),
      });
    } catch (error) {
      this.context.log(`[item-list-by-container-handler] Failed to fetch items: ${error.message}`);
      const response = {
        success: false,
        message: 'Failed to fetch items: database error',
        playerName: player.playerName,
      };
      socket.emit(ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT, response);
      return response;
    }

    const response = {
      success: true,
      message: 'Items retrieved successfully',
      playerName: player.playerName,
      containerType,
      containerId,
      items,
    };

    socket.emit(ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ItemListByContainerMessageHandler,
};
