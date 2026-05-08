'use strict';

const CELESTIAL_BODY_LIST_REQUEST_EVENT = 'celestial-body-list-request';
const CELESTIAL_BODY_LIST_RESPONSE_EVENT = 'celestial-body-list-response';

/**
 * @typedef {Object} Triple
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} CelestialBodyListRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} solarSystemId
 * @property {Triple} positionKm
 * @property {number} distanceKm
 * @property {number} [limit]
 * @property {('unscanned'|'active'|'destroyed')[]} [states]
 * @property {string} [createdByCharacterId]
 * @property {string} [missionId]
 */

/**
 * @typedef {import('./celestial-body-upsert').CelestialBodyUpsertEntity & {distanceKm: number}} CelestialBodyListItem
 */

/**
 * @typedef {Object} CelestialBodyListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} solarSystemId
 * @property {Triple} [positionKm]
 * @property {number} [distanceKm]
 * @property {CelestialBodyListItem[]} celestialBodies
 */

module.exports = {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
};
