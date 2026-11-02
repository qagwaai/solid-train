'use strict';

const { STAR_GET_RESPONSE_EVENT } = require('../model/star-get');
const { getStarEntryByHygId, getStarEntryByStarId } = require('../model/star-catalog');
const { attachRequestId } = require('./handler-utils');

class StarGetMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const requestedHygId = this.context.toNonEmptyString(payload?.hygId);
    const requestedStarId = this.context.toNonEmptyString(payload?.starId);
    const echo = { hygId: requestedHygId, ...(requestedStarId ? { starId: requestedStarId } : {}) };

    if (!playerName || (!requestedHygId && !requestedStarId)) {
      return attachRequestId(
        {
          success: false,
          message: 'playerName and starId or hygId are required',
          playerName,
          ...echo,
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
          ...echo,
        },
        payload
      );
    }

    // starId wins when both are sent (D54).
    const star = requestedStarId
      ? getStarEntryByStarId(requestedStarId)
      : getStarEntryByHygId(requestedHygId);
    if (!star) {
      return attachRequestId(
        {
          success: false,
          message: 'Star not found',
          playerName: player.playerName,
          ...echo,
        },
        payload
      );
    }

    return attachRequestId(
      {
        success: true,
        message: 'Star retrieved successfully',
        playerName: player.playerName,
        hygId: star.hygId || '',
        starId: star.starId,
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
