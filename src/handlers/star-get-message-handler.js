'use strict';

const { STAR_GET_RESPONSE_EVENT } = require('../model/star-get');
const { getHygStars } = require('../model/hyg-star-catalog');
const { attachRequestId } = require('./handler-utils');

class StarGetMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const hygId = this.context.toNonEmptyString(payload?.hygId);

    if (!playerName || !hygId) {
      return attachRequestId(
        {
          success: false,
          message: 'playerName and hygId are required',
          playerName,
          hygId,
        },
        payload
      );
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return attachRequestId(
        {
          success: false,
          message: 'Player is not registered',
          playerName,
          hygId,
        },
        payload
      );
    }

    const star = getHygStars().find((entry) => entry.hygId === hygId) || null;
    if (!star) {
      return attachRequestId(
        {
          success: false,
          message: 'Star not found',
          playerName: player.playerName,
          hygId,
        },
        payload
      );
    }

    return attachRequestId(
      {
        success: true,
        message: 'Star retrieved successfully',
        playerName: player.playerName,
        hygId,
        star,
      },
      payload
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('star-get-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(STAR_GET_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  StarGetMessageHandler,
};
