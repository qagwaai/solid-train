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
 * @typedef {Object} ItemListByContainerResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {'ship'|'market'} [containerType]
 * @property {string} [containerId]
 * @property {Object[]} [items]
 */

module.exports = {
  ITEM_LIST_BY_CONTAINER_REQUEST_EVENT,
  ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT,
};
