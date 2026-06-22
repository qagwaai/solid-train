'use strict';

const { SOLAR_SYSTEM_GET_RESPONSE_EVENT } = require('../model/solar-system-get');
const { getSolarSystemById } = require('../model/solar-system-registry');
const { attachRequestId } = require('./handler-utils');

class SolarSystemGetMessageHandler {
  constructor(context) {
    this.context = context;
  }



  deriveAsteroidPhysicalCatalog(body) {
    const physicalCatalog =
      body?.physicalCatalog && typeof body.physicalCatalog === 'object' ? body.physicalCatalog : {};
    const estimatedDiameterM = this.context.isFiniteNumber(physicalCatalog.estimatedDiameterM)
      ? physicalCatalog.estimatedDiameterM
      : this.context.isFiniteNumber(body?.physical?.estimatedDiameterM)
        ? body.physical.estimatedDiameterM
        : null;
    const estimatedMassKg = this.context.isFiniteNumber(physicalCatalog.estimatedMassKg)
      ? physicalCatalog.estimatedMassKg
      : this.context.isFiniteNumber(body?.physical?.estimatedMassKg)
        ? body.physical.estimatedMassKg
        : null;

    let radiusKm = this.context.isFiniteNumber(physicalCatalog.radiusKm)
      ? physicalCatalog.radiusKm
      : null;
    if (!this.context.isFiniteNumber(radiusKm) && this.context.isFiniteNumber(estimatedDiameterM)) {
      radiusKm = Number((estimatedDiameterM / 2000).toFixed(3));
    }

    return {
      estimatedDiameterM,
      estimatedMassKg,
      radiusKm,
    };
  }

  toCanonicalAsteroidBody(body) {
    if (!body) {
      return body;
    }

    const displayName =
      this.context.toNonEmptyString(body.displayName) || body.catalogId || body.id;
    const visualization =
      body.visualization && typeof body.visualization === 'object' ? body.visualization : {};

    return {
      ...body,
      bodyType: 'asteroid',
      displayName,
      physicalCatalog: this.deriveAsteroidPhysicalCatalog(body),
      visualization: {
        colorHex: this.context.toNonEmptyString(visualization.colorHex) || '#8f99a7',
        textureKey: this.context.toNonEmptyString(visualization.textureKey) || 'asteroid-generic',
      },
    };
  }

  normalizeBodyForViewer(body) {
    if (body?.bodyType === 'asteroid' || body?.missionId) {
      return this.toCanonicalAsteroidBody(body);
    }

    return body;
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

    const bodies = (await this.context.getCelestialBodiesAsync({ solarSystemId })).map((body) =>
      this.normalizeBodyForViewer(body)
    );
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
