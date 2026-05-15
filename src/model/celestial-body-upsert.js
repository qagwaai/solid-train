'use strict';

const CELESTIAL_BODY_UPSERT_REQUEST_EVENT = 'celestial-body-upsert-request';
const CELESTIAL_BODY_UPSERT_RESPONSE_EVENT = 'celestial-body-upsert-response';
const DEFAULT_SOLAR_SYSTEM_ID = 'sol';
const ASTEROID_MATERIAL_RARITY_VALUES = ['Common', 'Uncommon', 'Rare', 'Exotic'];
const CELESTIAL_BODY_STATE_VALUES = ['unscanned', 'active', 'destroyed'];

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
 * @typedef {Object} CelestialBodyUpsertEntity
 * @property {string} [id]
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
 * @property {string} [clusterId]
 * @property {Triple} [clusterCenterKm]
 * @property {Triple} [localOffsetKm]
 * @property {'unscanned'|'active'|'destroyed'} [state]
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
  ASTEROID_MATERIAL_RARITY_VALUES,
  CELESTIAL_BODY_STATE_VALUES,
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  DEFAULT_SOLAR_SYSTEM_ID,
};
