'use strict';

const { CELESTIAL_BODY_LIST_RESPONSE_EVENT } = require('../model/celestial-body-list');
const { CELESTIAL_BODY_STATE_VALUES } = require('../model/celestial-body-upsert');
const { isFiniteNumber, isTriple } = require('./handler-utils');
const { compareIds, emptyPage, pageItems, parsePaging } = require('./list-paging');

class CelestialBodyListMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  toPositiveNumberOrZero(value) {
    if (!isFiniteNumber(value) || value < 0) {
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

  /**
   * Validate location query and build one page of the celestial-body-list
   * response (P2). Whole-system listings are ordered by id; radius queries by
   * distance, then id.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const positionKm =
      payload?.positionKm && isTriple(payload.positionKm)
        ? {
            x: payload.positionKm.x,
            y: payload.positionKm.y,
            z: payload.positionKm.z,
          }
        : null;
    const distanceKm = this.toPositiveNumberOrZero(payload?.distanceKm);
    const paging = parsePaging(payload);
    const states = this.normalizeStateFilters(payload?.states);
    const createdByCharacterId = this.context.toNonEmptyString(payload?.createdByCharacterId);
    const missionId = this.context.toNonEmptyString(payload?.missionId);
    const fail = (message, name = playerName) => ({
      success: false,
      message,
      playerName: name,
      solarSystemId,
      celestialBodies: [],
      ...emptyPage(paging),
    });

    if (!playerName || !solarSystemId) {
      return fail('playerName and solarSystemId are required');
    }

    // Allow whole-system queries when both positionKm and distanceKm are omitted.
    const isWholeSystemQuery =
      positionKm === null && distanceKm === null && payload?.distanceKm === undefined;

    if (!isWholeSystemQuery && (!positionKm || distanceKm === null)) {
      return fail(
        'positionKm and distanceKm must both be supplied for radius queries; omit both for a whole-system listing'
      );
    }

    if (!paging.ok) {
      return fail(paging.message);
    }

    if (payload?.states !== undefined && states === null) {
      return fail(
        `states must be an array with values from: ${CELESTIAL_BODY_STATE_VALUES.join(', ')}`
      );
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return fail('Player is not registered');
    }

    if (isWholeSystemQuery) {
      const all = await this.context.getCelestialBodiesAsync({
        solarSystemId,
        stateValues: states,
        createdByCharacterId: createdByCharacterId || undefined,
        missionId: missionId || undefined,
      });
      all.sort((left, right) => compareIds(left.id, right.id));
      const { items, page } = pageItems(all, paging);
      return {
        success: true,
        message: items.length
          ? 'Celestial body list retrieved successfully'
          : 'No celestial bodies found in solar system',
        playerName: player.playerName,
        solarSystemId,
        celestialBodies: items,
        ...page,
      };
    }

    const searchResult = await this.context.getCelestialBodiesNearPositionAsync({
      solarSystemId,
      positionKm,
      distanceKm,
      stateValues: states,
      createdByCharacterId: createdByCharacterId || undefined,
      missionId: missionId || undefined,
    });
    searchResult.sort(
      (left, right) =>
        left.distanceKm - right.distanceKm ||
        compareIds(left.celestialBody.id, right.celestialBody.id)
    );
    const { items, page } = pageItems(searchResult, paging);

    if (!items.length) {
      return {
        success: true,
        message: 'No celestial bodies found within distance',
        playerName: player.playerName,
        solarSystemId,
        positionKm,
        distanceKm,
        celestialBodies: [],
        ...page,
      };
    }

    const celestialBodies = items.map((entry) => ({
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
      ...page,
    };
  }

  /**
   * Enforce session and emit celestial-body-list-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('celestial-body-list-request', payload, {
      level: 'debug',
    });

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(CELESTIAL_BODY_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CelestialBodyListMessageHandler,
};
