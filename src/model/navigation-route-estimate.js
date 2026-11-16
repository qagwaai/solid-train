'use strict';

const { attachRequestId } = require('../handlers/handler-utils');

const NAVIGATION_ROUTE_ESTIMATE_REQUEST_EVENT = 'navigation-route-estimate-request';
const NAVIGATION_ROUTE_ESTIMATE_RESPONSE_EVENT = 'navigation-route-estimate-response';

/**
 * @typedef {Object} NavigationRouteEstimateRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} correlationId
 * @property {{operation: 'navigation-route-estimate', entityType: 'solar-system', containerId: string}} requestIdentity
 * @property {string} solarSystemId
 * @property {string} shipId
 * @property {string} destinationMarketId
 * @property {number} [scenarioCruiseSpeedKmPerSec]
 * @property {string} [requestId]
 */

function navigationEstimateFailure(payload, status, reason, message) {
  return attachRequestId(
    {
      success: false,
      message,
      playerName: typeof payload?.playerName === 'string' ? payload.playerName : '',
      solarSystemId: typeof payload?.solarSystemId === 'string' ? payload.solarSystemId : '',
      correlationId: payload?.correlationId ?? null,
      requestIdentity: payload?.requestIdentity ?? null,
      estimate: { status, reason, message },
    },
    payload
  );
}

function navigationEstimateSocketFailure(payload, reason, message) {
  return reason === 'invalid-session'
    ? navigationEstimateFailure(payload, 'unsupported', 'INVALID_SESSION', message)
    : navigationEstimateFailure(payload, 'failed', 'NAVIGATION_READ_FAILED', message);
}

module.exports = {
  NAVIGATION_ROUTE_ESTIMATE_REQUEST_EVENT,
  NAVIGATION_ROUTE_ESTIMATE_RESPONSE_EVENT,
  navigationEstimateFailure,
  navigationEstimateSocketFailure,
};
