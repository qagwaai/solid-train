'use strict';

const { SOLAR_SYSTEM_LIST_RESPONSE_EVENT } = require('../model/solar-system-list');
const { getSolarSystemRegistry } = require('../model/solar-system-registry');
const { attachRequestId } = require('./handler-utils');

const VALID_SOURCES = new Set(['curated', 'procedural', 'exoplanet-catalog']);

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
          entry.catalogName || '',
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

    const enrichedSystems = await this.enrichSystemsWithCounts(filtered);

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
   * Add count fields. Planet and moon counts are precomputed in the registry;
   * asteroid and market counts come from one live grouped query each (D51,
   * D55). The asteroid count never drops below the registry's catalog count,
   * so unseeded systems still report their catalog asteroids.
   * @param {Object[]} systems
   * @returns {Promise<Object[]>}
   */
  async enrichSystemsWithCounts(systems) {
    let live = null;
    try {
      live = await this.context.getSolarSystemLiveCountsAsync();
    } catch (error) {
      this.context.log(`[solar-system-list] Failed to load live counts: ${error.message}`);
    }
    return systems.map((system) => {
      const enriched = { ...system };
      if (live) {
        enriched.asteroidCount = Math.max(
          system.asteroidCount || 0,
          live.asteroidCounts.get(system.id) || 0
        );
        enriched.marketCount = live.marketCounts.get(system.id) || 0;
      }
      return enriched;
    });
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
