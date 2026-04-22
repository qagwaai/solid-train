'use strict';

const MISSION_ADD_REQUEST_EVENT = 'add-mission-request';
const MISSION_ADD_RESPONSE_EVENT = 'add-mission-response';

/**
 * @typedef {Object} MissionAddRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} missionId
 * @property {string} sessionKey
 * @property {string} [status]
 */

/**
 * @typedef {Object} MissionAddResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {import('./mission').CharacterMissionProgress} [mission]
 */

module.exports = {
  MISSION_ADD_REQUEST_EVENT,
  MISSION_ADD_RESPONSE_EVENT
};