'use strict';

const CELESTIAL_BODY_UPSERT_REQUEST_EVENT = 'celestial-body-upsert-request';
const CELESTIAL_BODY_UPSERT_RESPONSE_EVENT = 'celestial-body-upsert-response';
const DEFAULT_SOLAR_SYSTEM_ID = 'sol';
const ASTEROID_MATERIAL_RARITY_VALUES = ['Common', 'Uncommon', 'Rare', 'Exotic'];

/**
 * @typedef {Object} Triple
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} CelestialBodyLocation
 * @property {Triple} positionKm
 */

/**
 * @typedef {Object} AsteroidKinematics
 * @property {Triple} velocityKmPerSec
 * @property {Triple} angularVelocityRadPerSec
 * @property {number} estimatedMassKg
 * @property {number} estimatedDiameterM
 */

/**
 * @typedef {Object} AsteroidMaterialProfile
 * @property {'Common'|'Uncommon'|'Rare'|'Exotic'} rarity
 * @property {string} material
 * @property {string} textureColor
 */

/**
 * @typedef {Object} CelestialBodyUpsertEntity
 * @property {string} id
 * @property {string} catalogId
 * @property {string} solarSystemId
 * @property {string} sourceScanId
 * @property {string} createdByCharacterId
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {CelestialBodyLocation} location
 * @property {AsteroidKinematics} kinematics
 * @property {AsteroidMaterialProfile} composition
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
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  DEFAULT_SOLAR_SYSTEM_ID
};