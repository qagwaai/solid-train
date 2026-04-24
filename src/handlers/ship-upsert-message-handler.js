'use strict';

const {
  SHIP_UPSERT_RESPONSE_EVENT
} = require('../model/ship-upsert');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class ShipUpsertMessageHandler {
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
    const shipId = this.context.toNonEmptyString(payload?.ship?.id);
    const shipName = this.context.toNonEmptyString(payload?.ship?.shipName)
      || this.context.toNonEmptyString(payload?.ship?.name);
    const status = this.context.toNonEmptyString(payload?.ship?.status);
    const model = this.context.toNonEmptyString(payload?.ship?.model);
    const tierPayload = payload?.ship?.tier;
    const hasTier = tierPayload !== undefined && tierPayload !== null;
    const tier = (hasTier && Number.isInteger(tierPayload) && tierPayload >= 1 && tierPayload <= 10)
      ? tierPayload
      : null;
    const hasLocation = Boolean(payload?.ship?.location);
    const hasKinematics = Boolean(payload?.ship?.kinematics);
    const location = this.normalizeLocation(payload?.ship?.location);
    const kinematics = this.normalizeKinematics(payload?.ship?.kinematics);

    if (!playerName || !characterId || !shipId) {
      return {
        success: false,
        message: 'playerName, characterId, and ship.id are required',
        playerName,
        characterId
      };
    }

    if (!hasLocation && !hasKinematics && !model && !hasTier) {
      return {
        success: false,
        message: 'ship.location, ship.kinematics, ship.model, and/or ship.tier is required',
        playerName,
        characterId
      };
    }

    if (hasTier && tier === null) {
      return {
        success: false,
        message: 'ship.tier must be an integer between 1 and 10',
        playerName,
        characterId
      };
    }

    if ((hasLocation && !location) || (hasKinematics && !kinematics)) {
      return {
        success: false,
        message: 'ship location/kinematics payload is invalid',
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

    const existingShip = Array.isArray(character.ships)
      ? character.ships.find((ship) => ship.id === shipId)
      : null;

    if (!existingShip) {
      return {
        success: false,
        message: 'Ship is not in character list',
        playerName: player.playerName,
        characterId
      };
    }

    const nextShip = {
      ...existingShip,
      id: shipId,
      shipName: shipName || existingShip.shipName || existingShip.name || '',
      status: status || existingShip.status,
      model: model || existingShip.model,
      tier: tier !== null ? tier : existingShip.tier,
      location: location || existingShip.location,
      kinematics: kinematics || existingShip.kinematics
    };

    return {
      success: true,
      message: 'Ship updated successfully',
      playerName: player.playerName,
      characterId,
      ship: { ...nextShip }
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-upsert-request', payload);

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
        const nextShips = Array.isArray(character?.ships)
          ? character.ships.map((ship) => (ship.id === response.ship.id ? response.ship : ship))
          : [];

        await this.context.updateCharacterAsync(
          response.playerName,
          response.characterId,
          { ships: nextShips }
        );
      } catch (error) {
        this.context.log(`[ship-upsert-handler] Failed to upsert ship: ${error.message}`);
        response.success = false;
        response.message = 'Failed to update ship: database error';
        delete response.ship;
      }
    }

    socket.emit(SHIP_UPSERT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipUpsertMessageHandler
};
