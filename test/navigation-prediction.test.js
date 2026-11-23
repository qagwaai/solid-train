'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('../src/model/schema-validator');
const { navigationFixture } = require('../test-support/navigation-test-helpers');
const { createMockSocket } = require('../test-support/message-handler-test-helpers');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const {
  HORIZON_MS,
  PredictionError,
  keplerSpeedBound,
  keplerChainSpeedBound,
  solveLeg,
  predictNavigation,
  predictionFromNavigationState,
} = require('../src/handlers/context/navigation-prediction-service');
const { SOL_SYSTEM_CATALOG } = require('../src/model/sol-system-catalog');
const { computeAbsolutePositionKm } = require('../src/model/solar-system-celestial-seed');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const {
  computeRelativeOrbitPositionKm,
  computeRelativeOrbitPositionAtEpochMs,
} = require('../src/handlers/context/orbital-math');

const contract = Parser.dereference(path.join(__dirname, '..', 'api', 'openapi.yaml'));
const validators = contract.then((api) => {
  const operation = api.paths['/socket/solar-system-get'].post;
  const request = operation.requestBody.content['application/json'];
  const response = operation.responses['200'].content['application/json'];
  const ajv = createSchemaValidator({ allErrors: true });
  return {
    request: ajv.compile(request.schema),
    response: ajv.compile(response.schema),
    requestExample: request.examples.pairedPrediction.value,
    responseExample: response.examples.pairedPredictionSupported.value,
    missingCandidateExample: response.examples.pairedPredictionCandidateRequired.value,
  };
});

test('prediction contract accepts inclusive speed bounds and preserves direct-estimate speed rules', async () => {
  const { request: validate, requestExample } = await validators;
  for (const speed of [120, 150, 10000]) {
    const request = structuredClone(requestExample);
    request.navigationPrediction.scenarioCruiseSpeedKmPerSec = speed;
    request.navigationEstimate = { scenarioCruiseSpeedKmPerSec: 10 };
    assert.equal(validate(request), true, JSON.stringify(validate.errors));
  }
  const baseline = structuredClone(requestExample);
  delete baseline.navigationPrediction;
  delete baseline.navigation.candidateBodyId;
  assert.equal(validate(baseline), true, JSON.stringify(validate.errors));
  baseline.navigationEstimate = {};
  assert.equal(validate(baseline), true, JSON.stringify(validate.errors));
});

test('transport admits invalid prediction options and absent candidate for nested handler rejection', async () => {
  const { request: validate, requestExample } = await validators;
  for (const speed of [119.999, 10000.001, 0, -1, null, '150', NaN, Infinity]) {
    const request = structuredClone(requestExample);
    request.navigationPrediction.scenarioCruiseSpeedKmPerSec = speed;
    assert.equal(validate(request), true, `speed ${String(speed)} must reach the handler`);
  }
  for (const options of [
    {},
    null,
    [],
    150,
    { scenarioCruiseSpeedKmPerSec: 150, epochMs: 1794614400000 },
  ]) {
    const request = structuredClone(requestExample);
    request.navigationPrediction = options;
    assert.equal(
      validate(request),
      true,
      `options ${JSON.stringify(options)} must reach the handler`
    );
  }
  for (const field of ['navigation', 'candidateBodyId']) {
    const request = structuredClone(requestExample);
    if (field === 'navigation') delete request.navigation;
    else delete request.navigation.candidateBodyId;
    assert.equal(validate(request), true, `missing ${field} must reach the handler`);
  }
  const multiple = structuredClone(requestExample);
  multiple.navigation.candidateBodyId = ['sol-luna', 'sol-mars'];
  assert.equal(validate(multiple), false, 'multiple candidates must be rejected');
});

