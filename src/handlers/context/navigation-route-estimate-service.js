'use strict';

const { createSchemaValidator } = require('../../model/schema-validator');
const optionsSchema = require('../../../api/schemas/navigation-estimate-options.schema.json');
const speedSchema = require('../../../api/schemas/navigation-route-estimate-request.schema.json');
const { calculateDistanceKm } = require('./orbital-math');

/** @type {import('ajv').ValidateFunction<{scenarioCruiseSpeedKmPerSec?: number}>} */
const validateOptions = createSchemaValidator().compile({
  ...optionsSchema,
  properties: { scenarioCruiseSpeedKmPerSec: speedSchema.properties.scenarioCruiseSpeedKmPerSec },
});

function rejected(status, reason, message) {
  return { success: false, estimate: { status, reason, message } };
}

function estimateFromNavigationState(ctx, state, options) {
  if (!validateOptions(options)) {
    return rejected('invalid', 'NAVIGATION_REQUEST_INVALID', 'Invalid navigation estimate options');
  }
  if (!state || state.reason === 'NAVIGATION_REQUEST_INVALID') {
    return rejected(
      'invalid',
      'NAVIGATION_REQUEST_INVALID',
      'A valid navigation selection is required'
    );
  }
  if (state.status !== 'supported') {
    return rejected(
      state.reason === 'NAVIGATION_READ_FAILED' ? 'failed' : 'unsupported',
      state.reason,
      state.message
    );
  }
  if (state.previewEligibility.status === 'ineligible') {
    return rejected(
      'ineligible',
      state.previewEligibility.reason,
      'Known source or destination host-profile intersection blocks estimation'
    );
  }
  const distanceKm = calculateDistanceKm(
    ctx,
    state.departure.positionKm,
    state.destination.positionKm
  );
  const speed = options.scenarioCruiseSpeedKmPerSec;
  const estimatedDurationSec = speed === undefined ? undefined : distanceKm / speed;
  if (
    !Number.isFinite(distanceKm) ||
    (speed !== undefined &&
      (!Number.isFinite(estimatedDurationSec) || (distanceKm > 0 && estimatedDurationSec <= 0)))
  ) {
    ctx.log('[navigation-route-estimate] Nonfinite or underflowed distance/duration');
    return rejected(
      'failed',
      'ESTIMATE_NUMERIC_INVALID',
      'Distance/duration must be finite; positive distance requires positive duration'
    );
  }
  return {
    success: true,
    estimate: {
      status: 'supported',
      solarSystemId: state.solarSystemId,
      departure: { shipId: state.departure.shipId },
      destination: { marketId: state.destination.marketId },
      coordinateBasisId: state.coordinateBasisId,
      referenceEpochMs: state.epochMs,
      positionEvaluationModelId: state.provenance.evaluationModelId,
      estimationModelId: 'frozen-endpoints-constant-speed-v1',
      distanceKm,
      classification: 'hypothetical-not-eta',
      assumptions: {
        endpointsFrozen: true,
        constantScenarioSpeed: true,
        accelerationBrakingOmitted: true,
        assistSpeedChangesOmitted: true,
        movementDuringTripOmitted: true,
      },
      warnings: ['CLEARANCE_UNVERIFIED'],
      duration:
        speed === undefined
          ? { status: 'unavailable', reason: 'SCENARIO_SPEED_NOT_SUPPLIED' }
          : {
              status: 'estimated',
              estimatedDurationSec,
              scenarioCruiseSpeedKmPerSec: speed,
              speedProvenance: 'caller-supplied-scenario',
            },
    },
  };
}

module.exports = { estimateFromNavigationState };
