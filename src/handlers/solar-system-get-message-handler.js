'use strict';

const { SOLAR_SYSTEM_GET_RESPONSE_EVENT } = require('../model/solar-system-get');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { getSolarSystemById } = require('../model/solar-system-registry');

class SolarSystemGetMessageHandler {
  constructor(context) {
    this.context = context;
  }

  attachRequestId(response, payload) {
    const requestId = this.context.toNonEmptyString(payload?.requestId);
    if (requestId) response.requestId = requestId;
    return response;
  }

  /**
   * Resolve a system by id, ensure its bodies are seeded, and return both the
   * registry summary and all celestial bodies (split into stars + bodies for
   * convenience to UI clients).
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId).toLowerCase();
    const asOf = this.context.toNonEmptyString(payload?.asOf);

    if (!playerName || !solarSystemId) {
      return this.attachRequestId(
        {
          success: false,
          message: 'playerName and solarSystemId are required',
          playerName,
          solarSystemId,
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
          solarSystemId,
        },
        payload
      );
    }

    const summary = getSolarSystemById(solarSystemId);
    if (!summary) {
      return this.attachRequestId(
        {
          success: false,
          message: 'Unknown solar system',
          playerName: player.playerName,
          solarSystemId,
        },
        payload
      );
    }

    // Seed on demand if the system has not been materialized yet (idempotent).
    await this.context.seedSolarSystemCelestialBodiesAsync({ solarSystemId, asOf });

    const bodies = await this.context.getCelestialBodiesAsync({ solarSystemId });
    const stars = bodies.filter((body) => body.bodyType === 'star');

    return this.attachRequestId(
      {
        success: true,
        message: 'Solar system retrieved successfully',
        playerName: player.playerName,
        solarSystemId,
        solarSystem: summary,
        stars,
        bodies,
      },
      payload
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('solar-system-get-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SOLAR_SYSTEM_GET_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  SolarSystemGetMessageHandler,
};