test('prediction success requires the paired eligible navigation state and complete result', async () => {
  const { response: validate, responseExample } = await validators;
  assert.equal(validate(responseExample), true, JSON.stringify(validate.errors));
  const cases = [
    [
      'missing state',
      (r) => {
        delete r.navigationState;
      },
    ],
    [
      'unsupported state',
      (r) => {
        r.navigationState = {
          status: 'unsupported',
          reason: 'SOURCES_CHANGED',
          message: 'Sources changed',
        };
      },
    ],
    [
      'ineligible state',
      (r) => {
        r.navigationState.previewEligibility = {
          status: 'ineligible',
          reason: 'KNOWN_INVALID_DESTINATION',
        };
      },
    ],
    [
      'no candidate',
      (r) => {
        r.navigationState.candidates = [];
      },
    ],
    [
      'outer failure',
      (r) => {
        r.success = false;
      },
    ],
    [
      'wrong association',
      (r) => {
        r.navigationPrediction.association = 'same-response-direct-endpoints';
      },
    ],
    [
      'missing arrival',
      (r) => {
        delete r.navigationPrediction.prediction.arrival;
      },
    ],
    [
      'missing host position',
      (r) => {
        delete r.navigationPrediction.prediction.arrival.hostPositionKm;
      },
    ],
    [
      'missing time scale',
      (r) => {
        delete r.navigationPrediction.prediction.timeScaleId;
      },
    ],
    [
      'missing source revision',
      (r) => {
        delete r.navigationPrediction.prediction.sourceRevision;
      },
    ],
    [
      'missing assumption',
      (r) => {
        delete r.navigationPrediction.prediction.assumptions.constantScenarioSpeed;
      },
    ],
    [
      'duration claim',
      (r) => {
        r.navigationPrediction.prediction.durationSec = 1;
      },
    ],
  ];
  for (const [label, mutate] of cases) {
    const response = structuredClone(responseExample);
    mutate(response);
    assert.equal(validate(response), false, label);
  }
});

test('prediction contract bounds integer epochs and independently bounds both convergence diagnostics', async () => {
  const { response: validate, responseExample } = await validators;
  for (const leg of ['encounter', 'arrival']) {
    for (const [iterations, residualMs] of [
      [1, 0],
      [64, 1],
    ]) {
      const response = structuredClone(responseExample);
      response.navigationPrediction.prediction[leg].convergence = { iterations, residualMs };
      assert.equal(validate(response), true, JSON.stringify(validate.errors));
    }
    for (const convergence of [
      { iterations: 65, residualMs: 0 },
      { iterations: 1, residualMs: 1.001 },
    ]) {
      const response = structuredClone(responseExample);
      response.navigationPrediction.prediction[leg].convergence = convergence;
      assert.equal(validate(response), false, `${leg}: ${JSON.stringify(convergence)}`);
    }
  }
  for (const point of ['departure', 'encounter', 'arrival']) {
    for (const epochMs of [946684799999, 4102444800000, 1795713802170.5]) {
      const response = structuredClone(responseExample);
      response.navigationPrediction.prediction[point].epochMs = epochMs;
      assert.equal(validate(response), false, `${point}: ${epochMs}`);
    }
  }
  const boundary = structuredClone(responseExample);
  boundary.navigationState.epochMs =
    boundary.navigationPrediction.prediction.departure.epochMs = 946684800000;
  assert.equal(validate(boundary), true, JSON.stringify(validate.errors));
  boundary.navigationState.epochMs =
    boundary.navigationPrediction.prediction.departure.epochMs = 4102444799999;
  boundary.navigationPrediction.prediction.encounter.epochMs = 4102444799999;
  boundary.navigationPrediction.prediction.arrival.epochMs = 4102444799999;
  assert.equal(validate(boundary), true, JSON.stringify(validate.errors));
});

