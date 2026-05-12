'use strict';

const SOLAR_SYSTEM_LIST_REQUEST_EVENT = 'solar-system-list-request';
const SOLAR_SYSTEM_LIST_RESPONSE_EVENT = 'solar-system-list-response';

/**
 * @typedef {Object} SolarSystemListRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {('curated'|'procedural')} [source]
 * @property {number} [maxDistanceParsec]
 * @property {string} [search]
 * @property {number} [limit]
 * @property {string} [requestId]
 */

/**
 * @typedef {Object} SolarSystemSummary
 * @property {string} id
 * @property {string} displayName
 * @property {string} hygSystemId
 * @property {('curated'|'procedural')} source
 * @property {boolean} isMultiStar
 * @property {number} starCount
 * @property {number|null} distanceParsec
 * @property {{x:number,y:number,z:number}} positionPc
 * @property {Object|null} primaryStar
 * @property {number} [planetCount]
 * @property {number} [moonCount]
 * @property {number} [asteroidCount]
 * @property {number} [marketCount]
 */

/**
 * @typedef {Object} SolarSystemListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {SolarSystemSummary[]} solarSystems
 * @property {string} [requestId]
 */

module.exports = {
  SOLAR_SYSTEM_LIST_REQUEST_EVENT,
  SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
};
