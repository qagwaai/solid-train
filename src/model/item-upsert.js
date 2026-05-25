'use strict';

const ITEM_UPSERT_REQUEST_EVENT = 'item-upsert-request';
const ITEM_UPSERT_RESPONSE_EVENT = 'item-upsert-response';
const UPSERT_ITEM_REQUEST_EVENT = 'upsert-item-request';
const UPSERT_ITEM_RESPONSE_EVENT = 'upsert-item-response';

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
 * @typedef {Object} ItemKinematics
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
 * @typedef {Object} ItemRequestIdentity
 * @property {string} operation
 * @property {string} entityType
 * @property {string} containerId
 */

/**
 * @typedef {Object} ItemUpsertEntity
 * @property {string} [id]
 * @property {string} itemType
 * @property {string} displayName
 * @property {number} [tier]
 * @property {'contained'|'deployed'|'destroyed'} [state]
 * @property {'intact'|'damaged'|'disabled'|'destroyed'} [damageStatus]
 * @property {ItemContainer|null} [container]
 * @property {string} [owningPlayerId]
 * @property {string} [owningCharacterId]
 * @property {ItemKinematics|null} [kinematics]
 * @property {ItemContainer|null} [launchedFromContainer]
 * @property {string|null} [destroyedAt]
 * @property {string|null} [destroyedReason]
 * @property {string|null} [discoveredAt]
 * @property {string|null} [discoveredByCharacterId]
 * @property {boolean} [launchable]
 */

/**
 * @typedef {Object} ItemUpsertRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} correlationId
 * @property {ItemRequestIdentity} requestIdentity
 * @property {ItemUpsertEntity} item
 */

/**
 * @typedef {Object} ItemUpsertResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} correlationId
 * @property {ItemRequestIdentity} requestIdentity
 * @property {ItemUpsertEntity} [item]
 */

module.exports = {
  ITEM_UPSERT_REQUEST_EVENT,
  ITEM_UPSERT_RESPONSE_EVENT,
  UPSERT_ITEM_REQUEST_EVENT,
  UPSERT_ITEM_RESPONSE_EVENT,
};
