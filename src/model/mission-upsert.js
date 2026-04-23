'use strict';

const MISSION_UPSERT_REQUEST_EVENT = 'add-mission-request';
const MISSION_UPSERT_RESPONSE_EVENT = 'add-mission-response';

/**
 * @typedef {Object} MissionUpsertRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} missionId
 * @property {string} sessionKey
 * @property {string} status
 */

/**
 * @typedef {Object} MissionUpsertResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {import('./mission').CharacterMissionProgress} [mission]
 */

module.exports = {
  MISSION_UPSERT_REQUEST_EVENT,
  MISSION_UPSERT_RESPONSE_EVENT
};