test('prediction rejections have typed reasons and cannot leak partial results or claim success', async () => {
  const { response: validate, responseExample } = await validators;
  for (const [status, reason] of [
    ['invalid', 'SCENARIO_SPEED_INVALID'],
    ['unsupported', 'PREDICTION_HORIZON_EXCEEDED'],
    ['unsupported', 'PREDICTION_EPOCH_UNSUPPORTED'],
    ['unsupported', 'SOURCES_CHANGED'],
    ['ineligible', 'KNOWN_INVALID_DESTINATION'],
    ['failed', 'ENCOUNTER_NONCONVERGENT'],
    ['failed', 'ARRIVAL_NONCONVERGENT'],
    ['failed', 'PREDICTION_SOURCE_MISMATCH'],
    ['failed', 'PREDICTION_EVALUATION_FAILED'],
  ]) {
    const response = structuredClone(responseExample);
    response.navigationPrediction.success = false;
    response.navigationPrediction.prediction = { status, reason, message: 'Prediction rejected' };
    assert.equal(validate(response), true, JSON.stringify(validate.errors));
    for (const field of ['departure', 'encounter', 'arrival']) {
      response.navigationPrediction.prediction[field] =
        responseExample.navigationPrediction.prediction[field];
      assert.equal(validate(response), false, `${status} must not contain ${field}`);
      delete response.navigationPrediction.prediction[field];
    }
    response.navigationPrediction.success = true;
    assert.equal(validate(response), false, `${status} must not claim success`);
    response.navigationPrediction.success = false;
    response.navigationPrediction.prediction.reason = 'INVALID_SESSION';
    assert.equal(validate(response), false, 'session failures are not prediction outcomes');
  }
  const readFailure = structuredClone(responseExample);
  readFailure.success = false;
  readFailure.navigationState = {
    status: 'unsupported',
    reason: 'NAVIGATION_READ_FAILED',
    message: 'Read failed',
  };
  readFailure.navigationPrediction.success = false;
  readFailure.navigationPrediction.prediction = {
    status: 'failed',
    reason: 'NAVIGATION_READ_FAILED',
    message: 'Read failed',
  };
  assert.equal(validate(readFailure), true, JSON.stringify(validate.errors));
  readFailure.navigationPrediction.prediction.reason = 'SCENARIO_SPEED_INVALID';
  assert.equal(validate(readFailure), false, 'a reason under the wrong status must be rejected');
});

test('prediction example preserves source and endpoint association with its navigation state', async () => {
  const { responseExample } = await validators;
  const {
    navigationState: state,
    navigationPrediction: { prediction },
  } = responseExample;
  assert.equal(prediction.sourceRevision, state.provenance.sourceRevision);
  assert.equal(prediction.coordinateBasisId, state.coordinateBasisId);
  assert.equal(prediction.positionEvaluationModelId, state.provenance.evaluationModelId);
  assert.deepEqual(prediction.departure, {
    shipId: state.departure.shipId,
    epochMs: state.epochMs,
    positionKm: state.departure.positionKm,
  });
  assert.equal(prediction.encounter.bodyId, state.candidates[0].bodyId);
  assert.equal(prediction.arrival.marketId, state.destination.marketId);
  assert.equal(prediction.arrival.hostBodyId, state.destination.hostBodyId);
  assert.ok(prediction.departure.epochMs <= prediction.encounter.epochMs);
  assert.ok(prediction.encounter.epochMs <= prediction.arrival.epochMs);
  assert.ok(prediction.arrival.epochMs - prediction.departure.epochMs <= 315576000000);
});

async function fixture(source, epoch) {
  const f = await navigationFixture(source, epoch);
  f.handler = new SolarSystemGetMessageHandler(f.ctx);
  f.request = {
    ...f.request,
    requestIdentity: { ...f.request.requestIdentity, operation: 'solar-system-get' },
    navigation: {
      shipId: f.ship.id,
      destinationMarketId: 'sol-pluto-orbit',
      candidateBodyId: 'sol-luna',
    },
    navigationPrediction: { scenarioCruiseSpeedKmPerSec: 150 },
    navigationEstimate: { scenarioCruiseSpeedKmPerSec: 10 },
  };
  delete f.request.shipId;
  delete f.request.destinationMarketId;
  return f;
}

async function assertResponse(f, response, reason) {
  const { response: validate } = await validators;
  assert.equal(
    validate({
      ...response,
      correlationId: f.request.correlationId,
      requestIdentity: f.request.requestIdentity,
    }),
    true,
    JSON.stringify(validate.errors)
  );
  assert.equal(
    response.navigationPrediction.success,
    reason === undefined,
    JSON.stringify(response.navigationPrediction)
  );
  if (reason) {
    assert.equal(response.navigationPrediction.prediction.reason, reason);
    assert.deepEqual(Object.keys(response.navigationPrediction.prediction).sort(), [
      'message',
      'reason',
      'status',
    ]);
  }
}

function countedDatabase(f, changeSecondCapture = false) {
  const counts = { characters: 0, bodies: 0, markets: 0 };
  f.ctx.databaseService = {
    getCharacters: async () => {
      counts.characters++;
      return structuredClone(f.ctx.charactersByPlayer.get('fixturepilot'));
    },
    getMarkets: async () => {
      counts.markets++;
      return structuredClone(f.markets);
    },
    getCelestialBodies: async () => {
      const bodies = structuredClone(f.bodies);
      if (++counts.bodies === 2 && changeSecondCapture)
        bodies[0].updatedAt = '2026-11-16T00:00:00.000Z';
      return bodies;
    },
  };
  return counts;
}

