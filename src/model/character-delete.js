'use strict';

const CHARACTER_DELETE_REQUEST_EVENT = 'character-delete-request';
const CHARACTER_DELETE_RESPONSE_EVENT = 'character-delete-response';

/**
 * @typedef {Object} CharacterDeleteRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} characterId
 * @property {string} [characterName]
 */

/**
 * @typedef {Object} CharacterDeleteResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} [characterId]
 */

module.exports = {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT
};
