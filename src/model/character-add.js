'use strict';

const CHARACTER_ADD_REQUEST_EVENT = 'character-add-request';
const CHARACTER_ADD_RESPONSE_EVENT = 'character-add-response';

/**
 * @typedef {Object} CharacterAddRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} characterName
 */

/**
 * @typedef {Object} CharacterAddResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} [characterName]
 * @property {string} [characterId]
 */

module.exports = {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT
};
