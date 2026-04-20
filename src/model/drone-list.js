'use strict';

const DRONE_LIST_REQUEST_EVENT = 'drone-list-request';
const DRONE_LIST_RESPONSE_EVENT = 'drone-list-response';

/**
 * @typedef {Object} DroneListRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} sessionKey
 */

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
 * @property {number} epochMs
 */

/**
 * @typedef {Object} DroneKinematics
 * @property {Triple} position - Position in 3D space
 * @property {Triple} velocity - Velocity in 3D space
 * @property {SpatialReference} reference - Spatial reference frame
 */

/**
 * @typedef {Object} DroneSummary
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [model]
 * @property {DroneKinematics} [kinematics]
 */

/**
 * @typedef {Object} DroneListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {DroneSummary[]} drones
 */

module.exports = {
  DRONE_LIST_REQUEST_EVENT,
  DRONE_LIST_RESPONSE_EVENT
};