test('runtime prediction preserves the exact preview, bodies and direct estimate with only two captures', async () => {
  const f = await fixture();
  const baseRequest = { ...f.request };
  delete baseRequest.navigationPrediction;
  const original = await f.handler.buildResponse(baseRequest);
  const before = JSON.stringify([f.ship, f.bodies, f.markets]);
  const counts = countedDatabase(f);
  const response = await f.handler.handle(createMockSocket(), f.request);
  await assertResponse(f, response);
  assert.deepEqual(counts, { characters: 2, bodies: 2, markets: 2 });
  for (const field of ['navigationState', 'bodies', 'stars', 'navigationEstimate']) {
    assert.equal(JSON.stringify(response[field]), JSON.stringify(original[field]), field);
  }
  assert.equal(JSON.stringify([f.ship, f.bodies, f.markets]), before);
  const p = response.navigationPrediction.prediction;
  const state = response.navigationState;
  assert.equal(p.sourceRevision, state.provenance.sourceRevision);
  assert.deepEqual(p.departure, {
    shipId: state.departure.shipId,
    epochMs: state.epochMs,
    positionKm: state.departure.positionKm,
  });
  assert.notEqual(p.departure.positionKm, state.departure.positionKm, 'vectors must not alias');
  const catalog = new Map(SOL_SYSTEM_CATALOG.map((body) => [body.id, body]));
  const candidate = computeAbsolutePositionKm(
    catalog.get('sol-luna'),
    p.encounter.epochMs,
    new Map(),
    catalog
  );
  const host = computeAbsolutePositionKm(
    catalog.get('sol-pluto'),
    p.arrival.epochMs,
    new Map(),
    catalog
  );
  const orbit = f.markets.find((market) => market.marketId === 'sol-pluto-orbit').trajectory.orbit;
  const offset = computeRelativeOrbitPositionKm(
    f.ctx,
    orbit,
    new Date(p.arrival.epochMs).toISOString()
  );
  assert.deepEqual(p.encounter.positionKm, candidate);
  assert.deepEqual(p.arrival.hostPositionKm, host);
  assert.deepEqual(p.arrival.positionKm, {
    x: host.x + offset.x,
    y: host.y + offset.y,
    z: host.z + offset.z,
  });
  assert.notDeepEqual(p.arrival.positionKm, state.destination.positionKm);
  for (const [start, end] of [
    [p.departure, p.encounter],
    [p.encounter, p.arrival],
  ]) {
    const distance = Math.hypot(
      ...['x', 'y', 'z'].map((axis) => end.positionKm[axis] - start.positionKm[axis])
    );
    const residual = Math.abs(start.epochMs + (1000 * distance) / 150 - end.epochMs);
    assert.equal(end.convergence.residualMs, residual);
    assert.ok(residual <= 1);
    assert.ok(end.epochMs >= start.epochMs);
  }
  const { responseExample } = await validators;
  for (const field of ['encounter', 'arrival']) {
    assert.deepEqual(
      p[field],
      responseExample.navigationPrediction.prediction[field],
      `regenerated ${field} example`
    );
  }
});

