'use strict';

const ITEM_LIST_BY_LOCATION_REQUEST_EVENT = 'item-list-by-location-request';
const ITEM_LIST_BY_LOCATION_RESPONSE_EVENT = 'item-list-by-location-response';

/**
 * @typedef {Object} Triple
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} ItemListByLocationRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} solarSystemId
 * @property {Triple} positionKm
 * @property {number} distanceKm
 * @property {string} [itemType]
 * @property {number} [limit]
 */

/**
 * @typedef {Object} ItemListByLocationItem
 * @property {string} id
 * @property {string} itemType
 * @property {string} displayName
 * @property {'contained'|'deployed'|'destroyed'} state
 * @property {'intact'|'damaged'|'disabled'|'destroyed'} damageStatus
 * @property {number} distanceKm
 */

/**
 * @typedef {Object} ItemListByLocationResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} [solarSystemId]
 * @property {Triple} [positionKm]
 * @property {number} [distanceKm]
 * @property {string} [itemType]
 * @property {ItemListByLocationItem[]} items
 */

module.exports = {
  ITEM_LIST_BY_LOCATION_REQUEST_EVENT,
  ITEM_LIST_BY_LOCATION_RESPONSE_EVENT
};
