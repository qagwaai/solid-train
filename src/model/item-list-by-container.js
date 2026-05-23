'use strict';

const ITEM_LIST_BY_CONTAINER_REQUEST_EVENT = 'item-list-by-container-request';
const ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT = 'item-list-by-container-response';

/**
 * @typedef {Object} ItemContainer
 * @property {'ship'|'market'} containerType
 * @property {string} containerId
 */

/**
 * @typedef {Object} ItemListByContainerRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {'ship'|'market'} containerType
 * @property {string} containerId
 */

/**
 * @typedef {Object} ItemListByContainerItem
 * @property {string} id
 * @property {string} itemType
 * @property {string} displayName
 * @property {number} [tier]
 * @property {boolean} launchable
 * @property {'contained'|'deployed'|'destroyed'} state
 * @property {'intact'|'damaged'|'disabled'|'destroyed'} damageStatus
 * @property {ItemContainer|null} container
 * @property {string|null} owningPlayerId
 * @property {string|null} owningCharacterId
 * @property {Object|null} spatial
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ItemListByContainerResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {'ship'|'market'} [containerType]
 * @property {string} [containerId]
 * @property {ItemListByContainerItem[]} [items]
 */

module.exports = {
  ITEM_LIST_BY_CONTAINER_REQUEST_EVENT,
  ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT,
};