test('invalid prediction inputs reject only the sibling and preserve preview and estimate', async () => {
  const f = await fixture();
  const original = await f.handler.buildResponse(f.request);
  const cases = [
    ...[null, [], 150, { epochMs: 1 }, { scenarioCruiseSpeedKmPerSec: 150, extra: true }].map(
      (options) => [options, 'NAVIGATION_REQUEST_INVALID']
    ),
    ...[undefined, null, '150', NaN, Infinity, -1, 0, 119.999, 10000.001].map((speed) => [
      { scenarioCruiseSpeedKmPerSec: speed },
      'SCENARIO_SPEED_INVALID',
    ]),
  ];
  for (const [options, reason] of cases) {
    const response = await f.handler.handle(createMockSocket(), {
      ...f.request,
      navigationPrediction: options,
    });
    await assertResponse(f, response, reason);
    assert.deepEqual(response.navigationState, original.navigationState);
    assert.deepEqual(response.navigationEstimate, original.navigationEstimate);
    assert.deepEqual(response.bodies, original.bodies);
  }
  const withoutCandidate = structuredClone(f.request);
  delete withoutCandidate.navigation.candidateBodyId;
  const missing = await f.handler.buildResponse(withoutCandidate);
  await assertResponse(f, missing, 'CANDIDATE_REQUIRED');
  const { missingCandidateExample } = await validators;
  assert.equal(
    missing.navigationState.provenance.sourceRevision,
    missingCandidateExample.navigationState.provenance.sourceRevision
  );
  const baseline = { ...withoutCandidate };
  delete baseline.navigationPrediction;
  assert.deepEqual(
    missing.navigationState,
    (await f.handler.buildResponse(baseline)).navigationState
  );
  for (const speed of [120, 10000]) {
    await assertResponse(
      f,
      await f.handler.buildResponse({
        ...f.request,
        navigationPrediction: { scenarioCruiseSpeedKmPerSec: speed },
      })
    );
  }
  const { response: validate } = await validators;
  for (const speed of [119, 10001, '150', null]) {
    const bad = structuredClone(original);
    bad.navigationPrediction.prediction.scenarioCruiseSpeedKmPerSec = speed;
    assert.equal(
      validate({
        ...bad,
        correlationId: f.request.correlationId,
        requestIdentity: f.request.requestIdentity,
      }),
      false
    );
  }
});

test('missing selection never seeds or refreshes presence; precedence and legacy missing-navigation message are preserved', async () => {
  const f = await fixture();
  f.ctx.getPlayer = () => {
    throw new Error('Missing selection must not read');
  };
  const request = { ...f.request };
  delete request.navigation;
  const both = await f.handler.handle(createMockSocket(), request);
  assert.equal(both.message, 'navigationEstimate requires navigation');
  await assertResponse(f, both, 'NAVIGATION_REQUEST_INVALID');
  delete request.navigationEstimate;
  const only = await f.handler.handle(createMockSocket(), request);
  assert.equal(only.message, 'navigationPrediction requires navigation');
  await assertResponse(f, only, 'NAVIGATION_REQUEST_INVALID');
  request.navigationPrediction = {};
  await assertResponse(f, await f.handler.buildResponse(request), 'SCENARIO_SPEED_INVALID');
});

test('source changes discard both legs; read failures and existing unsupported gates remain explicit', async () => {
  const f = await fixture();
  const counts = countedDatabase(f, true);
  const changed = await f.handler.buildResponse(f.request);
  await assertResponse(f, changed, 'SOURCES_CHANGED');
  assert.equal(changed.navigationState.reason, 'SOURCES_CHANGED');
  assert.deepEqual(counts, { characters: 2, bodies: 2, markets: 2 });
  f.ctx.databaseService.getCharacters = async () => {
    throw new Error('Read unavailable');
  };
  await assertResponse(f, await f.handler.buildResponse(f.request), 'NAVIGATION_READ_FAILED');
  assert.ok(f.logs.some((message) => message.includes('Read unavailable')));
  f.ctx.databaseService = null;
  for (const [navigation, reason] of [
    [{ ...f.request.navigation, shipId: 'unowned' }, 'SHIP_NOT_OWNED'],
    [{ ...f.request.navigation, candidateBodyId: 'sol-sun' }, 'EVALUATION_UNSUPPORTED'],
    [{ ...f.request.navigation, candidateBodyId: 'missing' }, 'EVALUATION_UNSUPPORTED'],
  ]) {
    await assertResponse(f, await f.handler.buildResponse({ ...f.request, navigation }), reason);
  }
  await assertResponse(
    f,
    await f.handler.buildResponse({ ...f.request, solarSystemId: 'alpha-centauri' }),
    'SYSTEM_UNSUPPORTED'
  );
  const luna = f.bodies.find((body) => body.id === 'sol-luna');
  luna.orbitalElements.eccentricity += 0.01;
  await assertResponse(f, await f.handler.buildResponse(f.request), 'SOURCE_UNVERIFIED');
  f.ship.spatial.positionKm.x += 1;
  await assertResponse(f, await f.handler.buildResponse(f.request), 'BASIS_UNKNOWN');
});

