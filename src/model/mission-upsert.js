'use strict';

const MISSION_UPSERT_REQUEST_EVENT = 'add-mission-request';
const MISSION_UPSERT_RESPONSE_EVENT = 'add-mission-response';
const MISSION_UPSERT_ALIAS_REQUEST_EVENT = 'mission-upsert-request';
const MISSION_UPSERT_ALIAS_RESPONSE_EVENT = 'mission-upsert-response';

/**
 * @typedef {Object} MissionUpsertRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} missionId
 * @property {string} sessionKey
 * @property {string} status
 * @property {string} [statusDetail]
 * @property {string} [requestId]
 */

/**
 * @typedef {Object} MissionUpsertResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {import('./mission').CharacterMissionProgress} [mission]
 * @property {string} [requestId]
 */

module.exports = {
  MISSION_UPSERT_REQUEST_EVENT,
  MISSION_UPSERT_RESPONSE_EVENT,
  MISSION_UPSERT_ALIAS_REQUEST_EVENT,
  MISSION_UPSERT_ALIAS_RESPONSE_EVENT,
};
