'use strict';

const STAR_LIST_REQUEST_EVENT = 'star-list-request';
const STAR_LIST_RESPONSE_EVENT = 'star-list-response';

/**
 * @typedef {Object} StarListRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} [systemId]
 * @property {string} [spectralClass]
 * @property {number} [maxDistanceParsec]
 * @property {number} [limit]
 * @property {string} [requestId]
 */

/**
 * @typedef {Object} StarListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {Object[]} stars
 * @property {string} [requestId]
 */

module.exports = {
  STAR_LIST_REQUEST_EVENT,
  STAR_LIST_RESPONSE_EVENT,
};
