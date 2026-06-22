'use strict';

const { STAR_LIST_RESPONSE_EVENT } = require('../model/star-list');
const { getHygStars } = require('../model/hyg-star-catalog');
const { attachRequestId } = require('./handler-utils');

class StarListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    if (!playerName) {
      return attachRequestId(
        {
          success: false,
          message: 'playerName is required',
          playerName,
          stars: [],
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
          stars: [],
        },
        payload
      );
    }

    let stars = getHygStars().slice();
    const systemId = this.context.toNonEmptyString(payload?.systemId).toLowerCase();
    if (systemId) stars = stars.filter((star) => star.systemId === systemId);
    const spectralClass = this.context.toNonEmptyString(payload?.spectralClass).toUpperCase();
    if (spectralClass) stars = stars.filter((star) => star.spectralClass === spectralClass);
    const maxDistance =
      typeof payload?.maxDistanceParsec === 'number' && Number.isFinite(payload.maxDistanceParsec)
        ? payload.maxDistanceParsec
        : null;
    if (maxDistance !== null) {
      stars = stars.filter(
        (star) => star.distanceParsec !== null && star.distanceParsec <= maxDistance
      );
    }
    stars.sort((a, b) => (a.distanceParsec ?? Infinity) - (b.distanceParsec ?? Infinity));
    const limit =
      Number.isInteger(payload?.limit) && payload.limit > 0 ? Math.min(payload.limit, 5000) : 0;
    if (limit) stars = stars.slice(0, limit);

    return attachRequestId(
      {
        success: true,
        message: stars.length ? 'Star list retrieved successfully' : 'No stars matched the query',
        playerName: player.playerName,
        stars,
      },
      payload
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('star-list-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(STAR_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  StarListMessageHandler,
};
