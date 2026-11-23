'use strict';

const { createSchemaValidator } = require('../model/schema-validator');
const requestSchema = require('../../api/schemas/navigation-route-edge-batch-request.schema.json');
const { attachRequestId } = require('./handler-utils');
const { getNavigationStateAsync } = require('./context/navigation-state-service');
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
  AU_KM,
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

/** @param {Partial<NavigationRouteEdgeBatchRequest>|null|undefined} payload */
function failure(payload, reason, message) {
  const requestIdentity = {
    operation: 'navigation-route-edge-batch',
    entityType: 'solar-system',
    containerId: 'sol',
  };
  return attachRequestId(
    {
      success: false,
      message,
      correlationId: payload?.correlationId ?? null,
      requestIdentity,
      batch: {
        status: 'failed',
        planningRevision: '0'.repeat(64),
        capture: null,
        clock: payload?.clock ?? {
          status: 'unavailable',
          epochMs: null,
          timeScaleId: 'stellar:unix-ms-uniform:v1',
          running: false,
          generation: 1,
          lineage: 'navigation-clock-lineage-v1',
          durability: 'process-only-unverified',
        },
        directReference: null,
        jobs: [],
        bounds: {
          profileId: payload?.profileId || LEGACY_PROFILE_ID,
          candidateDiscovery: payload?.selection?.candidateBodyIds ? 'explicit' : 'automatic',
          candidateBodyCount: payload?.selection?.candidateBodyIds?.length ?? 0,
          maxEncounters: 5,
          maxLegs: 6,
          maxLegDistanceKm:
            (payload.profileId || LEGACY_PROFILE_ID) === TEST_PROFILE_ID ? null : LEG_LIMIT_KM,
          maxEligiblePathKm:
            (payload.profileId || LEGACY_PROFILE_ID) === TEST_PROFILE_ID
              ? TEST_MAX_LENGTH_KM
              : MAX_LENGTH_KM,
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
          mode: 'complete',
          completedJobCount: 0,
          failedJobCount: 0,
          logicalLegCount: 0,
        },
      },
      failure: { reason, message },
    },
    payload
  );
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
    const candidateDiscovery = payload.selection.candidateBodyIds ? 'explicit' : 'automatic';
    const candidateBodyIds = payload.selection.candidateBodyIds || CANDIDATE_IDS.slice(0, 10);
    if (candidateBodyIds.some((id) => !CANDIDATE_IDS.includes(id))) {
      return failure(payload, 'invalid_request', 'Candidate body is outside the approved Phase 3 Sol pool');
    }
    if (payload.selection.destination.kind !== 'market') {
      return failure(payload, 'unsupported_target', 'The destination target must be a market');
    }

    let batchLogicalLegCount = 0;
    for (const job of payload.jobs) {
      batchLogicalLegCount += job.prefixBodyIds.length + 1;
      if (job.prefixSides && job.prefixSides.length !== job.prefixBodyIds.length) {
        return failure(payload, 'invalid_request', 'prefixSides must align with prefixBodyIds');
      }
    }
    if (batchLogicalLegCount > 192) {
      return failure(payload, 'invalid_request', 'The batch exceeds 192 logical legs');
    }

    let state;
    try {
      ({ navigationState: state } = await getNavigationStateAsync(
        this.context,
        payload.playerName,
        'sol',
        {
          shipId: payload.selection.shipId,
          destinationMarketId: payload.selection.destination.id,
        }
      ));
    } catch (error) {
      return failure(payload, 'NAVIGATION_READ_FAILED', error.message || 'Navigation source read failed');
    }
    if (!state || state.status !== 'supported') {
      return failure(payload, state?.reason || 'unsupported_ship_position', state?.message || 'Unsupported ship position');
    }
    const navigationMode = payload.navigationMode || null;
    if (navigationMode === NAV_MODE_PREVIEW && profileId !== TEST_PROFILE_ID) {
      return failure(payload, 'invalid_request', 'bounded-preview-100au requires stellar-sol-station-100au-v1');
    }
    if (navigationMode === NAV_MODE_NORMAL && !state.driveProfile) {
      return failure(payload, 'drive_profile_unavailable', 'The owned ship has no valid driveProfile.rangeAu');
    }

    const clock = this.context.gameClock.read();
    if (clock.status !== 'supported' || clock.durability !== 'durable-mongo-game-state') {
      return failure(payload, 'clock_unavailable', 'A durable shared game clock is unavailable');
    }
    let planningRevision;
    let bootstrapId;
    let capture;
    if (payload.phase === 'continuation') {
      if (!payload.planningRevision || !payload.bootstrapId) {
        return failure(payload, 'invalid_capture', 'Continuation requires planningRevision and bootstrapId');
      }
      capture = this.context.navigationPlanningCaptures?.get(payload.bootstrapId);
      if (!capture || capture.planningRevision !== payload.planningRevision) {
        return failure(payload, 'invalid_capture', 'Planning capture is unavailable or mismatched');
      }
      planningRevision = payload.planningRevision;
      bootstrapId = payload.bootstrapId;
    } else {
      planningRevision = revision({
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
        departureEpochMs: state.epochMs,
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
        clockEpochMs: clock.epochMs,
      };
      this.context.navigationPlanningCaptures?.set(bootstrapId, capture);
    }

    if (
      payload.phase === 'continuation' &&
      (capture.driveProfileRevision !== state.driveProfileRevision ||
        JSON.stringify(capture.driveProfile) !== JSON.stringify(state.driveProfile))
    ) {
      return failure(payload, 'drive_profile_changed', 'The owned ship driveProfile changed since capture');
    }
    if (
      capture.sourceRevision !== state.provenance.sourceRevision ||
      capture.shipId !== state.departure.shipId ||
      capture.shipRevision !== state.departure.provenance.shipRevision ||
      capture.destinationMarketId !== state.destination.marketId ||
      capture.departureEpochMs !== state.epochMs ||
      capture.departurePositionKm.x !== state.departure.positionKm.x ||
      capture.departurePositionKm.y !== state.departure.positionKm.y ||
      capture.departurePositionKm.z !== state.departure.positionKm.z ||
      capture.clockGeneration !== clock.generation ||
      capture.clockLineage !== clock.lineage
      || capture.profileId !== profileId
      || capture.navigationMode !== (payload.navigationMode || 'legacy')
      || JSON.stringify(capture.driveProfile) !== JSON.stringify(state.driveProfile)
      || capture.driveProfileRevision !== state.driveProfileRevision
    ) {
      return failure(payload, 'source_changed', 'Planning capture no longer matches current sources');
    }

    const jobs = payload.jobs.map((job) =>
      evaluateJob(this.context, state, this.context.gameClock, job, profileId, navigationMode)
    );
    const directReference = evaluateDirectReference(
      this.context,
      state,
      this.context.gameClock,
      profileId,
      navigationMode
    );
    const successful = jobs.filter((job) => job.success);
    const status =
      successful.length === jobs.length
        ? 'supported'
        : successful.length > 0
          ? 'incomplete'
          : directReference
            ? 'incomplete'
            : 'failed';
    let logicalLegCount = 0;
    for (const job of payload.jobs) logicalLegCount += job.prefixBodyIds.length + 1;
    const completionMode =
      payload.timeoutMs && successful.length < payload.jobs.length ? 'timeout' : 'complete';

    return attachRequestId(
      {
        success: status !== 'failed',
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
          planningRevision,
          clock,
          directReference,
          jobs,
          bounds: {
            profileId,
            candidateDiscovery,
            candidateBodyCount: candidateBodyIds.length,
            maxEncounters: 5,
            maxLegs: 6,
            maxLegDistanceKm:
              profileId === TEST_PROFILE_ID ? null : LEG_LIMIT_KM,
            maxEligiblePathKm:
              profileId === TEST_PROFILE_ID ? TEST_MAX_LENGTH_KM : MAX_LENGTH_KM,
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
            completedJobCount: successful.length,
            failedJobCount: jobs.length - successful.length,
            logicalLegCount,
          },
        },
        ...(status === 'failed'
          ? {
              failure: {
                reason: 'batch_evaluation_failed',
                message: 'No complete Phase 3 route jobs were evaluated',
              },
            }
          : {}),
      },
      payload
    );
  }

  /** @param {unknown} payload */
  async handle(socket, payload) {
    this.context.logHandlerMessage(NAVIGATION_ROUTE_EDGE_BATCH_REQUEST_EVENT, payload, { level: 'debug' });
    const requestPayload = /** @type {NavigationRouteEdgeBatchRequest} */ (payload);
    const response = await this.buildResponse(requestPayload);
    socket.emit(NAVIGATION_ROUTE_EDGE_BATCH_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = { NavigationRouteEdgeBatchMessageHandler };
