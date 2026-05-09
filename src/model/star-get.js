'use strict';

const STAR_GET_REQUEST_EVENT = 'star-get-request';
const STAR_GET_RESPONSE_EVENT = 'star-get-response';

/**
 * @typedef {Object} StarGetRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} hygId
 * @property {string} [requestId]
 */

/**
 * @typedef {Object} StarGetResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} hygId
 * @property {Object} [star]
 * @property {string} [requestId]
 */

module.exports = {
  STAR_GET_REQUEST_EVENT,
  STAR_GET_RESPONSE_EVENT,
};
