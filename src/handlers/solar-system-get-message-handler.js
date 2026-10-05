'use strict';

const { SOLAR_SYSTEM_GET_RESPONSE_EVENT } = require('../model/solar-system-get');
const { getSolarSystemById } = require('../model/solar-system-registry');
const { attachRequestId } = require('./handler-utils');

class SolarSystemGetMessageHandler {
  constructor(context) {
    this.context = context;
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
      return attachRequestId(
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
      return attachRequestId(
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
      return attachRequestId(
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

    // Canonical reads preserve stored classification, catalog provenance and
    // estimates. Viewer defaults and scalar selection belong to the consumer.
    const bodies = await this.context.getCelestialBodiesAsync({ solarSystemId });
    const stars = bodies.filter((body) => body.bodyType === 'star');

    return attachRequestId(
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
    this.context.logHandlerMessage('solar-system-get-request', payload, {
      level: 'debug',
    });

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SOLAR_SYSTEM_GET_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  SolarSystemGetMessageHandler,
};
