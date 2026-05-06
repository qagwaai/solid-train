'use strict';

const {
  ASTEROID_MATERIAL_RARITY_VALUES,
  CELESTIAL_BODY_STATE_VALUES,
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

  hasValidSpatial(spatial) {
    return Boolean(spatial)
      && Boolean(this.context.toNonEmptyString(spatial.solarSystemId))
      && spatial.frame === 'barycentric'
      && this.isTriple(spatial.positionKm)
      && this.isFiniteNumber(spatial.epochMs);
  }

  hasValidObservability(observability) {
    const validVisibility = ['visible', 'not-visible', 'cloaked'];
    const validScanState = ['unscanned', 'scanned'];
    return Boolean(observability)
      && validVisibility.includes(observability.visibility)
      && validScanState.includes(observability.scanState);
  }

  hasValidComposition(composition) {
    if (!composition) {
      return false;
    }

    const rarity = this.context.toNonEmptyString(composition?.rarity);
    const material = this.context.toNonEmptyString(composition?.material);
    const textureColor = this.context.toNonEmptyString(composition?.textureColor);

    return ASTEROID_MATERIAL_RARITY_VALUES.includes(rarity)
      && Boolean(material)
      && Boolean(textureColor);
  }

  toSafeIdPart(value) {
    return this.context
      .toNonEmptyString(value)
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, '-');
  }

  createDeterministicCelestialBodyId(celestialBody) {
    const createdByCharacterId = this.toSafeIdPart(celestialBody?.createdByCharacterId);
    const missionId = this.toSafeIdPart(celestialBody?.missionId);
    const sourceScanId = this.toSafeIdPart(celestialBody?.sourceScanId);

    if (!createdByCharacterId || !missionId || !sourceScanId) {
      return '';
    }

    return `cb-${createdByCharacterId}-${missionId}-${sourceScanId}`;
  }

  normalizeState(state) {
    const normalizedState = this.context.toNonEmptyString(state).toLowerCase();
    if (!normalizedState) {
      return 'active';
    }

    return CELESTIAL_BODY_STATE_VALUES.includes(normalizedState)
      ? normalizedState
      : '';
  }

  normalizeCelestialBody(celestialBody) {
    const normalizedId = this.context.toNonEmptyString(celestialBody?.id);
    const rawSpatial = celestialBody?.spatial;
    const spatial = rawSpatial ? {
      solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
      frame: 'barycentric',
      positionKm: rawSpatial.positionKm ? { ...rawSpatial.positionKm } : null,
      epochMs: rawSpatial.epochMs
    } : null;
    const rawMotion = celestialBody?.motion;
    const motion = rawMotion ? {
      velocityKmPerSec: rawMotion.velocityKmPerSec ? { ...rawMotion.velocityKmPerSec } : null,
      angularVelocityRadPerSec: rawMotion.angularVelocityRadPerSec
        ? { ...rawMotion.angularVelocityRadPerSec } : null
    } : null;
    const rawPhysical = celestialBody?.physical;
    const physical = rawPhysical ? {
      estimatedMassKg: rawPhysical.estimatedMassKg ?? null,
      estimatedDiameterM: rawPhysical.estimatedDiameterM ?? null
    } : null;
    const rawObservability = celestialBody?.observability;
    const observability = rawObservability ? {
      visibility: rawObservability.visibility,
      scanState: rawObservability.scanState
    } : { visibility: 'visible', scanState: 'scanned' };

    return {
      id: normalizedId || this.createDeterministicCelestialBodyId(celestialBody),
      catalogId: this.context.toNonEmptyString(celestialBody?.catalogId),
      sourceScanId: this.context.toNonEmptyString(celestialBody?.sourceScanId),
      createdByCharacterId: this.context.toNonEmptyString(celestialBody?.createdByCharacterId),
      missionId: this.context.toNonEmptyString(celestialBody?.missionId) || null,
      missionInstanceId: this.context.toNonEmptyString(celestialBody?.missionInstanceId) || null,
      createdAt: this.context.toNonEmptyString(celestialBody?.createdAt),
      updatedAt: this.context.toNonEmptyString(celestialBody?.updatedAt),
      spatial,
      motion,
      physical,
      observability,
      composition: celestialBody?.composition ? {
        rarity: this.context.toNonEmptyString(celestialBody.composition.rarity),
        material: this.context.toNonEmptyString(celestialBody.composition.material),
        textureColor: this.context.toNonEmptyString(celestialBody.composition.textureColor)
      } : null,
      state: this.normalizeState(celestialBody?.state)
    };
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const celestialBody = this.normalizeCelestialBody(payload?.celestialBody);
    const sourceCelestialBody = payload?.celestialBody || {};
    const requiresComposition = celestialBody.state !== 'unscanned';
    const hasValidState = Boolean(celestialBody.state);

    if (sourceCelestialBody.location !== undefined) {
      return {
        success: false,
        message: "CelestialBodyUpsert: legacy field 'location' is not supported. Use 'spatial' instead.",
        playerName
      };
    }

    if (sourceCelestialBody.kinematics !== undefined) {
      return {
        success: false,
        message: "CelestialBodyUpsert: legacy field 'kinematics' is not supported. Use 'motion' and/or 'physical' instead.",
        playerName
      };
    }

    if (sourceCelestialBody.solarSystemId !== undefined) {
      return {
        success: false,
        message: "CelestialBodyUpsert: legacy field 'solarSystemId' is not supported. Use 'spatial.solarSystemId' instead.",
        playerName
      };
    }

    if (
      !playerName
      || !celestialBody.id
      || !celestialBody.catalogId
      || !celestialBody.sourceScanId
      || !celestialBody.createdByCharacterId
      || !celestialBody.createdAt
      || !celestialBody.updatedAt
      || !this.hasValidSpatial(celestialBody.spatial)
      || !this.hasValidObservability(celestialBody.observability)
      || !hasValidState
      || (requiresComposition && !this.hasValidComposition(celestialBody.composition))
      || (celestialBody.composition && !this.hasValidComposition(celestialBody.composition))
    ) {
      return {
        success: false,
        message: 'playerName and a complete canonical celestialBody payload are required',
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