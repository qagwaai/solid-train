'use strict';

const GAME_JOIN_REQUEST_EVENT = 'game-join';
const GAME_JOIN_RESPONSE_EVENT = 'game-join-response';

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
  GAME_JOIN_RESPONSE_EVENT
};