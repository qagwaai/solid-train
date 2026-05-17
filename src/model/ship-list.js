'use strict';

const SHIP_LIST_REQUEST_EVENT = 'ship-list-request';
const SHIP_LIST_RESPONSE_EVENT = 'ship-list-response';

/**
 * @typedef {Object} ShipListRequest
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
 * @typedef {'km'} DistanceUnit
 */

/**
 * @typedef {'km/s'} VelocityUnit
 */

/**
 * @typedef {Object} CelestialBodyLocation
 * @property {Triple} positionKm
 */

/**
 * @typedef {'barycentric'|'body-centered'} SpatialReferenceKind
 */

/**
 * @typedef {Object} SpatialReference
 * @property {string} solarSystemId
 * @property {SpatialReferenceKind} referenceKind
 * @property {string} [referenceBodyId]
 * @property {DistanceUnit} [distanceUnit]
 * @property {VelocityUnit} [velocityUnit]
 * @property {number} epochMs
 */

/**
 * @typedef {Object} ShipKinematics
 * @property {Triple} position - Position in 3D space
 * @property {Triple} velocity - Velocity in 3D space
 * @property {SpatialReference} reference - Spatial reference frame
 */

/**
 * @typedef {Object} ItemContainer
 * @property {'ship'|'market'} containerType
 * @property {string} containerId
 */

/**
 * @typedef {Object} InventoryItem
 * @property {string} id
 * @property {string} itemType
 * @property {string} displayName
 * @property {boolean} launchable
 * @property {'contained'|'deployed'|'destroyed'} state
 * @property {'intact'|'damaged'|'disabled'|'destroyed'} damageStatus
 * @property {ItemContainer|null} container
 * @property {string} owningPlayerId
 * @property {string} owningCharacterId
 * @property {Object|null} spatial
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ShipSummary
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [model]
 * @property {number} [tier]
 * @property {InventoryItem[]} [inventory]
 * @property {CelestialBodyLocation} [location]
 * @property {ShipKinematics} [kinematics]
 * @property {boolean} [launchable]
 */

/**
 * @typedef {Object} ShipListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {ShipSummary[]} ships
 */

module.exports = {
  SHIP_LIST_REQUEST_EVENT,
  SHIP_LIST_RESPONSE_EVENT,
};
