'use strict';

const { SOLAR_SYSTEM_GET_RESPONSE_EVENT } = require('../model/solar-system-get');
const { getSolarSystemById } = require('../model/solar-system-registry');
const { attachRequestId } = require('./handler-utils');
const { getNavigationStateAsync } = require('./context/navigation-state-service');

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

    if (Object.prototype.hasOwnProperty.call(payload, 'navigation')) {
      try {
        const projection = await getNavigationStateAsync(
          this.context, playerName, solarSystemId, payload.navigation
        );
        const bodies = projection.bodies.map((body) => this.context.normalizeCelestialBody(body));
        return attachRequestId({
          success: true,
          message: projection.navigationState.status === 'supported'
            ? 'Solar system navigation positions evaluated'
            : 'Solar system navigation positions are unsupported',
          playerName: player.playerName, solarSystemId, solarSystem: summary,
          stars: bodies.filter((body) => body.bodyType === 'star'), bodies,
          navigationState: projection.navigationState,
        }, payload);
      } catch (error) {
        this.context.log(`[solar-system-get] Navigation read failed: ${error.message}`);
        return attachRequestId({
          success: false, message: 'Navigation source read failed',
          reason: 'NAVIGATION_READ_FAILED', playerName: player.playerName, solarSystemId,
          navigationState: { status: 'unsupported', reason: 'NAVIGATION_READ_FAILED',
            message: 'Navigation source read failed' },
        }, payload);
      }
    }

    // Seed on demand if the system has not been materialized yet (idempotent).
    const seeded = await this.context.seedSolarSystemCelestialBodiesAsync({ solarSystemId, asOf });
    if (seeded?.success === false) {
      return attachRequestId(
        {
          success: false,
          message: seeded.message || 'Solar system celestial seeding failed',
          reason: seeded.reason,
          playerName: player.playerName,
          solarSystemId,
        },
        payload
      );
    }

    // Canonical reads preserve stored classification, catalog provenance and
    // estimates. Viewer defaults and scalar selection belong to the consumer.
    const bodies = await this.context.getCelestialBodiesAsync({ solarSystemId });
    const stars = bodies.filter((body) => body.bodyType === 'star');
    const materializedSummary = {
      ...summary,
      planetCount: Math.max(summary.planetCount || 0, bodies.filter((body) => body.bodyType === 'planet').length),
      moonCount: Math.max(summary.moonCount || 0, bodies.filter((body) => body.bodyType === 'moon').length),
      asteroidCount: Math.max(summary.asteroidCount || 0, bodies.filter((body) => body.bodyType === 'asteroid').length),
    };

    return attachRequestId(
      {
        success: true,
        message: 'Solar system retrieved successfully',
        playerName: player.playerName,
        solarSystemId,
        solarSystem: materializedSummary,
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

    if (!Object.prototype.hasOwnProperty.call(payload, 'navigation')) {
      this.context.refreshCharacterPresence(payload);
    }

    const response = await this.buildResponse(payload);
    socket.emit(SOLAR_SYSTEM_GET_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  SolarSystemGetMessageHandler,
};