test('arrival uses the future verified body-orbit offset and rejects unsupported placement metadata', async () => {
  const f = await fixture();
  const destination = f.markets.find((market) => market.marketId === 'sol-pluto-orbit');
  const original = await f.handler.buildResponse(f.request);
  destination.stationPlacement = {
    kind: 'body-orbit',
    activation: 'active',
    primaryBodyId: 'sol-pluto',
    stationKeeping: false,
    provenance: 'fixture',
    reason: 'Existing verified orbital trajectory',
  };
  const explicit = await f.handler.buildResponse(f.request);
  await assertResponse(f, explicit);
  assert.deepEqual(
    explicit.navigationPrediction.prediction.arrival,
    original.navigationPrediction.prediction.arrival
  );
  assert.notEqual(
    explicit.navigationPrediction.prediction.sourceRevision,
    original.navigationPrediction.prediction.sourceRevision
  );
  const orbit = destination.trajectory.orbit;
  const integer = original.navigationPrediction.prediction.arrival.epochMs;
  assert.deepEqual(
    computeRelativeOrbitPositionAtEpochMs(f.ctx, orbit, integer),
    computeRelativeOrbitPositionKm(f.ctx, orbit, new Date(integer).toISOString())
  );
  assert.notDeepEqual(
    computeRelativeOrbitPositionAtEpochMs(f.ctx, orbit, integer + 0.75),
    computeRelativeOrbitPositionAtEpochMs(f.ctx, orbit, integer),
    'iteration must not truncate fractional milliseconds'
  );
  destination.stationPlacement.activation = 'metadata-only';
  await assertResponse(
    f,
    await f.handler.buildResponse(f.request),
    'STATION_PLACEMENT_UNSUPPORTED'
  );
});

test('candidate may equal either endpoint host; late supported ship epochs reject future out-of-range arrival', async () => {
  const f = await fixture('sol-pluto-orbit');
  f.request.navigation.destinationMarketId = 'sol-mars-orbit';
  for (const candidateBodyId of ['sol-charon', 'sol-mars']) {
    f.request.navigation.candidateBodyId = candidateBodyId;
    await assertResponse(f, await f.handler.buildResponse(f.request));
  }
  const sameSource = await fixture();
  sameSource.request.navigation.candidateBodyId = 'sol-mars';
  await assertResponse(sameSource, await sameSource.handler.buildResponse(sameSource.request));
  const late = await fixture('sol-mars-orbit', '2099-12-31T23:59:59.999Z');
  const result = await late.handler.buildResponse(late.request);
  assert.equal(result.navigationState.status, 'supported');
  await assertResponse(late, result, 'PREDICTION_EPOCH_UNSUPPORTED');
});

test('analytic speed bounds cover every catalog target chain and station without epoch sampling', () => {
  const catalog = new Map(SOL_SYSTEM_CATALOG.map((entry) => [entry.id, entry]));
  const bounds = SOL_SYSTEM_CATALOG.filter((entry) =>
    ['planet', 'moon'].includes(entry.bodyType)
  ).map((entry) => ({
    id: entry.id,
    speed: keplerChainSpeedBound(entry.id, (id) => catalog.get(id)),
  }));
  const stationBounds = buildSeededMarketsForSolarSystem('sol')
    .filter((market) => market.siteType === 'station')
    .map((market) => ({
      id: market.marketId,
      speed:
        keplerSpeedBound(market.trajectory.orbit, true) +
        keplerChainSpeedBound(market.trajectory.orbit.anchorBodyId, (id) => catalog.get(id)),
    }));
  assert.equal(bounds.length, 469);
  for (const bound of [...bounds, ...stationBounds])
    assert.ok(bound.speed / 120 <= 0.5, JSON.stringify(bound));
  bounds.sort((a, b) => b.speed - a.speed);
  stationBounds.sort((a, b) => b.speed - a.speed);
  assert.equal(bounds[0].id, 'sol-mercury');
  assert.ok(bounds[0].speed > 58.97 && bounds[0].speed < 58.98);
  assert.equal(stationBounds[0].id, 'sol-mercury-orbit');
  assert.ok(stationBounds[0].speed > 59.14 && stationBounds[0].speed < 60.1);
  const circular = { semiMajorAxisKm: 100, eccentricity: 0, orbitalPeriodSec: 100 };
  assert.ok(Math.abs(keplerSpeedBound(circular) - 2 * Math.PI) < 1e-14);
  assert.equal(
    keplerSpeedBound({ ...circular, orbitalPeriodSec: -100 }),
    keplerSpeedBound(circular)
  );
  for (const [e, station] of [
    [0.999, false],
    [0.99, true],
  ]) {
    const expected = 2 * Math.PI * Math.sqrt((1 + e) / (1 - e));
    assert.ok(
      Math.abs(keplerSpeedBound({ ...circular, eccentricity: e }, station) - expected) <
        expected * 1e-14
    );
  }
  for (const orbit of [
    null,
    { ...circular, eccentricity: 1 },
    { ...circular, orbitalPeriodSec: 0 },
    { ...circular, semiMajorAxisKm: Infinity },
    { ...circular, semiMajorAxisKm: Number.MAX_VALUE, orbitalPeriodSec: 1 },
  ]) {
    assert.throws(() => keplerSpeedBound(orbit), { reason: 'EVALUATION_UNSUPPORTED' });
  }
  assert.throws(() => keplerSpeedBound({ ...circular, orbitalPeriodSec: -100 }, true), {
    reason: 'EVALUATION_UNSUPPORTED',
  });
  for (const body of [
    undefined,
    { id: 'custom', positionKmAtTimestamp: () => ({}) },
    { id: 'cycle', orbit: circular, parentBodyId: 'cycle' },
  ]) {
    assert.throws(() => keplerChainSpeedBound('cycle', () => body), {
      reason: 'EVALUATION_UNSUPPORTED',
    });
  }
});

