'use strict';

const { SOLAR_SYSTEM_LIST_RESPONSE_EVENT } = require('../model/solar-system-list');
const { getSolarSystemRegistry } = require('../model/solar-system-registry');
const { attachRequestId } = require('./handler-utils');

const VALID_SOURCES = new Set(['curated', 'procedural']);

class SolarSystemListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  /**
   * Build a list of solar systems from the in-memory registry. The registry is
   * authoritative for what systems the server can serve; the DB collection
   * is treated as a cache (populated by initialization).
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    if (!playerName) {
      return attachRequestId(
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
      return attachRequestId(
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
      return attachRequestId(
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

    // Enrich each system with optional aggregate counts from the database
    const enrichedSystems = await Promise.all(
      filtered.map((system) => this.enrichSystemWithCounts(system))
    );

    return attachRequestId(
      {
        success: true,
        message: enrichedSystems.length
          ? 'Solar system list retrieved successfully'
          : 'No solar systems matched the query',
        playerName: player.playerName,
        solarSystems: enrichedSystems,
      },
      payload
    );
  }

  /**
   * Enrich a solar system entry with optional count fields from the database.
   * @param {Object} system
   * @returns {Promise<Object>}
   */
  async enrichSystemWithCounts(system) {
    const enriched = { ...system };

    try {
      // Get celestial bodies for this system and count by type
      const bodies = await this.context.getCelestialBodiesAsync({
        solarSystemId: system.id,
      });

      enriched.planetCount = bodies.filter((b) => b.bodyType === 'planet').length;
      enriched.moonCount = bodies.filter((b) => b.bodyType === 'moon').length;
      enriched.asteroidCount = bodies.filter((b) => b.bodyType === 'asteroid').length;

      // Get markets for this system
      const markets = await this.context.getMarketsAsync({
        solarSystemId: system.id,
      });

      enriched.marketCount = markets.length;
    } catch (error) {
      // If enrichment fails, just return the system without the count fields
      this.context.log(
        `[solar-system-list] Failed to enrich counts for system ${system.id}: ${error.message}`
      );
    }

    return enriched;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('solar-system-list-request', payload, {
      level: 'debug',
    });


    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  SolarSystemListMessageHandler,
};
