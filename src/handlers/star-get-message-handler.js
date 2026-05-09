'use strict';

const { STAR_GET_RESPONSE_EVENT } = require('../model/star-get');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { getHygStars } = require('../model/hyg-star-catalog');

class StarGetMessageHandler {
  constructor(context) {
    this.context = context;
  }

  attachRequestId(response, payload) {
    const requestId = this.context.toNonEmptyString(payload?.requestId);
    if (requestId) response.requestId = requestId;
    return response;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const hygId = this.context.toNonEmptyString(payload?.hygId);

    if (!playerName || !hygId) {
      return this.attachRequestId(
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
      return this.attachRequestId(
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
      return this.attachRequestId(
        {
          success: false,
          message: 'Star not found',
          playerName: player.playerName,
          hygId,
        },
        payload
      );
    }

    return this.attachRequestId(
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

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(STAR_GET_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  StarGetMessageHandler,
};
