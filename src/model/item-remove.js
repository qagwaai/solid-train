'use strict';

const ITEM_REMOVE_REQUEST_EVENT = 'item-remove-request';
const ITEM_REMOVE_RESPONSE_EVENT = 'item-remove-response';

/**
 * @typedef {Object} ItemRemoveRequestIdentity
 * @property {string} operation
 * @property {string} entityType
 * @property {string} containerId
 */

/**
 * @typedef {Object} ItemRemoveRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} correlationId
 * @property {ItemRemoveRequestIdentity} requestIdentity
 * @property {string} characterId
 * @property {string} shipId
 * @property {string} itemId
 * @property {string} [itemType]
 * @property {string} [reason]
 */

/**
 * @typedef {Object} ItemRemoveResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} correlationId
 * @property {ItemRemoveRequestIdentity} requestIdentity
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} shipId
 * @property {string} itemId
 * @property {string} itemType
 * @property {Object} [item]
 */

module.exports = {
  ITEM_REMOVE_REQUEST_EVENT,
  ITEM_REMOVE_RESPONSE_EVENT,
};
