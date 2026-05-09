'use strict';

const SOLAR_SYSTEM_GET_REQUEST_EVENT = 'solar-system-get-request';
const SOLAR_SYSTEM_GET_RESPONSE_EVENT = 'solar-system-get-response';

/**
 * @typedef {Object} SolarSystemGetRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} solarSystemId
 * @property {string} [asOf] - ISO timestamp; defaults to current time on the server
 * @property {string} [requestId]
 */

/**
 * @typedef {Object} SolarSystemGetResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} solarSystemId
 * @property {Object} [solarSystem] - SolarSystemSummary
 * @property {Object[]} [stars] - star bodies (bodyType: 'star') with visualization
 * @property {Object[]} [bodies] - all celestial bodies in the system
 * @property {string} [requestId]
 */

module.exports = {
  SOLAR_SYSTEM_GET_REQUEST_EVENT,
  SOLAR_SYSTEM_GET_RESPONSE_EVENT,
};
