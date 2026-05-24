'use strict';

/**
 * Registry of solar systems supported by the server.
 *
 * A "solar system" record captures:
 *   - id: canonical lowercase id used in spatial.solarSystemId
 *   - displayName
 *   - hygSystemId: matching system grouping in the HYG fixture (or null)
 *   - source: 'curated' | 'procedural'
 *   - position in galactic parsecs (from HYG)
 *   - distanceParsec from Sol
 *   - primaryStar: { spectralClass, spectralType, colorHex, luminositySolar, massSolar }
 *   - generationSeed (procedural only)
 *   - isMultiStar
 *
 * The server uses this registry to:
 *   - List available systems (`solar-system-list-request`).
 *   - Resolve a system's details (`solar-system-get-request`).
 *   - Decide whether a system uses a curated catalog or procedural generation.
 */

const { getHygSystems } = require('./hyg-star-catalog');

const CURATED_SYSTEMS = new Set(['sol', 'alpha-centauri']);

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

function buildPrimaryStarSummary(stars) {
  const primary = stars && stars[0];
  if (!primary) return null;
  return {
    hygId: primary.hygId,
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

let cachedRegistry = null;

function getSolarSystemRegistry() {
  if (cachedRegistry) return cachedRegistry;
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
    });
  }
  cachedRegistry = records;
  return cachedRegistry;
}

function getSolarSystemById(id) {
  const normalized = String(id || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return getSolarSystemRegistry().find((entry) => entry.id === normalized) || null;
}

function clearRegistryCache() {
  cachedRegistry = null;
}

module.exports = {
  CURATED_SYSTEMS,
  getSolarSystemRegistry,
  getSolarSystemById,
  clearRegistryCache,
};
