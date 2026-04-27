'use strict';

const SHIP_UPSERT_REQUEST_EVENT = 'ship-upsert-request';
const SHIP_UPSERT_RESPONSE_EVENT = 'ship-upsert-response';

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
 * @typedef {Object} ShipKinematics
 * @property {Triple} position
 * @property {Triple} velocity
 * @property {SpatialReference} reference
 */

/**
 * @typedef {Object} ItemContainer
 * @property {'ship'|'market'} containerType
 * @property {string} containerId
 */

/**
 * @typedef {Object} InventoryItemReference
 * @property {string} itemId
 * @property {string} itemType
 */

/**
 * @typedef {Object} InventoryItem
 * @property {string} id
 * @property {string} itemType
 * @property {string} displayName
 * @property {'contained'|'deployed'|'destroyed'} state
 * @property {'intact'|'damaged'|'disabled'|'destroyed'} damageStatus
 * @property {ItemContainer|null} container
 * @property {string} owningPlayerId
 * @property {string} owningCharacterId
 * @property {ShipKinematics|null} [kinematics]
 * @property {boolean} [launchable]
 */

/**
 * @typedef {Object} ShipUpsertEntity
 * @property {string} id
 * @property {string} [name]
 * @property {string} [shipName]
 * @property {string} [status]
 * @property {string} [model]
 * @property {number} [tier]
 * @property {InventoryItemReference[]|InventoryItem[]} [inventory]
 * @property {CelestialBodyLocation} [location]
 * @property {ShipKinematics} [kinematics]
 * @property {boolean} [launchable]
 */

/**
 * @typedef {Object} ShipUpsertRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} sessionKey
 * @property {ShipUpsertEntity} ship
 */

/**
 * @typedef {Object} ShipUpsertResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {ShipUpsertEntity} [ship]
 */

module.exports = {
  SHIP_UPSERT_REQUEST_EVENT,
  SHIP_UPSERT_RESPONSE_EVENT
};
