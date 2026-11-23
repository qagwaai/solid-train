'use strict';

const { createSchemaValidator } = require('../model/schema-validator');
const requestSchema = require('../../api/schemas/navigation-route-edge-batch-request.schema.json');
const responseSchema = require('../../api/schemas/navigation-route-edge-batch-response.schema.json');
const {
  getNavigationStateAsync,
  MIN_EPOCH_MS,
  MAX_EPOCH_MS,
} = require('./context/navigation-state-service');
const { revision } = require('../model/navigation-placement');
const {
  CANDIDATE_IDS,
  SOL_HAZARD_SURVEY,
  evaluateJob,
  evaluateDirectReference,
  LEGACY_PROFILE_ID,
  TEST_PROFILE_ID,
  TEST_MAX_LENGTH_KM,
  NAV_MODE_NORMAL,
  NAV_MODE_PREVIEW,
  CRUISE_SPEED_KM_S,
  LEG_LIMIT_KM,
  MAX_LENGTH_KM,
} = require('./context/navigation-route-edge-batch-service');
const {
  NAVIGATION_ROUTE_EDGE_BATCH_REQUEST_EVENT,
  NAVIGATION_ROUTE_EDGE_BATCH_RESPONSE_EVENT,
} = require('../model/navigation-route-edge-batch');

/**
 * @typedef {Object} NavigationRouteEdgeBatchRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {'navigation-route-edge-batch.v1'} operation
 * @property {'bootstrap'|'continuation'} phase
 * @property {string} correlationId
 * @property {{entityType:'solar-system',containerId:'sol'}} requestIdentity
 * @property {{solarSystemId:'sol',characterId?:string,shipId:string,destination:{kind:'market',id:string},candidateBodyIds?:string[]}} selection
 * @property {12466.489225} scenarioCruiseSpeedKmPerSec
 * @property {string} [planningRevision]
 * @property {string} [bootstrapId]
 * @property {number} [timeoutMs]
 * @property {'navigation-phase3-legacy-v1'|'stellar-sol-station-100au-v1'} [profileId]
 * @property {'ship-drive-normal'|'bounded-preview-100au'} [navigationMode]
 * @property {Array<{jobId:string,prefixBodyIds:string[],prefixSides?:Array<-1|1>,target:{kind:'body'|'market',id:string},targetSide?:-1|1}>} jobs
 * @property {Object} [clock]
 */

const validateRequest = createSchemaValidator({ allErrors: true }).compile(requestSchema);
const typedValidateRequest =
  /** @type {import('ajv').ValidateFunction<NavigationRouteEdgeBatchRequest>} */ (validateRequest);
const validateDriveProfile = createSchemaValidator().compile(
  responseSchema.definitions.capture.properties.driveProfile
);

function validClock(clock) {
  return (
    clock?.status === 'supported' &&
    clock.durability === 'durable-mongo-game-state' &&
    clock.timeScaleId === 'stellar:unix-ms-uniform:v1' &&
    Number.isSafeInteger(clock.epochMs) &&
    clock.epochMs >= MIN_EPOCH_MS &&
    clock.epochMs < MAX_EPOCH_MS &&
    Number.isSafeInteger(clock.generation) &&
    clock.generation >= 1 &&
    typeof clock.lineage === 'string' &&
    clock.lineage.trim().length > 0 &&
    typeof clock.running === 'boolean'
  );
}

/** @param {Partial<NavigationRouteEdgeBatchRequest>|null|undefined} payload */
function failure(payload, reason, message) {
  const requestIdentity = {
    operation: 'navigation-route-edge-batch',
    entityType: 'solar-system',
    containerId: 'sol',
  };
  return {
    success: false,
    message,
    correlationId: typeof payload?.correlationId === 'string' ? payload.correlationId : null,
    requestIdentity,
    batch: {
      status: 'failed',
      capture: null,
      clock: null,
      directReference: null,
      jobs: [],
      bounds: null,
      hazardSurvey: null,
      numericPrecision: null,
      completion: null,
    },
    failure: { reason, message },
  };
}

class NavigationRouteEdgeBatchMessageHandler {
  constructor(context) {
    this.context = context;
  }

