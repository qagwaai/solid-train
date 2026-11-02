'use strict';

/**
 * Unified star catalog for star-list/star-get and the stars collection (D50, D54).
 *
 * Combines the HYG fixture stars (catalogSource 'hyg') with every
 * exoplanet-catalog star (catalogSource 'exoplanet-catalog'). Every entry has a
 * stable starId equal to its star celestial body id.
 */

const { getHygStars } = require('./hyg-star-catalog');
const { getExoplanetStarEntries } = require('./exoplanet-catalog');

/** Celestial body id of a HYG fixture star: curated Sol uses 'sol-sun'. */
function hygStarId(star) {
  return star.systemId === 'sol' ? 'sol-sun' : `${star.systemId}-star-${star.systemRole}`;
}

let cache = null;

function load() {
  if (cache) {
    return cache;
  }
  const hygEntries = getHygStars().map((star) => ({
    starId: hygStarId(star),
    ...star,
    catalogSource: 'hyg',
    catalogName: null,
    approximate: false,
  }));
  const entries = [...hygEntries, ...getExoplanetStarEntries()];
  const byStarId = new Map(entries.map((entry) => [entry.starId, entry]));
  const byHygId = new Map();
  for (const entry of entries) {
    if (entry.hygId && !byHygId.has(entry.hygId)) {
      byHygId.set(entry.hygId, entry);
    }
  }
  cache = { entries, byStarId, byHygId };
  return cache;
}

function getStarCatalogEntries() {
  return load().entries;
}

function getStarEntryByStarId(starId) {
  return load().byStarId.get(starId) || null;
}

/** HYG fixture stars win when an exoplanet-catalog star shares the hygId. */
function getStarEntryByHygId(hygId) {
  return load().byHygId.get(hygId) || null;
}

function clearStarCatalogCache() {
  cache = null;
}

module.exports = {
  clearStarCatalogCache,
  getStarCatalogEntries,
  getStarEntryByHygId,
  getStarEntryByStarId,
  hygStarId,
};