const T0 = 1794614400000;
const origin = { x: 0, y: 0, z: 0 };
function legOptions(overrides = {}) {
  return {
    departureEpochMs: T0,
    startEpochMs: T0,
    startPositionKm: origin,
    speed: 120,
    target: () => ({ positionKm: { x: 120, y: 0, z: 0 } }),
    leg: 'encounter',
    ...overrides,
  };
}

test('leg solver checks moving and zero-distance targets and departure-relative horizon/epoch boundaries', () => {
  const moving = solveLeg(
    legOptions({
      target: (epoch) => ({ positionKm: { x: 120 + (60 * (epoch - T0)) / 1000, y: 0, z: 0 } }),
    })
  );
  assert.equal(moving.epochMs, T0 + 2000);
  const zero = solveLeg(legOptions({ target: () => ({ positionKm: origin }) }));
  assert.equal(zero.epochMs, T0);
  assert.equal(zero.convergence.residualMs, 0);
  for (const extra of [0, 1, HORIZON_MS + 1]) {
    const options = legOptions({
      startEpochMs: T0 + HORIZON_MS - 1000,
      leg: 'arrival',
      target: () => ({ positionKm: { x: (120 * (1000 + extra)) / 1000, y: 0, z: 0 } }),
    });
    if (extra === 0) assert.equal(solveLeg(options).epochMs, T0 + HORIZON_MS);
    else assert.throws(() => solveLeg(options), { reason: 'PREDICTION_HORIZON_EXCEEDED' });
  }
  const last = 4102444799999;
  assert.equal(
    solveLeg(
      legOptions({
        departureEpochMs: last,
        startEpochMs: last,
        target: () => ({ positionKm: origin }),
      })
    ).epochMs,
    last
  );
  assert.throws(() => solveLeg(legOptions({ departureEpochMs: last, startEpochMs: last })), {
    reason: 'PREDICTION_EPOCH_UNSUPPORTED',
  });
  assert.throws(
    () =>
      solveLeg(
        legOptions({
          departureEpochMs: last,
          startEpochMs: last,
          target: () => ({ positionKm: { x: (120 * (HORIZON_MS + 1)) / 1000, y: 0, z: 0 } }),
        })
      ),
    { reason: 'PREDICTION_HORIZON_EXCEEDED' },
    'horizon takes precedence over epoch'
  );
});