  /** @param {NavigationRouteEdgeBatchRequest} payload */
  async buildResponse(payload) {
    if (!typedValidateRequest(payload)) {
      return failure(payload, 'invalid_request', 'Invalid navigation route edge batch request');
    }
    const profileId = payload.profileId || LEGACY_PROFILE_ID;
    if (payload.selection.solarSystemId !== 'sol') {
      return failure(payload, 'unsupported_ship_position', 'Only the Sol basis is supported');
    }
    const savedEntry =
      payload.phase === 'continuation'
        ? this.context.navigationPlanningCaptures?.get(payload.bootstrapId)
        : null;
    const candidateDiscovery =
      savedEntry?.candidateDiscovery ||
      (payload.selection.candidateBodyIds ? 'explicit' : 'automatic');
    const savedCapture = savedEntry?.capture;
    if (
      payload.phase === 'continuation' &&
      (!savedCapture ||
        savedCapture.planningRevision !== payload.planningRevision ||
        savedEntry.playerName !== payload.playerName.toLowerCase())
    ) {
      return failure(payload, 'invalid_capture', 'Planning capture is unavailable or mismatched');
    }
    const candidateBodyIds = [
      ...(payload.selection.candidateBodyIds ||
        savedCapture?.candidateBodyIds ||
        CANDIDATE_IDS.slice(0, 10)),
    ].sort();
    if (
      savedCapture &&
      JSON.stringify(savedCapture.candidateBodyIds) !== JSON.stringify(candidateBodyIds)
    ) {
      return failure(payload, 'source_changed', 'The captured candidate pool changed');
    }
    if (candidateBodyIds.some((id) => !CANDIDATE_IDS.includes(id))) {
      return failure(
        payload,
        'invalid_request',
        'Candidate body is outside the approved Phase 3 Sol pool'
      );
    }
    if (payload.selection.destination.kind !== 'market') {
      return failure(payload, 'unsupported_target', 'The destination target must be a market');
    }

    let batchLogicalLegCount = 0;
    const jobIds = new Set();
    for (const job of payload.jobs) {
      if (jobIds.has(job.jobId))
        return failure(payload, 'invalid_request', 'Job IDs must be unique');
      jobIds.add(job.jobId);
      if (
        job.prefixBodyIds.some((id) => !candidateBodyIds.includes(id)) ||
        (job.target.kind === 'body' && !candidateBodyIds.includes(job.target.id)) ||
        (job.target.kind === 'market' && job.target.id !== payload.selection.destination.id)
      ) {
        return failure(
          payload,
          'invalid_request',
          'Job target or prefix is outside the captured selection'
        );
      }
      batchLogicalLegCount += job.prefixBodyIds.length + 1;
      if (job.prefixSides && job.prefixSides.length !== job.prefixBodyIds.length) {
        return failure(payload, 'invalid_request', 'prefixSides must align with prefixBodyIds');
      }
    }
    if (batchLogicalLegCount > 192) {
      return failure(payload, 'invalid_request', 'The batch exceeds 192 logical legs');
    }

    let state;
    let routeTarget;
    try {
      const read = await getNavigationStateAsync(
        this.context,
        payload.playerName,
        'sol',
        {
          shipId: payload.selection.shipId,
          destinationMarketId: payload.selection.destination.id,
        },
        { routeCandidateBodyIds: candidateBodyIds }
      );
      state = read.navigationState;
      routeTarget = 'routeTarget' in read ? read.routeTarget : null;
    } catch (error) {
      this.context.log(`[navigation-route-edge-batch] Source read failed: ${error.message}`);
      return failure(payload, 'navigation_read_failed', 'Navigation source read failed');
    }
    if (!state || state.status !== 'supported') {
      const reason =
        payload.phase === 'continuation'
          ? 'source_changed'
          : state?.reason === 'STATION_PLACEMENT_UNSUPPORTED'
            ? 'direct_target_unsupported'
            : state?.reason === 'STATION_HOST_UNVERIFIED'
              ? 'direct_source_unavailable'
              : 'unsupported_ship_position';
      return failure(payload, reason, state?.message || 'Unsupported ship position');
    }
    const navigationMode = payload.navigationMode || null;
    if (navigationMode === NAV_MODE_PREVIEW && profileId !== TEST_PROFILE_ID) {
      return failure(
        payload,
        'invalid_request',
        'bounded-preview-100au requires stellar-sol-station-100au-v1'
      );
    }
    if (
      savedCapture &&
      (savedCapture.driveProfileRevision !== state.driveProfileRevision ||
        JSON.stringify(savedCapture.driveProfile) !== JSON.stringify(state.driveProfile))
    ) {
      return failure(
        payload,
        'drive_profile_changed',
        'The owned ship driveProfile changed since capture'
      );
    }
    if (
      (navigationMode === NAV_MODE_NORMAL && !state.driveProfile) ||
      !validateDriveProfile(state.driveProfile)
    ) {
      return failure(
        payload,
        'drive_profile_unavailable',
        'The owned ship has no valid driveProfile.rangeAu'
      );
    }

    const clock = this.context.gameClock.read();
    if (!validClock(clock)) {
      return failure(payload, 'clock_unavailable', 'A durable shared game clock is unavailable');
    }
    let bootstrapId;
    let capture;
    if (payload.phase === 'continuation') {
      if (!payload.planningRevision || !payload.bootstrapId) {
        return failure(
          payload,
          'invalid_capture',
          'Continuation requires planningRevision and bootstrapId'
        );
      }
      capture = savedCapture;
      bootstrapId = payload.bootstrapId;
    } else {
      const planningRevision = revision({
        operation: payload.operation,
        selection: { ...payload.selection, candidateBodyIds },
        clock,
        state,
        speed: payload.scenarioCruiseSpeedKmPerSec,
        profileId,
        navigationMode: payload.navigationMode || 'legacy',
        shipRevision: state.departure.provenance.shipRevision,
        driveProfile: state.driveProfile,
        driveProfileRevision: state.driveProfileRevision,
        modelId: 'navigation-route-edge-batch-v1',
      });
      bootstrapId = `nav3-${planningRevision.slice(0, 24)}`;
      capture = {
        planningRevision,
        bootstrapId,
        shipPositionEpochMs: state.epochMs,
        departurePositionKm: state.departure.positionKm,
        coordinateBasisId: state.coordinateBasisId,
        positionEvaluationModelId: state.provenance.evaluationModelId,
        shipId: state.departure.shipId,
        shipRevision: state.departure.provenance.shipRevision,
        destinationMarketId: state.destination.marketId,
        candidateBodyIds,
        profileId,
        profileVersion: 'v1',
        navigationMode: payload.navigationMode || 'legacy',
        driveProfile: state.driveProfile,
        driveProfileRevision: state.driveProfileRevision,
        flightAuthorized: false,
        sourceRevision: state.provenance.sourceRevision,
        clockGeneration: clock.generation,
        clockLineage: clock.lineage,
        searchStartEpochMs: clock.epochMs,
      };
    }

    if (
      capture.sourceRevision !== state.provenance.sourceRevision ||
      capture.shipId !== state.departure.shipId ||
      capture.shipRevision !== state.departure.provenance.shipRevision ||
      capture.destinationMarketId !== state.destination.marketId ||
      capture.shipPositionEpochMs !== state.epochMs ||
      capture.departurePositionKm.x !== state.departure.positionKm.x ||
      capture.departurePositionKm.y !== state.departure.positionKm.y ||
      capture.departurePositionKm.z !== state.departure.positionKm.z ||
      capture.clockGeneration !== clock.generation ||
      capture.clockLineage !== clock.lineage ||
      capture.profileId !== profileId ||
      capture.navigationMode !== (payload.navigationMode || 'legacy') ||
      JSON.stringify(capture.driveProfile) !== JSON.stringify(state.driveProfile) ||
      capture.driveProfileRevision !== state.driveProfileRevision ||
      JSON.stringify(capture.candidateBodyIds) !== JSON.stringify(candidateBodyIds)
    ) {
      return failure(
        payload,
        'source_changed',
        'Planning capture no longer matches current sources'
      );
    }

    if (
      !routeTarget ||
      !Number.isFinite(routeTarget.speedBoundKmPerSec) ||
      routeTarget.speedBoundKmPerSec < 0 ||
      routeTarget.speedBoundKmPerSec >= CRUISE_SPEED_KM_S
    ) {
      return failure(
        payload,
        'direct_target_unsupported',
        'The station trajectory cannot be bounded'
      );
    }
    const directReference = evaluateDirectReference(
      this.context,
      state,
      capture.searchStartEpochMs,
      profileId,
      navigationMode,
      routeTarget
    );
    if (!directReference)
      return failure(
        payload,
        'direct_numeric_failure',
        'The required direct route could not converge'
      );
    const jobs = payload.jobs.map((job) => {
      const result = evaluateJob(
        this.context,
        state,
        capture.searchStartEpochMs,
        job,
        profileId,
        navigationMode,
        routeTarget
      );
      return result.success
        ? result
        : {
            ...result,
            jobId: job.jobId,
            prefixBodyIds: job.prefixBodyIds,
            prefixSides: job.prefixBodyIds.map((_, index) => job.prefixSides?.[index] ?? 1),
            target: job.target,
          };
    });
    let finalState;
    try {
      ({ navigationState: finalState } = await getNavigationStateAsync(
        this.context,
        payload.playerName,
        'sol',
        { shipId: payload.selection.shipId, destinationMarketId: payload.selection.destination.id },
        { routeCandidateBodyIds: candidateBodyIds }
      ));
    } catch (error) {
      this.context.log(
        `[navigation-route-edge-batch] Source revalidation failed: ${error.message}`
      );
      return failure(payload, 'navigation_read_failed', 'Navigation source revalidation failed');
    }
    const finalClock = this.context.gameClock.read();
    if (
      finalState?.status !== 'supported' ||
      finalState.provenance.sourceRevision !== capture.sourceRevision ||
      finalState.departure.provenance.shipRevision !== capture.shipRevision ||
      finalState.driveProfileRevision !== capture.driveProfileRevision ||
      !validClock(finalClock) ||
      finalClock.generation !== capture.clockGeneration ||
      finalClock.lineage !== capture.clockLineage
    ) {
      return failure(payload, 'source_changed', 'Planning capture changed during evaluation');
    }
    if (payload.phase === 'bootstrap') {
      this.context.navigationPlanningCaptures.set(bootstrapId, {
        capture,
        playerName: payload.playerName.toLowerCase(),
        candidateDiscovery,
      });
    }
    const successful = jobs.filter((job) => job.success);
    const status = successful.length === jobs.length ? 'supported' : 'incomplete';
    let logicalLegCount = 0;
    for (const job of payload.jobs) logicalLegCount += job.prefixBodyIds.length + 1;
    const completionMode = 'complete';

    return {
      success: true,
      message:
        status === 'supported'
          ? 'Complete Phase 3 edge batch evaluated'
          : status === 'incomplete'
            ? 'Batch evaluated incompletely; only complete jobs are included'
            : 'No complete Phase 3 route jobs were evaluated',
      correlationId: payload.correlationId,
      requestIdentity: {
        operation: 'navigation-route-edge-batch',
        entityType: 'solar-system',
        containerId: 'sol',
      },
      batch: {
        status,
        capture,
        clock: finalClock,
        directReference,
        jobs,
        bounds: {
          profileId,
          candidateDiscovery,
          candidateBodyCount: candidateBodyIds.length,
          maxEncounters: 5,
          maxLegs: 6,
          maxLegDistanceKm: profileId === TEST_PROFILE_ID ? null : LEG_LIMIT_KM,
          maxEligiblePathKm: profileId === TEST_PROFILE_ID ? TEST_MAX_LENGTH_KM : MAX_LENGTH_KM,
          fuelUnitsPerAu: 1,
          cruiseSpeedKmPerSec: CRUISE_SPEED_KM_S,
          maxJobs: 32,
          maxLogicalLegs: 192,
          maxTimeoutMs: 30000,
          novaSearchDispatchBudget: 512,
          novaOverallTimeoutMs: 30000,
          novaSearchBudgetScope: 'client-owned-not-server-batch-completion',
        },
        hazardSurvey: SOL_HAZARD_SURVEY,
        numericPrecision: {
          epochUnit: 'uniform-game-millisecond',
          positionUnit: 'kilometre',
          distanceUnit: 'kilometre',
          durationUnit: 'game-millisecond',
          fuelUnit: 'prototype-fuel-unit-per-AU',
          distanceRounding: 'IEEE-754-binary64-full-precision-response',
          epochRounding: 'Math.round-nearest-millisecond',
          finiteValueRequirement: 'all-output-numbers-must-be-finite',
        },
        completion: {
          mode: completionMode,
          submittedJobCount: payload.jobs.length,
          completedJobCount: successful.length,
          failedJobCount: jobs.length - successful.length,
          logicalLegCount,
        },
      },
    };
  }

  /** @param {unknown} payload */
  async handle(socket, payload) {
    this.context.logHandlerMessage(NAVIGATION_ROUTE_EDGE_BATCH_REQUEST_EVENT, payload, {
      level: 'debug',
    });
    const requestPayload = /** @type {NavigationRouteEdgeBatchRequest} */ (payload);
    const response = await this.buildResponse(requestPayload);
    socket.emit(NAVIGATION_ROUTE_EDGE_BATCH_RESPONSE_EVENT, response);
    return response;
  }
}

function navigationRouteEdgeBatchSocketFailure(payload, reason, message) {
  return failure(
    payload,
    reason === 'invalid-session' ? 'unauthorized' : 'batch_evaluation_failed',
    message
  );
}

module.exports = { NavigationRouteEdgeBatchMessageHandler, navigationRouteEdgeBatchSocketFailure };
