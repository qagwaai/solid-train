'use strict';

/**
 * Registry of solar systems supported by the server.
 *
 * A "solar system" record captures:
 *   - id: canonical lowercase id used in spatial.solarSystemId
 *   - displayName
 *   - hygSystemId: matching system grouping in the HYG fixture (or null)
 *   - source: 'curated' | 'procedural' | 'exoplanet-catalog'
 *   - position in galactic parsecs (from HYG or the exoplanet catalog)
 *   - distanceParsec from Sol
 *   - primaryStar: { starId, spectralClass, spectralType, colorHex, luminositySolar, massSolar }
 *   - generationSeed (procedural only)
 *   - isMultiStar
 *   - planetCount, moonCount, asteroidCount: catalog counts, precomputed (D51, D55)
 *
 * The server uses this registry to:
 *   - List available systems (`solar-system-list-request`).
 *   - Resolve a system's details (`solar-system-get-request`).
 *   - Decide whether a system uses a curated catalog or procedural generation.
 */

const { getHygSystems } = require('./hyg-star-catalog');
const { getExoplanetRegistryRecords } = require('./exoplanet-catalog');
const { getSolarSystemCatalogEntries } = require('./solar-system-celestial-seed');
const { hygStarId } = require('./star-catalog');
const {
  getSystemNamingManifest,
  resolveSystemNaming,
  validateNamingManifest,
} = require('./system-naming');

const CURATED_SYSTEMS = new Set(['sol', 'alpha-centauri', 'cygnus-x1']);

const SOL_REGISTRY_OVERRIDES = {
  id: 'sol',
  displayName: 'Sol',
  hygSystemId: 'sol',
  source: 'curated',
  isMultiStar: false,
};

const ALPHA_CENTAURI_REGISTRY_OVERRIDES = {
  id: 'alpha-centauri',
  displayName: 'Alpha Centauri',
  hygSystemId: 'alpha-centauri',
  source: 'curated',
  isMultiStar: true,
};

// The Cygnus system anchor is the HYG/Hipparcos/HD companion record, not the
// black hole. Global HYG position is intentionally unknown in this fixture.
const CYGNUS_X1_REGISTRY_ENTRY = Object.freeze({
  id: 'cygnus-x1',
  displayName: 'Cygnus X-1',
  hygSystemId: 'cygnus-x1',
  source: 'curated',
  isMultiStar: false,
  positionPc: null,
  distanceParsec: null,
  primaryStar: null,
  starCount: 1,
  generationSeed: null,
});

function buildPrimaryStarSummary(stars) {
  const primary = stars && stars[0];
  if (!primary) return null;
  return {
    hygId: primary.hygId,
    starId: hygStarId(primary),
    spectralClass: primary.spectralClass,
    spectralType: primary.spectralType,
    colorHex: primary.colorHex,
    colorIndexBv: primary.colorIndexBv,
    luminositySolar: primary.luminositySolar,
    massSolar: primary.massSolar,
    radiusSolar: primary.radiusSolar,
    absoluteMagnitude: primary.absoluteMagnitude,
    properName: primary.properName,
  };
}

/** Catalog body counts for a curated or HYG procedural system (D51, D55). */
function catalogBodyCounts(systemId) {
  const catalog = getSolarSystemCatalogEntries(systemId);
  const counts = { planetCount: 0, moonCount: 0, asteroidCount: 0 };
  for (const entry of catalog ? catalog.entries : []) {
    if (entry.bodyType === 'planet') counts.planetCount += 1;
    else if (entry.bodyType === 'moon') counts.moonCount += 1;
    else if (entry.bodyType === 'asteroid') counts.asteroidCount += 1;
  }
  return counts;
}

let cachedRegistry = null;
let cachedRegistryById = null;

function getSolarSystemRegistry({ namingManifest = getSystemNamingManifest() } = {}) {
  // Explicit projections must never change the process-wide runtime cache.
  const useRuntimeCache = namingManifest === getSystemNamingManifest();
  if (useRuntimeCache && cachedRegistry) return cachedRegistry;
  const hygSystems = getHygSystems();
  const records = [];
  for (const system of hygSystems) {
    const overrides =
      system.systemId === 'sol'
        ? SOL_REGISTRY_OVERRIDES
        : system.systemId === 'alpha-centauri'
          ? ALPHA_CENTAURI_REGISTRY_OVERRIDES
          : { id: system.systemId, displayName: system.displayName, hygSystemId: system.systemId };

    const id = overrides.id || system.systemId;
    records.push({
      id,
      displayName: overrides.displayName || system.displayName,
      hygSystemId: overrides.hygSystemId || system.systemId,
      source: overrides.source || (CURATED_SYSTEMS.has(id) ? 'curated' : 'procedural'),
      isMultiStar:
        typeof overrides.isMultiStar === 'boolean' ? overrides.isMultiStar : system.isMultiStar,
      positionPc: system.positionPc,
      distanceParsec: system.distanceParsec,
      primaryStar: buildPrimaryStarSummary(system.stars),
      starCount: system.stars.length,
      generationSeed:
        system.stars[0] && system.stars[0].hygId ? Number(system.stars[0].hygId) || null : null,
      ...catalogBodyCounts(id),
    });
  }
  records.push({ ...CYGNUS_X1_REGISTRY_ENTRY, ...catalogBodyCounts(CYGNUS_X1_REGISTRY_ENTRY.id) });
  records.push(...getExoplanetRegistryRecords());
  validateNamingManifest(records, namingManifest);
  const resolved = records.map((record) => resolveSystemNaming(record, namingManifest));
  if (!useRuntimeCache) return resolved;
  cachedRegistry = resolved;
  cachedRegistryById = new Map(cachedRegistry.map((entry) => [entry.id, entry]));
  return cachedRegistry;
}

function getSolarSystemById(id) {
  const normalized = String(id || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  getSolarSystemRegistry();
  return cachedRegistryById.get(normalized) || null;
}

function clearRegistryCache() {
  cachedRegistry = null;
  cachedRegistryById = null;
}

module.exports = {
  CURATED_SYSTEMS,
  CYGNUS_X1_REGISTRY_ENTRY,
  getSolarSystemRegistry,
  getSolarSystemById,
  clearRegistryCache,
};