test('each leg rejects iteration cap and integer-epoch residual failure independently', () => {
  for (const leg of ['encounter', 'arrival']) {
    const reason = leg === 'encounter' ? 'ENCOUNTER_NONCONVERGENT' : 'ARRIVAL_NONCONVERGENT';
    assert.throws(
      () =>
        solveLeg(
          legOptions({
            leg,
            target: (epoch) => ({
              positionKm: { x: epoch === T0 ? 120 : 0, y: 0, z: 0 },
            }),
          })
        ),
      { reason }
    );
    assert.throws(
      () =>
        solveLeg(
          legOptions({
            leg,
            target: (epoch) => ({
              positionKm: { x: epoch === T0 + 1000 ? 240 : 120.048, y: 0, z: 0 },
            }),
          })
        ),
      { reason },
      'fractional convergence does not bypass rounded-epoch residual validation'
    );
  }
  for (const x of [NaN, Infinity, Number.MAX_VALUE]) {
    assert.throws(
      () => solveLeg(legOptions({ target: () => ({ positionKm: { x, y: 0, z: 0 } }) })),
      { reason: 'PREDICTION_NUMERIC_INVALID' }
    );
  }
});

test('prediction checks both bounds before evaluation, contains failures and never returns a partial encounter', async () => {
  const { responseExample } = await validators;
  const state = responseExample.navigationState;
  const logs = [];
  const ctx = { log: (message) => logs.push(message) };
  const options = { scenarioCruiseSpeedKmPerSec: 120 };
  let evaluations = 0;
  function targets(bound = 60) {
    return {
      candidate: {
        speedBoundKmPerSec: bound,
        atEpoch: () => {
          evaluations++;
          return { bodyId: 'sol-luna', positionKm: state.departure.positionKm };
        },
      },
      destination: {
        speedBoundKmPerSec: bound,
        atEpoch: () => {
          evaluations++;
          return {
            marketId: state.destination.marketId,
            hostBodyId: state.destination.hostBodyId,
            positionKm: state.departure.positionKm,
            hostPositionKm: state.departure.positionKm,
          };
        },
      },
      assertSources: () => {},
    };
  }
  assert.equal(predictNavigation(ctx, state, options, () => targets()).success, true);
  for (const key of ['candidate', 'destination']) {
    for (const [bound, reason] of [
      [60.000001, 'SCENARIO_SPEED_BELOW_CONVERGENCE_BOUND'],
      [NaN, 'EVALUATION_UNSUPPORTED'],
    ]) {
      evaluations = 0;
      const inputs = targets();
      inputs[key].speedBoundKmPerSec = bound;
      const result = predictNavigation(ctx, state, options, () => inputs);
      assert.equal(result.prediction.reason, reason);
      assert.equal(evaluations, 0, 'both preconditions run before either leg');
    }
  }
  const inputs = targets();
  inputs.destination.atEpoch = () => {
    throw new Error('Injected evaluation failure');
  };
  let result = predictNavigation(ctx, state, options, () => inputs);
  assert.deepEqual(Object.keys(result.prediction).sort(), ['message', 'reason', 'status']);
  assert.equal(result.prediction.reason, 'PREDICTION_EVALUATION_FAILED');
  assert.ok(logs.some((message) => message.includes('Injected evaluation failure')));
  const mismatch = targets();
  mismatch.assertSources = () => {
    throw new PredictionError('failed', 'PREDICTION_SOURCE_MISMATCH', 'Dependencies changed');
  };
  result = predictNavigation(ctx, state, options, () => mismatch);
  assert.equal(result.prediction.reason, 'PREDICTION_SOURCE_MISMATCH');
  const ineligible = structuredClone(state);
  ineligible.previewEligibility = { status: 'ineligible', reason: 'KNOWN_INVALID_DESTINATION' };
  assert.equal(
    predictNavigation(ctx, ineligible, options, () => {
      throw new Error('Must not run');
    }).prediction.reason,
    'KNOWN_INVALID_DESTINATION'
  );
  const correct = responseExample.navigationPrediction;
  for (const mutate of [
    (p) => {
      p.sourceRevision = 'other';
    },
    (p) => {
      p.departure.positionKm.x++;
    },
    (p) => {
      p.departure.epochMs++;
    },
    (p) => {
      p.encounter.bodyId = 'other';
    },
    (p) => {
      p.arrival.marketId = 'other';
    },
    (p) => {
      p.arrival.hostBodyId = 'other';
    },
  ]) {
    const changed = structuredClone(correct);
    mutate(changed.prediction);
    assert.equal(
      predictionFromNavigationState(ctx, state, null, changed).prediction.reason,
      'PREDICTION_SOURCE_MISMATCH'
    );
  }
});
