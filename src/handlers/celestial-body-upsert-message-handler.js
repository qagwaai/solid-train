'use strict';

const {
  ASTEROID_MATERIAL_RARITY_VALUES,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  DEFAULT_SOLAR_SYSTEM_ID
} = require('../model/celestial-body-upsert');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class CelestialBodyUpsertMessageHandler {
  constructor(context) {
    this.context = context;
  }

  isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  isTriple(value) {
    return Boolean(value)
      && this.isFiniteNumber(value.x)
      && this.isFiniteNumber(value.y)
      && this.isFiniteNumber(value.z);
  }

  hasValidLocation(location) {
    return Boolean(location) && this.isTriple(location.positionKm);
  }

  hasValidKinematics(kinematics) {
    return Boolean(kinematics)
      && this.isTriple(kinematics.velocityKmPerSec)
      && this.isTriple(kinematics.angularVelocityRadPerSec)
      && this.isFiniteNumber(kinematics.estimatedMassKg)
      && this.isFiniteNumber(kinematics.estimatedDiameterM);
  }

  hasValidComposition(composition) {
    const rarity = this.context.toNonEmptyString(composition?.rarity);
    const material = this.context.toNonEmptyString(composition?.material);
    const textureColor = this.context.toNonEmptyString(composition?.textureColor);

    return ASTEROID_MATERIAL_RARITY_VALUES.includes(rarity)
      && Boolean(material)
      && Boolean(textureColor);
  }

  normalizeCelestialBody(celestialBody) {
    return {
      id: this.context.toNonEmptyString(celestialBody?.id),
      catalogId: this.context.toNonEmptyString(celestialBody?.catalogId),
      solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
      sourceScanId: this.context.toNonEmptyString(celestialBody?.sourceScanId),
      createdByCharacterId: this.context.toNonEmptyString(celestialBody?.createdByCharacterId),
      createdAt: this.context.toNonEmptyString(celestialBody?.createdAt),
      updatedAt: this.context.toNonEmptyString(celestialBody?.updatedAt),
      location: celestialBody?.location ? {
        positionKm: { ...celestialBody.location.positionKm }
      } : null,
      kinematics: celestialBody?.kinematics ? {
        velocityKmPerSec: { ...celestialBody.kinematics.velocityKmPerSec },
        angularVelocityRadPerSec: { ...celestialBody.kinematics.angularVelocityRadPerSec },
        estimatedMassKg: celestialBody.kinematics.estimatedMassKg,
        estimatedDiameterM: celestialBody.kinematics.estimatedDiameterM
      } : null,
      composition: celestialBody?.composition ? {
        rarity: this.context.toNonEmptyString(celestialBody.composition.rarity),
        material: this.context.toNonEmptyString(celestialBody.composition.material),
        textureColor: this.context.toNonEmptyString(celestialBody.composition.textureColor)
      } : null
    };
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const celestialBody = this.normalizeCelestialBody(payload?.celestialBody);

    if (
      !playerName
      || !celestialBody.id
      || !celestialBody.catalogId
      || !celestialBody.sourceScanId
      || !celestialBody.createdByCharacterId
      || !celestialBody.createdAt
      || !celestialBody.updatedAt
      || !this.hasValidLocation(celestialBody.location)
      || !this.hasValidKinematics(celestialBody.kinematics)
      || !this.hasValidComposition(celestialBody.composition)
    ) {
      return {
        success: false,
        message: 'playerName and a complete celestialBody payload are required',
        playerName
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName
      };
    }

    const character = this.context.findCharacter(playerName, celestialBody.createdByCharacterId);
    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName
      };
    }

    return {
      success: true,
      message: 'Celestial body recorded successfully',
      playerName: player.playerName,
      celestialBody
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('celestial-body-upsert-request', payload);

    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      try {
        await this.context.addOrUpdateCelestialBodyAsync(response.celestialBody);
      } catch (error) {
        this.context.log(
          `[celestial-body-upsert-handler] Failed to upsert celestial body: ${error.message}`
        );
        response.success = false;
        response.message = 'Failed to record celestial body: database error';
        delete response.celestialBody;
      }
    }

    socket.emit(CELESTIAL_BODY_UPSERT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CelestialBodyUpsertMessageHandler
};