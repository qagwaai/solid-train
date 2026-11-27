'use strict';

const GAME_JOIN_REQUEST_EVENT = 'game-join-request';
const GAME_JOIN_RESPONSE_EVENT = 'game-join-response';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nonblank = (value) => typeof value === 'string' && /\S/.test(value);

function validJoinIdentity(identity) {
  return (
    identity &&
    typeof identity === 'object' &&
    !Array.isArray(identity) &&
    Object.keys(identity).length === 3 &&
    identity.operation === 'game-join' &&
    identity.entityType === 'game-session' &&
    nonblank(identity.containerId)
  );
}

function validJoinCorrelation(payload) {
  return (
    payload &&
    nonblank(payload.playerName) &&
    nonblank(payload.characterId) &&
    typeof payload.correlationId === 'string' &&
    UUID_V4.test(payload.correlationId) &&
    validJoinIdentity(payload.requestIdentity) &&
    payload.requestIdentity.containerId === payload.characterId
  );
}

function validJoinRequest(payload) {
  return validJoinCorrelation(payload) && nonblank(payload.sessionKey);
}

function gameJoinFailure(payload, reason, message) {
  return {
    success: false,
    message,
    reason,
    playerName: typeof payload?.playerName === 'string' ? payload.playerName : '',
    characterId: typeof payload?.characterId === 'string' ? payload.characterId : '',
    correlationId: payload.correlationId,
    requestIdentity: payload.requestIdentity,
  };
}

/**
 * @typedef {Object} GameJoinRequest
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} sessionKey
 */

/**
 * @typedef {Object} GameJoinResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 */

module.exports = {
  GAME_JOIN_REQUEST_EVENT,
  GAME_JOIN_RESPONSE_EVENT,
  validJoinCorrelation,
  validJoinRequest,
  gameJoinFailure,
};
