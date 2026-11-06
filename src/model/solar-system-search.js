'use strict';

const { normalizeAlias } = require('./system-naming');

function getSolarSystemSearchLabels(system) {
  return [
    system?.id,
    system?.displayName,
    system?.settlementName,
    system?.catalogName,
    system?.primaryStar?.properName,
    system?.primaryStar?.spectralType,
    ...(Array.isArray(system?.aliases) ? system.aliases : []),
  ].filter((label) => typeof label === 'string' && label.trim());
}

function buildSolarSystemSearchTerms(system) {
  return [...new Set(getSolarSystemSearchLabels(system).map(normalizeAlias).filter(Boolean))];
}

function matchesSolarSystemSearch(system, search) {
  const normalizedSearch = normalizeAlias(search);
  if (!normalizedSearch) return true;
  return buildSolarSystemSearchTerms(system).some((term) => term.includes(normalizedSearch));
}

module.exports = {
  buildSolarSystemSearchTerms,
  getSolarSystemSearchLabels,
  matchesSolarSystemSearch,
};
