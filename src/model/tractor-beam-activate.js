'use strict';

const TRACTOR_BEAM_ACTIVATE_REQUEST_EVENT = 'tractor-beam-activate-request';
const TRACTOR_BEAM_ACTIVATE_RESPONSE_EVENT = 'tractor-beam-activate-response';

/**
 * @typedef {Object} TractorBeamActivateRequestIdentity
 * @property {string} operation
 * @property {string} entityType
 * @property {string} containerId
 */

/**
 * @typedef {Object} TractorBeamActivateRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} correlationId
 * @property {TractorBeamActivateRequestIdentity} requestIdentity
 * @property {string} characterId
 * @property {string} shipId
 * @property {string} [targetItemId]
 * @property {string} [targetCelestialBodyId]
 */

/**
 * @typedef {Object} TractorBeamActivateResponse
 * @property {boolean} success
 * @property {string} message
 * @property {string} correlationId
 * @property {TractorBeamActivateRequestIdentity} requestIdentity
 * @property {string} playerName
 * @property {string} characterId
 * @property {string} shipId
 * @property {string} [tractorBeamItemId]
 * @property {string|null} [targetItemId]
 * @property {string|null} [targetCelestialBodyId]
 * @property {boolean} [activated]
 */

module.exports = {
  TRACTOR_BEAM_ACTIVATE_REQUEST_EVENT,
  TRACTOR_BEAM_ACTIVATE_RESPONSE_EVENT,
};
