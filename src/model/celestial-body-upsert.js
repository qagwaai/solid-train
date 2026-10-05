'use strict';

const CELESTIAL_BODY_UPSERT_REQUEST_EVENT = 'celestial-body-upsert-request';
const CELESTIAL_BODY_UPSERT_RESPONSE_EVENT = 'celestial-body-upsert-response';
const DEFAULT_SOLAR_SYSTEM_ID = 'sol';
const SURFACE_ARCHETYPE_VALUES = [
  'rocky',
  'lava',
  'ocean',
  'gas-giant',
  'ice-giant',
  'star',
  'rocky-moon',
  'icy-moon',
  'asteroid',
];
const ASTEROID_MATERIAL_RARITY_VALUES = ['Common', 'Uncommon', 'Rare', 'Exotic'];
const CELESTIAL_BODY_STATE_VALUES = ['unscanned', 'active', 'destroyed'];
// Compatibility follows the curated catalogs and their explicit fallback mapping.
// planetType and visualization.textureKey are independent of this classification.
const BODY_TYPE_ARCHETYPES = {
  star: ['star'],
  planet: ['rocky', 'lava', 'ocean', 'gas-giant', 'ice-giant'],
  'dwarf-planet': ['rocky', 'icy-moon'],
  moon: ['rocky-moon', 'icy-moon', 'lava'],
  asteroid: ['asteroid'],
  tno: ['icy-moon'],
  comet: ['asteroid'],
};
const BODY_TYPE_VALUES = Object.keys(BODY_TYPE_ARCHETYPES);

function hasValidBodyClassification(body) {
  return Object.hasOwn(BODY_TYPE_ARCHETYPES, body?.bodyType) &&
    BODY_TYPE_ARCHETYPES[body.bodyType].includes(body.surfaceArchetype);
}

/**
 * @typedef {Object} Triple
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} SpatialState
 * @property {string} solarSystemId
 * @property {'barycentric'} frame
 * @property {Triple} positionKm
 * @property {number} epochMs
 */

/**
 * @typedef {Object} MotionState
 * @property {Triple} velocityKmPerSec
 * @property {Triple} [angularVelocityRadPerSec]
 */

/**
 * @typedef {Object} PhysicalState
 * @property {number} [estimatedMassKg]
 * @property {number} [estimatedDiameterM]
 */

/**
 * @typedef {Object} ObservabilityState
 * @property {'visible'|'not-visible'|'cloaked'} visibility
 * @property {'unscanned'|'scanned'} scanState
 */

/**
 * @typedef {Object} ClusterMetadata
 * @property {string} [clusterId]
 * @property {Triple} [clusterCenterKm]
 * @property {Triple} [localOffsetKm]
 */

/**
 * @typedef {Object} AsteroidMaterialProfile
 * @property {'Common'|'Uncommon'|'Rare'|'Exotic'} rarity
 * @property {string} material
 * @property {string} textureColor
 */

/**
 * @typedef {Object} ExternalObjectDescriptor
 * @property {string} descriptorId
 * @property {'sw-13-m0-v1'} schemaVersion
 * @property {'debris'|'ships'|'gates'|'stations'|'asteroids'} domain
 * @property {string} objectFamily
 * @property {'salvage'|'industrial'|'trade'|'military'|'navigation'|'infrastructure'|'hazard'|'civilian'|'neutral'} roleCue
 * @property {'neutral'|'independent'|'consortium'|'frontier-union'|'imperial-remnant'|'pirate-clan'|'unknown'} factionCue
 * @property {'hero'|'standard'|'minimal'} fallbackTier
 * @property {string} displayLabel
 * @property {'fragmented'|'needle'|'broad'|'modular'|'ring'|'spire'|'clustered'|'irregular'} silhouetteProfile
 * @property {'scrap'|'alloy'|'composite'|'infrastructure'|'rocky'|'metallic'|'icy'} materialProfile
 * @property {'none'|'low'|'medium'|'high'|'navigation'} emissiveProfile
 */

/**
 * @typedef {Object} CelestialBodyUpsertEntity
 * @property {string} [id]
 * @property {'star'|'planet'|'dwarf-planet'|'moon'|'asteroid'|'tno'|'comet'} bodyType
 * @property {string|null} [spectralClass] Source class; unknown is null.
 * @property {number|null} [luminositySolar] Source luminosity in solar units.
 * @property {'rocky'|'lava'|'ocean'|'gas-giant'|'ice-giant'|'star'|'rocky-moon'|'icy-moon'|'asteroid'} surfaceArchetype
 * @property {string} catalogId
 * @property {string} sourceScanId
 * @property {string} createdByCharacterId
 * @property {string} [missionId]
 * @property {string} [missionInstanceId]
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {SpatialState} spatial
 * @property {MotionState} [motion]
 * @property {PhysicalState} [physical]
 * @property {ObservabilityState} observability
 * @property {AsteroidMaterialProfile} [composition]
 * @property {ExternalObjectDescriptor} [externalObjectDescriptor]
 * @property {string} [clusterId]
 * @property {Triple} [clusterCenterKm]
 * @property {Triple} [localOffsetKm]
 * @property {'unscanned'|'active'|'destroyed'} state
 */

/**
 * @typedef {Object} CelestialBodyUpsertRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {CelestialBodyUpsertEntity} celestialBody
 */

/**
 * @typedef {Object} CelestialBodyUpsertResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {CelestialBodyUpsertEntity} [celestialBody]
 */

module.exports = {
  BODY_TYPE_ARCHETYPES,
  BODY_TYPE_VALUES,
  hasValidBodyClassification,
  ASTEROID_MATERIAL_RARITY_VALUES,
  CELESTIAL_BODY_STATE_VALUES,
  SURFACE_ARCHETYPE_VALUES,
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  DEFAULT_SOLAR_SYSTEM_ID,
};
