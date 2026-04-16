'use strict';

const CHARACTER_LIST_REQUEST_EVENT = 'character-list-request';
const CHARACTER_LIST_RESPONSE_EVENT = 'character-list-response';

/**
 * @typedef {Object} CharacterListRequest
 * @property {string} playerName
 */

/**
 * @typedef {Object} PlayerCharacterSummary
 * @property {string} id
 * @property {string} characterName
 * @property {number} [level]
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} CharacterListResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {PlayerCharacterSummary[]} characters
 */

module.exports = {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT
};
