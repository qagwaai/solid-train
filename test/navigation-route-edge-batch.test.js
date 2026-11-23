'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('../src/model/schema-validator');
const { SharedGameClock } = require('../src/model/game-clock');
const {
  AU_KM,
  CRUISE_SPEED_KM_S,
  LEG_LIMIT_KM,
  MAX_LEGS,
  MAX_LENGTH_KM,
  LEGACY_PROFILE_ID,
  TEST_PROFILE_ID,
  TEST_MAX_LENGTH_KM,
  directReferenceEligibility,
  routeEligibility,
  driveEligibility,
  NAV_MODE_NORMAL,
  NAV_MODE_PREVIEW,
  candidateWaypoint,
  solveMovingTarget,
  evaluateJob,
  evaluateDirectReference,
  SOL_HAZARD_SURVEY,
  bodyPosition,
  distancePointToSegment,
  buildEncounter,
} = require('../src/handlers/context/navigation-route-edge-batch-service');

test('Phase 3 route-edge constants preserve approved bounds', () => {
  assert.equal(CRUISE_SPEED_KM_S, 12466.489225);
  assert.equal(AU_KM, 149597870.7);
  assert.equal(LEG_LIMIT_KM, 74798935.35);
  assert.equal(MAX_LEGS, 6);
  assert.equal(MAX_LENGTH_KM, 448793612.1);
});

test('100 AU test profile uses exact total limit with no per-leg hop cap', () => {
  assert.equal(TEST_MAX_LENGTH_KM, 14959787070);
  assert.ok(Math.abs(TEST_MAX_LENGTH_KM / AU_KM - 100) < 1e-12);
  assert.equal(LEGACY_PROFILE_ID, 'navigation-phase3-legacy-v1');
  assert.equal(TEST_PROFILE_ID, 'stellar-sol-station-100au-v1');

  const exact = 100 * AU_KM;
  const over = exact + 0.001;
  assert.equal(exact <= TEST_MAX_LENGTH_KM, true);
  assert.equal(over <= TEST_MAX_LENGTH_KM, false);

  const singleLeg = 60 * AU_KM;
  assert.equal(singleLeg > LEG_LIMIT_KM, true);
  assert.equal(singleLeg <= TEST_MAX_LENGTH_KM, true);
  const twoLegs = 60 * AU_KM + 60 * AU_KM;
  assert.equal(twoLegs > TEST_MAX_LENGTH_KM, true);
  assert.equal(routeEligibility(singleLeg, TEST_PROFILE_ID).eligible, true);
  assert.equal(routeEligibility(twoLegs, TEST_PROFILE_ID).eligible, false);
});

test('calculated waypoints stay outside modeled radius plus warning buffer', () => {
  const start = { x: 0, y: 0, z: 0 };
  const epochMs = Date.parse('2026-01-01T00:00:00.000Z');
  for (const side of [-1, 1]) {
    const offset = candidateWaypoint(start, 'sol-earth', epochMs, side);
    assert.ok(offset);
    const center = bodyPosition('sol-earth', epochMs);
    const point = { x: center.x + offset.x, y: center.y + offset.y, z: center.z + offset.z };
    assert.ok(distancePointToSegment(center, point, point) >= 6371 + 1000);
  }
});

test('side-dependent encounter replay produces separate complete choices', () => {
  const epochMs = Date.parse('2026-01-01T00:00:00.000Z');
  const clock = new SharedGameClock({ epochMs, running: true });
  const state = {
    status: 'supported',
    epochMs,
    departure: { shipId: 'ship-1', positionKm: { x: -100000, y: 0, z: 0 } },
    destination: {
      marketId: 'sol-mars-orbit',
      hostBodyId: 'sol-mars',
      positionKm: bodyPosition('sol-mars', epochMs),
      hostPositionKm: bodyPosition('sol-mars', epochMs),
    },
  };
  const jobs = [-1, 1].map((side) =>
    evaluateJob({}, state, clock, {
      jobId: `earth-${side}`,
      prefixBodyIds: ['sol-earth'],
      prefixSides: [side],
      target: { kind: 'market', id: 'sol-mars-orbit' },
    })
  );
  for (const job of jobs) {
    assert.equal(job.success, true);
    assert.equal(job.legs.length, 2);
    assert.equal(job.legs.every((leg) => Number.isFinite(leg.distanceKm)), true);
  }
  assert.notEqual(jobs[0].totalDistanceKm, jobs[1].totalDistanceKm);
});

