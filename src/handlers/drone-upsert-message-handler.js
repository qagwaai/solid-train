'use strict';

const {
  DRONE_UPSERT_RESPONSE_EVENT
} = require('../model/drone-upsert');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class DroneUpsertMessageHandler {
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

  normalizeLocation(location) {
    if (!location || !this.isTriple(location.positionKm)) {
      return null;
    }

    return {
      positionKm: {
        x: location.positionKm.x,
        y: location.positionKm.y,
        z: location.positionKm.z
      }
    };
  }

  normalizeKinematics(kinematics) {
    if (!kinematics || !this.isTriple(kinematics.position) || !this.isTriple(kinematics.velocity)) {
      return null;
    }

    const reference = kinematics.reference;
    if (
      !reference
      || !this.context.toNonEmptyString(reference.solarSystemId)
      || !['barycentric', 'body-centered'].includes(this.context.toNonEmptyString(reference.referenceKind))
      || !this.isFiniteNumber(reference.epochMs)
    ) {
      return null;
    }

    return {
      position: {
        x: kinematics.position.x,
        y: kinematics.position.y,
        z: kinematics.position.z
      },
      velocity: {
        x: kinematics.velocity.x,
        y: kinematics.velocity.y,
        z: kinematics.velocity.z
      },
      reference: {
        solarSystemId: this.context.toNonEmptyString(reference.solarSystemId),
        referenceKind: this.context.toNonEmptyString(reference.referenceKind),
        referenceBodyId: this.context.toNonEmptyString(reference.referenceBodyId) || null,
        distanceUnit: 'km',
        velocityUnit: 'km/s',
        epochMs: reference.epochMs
      }
    };
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const droneId = this.context.toNonEmptyString(payload?.drone?.id);
    const droneName = this.context.toNonEmptyString(payload?.drone?.droneName)
      || this.context.toNonEmptyString(payload?.drone?.name);
    const status = this.context.toNonEmptyString(payload?.drone?.status);
    const model = this.context.toNonEmptyString(payload?.drone?.model);
    const hasLocation = Boolean(payload?.drone?.location);
    const hasKinematics = Boolean(payload?.drone?.kinematics);
    const location = this.normalizeLocation(payload?.drone?.location);
    const kinematics = this.normalizeKinematics(payload?.drone?.kinematics);

    if (!playerName || !characterId || !droneId) {
      return {
        success: false,
        message: 'playerName, characterId, and drone.id are required',
        playerName,
        characterId
      };
    }

    if (!hasLocation && !hasKinematics) {
      return {
        success: false,
        message: 'drone.location and/or drone.kinematics is required',
        playerName,
        characterId
      };
    }

    if ((hasLocation && !location) || (hasKinematics && !kinematics)) {
      return {
        success: false,
        message: 'drone location/kinematics payload is invalid',
        playerName,
        characterId
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId
      };
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId
      };
    }

    const existingDrone = Array.isArray(character.drones)
      ? character.drones.find((drone) => drone.id === droneId)
      : null;

    if (!existingDrone) {
      return {
        success: false,
        message: 'Drone is not in character list',
        playerName: player.playerName,
        characterId
      };
    }

    const nextDrone = {
      ...existingDrone,
      id: droneId,
      droneName: droneName || existingDrone.droneName || existingDrone.name || '',
      status: status || existingDrone.status,
      model: model || existingDrone.model,
      location: location || existingDrone.location,
      kinematics: kinematics || existingDrone.kinematics
    };

    return {
      success: true,
      message: 'Drone updated successfully',
      playerName: player.playerName,
      characterId,
      drone: { ...nextDrone }
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('drone-upsert-request', payload);

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
        const character = this.context.findCharacter(response.playerName, response.characterId);
        const nextDrones = Array.isArray(character?.drones)
          ? character.drones.map((drone) => (drone.id === response.drone.id ? response.drone : drone))
          : [];

        await this.context.updateCharacterAsync(
          response.playerName,
          response.characterId,
          { drones: nextDrones }
        );
      } catch (error) {
        this.context.log(`[drone-upsert-handler] Failed to upsert drone: ${error.message}`);
        response.success = false;
        response.message = 'Failed to update drone: database error';
        delete response.drone;
      }
    }

    socket.emit(DRONE_UPSERT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  DroneUpsertMessageHandler
};