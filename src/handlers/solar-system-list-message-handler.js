'use strict';

const {
  SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
} = require('../model/solar-system-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { getSolarSystemRegistry } = require('../model/solar-system-registry');

const VALID_SOURCES = new Set(['curated', 'procedural']);

class SolarSystemListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  attachRequestId(response, payload) {
    const requestId = this.context.toNonEmptyString(payload?.requestId);
    if (requestId) response.requestId = requestId;
    return response;
  }

  /**
   * Build a list of solar systems from the in-memory registry. The registry is
   * authoritative for what systems the server can serve; the DB collection
   * is treated as a cache (populated by initialization).
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    if (!playerName) {
      return this.attachRequestId(
        {
          success: false,
          message: 'playerName is required',
          playerName,
          solarSystems: [],
        },
        payload
      );
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return this.attachRequestId(
        {
          success: false,
          message: 'Player is not registered',
          playerName,
          solarSystems: [],
        },
        payload
      );
    }

    const registry = getSolarSystemRegistry();
    const source = this.context.toNonEmptyString(payload?.source).toLowerCase();
    if (source && !VALID_SOURCES.has(source)) {
      return this.attachRequestId(
        {
          success: false,
          message: `source must be one of: ${[...VALID_SOURCES].join(', ')}`,
          playerName: player.playerName,
          solarSystems: [],
        },
        payload
      );
    }

    const search = this.context.toNonEmptyString(payload?.search).toLowerCase();
    const maxDistanceParsec =
      typeof payload?.maxDistanceParsec === 'number' && Number.isFinite(payload.maxDistanceParsec)
        ? payload.maxDistanceParsec
        : null;
    const limit =
      Number.isInteger(payload?.limit) && payload.limit > 0 ? Math.min(payload.limit, 1000) : 0;

    let filtered = registry.slice();
    if (source) filtered = filtered.filter((entry) => entry.source === source);
    if (search) {
      filtered = filtered.filter((entry) => {
        const haystack = [
          entry.id,
          entry.displayName,
          entry.primaryStar?.properName || '',
          entry.primaryStar?.spectralType || '',
        ]
          .join('|')
          .toLowerCase();
        return haystack.includes(search);
      });
    }
    if (maxDistanceParsec !== null) {
      filtered = filtered.filter(
        (entry) => entry.distanceParsec !== null && entry.distanceParsec <= maxDistanceParsec
      );
    }
    filtered.sort((a, b) => (a.distanceParsec ?? Infinity) - (b.distanceParsec ?? Infinity));
    if (limit) filtered = filtered.slice(0, limit);

    return this.attachRequestId(
      {
        success: true,
        message: filtered.length
          ? 'Solar system list retrieved successfully'
          : 'No solar systems matched the query',
        playerName: player.playerName,
        solarSystems: filtered,
      },
      payload
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('solar-system-list-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  SolarSystemListMessageHandler,
};
