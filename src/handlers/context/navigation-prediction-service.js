'use strict';

const { createSchemaValidator } = require('../../model/schema-validator');
const selectorsSchema = require('../../../api/schemas/navigation-state-request.schema.json');
const optionsSchema = require('../../../api/schemas/navigation-prediction-options.schema.json');
const resultSchema = require('../../../api/schemas/navigation-paired-prediction.schema.json');
const { BASIS_ID, MODEL_ID } = require('../../model/navigation-placement');

const ajv = createSchemaValidator();
/** @type {import('ajv').ValidateFunction<{shipId: string, destinationMarketId: string, candidateBodyId?: string}>} */
const validSelectors = ajv.compile(selectorsSchema);
const validSpeed = ajv.compile(optionsSchema.definitions.validSpeed);
const MIN_EPOCH_MS = resultSchema.definitions.epochMs.minimum;
const MAX_EPOCH_MS = resultSchema.definitions.epochMs.maximum + 1;
const HORIZON_MS = 315576000000;
const MAX_CONTRACTION = 0.5;
const MAX_ITERATIONS = 64;
const STOP_TOLERANCE_MS = 0.1;
const RESIDUAL_TOLERANCE_MS = 1;

class PredictionError extends Error {
  constructor(status, reason, message) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

function rejected(status, reason, message) {
  return { success: false, prediction: { status, reason, message } };
}

/** @returns {never} */
function fail(status, reason, message) {
  throw new PredictionError(status, reason, message);
}

function validatePredictionRequest(options, navigation) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => key !== 'scenarioCruiseSpeedKmPerSec')
  ) {
    return rejected(
      'invalid',
      'NAVIGATION_REQUEST_INVALID',
      'Invalid navigation prediction options'
    );
  }
  if (!validSpeed(options.scenarioCruiseSpeedKmPerSec)) {
    return rejected(
      'invalid',
      'SCENARIO_SPEED_INVALID',
      'scenarioCruiseSpeedKmPerSec is required and must be a finite number in [120, 10000] km/s'
    );
  }
  if (!validSelectors(navigation)) {
    return rejected(
      'invalid',
      'NAVIGATION_REQUEST_INVALID',
      'A valid navigation selection is required'
    );
  }
  if (navigation.candidateBodyId === undefined) {
    return rejected('invalid', 'CANDIDATE_REQUIRED', 'An explicit candidateBodyId is required');
  }
  return null;
}

function stateRejection(state) {
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
      'Known source or destination host-profile intersection blocks prediction'
    );
  }
  return null;
}

