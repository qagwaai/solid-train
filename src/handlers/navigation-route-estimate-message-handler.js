'use strict';

const { createSchemaValidator } = require('../model/schema-validator');
const requestSchema = require('../../api/schemas/navigation-route-estimate-request.schema.json');
const { attachRequestId } = require('./handler-utils');
const { getNavigationStateAsync } = require('./context/navigation-state-service');
const { estimateFromNavigationState } = require('./context/navigation-route-estimate-service');
const {
  NAVIGATION_ROUTE_ESTIMATE_REQUEST_EVENT,
  NAVIGATION_ROUTE_ESTIMATE_RESPONSE_EVENT,
  navigationEstimateFailure,
} = require('../model/navigation-route-estimate');

/** @type {import('ajv').ValidateFunction<import('../model/navigation-route-estimate').NavigationRouteEstimateRequest>} */
const validateRequest = createSchemaValidator({ allErrors: true }).compile(requestSchema);

class NavigationRouteEstimateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    if (!validateRequest(payload)) {
      return navigationEstimateFailure(
        payload,
        'invalid',
        'NAVIGATION_REQUEST_INVALID',
        'Invalid navigation route estimate request'
      );
    }
    if (payload.requestIdentity.containerId !== payload.solarSystemId) {
      return navigationEstimateFailure(
        payload,
        'invalid',
        'NAVIGATION_REQUEST_INVALID',
        'requestIdentity.containerId must equal solarSystemId'
      );
    }
    const player = this.context.getPlayer(payload.playerName);
    if (!player) {
      return navigationEstimateFailure(
        payload,
        'unsupported',
        'SHIP_NOT_OWNED',
        'The departure ship has no registered player owner'
      );
    }

    let state;
    try {
      ({ navigationState: state } = await getNavigationStateAsync(
        this.context,
        payload.playerName,
        payload.solarSystemId,
        { shipId: payload.shipId, destinationMarketId: payload.destinationMarketId }
      ));
    } catch (error) {
      this.context.log(
        `[navigation-route-estimate] Source read/evaluation failed: ${error.message}`
      );
      return navigationEstimateFailure(
        payload,
        'failed',
        'NAVIGATION_READ_FAILED',
        'Navigation source read/evaluation failed'
      );
    }
    const result = estimateFromNavigationState(
      this.context,
      state,
      payload.scenarioCruiseSpeedKmPerSec === undefined
        ? {}
        : { scenarioCruiseSpeedKmPerSec: payload.scenarioCruiseSpeedKmPerSec }
    );
    if (!result.success) {
      return navigationEstimateFailure(
        payload,
        result.estimate.status,
        result.estimate.reason,
        result.estimate.message
      );
    }
    return attachRequestId(
      {
        success: true,
        message: 'Direct baseline measured; any duration is hypothetical, not an ETA',
        playerName: player.playerName,
        solarSystemId: payload.solarSystemId,
        correlationId: payload.correlationId,
        requestIdentity: payload.requestIdentity,
        estimate: result.estimate,
      },
      payload
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage(NAVIGATION_ROUTE_ESTIMATE_REQUEST_EVENT, payload, {
      level: 'debug',
    });
    const response = await this.buildResponse(payload);
    socket.emit(NAVIGATION_ROUTE_ESTIMATE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = { NavigationRouteEstimateMessageHandler };
