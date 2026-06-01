'use strict';

const EXTERNAL_OBJECT_DOMAIN = Object.freeze({
  DEBRIS: 'debris',
  SHIPS: 'ships',
  GATES: 'gates',
  STATIONS: 'stations',
  ASTEROIDS: 'asteroids',
});

const EXTERNAL_OBJECT_DOMAIN_VALUES = Object.freeze(Object.values(EXTERNAL_OBJECT_DOMAIN));
const EXTERNAL_OBJECT_DOMAIN_SET = new Set(EXTERNAL_OBJECT_DOMAIN_VALUES);

const EXTERNAL_OBJECT_FAMILY_BY_DOMAIN = Object.freeze({
  [EXTERNAL_OBJECT_DOMAIN.DEBRIS]: Object.freeze([
    'salvage-fragment',
    'wreckage-panel',
    'cargo-canister',
    'field-shard',
  ]),
  [EXTERNAL_OBJECT_DOMAIN.SHIPS]: Object.freeze([
    'scout',
    'hauler',
    'frigate',
    'interceptor',
    'industrial',
  ]),
  [EXTERNAL_OBJECT_DOMAIN.GATES]: Object.freeze([
    'ring-gate',
    'segmented-arch',
    'relay-spindle',
  ]),
  [EXTERNAL_OBJECT_DOMAIN.STATIONS]: Object.freeze([
    'trade-hub',
    'refinery',
    'naval-outpost',
    'research-platform',
  ]),
  [EXTERNAL_OBJECT_DOMAIN.ASTEROIDS]: Object.freeze([
    'rocky-irregular',
    'metallic-cluster',
    'icy-body',
    'cinematic-hero',
  ]),
});

const EXTERNAL_OBJECT_ROLE_CUE = Object.freeze({
  SALVAGE: 'salvage',
  INDUSTRIAL: 'industrial',
  TRADE: 'trade',
  MILITARY: 'military',
  NAVIGATION: 'navigation',
  INFRASTRUCTURE: 'infrastructure',
  HAZARD: 'hazard',
  CIVILIAN: 'civilian',
  NEUTRAL: 'neutral',
});

const EXTERNAL_OBJECT_ROLE_CUE_VALUES = Object.freeze(Object.values(EXTERNAL_OBJECT_ROLE_CUE));
const EXTERNAL_OBJECT_ROLE_CUE_SET = new Set(EXTERNAL_OBJECT_ROLE_CUE_VALUES);

const EXTERNAL_OBJECT_FACTION_CUE = Object.freeze({
  NEUTRAL: 'neutral',
  INDEPENDENT: 'independent',
  CONSORTIUM: 'consortium',
  FRONTIER_UNION: 'frontier-union',
  IMPERIAL_REMNANT: 'imperial-remnant',
  PIRATE_CLAN: 'pirate-clan',
  UNKNOWN: 'unknown',
});

const EXTERNAL_OBJECT_FACTION_CUE_VALUES = Object.freeze(Object.values(EXTERNAL_OBJECT_FACTION_CUE));
const EXTERNAL_OBJECT_FACTION_CUE_SET = new Set(EXTERNAL_OBJECT_FACTION_CUE_VALUES);

const EXTERNAL_OBJECT_FALLBACK_TIER = Object.freeze({
  HERO: 'hero',
  STANDARD: 'standard',
  MINIMAL: 'minimal',
});

const EXTERNAL_OBJECT_FALLBACK_TIER_VALUES = Object.freeze(Object.values(EXTERNAL_OBJECT_FALLBACK_TIER));
const EXTERNAL_OBJECT_FALLBACK_TIER_SET = new Set(EXTERNAL_OBJECT_FALLBACK_TIER_VALUES);

const EXTERNAL_OBJECT_SILHOUETTE_PROFILE = Object.freeze({
  FRAGMENTED: 'fragmented',
  NEEDLE: 'needle',
  BROAD: 'broad',
  MODULAR: 'modular',
  RING: 'ring',
  SPIRE: 'spire',
  CLUSTERED: 'clustered',
  IRREGULAR: 'irregular',
});