test('body-target jobs expose targetSide in sideHistory', () => {
  const epochMs = Date.parse('2026-01-01T00:00:00.000Z');
  const clock = new SharedGameClock({ epochMs, running: true });
  const state = {
    status: 'supported',
    epochMs,
    departure: { shipId: 'ship-1', positionKm: { x: -100000, y: 0, z: 0 } },
    destination: {
      marketId: 'sol-mars-orbit',
      hostBodyId: 'sol-mars',
      positionKm: bodyPosition('sol-mars', epochMs),
      hostPositionKm: bodyPosition('sol-mars', epochMs),
    },
  };
  for (const side of [-1, 1]) {
    const job = evaluateJob({}, state, clock, {
      jobId: `mercury-${side}`,
      prefixBodyIds: [],
      prefixSides: [],
      target: { kind: 'body', id: 'sol-mercury' },
      targetSide: side,
    });
    assert.equal(job.success, true);
    assert.equal(job.targetSide, side);
    assert.deepEqual(job.sideHistory, [
      { encounterIndex: 1, bodyId: 'sol-mercury', side },
    ]);
  }
});

test('body and prefix encounter legs expose exact timed body/waypoint association', () => {
  const epochMs = Date.parse('2026-01-01T00:00:00.000Z');
  const clock = new SharedGameClock({ epochMs, running: true });
  const state = {
    status: 'supported',
    epochMs,
    coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
    provenance: {
      evaluationModelId: 'sol-catalog-kepler-position-v1',
      sourceRevision: 'b'.repeat(64),
    },
    departure: { shipId: 'ship-1', positionKm: { x: -100000, y: 0, z: 0 } },
    destination: {
      marketId: 'sol-mars-orbit',
      hostBodyId: 'sol-mars',
      positionKm: bodyPosition('sol-mars', epochMs),
      hostPositionKm: bodyPosition('sol-mars', epochMs),
    },
  };
  for (const side of [-1, 1]) {
    const job = evaluateJob({}, state, clock, {
      jobId: `mars-${side}`,
      prefixBodyIds: [],
      prefixSides: [],
      target: { kind: 'body', id: 'sol-mars' },
      targetSide: side,
    }, TEST_PROFILE_ID);
    assert.equal(job.success, true);
    const leg = job.legs[0];
    const encounter = leg.encounter;
    assert.equal(encounter.bodyId, 'sol-mars');
    assert.equal(encounter.side, side);
    assert.equal(encounter.encounterEpochMs, leg.arrivalEpochMs);
    assert.deepEqual(encounter.waypointPositionKm, leg.endPositionKm);
    assert.equal(encounter.coordinateBasisId, state.coordinateBasisId);
    assert.equal(encounter.positionEvaluationModelId, state.provenance.evaluationModelId);
    assert.equal(encounter.sourceRevision, state.provenance.sourceRevision);
    assert.ok(encounter.bodyCenterPositionKm);
    assert.notDeepEqual(encounter.bodyCenterPositionKm, leg.endPositionKm);
  }

  const prefixJob = evaluateJob({}, state, clock, {
    jobId: 'prefix-luna-target-mars',
    prefixBodyIds: ['sol-luna'],
    prefixSides: [-1],
    target: { kind: 'market', id: 'sol-mars-orbit' },
  }, TEST_PROFILE_ID);
  assert.equal(prefixJob.success, true);
  const prefixLeg = prefixJob.legs[0];
  assert.equal(prefixLeg.encounter.bodyId, 'sol-luna');
  assert.equal(prefixLeg.encounter.side, -1);
  assert.equal(prefixLeg.encounter.encounterEpochMs, prefixLeg.arrivalEpochMs);
  assert.deepEqual(prefixLeg.encounter.waypointPositionKm, prefixLeg.endPositionKm);
});

test('direct reference can exceed hop limits and remains visible and ineligible', () => {
  const epochMs = Date.parse('2026-01-01T00:00:00.000Z');
  const clock = new SharedGameClock({ epochMs, running: true });
  const state = {
    status: 'supported',
    epochMs,
    departure: { shipId: 'ship-1', positionKm: { x: 0, y: 0, z: 0 } },
    destination: {
      marketId: 'sol-pluto-orbit',
      hostBodyId: 'sol-pluto',
      positionKm: { x: 5.5e9, y: 0, z: 0 },
      hostPositionKm: { x: 5.5e9, y: 0, z: 0 },
    },
  };
  const direct = evaluateDirectReference({}, state, clock);
  assert.equal(direct.status, 'supported');
  assert.equal(Object.prototype.hasOwnProperty.call(direct, 'epochMs'), false);
  assert.equal(direct.kind, 'direct-reference');
  assert.equal(direct.eligible, false);
  assert.ok(direct.distanceKm > LEG_LIMIT_KM);
  assert.equal(direct.hazardAssessment.level !== undefined, true);
  assert.equal(Array.isArray(direct.hazardAssessment.unresolvedAssessments), true);
  assert.equal(direct.hazardAssessment.markers.every((marker) =>
    Number.isInteger(marker.legIndex) &&
    Number.isInteger(marker.epochMs) &&
    marker.positionKm &&
    marker.routeFraction >= 0 &&
    marker.routeFraction <= 1 &&
    marker.warningRadiusKm >= 1000
  ), true);
});

