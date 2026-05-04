'use strict';

const MISSION_LIST_REQUEST_EVENT = 'list-missions-request';
const MISSION_LIST_RESPONSE_EVENT = 'list-missions-response';

/**
 * @typedef {Object} MissionListRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} sessionKey
 * @property {string[]} [statuses]
 * @property {string} [requestId]
 */

/**
 * @typedef {Object} MissionListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {import('./mission').CharacterMissionProgress[]} missions
 * @property {string} [requestId]
 */

module.exports = {
  MISSION_LIST_REQUEST_EVENT,
  MISSION_LIST_RESPONSE_EVENT
};