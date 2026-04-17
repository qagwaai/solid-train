'use strict';

const DRONE_LIST_REQUEST_EVENT = 'drone-list-request';
const DRONE_LIST_RESPONSE_EVENT = 'drone-list-response';

/**
 * @typedef {Object} DroneListRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} sessionKey
 */

/**
 * @typedef {Object} DroneSummary
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [model]
 */

/**
 * @typedef {Object} DroneListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {DroneSummary[]} drones
 */

module.exports = {
  DRONE_LIST_REQUEST_EVENT,
  DRONE_LIST_RESPONSE_EVENT
};