function finiteVector(value) {
  return value && ['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]));
}

function keplerSpeedBound(orbit, station = false) {
  if (
    !orbit ||
    !Number.isFinite(orbit.semiMajorAxisKm) ||
    orbit.semiMajorAxisKm <= 0 ||
    !Number.isFinite(orbit.eccentricity) ||
    orbit.eccentricity < 0 ||
    orbit.eccentricity > (station ? 0.99 : 0.999) ||
    !Number.isFinite(orbit.orbitalPeriodSec) ||
    Math.abs(orbit.orbitalPeriodSec) < 1 ||
    (station && orbit.orbitalPeriodSec < 1)
  ) {
    fail(
      'unsupported',
      'EVALUATION_UNSUPPORTED',
      'A finite supported Kepler speed bound cannot be established'
    );
  }
  const e = orbit.eccentricity;
  const period = station
    ? Math.max(1, orbit.orbitalPeriodSec)
    : Math.max(1, Math.abs(orbit.orbitalPeriodSec));
  // Periapsis is the global speed maximum; fixed rotations preserve its norm.
  const bound = orbit.semiMajorAxisKm * ((2 * Math.PI) / period) * Math.sqrt((1 + e) / (1 - e));
  if (!Number.isFinite(bound) || bound <= 0) {
    fail(
      'unsupported',
      'EVALUATION_UNSUPPORTED',
      'The Kepler speed bound is nonfinite or underflowed'
    );
  }
  return bound;
}

function keplerChainSpeedBound(id, getBody, visiting = new Set()) {
  const entry = getBody(id);
  if (
    !entry ||
    visiting.has(id) ||
    typeof entry.positionKmAtTimestamp === 'function' ||
    (!entry.orbit && (id !== 'sol-sun' || entry.parentBodyId))
  ) {
    fail(
      'unsupported',
      'EVALUATION_UNSUPPORTED',
      'The target chain has no supported Kepler speed bound'
    );
  }
  visiting.add(id);
  const bound =
    (entry.orbit ? keplerSpeedBound(entry.orbit) : 0) +
    (entry.parentBodyId ? keplerChainSpeedBound(entry.parentBodyId, getBody, visiting) : 0);
  visiting.delete(id);
  if (!Number.isFinite(bound)) {
    fail('unsupported', 'EVALUATION_UNSUPPORTED', 'The target chain speed bound is nonfinite');
  }
  return bound;
}

function solveLeg({ departureEpochMs, startEpochMs, startPositionKm, speed, target, leg }) {
  const nonconvergent = leg === 'encounter' ? 'ENCOUNTER_NONCONVERGENT' : 'ARRIVAL_NONCONVERGENT';
  if (
    !Number.isSafeInteger(departureEpochMs) ||
    departureEpochMs < MIN_EPOCH_MS ||
    departureEpochMs >= MAX_EPOCH_MS ||
    !Number.isSafeInteger(startEpochMs) ||
    startEpochMs < departureEpochMs ||
    !finiteVector(startPositionKm) ||
    !validSpeed(speed)
  ) {
    fail('failed', 'PREDICTION_NUMERIC_INVALID', 'Invalid prediction leg inputs');
  }
  function evaluate(epochMs) {
    const evaluated = target(epochMs);
    if (
      !finiteVector(evaluated.positionKm) ||
      (evaluated.hostPositionKm !== undefined && !finiteVector(evaluated.hostPositionKm))
    ) {
      fail('failed', 'PREDICTION_NUMERIC_INVALID', 'Prediction position is not a finite km vector');
    }
    const distanceKm = Math.hypot(
      ...['x', 'y', 'z'].map((axis) => evaluated.positionKm[axis] - startPositionKm[axis])
    );
    const next = startEpochMs + (1000 * distanceKm) / speed;
    if (!Number.isFinite(next)) {
      fail('failed', 'PREDICTION_NUMERIC_INVALID', 'Prediction epoch is not finite');
    }
    return { evaluated, next };
  }
  let epochMs = startEpochMs;
  for (let iterations = 1; iterations <= MAX_ITERATIONS; iterations += 1) {
    const { next } = evaluate(epochMs);
    if (next - departureEpochMs > 2 * HORIZON_MS) {
      fail(
        'unsupported',
        'PREDICTION_HORIZON_EXCEEDED',
        'Prediction exceeds the departure-relative ten Julian-year horizon'
      );
    }
    const delta = Math.abs(next - epochMs);
    epochMs = next;
    if (delta > STOP_TOLERANCE_MS) continue;
    epochMs = Math.round(epochMs);
    if (epochMs - departureEpochMs > HORIZON_MS) {
      fail(
        'unsupported',
        'PREDICTION_HORIZON_EXCEEDED',
        'Prediction exceeds the departure-relative ten Julian-year horizon'
      );
    }
    if (epochMs >= MAX_EPOCH_MS) {
      fail(
        'unsupported',
        'PREDICTION_EPOCH_UNSUPPORTED',
        'Prediction epoch must be before 2100 in uniform game time'
      );
    }
    const { evaluated, next: finalNext } = evaluate(epochMs);
    const residualMs = Math.abs(finalNext - epochMs);
    if (residualMs > RESIDUAL_TOLERANCE_MS) {
      fail(
        'failed',
        nonconvergent,
        'The independently evaluated integer-epoch timing residual exceeds 1 ms'
      );
    }
    return { ...structuredClone(evaluated), epochMs, convergence: { iterations, residualMs } };
  }
  return fail('failed', nonconvergent, 'The prediction leg did not converge within 64 iterations');
}

function predictNavigation(ctx, state, options, createTargets) {
  try {
    const blocked = stateRejection(state);
    if (blocked) return blocked;
    const speed = options.scenarioCruiseSpeedKmPerSec;
    const targets = createTargets();
    for (const target of [targets.candidate, targets.destination]) {
      if (!Number.isFinite(target.speedBoundKmPerSec) || target.speedBoundKmPerSec < 0) {
        fail(
          'unsupported',
          'EVALUATION_UNSUPPORTED',
          'A finite target speed bound cannot be established'
        );
      }
      if (target.speedBoundKmPerSec / speed > MAX_CONTRACTION) {
        fail(
          'unsupported',
          'SCENARIO_SPEED_BELOW_CONVERGENCE_BOUND',
          'Both target speed bounds must be at most half the scenario speed'
        );
      }
    }
    const encounter = solveLeg({
      departureEpochMs: state.epochMs,
      startEpochMs: state.epochMs,
      startPositionKm: state.departure.positionKm,
      speed,
      target: targets.candidate.atEpoch,
      leg: 'encounter',
    });
    const arrival = solveLeg({
      departureEpochMs: state.epochMs,
      startEpochMs: encounter.epochMs,
      startPositionKm: encounter.positionKm,
      speed,
      target: targets.destination.atEpoch,
      leg: 'arrival',
    });
    targets.assertSources();
    return {
      success: true,
      prediction: {
        status: 'supported',
        solarSystemId: 'sol',
        coordinateBasisId: BASIS_ID,
        positionEvaluationModelId: MODEL_ID,
        predictionModelId: 'constant-speed-straight-legs-moving-targets-v1',
        timeScaleId: 'stellar:unix-ms-uniform:v1',
        sourceRevision: state.provenance.sourceRevision,
        classification: 'illustrative-not-eta',
        scenarioCruiseSpeedKmPerSec: speed,
        speedProvenance: 'caller-supplied-scenario',
        departure: {
          shipId: state.departure.shipId,
          epochMs: state.epochMs,
          positionKm: { ...state.departure.positionKm },
        },
        encounter,
        arrival,
        assumptions: {
          legDistanceStraightLine: true,
          constantScenarioSpeed: true,
          accelerationBrakingOmitted: true,
          gravityAndAssistEffectsOmitted: true,
          departureFixedAtNavigationEpoch: true,
          encounterAtBodyCenter: true,
        },
        warnings: ['CLEARANCE_UNVERIFIED'],
      },
    };
  } catch (error) {
    if (error instanceof PredictionError) {
      return rejected(error.status, error.reason, error.message);
    }
    ctx.log(`[navigation-prediction] Evaluation failed: ${error.message}`);
    return rejected('failed', 'PREDICTION_EVALUATION_FAILED', 'Prediction evaluation failed');
  }
}

function predictionFromNavigationState(ctx, state, requestError, result) {
  try {
    const blocked = requestError || stateRejection(state);
    if (blocked) return blocked;
    if (result?.success === false) return result;
    const p = result?.prediction;
    if (
      !p ||
      p.sourceRevision !== state.provenance.sourceRevision ||
      p.solarSystemId !== state.solarSystemId ||
      p.coordinateBasisId !== state.coordinateBasisId ||
      p.positionEvaluationModelId !== state.provenance.evaluationModelId ||
      p.departure?.shipId !== state.departure.shipId ||
      p.departure?.epochMs !== state.epochMs ||
      !['x', 'y', 'z'].every(
        (axis) => p.departure.positionKm?.[axis] === state.departure.positionKm[axis]
      ) ||
      state.candidates.length !== 1 ||
      p.encounter?.bodyId !== state.candidates[0].bodyId ||
      p.arrival?.marketId !== state.destination.marketId ||
      p.arrival?.hostBodyId !== state.destination.hostBodyId
    ) {
      ctx.log('[navigation-prediction] Same-response source association mismatch');
      return rejected(
        'failed',
        'PREDICTION_SOURCE_MISMATCH',
        'Prediction does not match the same-response navigation sources'
      );
    }
    return result;
  } catch (error) {
    ctx.log(`[navigation-prediction] Composition failed: ${error.message}`);
    return rejected('failed', 'PREDICTION_EVALUATION_FAILED', 'Prediction composition failed');
  }
}

module.exports = {
  PredictionError,
  HORIZON_MS,
  keplerSpeedBound,
  keplerChainSpeedBound,
  solveLeg,
  validatePredictionRequest,
  predictNavigation,
  predictionFromNavigationState,
};
