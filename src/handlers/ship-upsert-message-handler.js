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

  normalizeDamageProfile(raw) {
    const overallStatus = raw?.overallStatus;
    if (!['intact', 'damaged', 'disabled', 'destroyed'].includes(overallStatus)) {
      return { error: 'damageProfile.overallStatus must be one of: intact, damaged, disabled, destroyed' };
    }

    const summary = this.context.toNonEmptyString(raw.summary);
    if (!summary) {
      return { error: 'damageProfile.summary must be a non-empty string' };
    }

    const origin = raw.origin;
    if (!['cold-boot-scripted', 'combat', 'wear', 'unknown'].includes(origin)) {
      return { error: 'damageProfile.origin must be one of: cold-boot-scripted, combat, wear, unknown' };
    }

    const updatedAt = this.context.toNonEmptyString(raw.updatedAt);
    if (!updatedAt) {
      return { error: 'damageProfile.updatedAt must be a non-empty string' };
    }

    if (!Array.isArray(raw.systems)) {
      return { error: 'damageProfile.systems must be an array' };
    }

    const systems = [];
    for (const sys of raw.systems) {
      const code = this.context.toNonEmptyString(sys?.code);
      if (!code) {
        return { error: 'damageProfile.systems[].code must be a non-empty string' };
      }
      const label = this.context.toNonEmptyString(sys.label);
      if (!label) {
        return { error: 'damageProfile.systems[].label must be a non-empty string' };
      }
      const severity = sys.severity;
      if (!['minor', 'major', 'critical'].includes(severity)) {
        return { error: 'damageProfile.systems[].severity must be one of: minor, major, critical' };
      }
      const sysSummary = this.context.toNonEmptyString(sys.summary);
      if (!sysSummary) {
        return { error: 'damageProfile.systems[].summary must be a non-empty string' };
      }
      if (!Number.isInteger(sys.repairPriority)) {
        return { error: 'damageProfile.systems[].repairPriority must be an integer' };
      }
      systems.push({
        code,
        label,
        severity,
        summary: sysSummary,
        repairPriority: sys.repairPriority
      });
    }

    return { overallStatus, summary, origin, updatedAt, systems };
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const shipId = this.context.toNonEmptyString(payload?.ship?.id);
    const shipName = this.context.toNonEmptyString(payload?.ship?.shipName)
      || this.context.toNonEmptyString(payload?.ship?.name);
    const statusRaw = payload?.ship?.status;
    const hasStatusKey = payload?.ship != null && 'status' in payload.ship;
    const hasDamageProfileKey = payload?.ship != null && 'damageProfile' in payload.ship;
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
    const hasLaunchable = payload?.ship != null && 'launchable' in payload.ship;
    const launchable = hasLaunchable
      ? (payload.ship.launchable != null ? Boolean(payload.ship.launchable) : null)
      : null;

    if (!playerName || !characterId || !shipId) {
      return {
        success: false,
        message: 'playerName, characterId, and ship.id are required',
        playerName,
        characterId
      };
    }

    if (!hasLocation && !hasKinematics && !model && !hasTier && !hasStatusKey && !hasDamageProfileKey) {
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

    if (hasStatusKey && typeof statusRaw !== 'string') {
      return {
        success: false,
        message: 'ship.status must be a string',
        playerName,
        characterId
      };
    }

    const status = hasStatusKey ? (statusRaw.trim() || null) : undefined;

    let normalizedDamageProfile;
    if (hasDamageProfileKey) {
      if (payload.ship.damageProfile === null) {
        normalizedDamageProfile = null;
      } else {
        const validation = this.normalizeDamageProfile(payload.ship.damageProfile);
        if (validation?.error) {
          return {
            success: false,
            message: validation.error,
            playerName,
            characterId
          };
        }
        normalizedDamageProfile = validation;
      }
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
      status: hasStatusKey ? status : (existingShip.status ?? null),
      model: model || existingShip.model,
      tier: tier !== null ? tier : existingShip.tier,
      location: location || existingShip.location,
      kinematics: kinematics || existingShip.kinematics,
      launchable: hasLaunchable && launchable !== null
        ? launchable
        : (existingShip.launchable != null ? existingShip.launchable : true),
      damageProfile: hasDamageProfileKey ? normalizedDamageProfile : (existingShip.damageProfile ?? null)
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

    if (!await this.context.hasValidSessionAsync(payload)) {
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

    if (response.success && response.ship) {
      response.ship = await this.context.hydrateShipAsync(response.ship);
    }

    socket.emit(SHIP_UPSERT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipUpsertMessageHandler
};
