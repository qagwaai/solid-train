'use strict';

const DRONE_UPSERT_REQUEST_EVENT = 'drone-upsert-request';
const DRONE_UPSERT_RESPONSE_EVENT = 'drone-upsert-response';

/**
 * @typedef {Object} Triple
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {'barycentric'|'body-centered'} SpatialReferenceKind
 */

/**
 * @typedef {Object} SpatialReference
 * @property {string} solarSystemId
 * @property {SpatialReferenceKind} referenceKind
 * @property {string} [referenceBodyId]
 * @property {'km'} [distanceUnit]
 * @property {'km/s'} [velocityUnit]
 * @property {number} epochMs
 */

/**
 * @typedef {Object} CelestialBodyLocation
 * @property {Triple} positionKm
 */

/**
 * @typedef {Object} DroneKinematics
 * @property {Triple} position
 * @property {Triple} velocity
 * @property {SpatialReference} reference
 */

/**
 * @typedef {Object} DroneUpsertEntity
 * @property {string} id
 * @property {string} [name]
 * @property {string} [droneName]
 * @property {string} [status]
 * @property {string} [model]
 * @property {CelestialBodyLocation} [location]
 * @property {DroneKinematics} [kinematics]
 */

/**
 * @typedef {Object} DroneUpsertRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} sessionKey
 * @property {DroneUpsertEntity} drone
 */

/**
 * @typedef {Object} DroneUpsertResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {DroneUpsertEntity} [drone]
 */

module.exports = {
  DRONE_UPSERT_REQUEST_EVENT,
  DRONE_UPSERT_RESPONSE_EVENT
};