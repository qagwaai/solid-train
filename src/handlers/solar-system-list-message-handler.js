'use strict';

const { SOLAR_SYSTEM_LIST_RESPONSE_EVENT } = require('../model/solar-system-list');
const { getSolarSystemRegistry } = require('../model/solar-system-registry');
const { matchesSolarSystemSearch } = require('../model/solar-system-search');
const { attachRequestId } = require('./handler-utils');
const {
  compareIds,
  compareNames,
  compareNullableNumbers,
  emptyPage,
  pageItems,
  parsePaging,
} = require('./list-paging');

const VALID_SOURCES = new Set(['curated', 'procedural', 'exoplanet-catalog']);
const VALID_SORTS = new Set(['distance', 'name']);

function toFiniteNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const SORTERS = {
  distance: (a, b) =>
    compareNullableNumbers(a.distanceParsec, b.distanceParsec) || compareIds(a.id, b.id),
  name: (a, b) => compareNames(a.displayName, b.displayName) || compareIds(a.id, b.id),
};

class SolarSystemListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  /**
   * Build a page of solar systems from the in-memory registry. The registry is
   * authoritative for what systems the server can serve; the DB collection
   * is treated as a cache (populated by initialization). Filters apply first,
   * then the stable sort, then offset paging (P2).
   */
  async buildResponse(payload) {
    const paging = parsePaging(payload);
    const fail = (message, playerName) =>
      attachRequestId(
        { success: false, message, playerName, solarSystems: [], ...emptyPage(paging) },
        payload
      );

    const playerName = this.context.toNonEmptyString(payload?.playerName);
    if (!playerName) {
      return fail('playerName is required', playerName);
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return fail('Player is not registered', playerName);
    }

    const registry = getSolarSystemRegistry();
    const source = this.context.toNonEmptyString(payload?.source).toLowerCase();
    if (source && !VALID_SOURCES.has(source)) {
      return fail(`source must be one of: ${[...VALID_SOURCES].join(', ')}`, player.playerName);
    }
    if (!paging.ok) {
      return fail(paging.message, player.playerName);
    }
    const sort = this.context.toNonEmptyString(payload?.sort).toLowerCase() || 'distance';
    if (!VALID_SORTS.has(sort)) {
      return fail(`sort must be one of: ${[...VALID_SORTS].join(', ')}`, player.playerName);
    }

    const search = this.context.toNonEmptyString(payload?.search);
    const minDistanceParsec = toFiniteNumberOrNull(payload?.minDistanceParsec);
    const maxDistanceParsec = toFiniteNumberOrNull(payload?.maxDistanceParsec);
    if (
      minDistanceParsec !== null &&
      maxDistanceParsec !== null &&
      minDistanceParsec > maxDistanceParsec
    ) {
      return fail('minDistanceParsec must not exceed maxDistanceParsec', player.playerName);
    }
    const rawMinPlanetCount = payload?.minPlanetCount;
    if (
      rawMinPlanetCount !== undefined &&
      rawMinPlanetCount !== null &&
      !(Number.isSafeInteger(rawMinPlanetCount) && rawMinPlanetCount >= 0)
    ) {
      return fail('minPlanetCount must be a non-negative integer when provided', player.playerName);
    }
    const minPlanetCount = rawMinPlanetCount || 0;
    const spectralClass = this.context.toNonEmptyString(payload?.spectralClass).toUpperCase();

    let filtered = registry.slice();
    if (source) filtered = filtered.filter((entry) => entry.source === source);
    if (search) {
      filtered = filtered.filter((entry) => matchesSolarSystemSearch(entry, search));
    }
    if (minDistanceParsec !== null) {
      filtered = filtered.filter(
        (entry) => entry.distanceParsec !== null && entry.distanceParsec >= minDistanceParsec
      );
    }
    if (maxDistanceParsec !== null) {
      filtered = filtered.filter(
        (entry) => entry.distanceParsec !== null && entry.distanceParsec <= maxDistanceParsec
      );
    }
    if (minPlanetCount) {
      filtered = filtered.filter((entry) => (entry.planetCount || 0) >= minPlanetCount);
    }
    if (spectralClass) {
      filtered = filtered.filter(
        (entry) => (entry.primaryStar?.spectralClass || '').toUpperCase() === spectralClass
      );
    }
    filtered.sort(SORTERS[sort]);
    const { items, page } = pageItems(filtered, paging);

    const enrichedSystems = await this.enrichSystemsWithCounts(items);

    return attachRequestId(
      {
        success: true,
        message: enrichedSystems.length
          ? 'Solar system list retrieved successfully'
          : 'No solar systems matched the query',
        playerName: player.playerName,
        solarSystems: enrichedSystems,
        ...page,
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
