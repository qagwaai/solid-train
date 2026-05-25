'use strict';

const CHARACTER_EDIT_REQUEST_EVENT = 'character-edit';
const CHARACTER_EDIT_RESPONSE_EVENT = 'character-edit-response';

/**
 * @typedef {Object} CharacterEditRequestIdentity
 * @property {string} operation
 * @property {string} entityType
 * @property {string} containerId
 */

/**
 * @typedef {Object} CharacterEditRequest
 * @property {string} characterId
 * @property {string} playerName
 * @property {string} characterName
 * @property {string} sessionKey
 * @property {string} correlationId
 * @property {CharacterEditRequestIdentity} requestIdentity
 */

/**
 * @typedef {Object} CharacterEditResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} correlationId
 * @property {CharacterEditRequestIdentity} requestIdentity
 * @property {string} [characterName]
 */

module.exports = {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT,
};
