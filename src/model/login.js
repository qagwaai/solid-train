'use strict';

const LOGIN_EVENT = 'login';
const LOGIN_RESPONSE_EVENT = 'login-response';

const LOGIN_FAILURE_REASONS = {
  PLAYER_NOT_REGISTERED: 'PLAYER_NOT_REGISTERED',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  UNKNOWN: 'UNKNOWN'
};

/**
 * @typedef {Object} LoginRequest
 * @property {string} playerName
 * @property {string} password
 */

/**
 * @typedef {'PLAYER_NOT_REGISTERED' | 'PASSWORD_MISMATCH' | 'UNKNOWN'} LoginFailureReason
 */

/**
 * @typedef {Object} LoginResponse
 * @property {boolean} success
 * @property {string} message
 * @property {LoginFailureReason} [reason]
 * @property {string} [playerId]
 * @property {string} [sessionKey]
 */

module.exports = {
  LOGIN_EVENT,
  LOGIN_RESPONSE_EVENT,
  LOGIN_FAILURE_REASONS
};