const EXTERNAL_OBJECT_SILHOUETTE_PROFILE_VALUES = Object.freeze(
  Object.values(EXTERNAL_OBJECT_SILHOUETTE_PROFILE)
);
const EXTERNAL_OBJECT_SILHOUETTE_PROFILE_SET = new Set(EXTERNAL_OBJECT_SILHOUETTE_PROFILE_VALUES);

const EXTERNAL_OBJECT_MATERIAL_PROFILE = Object.freeze({
  SCRAP: 'scrap',
  ALLOY: 'alloy',
  COMPOSITE: 'composite',
  INFRASTRUCTURE: 'infrastructure',
  ROCKY: 'rocky',
  METALLIC: 'metallic',
  ICY: 'icy',
});

const EXTERNAL_OBJECT_MATERIAL_PROFILE_VALUES = Object.freeze(
  Object.values(EXTERNAL_OBJECT_MATERIAL_PROFILE)
);
const EXTERNAL_OBJECT_MATERIAL_PROFILE_SET = new Set(EXTERNAL_OBJECT_MATERIAL_PROFILE_VALUES);

const EXTERNAL_OBJECT_EMISSIVE_PROFILE = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  NAVIGATION: 'navigation',
});

const EXTERNAL_OBJECT_EMISSIVE_PROFILE_VALUES = Object.freeze(
  Object.values(EXTERNAL_OBJECT_EMISSIVE_PROFILE)
);
const EXTERNAL_OBJECT_EMISSIVE_PROFILE_SET = new Set(EXTERNAL_OBJECT_EMISSIVE_PROFILE_VALUES);

const EXTERNAL_OBJECT_SCHEMA_VERSION = 'sw-13-m0-v1';

function isCanonicalExternalObjectDomain(domain) {
  return EXTERNAL_OBJECT_DOMAIN_SET.has(domain);
}

function isCanonicalExternalObjectFamily(domain, family) {
  return Boolean(
    EXTERNAL_OBJECT_FAMILY_BY_DOMAIN[domain] && EXTERNAL_OBJECT_FAMILY_BY_DOMAIN[domain].includes(family)
  );
}

module.exports = {
  EXTERNAL_OBJECT_SCHEMA_VERSION,
  EXTERNAL_OBJECT_DOMAIN,
  EXTERNAL_OBJECT_DOMAIN_VALUES,
  EXTERNAL_OBJECT_FAMILY_BY_DOMAIN,
  EXTERNAL_OBJECT_ROLE_CUE,
  EXTERNAL_OBJECT_ROLE_CUE_VALUES,
  EXTERNAL_OBJECT_FACTION_CUE,
  EXTERNAL_OBJECT_FACTION_CUE_VALUES,
  EXTERNAL_OBJECT_FALLBACK_TIER,
  EXTERNAL_OBJECT_FALLBACK_TIER_VALUES,
  EXTERNAL_OBJECT_SILHOUETTE_PROFILE,
  EXTERNAL_OBJECT_SILHOUETTE_PROFILE_VALUES,
  EXTERNAL_OBJECT_MATERIAL_PROFILE,
  EXTERNAL_OBJECT_MATERIAL_PROFILE_VALUES,
  EXTERNAL_OBJECT_EMISSIVE_PROFILE,
  EXTERNAL_OBJECT_EMISSIVE_PROFILE_VALUES,
  isCanonicalExternalObjectDomain,
  isCanonicalExternalObjectFamily,
  EXTERNAL_OBJECT_DOMAIN_SET,
  EXTERNAL_OBJECT_ROLE_CUE_SET,
  EXTERNAL_OBJECT_FACTION_CUE_SET,
  EXTERNAL_OBJECT_FALLBACK_TIER_SET,
  EXTERNAL_OBJECT_SILHOUETTE_PROFILE_SET,
  EXTERNAL_OBJECT_MATERIAL_PROFILE_SET,
  EXTERNAL_OBJECT_EMISSIVE_PROFILE_SET,
};
