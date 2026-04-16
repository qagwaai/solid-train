'use strict';

const REGISTER_EVENT = 'register';
const REGISTER_RESPONSE_EVENT = 'register-response';

/**
 * @typedef {Object} RegisterRequest
 * @property {string} playerName
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {Object} RegisterResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} [playerId]
 */

module.exports = {
  REGISTER_EVENT,
  REGISTER_RESPONSE_EVENT
};
