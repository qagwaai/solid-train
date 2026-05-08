'use strict';

const { CELESTIAL_BODY_LIST_RESPONSE_EVENT } = require('../model/celestial-body-list');
const { CELESTIAL_BODY_STATE_VALUES } = require('../model/celestial-body-upsert');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

class CelestialBodyListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  isTriple(value) {
    return (
      Boolean(value) &&
      this.isFiniteNumber(value.x) &&
      this.isFiniteNumber(value.y) &&
      this.isFiniteNumber(value.z)
    );
  }

  toPositiveNumberOrZero(value) {
    if (!this.isFiniteNumber(value) || value < 0) {
      return null;
    }

    return value;
  }

  toValidLimit(value) {
    if (value === undefined || value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value;
  }

  normalizeStateFilters(states) {
    if (states === undefined || states === null) {
      return [];
    }

    if (!Array.isArray(states)) {
      return null;
    }

    const normalized = states
      .map((stateValue) => this.context.toNonEmptyString(stateValue).toLowerCase())
      .filter((stateValue) => Boolean(stateValue));

    if (normalized.some((stateValue) => !CELESTIAL_BODY_STATE_VALUES.includes(stateValue))) {
      return null;
    }

    return normalized;
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const positionKm =
      payload?.positionKm && this.isTriple(payload.positionKm)
        ? {
            x: payload.positionKm.x,
            y: payload.positionKm.y,
            z: payload.positionKm.z,
          }
        : null;
    const distanceKm = this.toPositiveNumberOrZero(payload?.distanceKm);
    const limit = this.toValidLimit(payload?.limit);
    const states = this.normalizeStateFilters(payload?.states);
    const createdByCharacterId = this.context.toNonEmptyString(payload?.createdByCharacterId);
    const missionId = this.context.toNonEmptyString(payload?.missionId);

    if (!playerName || !solarSystemId || !positionKm || distanceKm === null) {
      return {
        success: false,
        message: 'playerName, solarSystemId, positionKm, and distanceKm are required',
        playerName,
        solarSystemId,
        celestialBodies: [],
      };
    }

    if (payload?.limit !== undefined && limit === null) {
      return {
        success: false,
        message: 'limit must be a positive integer when provided',
        playerName,
        solarSystemId,
        celestialBodies: [],
      };
    }

    if (payload?.states !== undefined && states === null) {
      return {
        success: false,
        message: `states must be an array with values from: ${CELESTIAL_BODY_STATE_VALUES.join(', ')}`,
        playerName,
        solarSystemId,
        celestialBodies: [],
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        solarSystemId,
        celestialBodies: [],
      };
    }

    const searchResult = await this.context.getCelestialBodiesNearPositionAsync({
      solarSystemId,
      positionKm,
      distanceKm,
      stateValues: states,
      createdByCharacterId: createdByCharacterId || undefined,
      missionId: missionId || undefined,
      limit,
    });

    if (!searchResult.length) {
      return {
        success: true,
        message: 'No celestial bodies found within distance',
        playerName: player.playerName,
        solarSystemId,
        positionKm,
        distanceKm,
        celestialBodies: [],
      };
    }

    const celestialBodies = searchResult.map((entry) => ({
      ...entry.celestialBody,
      distanceKm: entry.distanceKm,
    }));

    return {
      success: true,
      message: 'Celestial body list retrieved successfully',
      playerName: player.playerName,
      solarSystemId,
      positionKm,
      distanceKm,
      celestialBodies,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('celestial-body-list-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(CELESTIAL_BODY_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CelestialBodyListMessageHandler,
};
