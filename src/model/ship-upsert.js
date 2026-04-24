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
 * @typedef {Object} ShipUpsertEntity
 * @property {string} id
 * @property {string} [name]
 * @property {string} [shipName]
 * @property {string} [status]
 * @property {string} [model]
 * @property {CelestialBodyLocation} [location]
 * @property {ShipKinematics} [kinematics]
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