test('direct reference is profile-aware at the exact 100 AU boundary', () => {
  assert.deepEqual(
    directReferenceEligibility(TEST_MAX_LENGTH_KM, TEST_PROFILE_ID),
    { eligible: true, reason: 'WITHIN_PHASE3_BOUNDS' }
  );
  assert.deepEqual(
    directReferenceEligibility(TEST_MAX_LENGTH_KM + 0.001, TEST_PROFILE_ID),
    { eligible: false, reason: 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT' }
  );
});

test('ship-drive-normal uses rangeAu as exact per-leg bound only', () => {
  const drive = { id: 'mk1', name: 'Mk1', rangeAu: 10, cruiseSpeedAuPerHour: 0.3, fuelCostPerAu: 1 };
  const legUnder = [{ legIndex: 1, distanceKm: 10 * AU_KM }];
  const legOver = [{ legIndex: 1, distanceKm: 10 * AU_KM + 0.001 }];
  assert.equal(driveEligibility(legUnder, drive, NAV_MODE_NORMAL).status, 'eligible');
  assert.equal(driveEligibility(legOver, drive, NAV_MODE_NORMAL).status, 'ineligible');
  assert.equal(driveEligibility([{ legIndex: 1, distanceKm: 10 * AU_KM }, { legIndex: 2, distanceKm: 10 * AU_KM }], drive, NAV_MODE_NORMAL).status, 'eligible');
  assert.equal(driveEligibility([], null, NAV_MODE_NORMAL).status, 'unavailable');
  assert.equal(driveEligibility([], drive, NAV_MODE_PREVIEW).status, 'not-applicable');
});

test('moving-target solver converges for a finite candidate leg', () => {
  const epochMs = Date.parse('2026-01-01T00:00:00.000Z');
  const result = solveMovingTarget({
    startEpochMs: epochMs,
    startPositionKm: { x: -100000, y: 0, z: 0 },
    targetPositionAtEpoch: (epoch) => bodyPosition('sol-earth', epoch),
  });
  assert.ok(result);
  assert.equal(Number.isFinite(result.positionKm.x), true);
  assert.equal(result.residualMs <= 1, true);
});

test('Sol hazard survey inventory exposes completeness and Sun boundary', () => {
  assert.equal(['complete', 'incomplete'].includes(SOL_HAZARD_SURVEY.status), true);
  assert.equal(SOL_HAZARD_SURVEY.inventoryBodyIds.includes('sol-sun'), true);
  assert.equal(SOL_HAZARD_SURVEY.inventoryBodyIds.includes('sol-earth'), true);
  const sun = SOL_HAZARD_SURVEY.profiles.find((profile) => profile.bodyId === 'sol-sun');
  assert.equal(sun.atmosphereOuterRadiusKm, 13914000);
  assert.equal(sun.assessment, 'complete');
});

test('shared game clock initializes once and restarts from persisted epoch', async () => {
  let stored = null;
  const database = {
    async getNavigationGameClock() {
      return stored;
    },
    async putNavigationGameClock(value) {
      stored = structuredClone(value);
      return stored;
    },
  };
  const startedAtWallMs = Date.parse('2026-01-01T00:00:00.000Z');
  const clock = new SharedGameClock({ startedAtWallMs, epochMs: startedAtWallMs, running: true });
  await clock.initializeAsync(database);
  const first = clock.read();
  assert.equal(first.durability, 'durable-mongo-game-state');
  assert.equal(Number.isSafeInteger(first.epochMs), true);

  await clock.pause();
  const paused = clock.read();
  assert.equal(paused.running, false);
  const pausedEpoch = paused.epochMs;

  const restarted = new SharedGameClock({ startedAtWallMs: startedAtWallMs + 86400000 });
  await restarted.initializeAsync(database);
  const resumed = restarted.read();
  assert.equal(resumed.running, false);
  assert.equal(resumed.epochMs, pausedEpoch);
  await restarted.resume();
  const running = restarted.read();
  assert.equal(running.running, true);
  assert.ok(running.epochMs >= pausedEpoch);
});

test('Phase 3 route-edge request and response contracts validate', async () => {
  const api = await Parser.dereference(path.join(__dirname, '..', 'api', 'openapi.yaml'));
  const operation = api.paths['/socket/navigation-route-edge-batch'].post;
  const ajv = createSchemaValidator({ allErrors: true });
  const validateRequest = ajv.compile(operation.requestBody.content['application/json'].schema);
  const validateResponse = ajv.compile(operation.responses['200'].content['application/json'].schema);

  const request = {
    playerName: 'PilotOne',
    sessionKey: 'session-123',
    operation: 'navigation-route-edge-batch.v1',
    phase: 'bootstrap',
    correlationId: '36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66',
    requestIdentity: { entityType: 'solar-system', containerId: 'sol' },
    selection: {
      solarSystemId: 'sol',
      characterId: 'character-1',
      shipId: 'ship-1',
      destination: { kind: 'market', id: 'sol-mars-orbit' },
      candidateBodyIds: ['sol-earth', 'sol-mars'],
    },
    scenarioCruiseSpeedKmPerSec: 12466.489225,
    profileId: 'stellar-sol-station-100au-v1',
    navigationMode: 'bounded-preview-100au',
    jobs: [
      {
        jobId: 'direct',
        prefixBodyIds: [],
        target: { kind: 'market', id: 'sol-mars-orbit' },
      },
    ],
  };
  assert.equal(validateRequest(request), true, JSON.stringify(validateRequest.errors));

  const overLimit = structuredClone(request);
  overLimit.jobs = Array.from({ length: 33 }, (_, index) => ({
    jobId: `job-${index}`,
    prefixBodyIds: [],
    target: { kind: 'market', id: 'sol-mars-orbit' },
  }));
  assert.equal(validateRequest(overLimit), false);

  const response = {
    success: true,
    message: 'Complete Phase 3 edge batch evaluated',
    correlationId: request.correlationId,
    requestIdentity: {
      operation: 'navigation-route-edge-batch',
      entityType: 'solar-system',
      containerId: 'sol',
    },
    batch: {
      status: 'supported',
      capture: {
        planningRevision: 'a'.repeat(64),
        bootstrapId: 'nav3-aaaaaaaaaaaaaaaaaaaaaaaa',
        departureEpochMs: epochMsForContract(),
        departurePositionKm: { x: 0, y: 0, z: 0 },
        coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
        positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
        shipId: 'ship-1',
        shipRevision: 'c'.repeat(64),
        destinationMarketId: 'sol-mars-orbit',
        candidateBodyIds: ['sol-earth', 'sol-mars'],
        sourceRevision: 'b'.repeat(64),
        clockGeneration: 1,
        clockLineage: 'navigation-clock-lineage-v1',
        clockEpochMs: epochMsForContract(),
        profileId: 'stellar-sol-station-100au-v1',
        profileVersion: 'v1',
        navigationMode: 'bounded-preview-100au',
        driveProfile: null,
        driveProfileRevision: null,
        flightAuthorized: false,
      },
      clock: { status: 'supported', epochMs: epochMsForContract(), timeScaleId: 'stellar:unix-ms-uniform:v1', running: true, generation: 1, lineage: 'navigation-clock-lineage-v1', durability: 'process-only-unverified' },
      directReference: null,
      jobs: [],
      bounds: {
        profileId: 'stellar-sol-station-100au-v1',
        candidateBodyCount: 2,
        maxEncounters: 5,
        maxLegs: 6,
        maxLegDistanceKm: null,
        maxEligiblePathKm: TEST_MAX_LENGTH_KM,
        fuelUnitsPerAu: 1,
        cruiseSpeedKmPerSec: CRUISE_SPEED_KM_S,
        candidateDiscovery: 'explicit',
        maxJobs: 32,
        maxLogicalLegs: 192,
        maxTimeoutMs: 30000,
        novaSearchDispatchBudget: 512,
        novaOverallTimeoutMs: 30000,
        novaSearchBudgetScope: 'client-owned-not-server-batch-completion',
      },
      hazardSurvey: SOL_HAZARD_SURVEY,
      completion: {
        mode: 'complete',
        completedJobCount: 0,
        failedJobCount: 0,
        logicalLegCount: 1,
      },
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
    },
  };
  assert.equal(validateResponse(response), true, JSON.stringify(validateResponse.errors));
});

function epochMsForContract() {
  return Date.parse('2026-01-01T00:00:00.000Z');
}
