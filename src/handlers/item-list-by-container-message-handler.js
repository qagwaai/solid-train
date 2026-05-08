'use strict';

const { ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT } = require('../model/item-list-by-container');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

const VALID_CONTAINER_TYPES = ['ship', 'market'];

class ItemListByContainerMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('item-list-by-container-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

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
      items = await this.context.getItemsByContainerAsync(containerType, containerId);
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
