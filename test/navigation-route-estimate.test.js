'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('../src/model/schema-validator');
const { navigationFixture: fixture } = require('../test-support/navigation-test-helpers');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const { registerSocketHandlers } = require('../src/handlers/socket-handler-registry');
const {
  registerTrustedNavigationPlacementAsync,
} = require('../src/handlers/context/navigation-state-service');
const { materializeStationSnapshotAsync } = require('../src/handlers/context/orbital-math');
const { createMockSocket } = require('../test-support/message-handler-test-helpers');
const {
  estimateFromNavigationState,
} = require('../src/handlers/context/navigation-route-estimate-service');
const { createServer } = require('../src/server');
const {
  listen,
  connectClient,
  waitForEvent,
  closeClient,
} = require('../test-support/socket-test-helpers');

const contract = Parser.dereference(path.join(__dirname, '..', 'api', 'openapi.yaml'));
const validators = contract.then((api) => {
  const operation = api.paths['/socket/navigation-route-estimate'].post;
  const ajv = createSchemaValidator({ strict: false });
  return {
    operation,
    request: ajv.compile(operation.requestBody.content['application/json'].schema),
    response: ajv.compile(operation.responses['200'].content['application/json'].schema),
    paired: ajv.compile(
      api.paths['/socket/solar-system-get'].post.responses['200'].content['application/json'].schema
    ),
    previewRequest: ajv.compile(
      api.paths['/socket/solar-system-get'].post.requestBody.content['application/json'].schema
    ),
  };
});

async function assertResponse(response, status) {
  const { response: validate } = await validators;
  assert.equal(validate(response), true, JSON.stringify(validate.errors));
  assert.equal(response.estimate.status, status);
  assert.equal(response.success, status === 'supported');
  if (status !== 'supported') {
    assert.equal(Object.hasOwn(response.estimate, 'distanceKm'), false);
    assert.equal(Object.hasOwn(response.estimate, 'duration'), false);
  }
}

test('direct baseline measures projected endpoints without changing preview, snapshots or inferring speed', async () => {
  const f = await fixture();
  f.ship.driveProfile = {
    id: 'fixture-drive',
    name: 'Fixture',
    rangeAu: 1,
    cruiseSpeedAuPerHour: 2,
    fuelCostPerAu: 3,
  };
  // Drive-profile changes are not spatial/ownership changes.
  const previewRequest = {
    playerName: f.request.playerName,
    solarSystemId: 'sol',
    navigation: {
      shipId: f.ship.id,
      destinationMarketId: f.request.destinationMarketId,
      candidateBodyId: 'sol-luna',
    },
  };
  const previewHandler = new SolarSystemGetMessageHandler(f.ctx);
  const previewBefore = await previewHandler.buildResponse(previewRequest);
  assert.equal(previewBefore.navigationState.status, 'supported');
  const before = JSON.stringify([f.ship, f.bodies, f.markets]);
  const socket = createMockSocket();
  const response = await f.handler.handle(socket, f.request);
  await assertResponse(response, 'supported');
  const destination = await materializeStationSnapshotAsync(
    f.evaluated,
    f.markets.find((market) => market.marketId === f.request.destinationMarketId)
  );
  const expectedKm = Math.hypot(
    ...['x', 'y', 'z'].map(
      (axis) => destination.spatial.positionKm[axis] - f.ship.spatial.positionKm[axis]
    )
  );
  assert.ok(Math.abs(response.estimate.distanceKm - expectedKm) < 0.000001);
  assert.equal(response.estimate.referenceEpochMs, f.ship.spatial.epochMs);
  assert.notEqual(response.estimate.referenceEpochMs, f.bodies[0].spatial.epochMs);
  assert.deepEqual(response.estimate.duration, {
    status: 'unavailable',
    reason: 'SCENARIO_SPEED_NOT_SUPPLIED',
  });
  assert.equal(response.correlationId, f.request.correlationId);
  assert.deepEqual(response.requestIdentity, f.request.requestIdentity);
  assert.deepEqual(socket.events, [
    { eventName: 'navigation-route-estimate-response', payload: response },
  ]);
  assert.equal(JSON.stringify([f.ship, f.bodies, f.markets]), before);
  assert.deepEqual(await previewHandler.buildResponse(previewRequest), previewBefore);
  for (const key of [
    'navigationState',
    'positionKm',
    'candidates',
    'sourceRevision',
    'shipRevision',
  ]) {
    assert.equal(JSON.stringify(response).includes(`"${key}"`), false);
  }
});

test('explicit scenario duration is distance/speed, handles zero distance and rejects nonfinite results', async () => {
  const f = await fixture();
  const response = await f.handler.buildResponse({ ...f.request, scenarioCruiseSpeedKmPerSec: 10 });
  await assertResponse(response, 'supported');
  assert.equal(response.estimate.duration.estimatedDurationSec, response.estimate.distanceKm / 10);
  assert.equal(response.estimate.duration.speedProvenance, 'caller-supplied-scenario');
  assert.equal(response.estimate.classification, 'hypothetical-not-eta');
  assert.deepEqual(response.estimate.assumptions, {
    endpointsFrozen: true,
    constantScenarioSpeed: true,
    accelerationBrakingOmitted: true,
    assistSpeedChangesOmitted: true,
    movementDuringTripOmitted: true,
  });
  assert.deepEqual(response.estimate.warnings, ['CLEARANCE_UNVERIFIED']);
  const zero = await f.handler.buildResponse({
    ...f.request,
    destinationMarketId: f.source.marketId,
    scenarioCruiseSpeedKmPerSec: 10,
  });
  await assertResponse(zero, 'supported');
  assert.equal(zero.estimate.distanceKm, 0);
  assert.equal(zero.estimate.duration.estimatedDurationSec, 0);
  const overflow = await f.handler.buildResponse({
    ...f.request,
    scenarioCruiseSpeedKmPerSec: Number.MIN_VALUE,
  });
  await assertResponse(overflow, 'failed');
  assert.equal(overflow.estimate.reason, 'ESTIMATE_NUMERIC_INVALID');
  assert.ok(f.logs.some((message) => message.includes('Nonfinite')));
});

test('invalid speed, metadata and unsupported extra inputs fail without reads or correlation substitution', async () => {
  const f = await fixture();
  f.ctx.getPlayer = () => {
    throw new Error('Invalid request must not read player');
  };
  const invalidRequests = [
    null,
    [],
    {},
    ...[null, 0, -1, '10', NaN, Infinity].map((speed) => ({
      ...f.request,
      scenarioCruiseSpeedKmPerSec: speed,
    })),
    ...['candidateBodyId', 'asOf', 'coordinateBasisId', 'maxResults'].map((key) => ({
      ...f.request,
      [key]: 'not-supported',
    })),
    { ...f.request, correlationId: 'not-uuid-v4' },
    { ...f.request, shipId: '' },
    {
      ...f.request,
      requestIdentity: { ...f.request.requestIdentity, operation: 'solar-system-get' },
    },
    {
      ...f.request,
      requestIdentity: { ...f.request.requestIdentity, containerId: 'alpha-centauri' },
    },
  ];
  for (const request of invalidRequests) {
    const response = await f.handler.buildResponse(request);
    await assertResponse(response, 'invalid');
    assert.equal(response.estimate.reason, 'NAVIGATION_REQUEST_INVALID');
    assert.equal(response.correlationId, request?.correlationId ?? null);
    assert.deepEqual(response.requestIdentity, request?.requestIdentity ?? null);
  }
});

test('baseline reuses ownership, lineage, system and source gates and blocks both ineligible endpoints', async () => {
  const f = await fixture();
  for (const [override, reason] of [
    [{ shipId: 'not-owned' }, 'SHIP_NOT_OWNED'],
    [
      {
        solarSystemId: 'alpha-centauri',
        requestIdentity: { ...f.request.requestIdentity, containerId: 'alpha-centauri' },
      },
      'SYSTEM_UNSUPPORTED',
    ],
  ]) {
    const response = await f.handler.buildResponse({ ...f.request, ...override });
    await assertResponse(response, 'unsupported');
    assert.equal(response.estimate.reason, reason);
  }
  const invalidDestination = await f.handler.buildResponse({
    ...f.request,
    destinationMarketId: 'sol-earth-orbit',
  });
  await assertResponse(invalidDestination, 'ineligible');
  assert.equal(invalidDestination.estimate.reason, 'KNOWN_INVALID_DESTINATION');
  const invalidSource = await fixture('sol-earth-orbit');
  const blocked = await invalidSource.handler.buildResponse(invalidSource.request);
  await assertResponse(blocked, 'ineligible');
  assert.equal(blocked.estimate.reason, 'KNOWN_INVALID_SOURCE');
  const pluto = f.bodies.find((body) => body.id === 'sol-pluto');
  pluto.orbitalElements.eccentricity += 0.01;
  const changed = await f.handler.buildResponse(f.request);
  await assertResponse(changed, 'unsupported');
  assert.equal(changed.estimate.reason, 'SOURCE_UNVERIFIED');
  f.ship.spatial.positionKm.x += 1;
  const revoked = await f.handler.buildResponse(f.request);
  await assertResponse(revoked, 'unsupported');
  assert.equal(revoked.estimate.reason, 'BASIS_UNKNOWN');
});

test('changed captured sources and database failures produce explicit non-measurement outcomes', async () => {
  const f = await fixture();
  let reads = 0;
  f.ctx.databaseService = {
    getCharacters: async () => structuredClone(f.ctx.charactersByPlayer.get('fixturepilot')),
    getMarkets: async () => structuredClone(f.markets),
    getCelestialBodies: async () => {
      const bodies = structuredClone(f.bodies);
      if (++reads === 2) bodies[0].updatedAt = '2026-11-15T00:00:00.000Z';
      return bodies;
    },
  };
  const changed = await f.handler.buildResponse(f.request);
  await assertResponse(changed, 'unsupported');
  assert.equal(changed.estimate.reason, 'SOURCES_CHANGED');
  f.ctx.databaseService.getCharacters = async () => {
    throw new Error('Database unavailable');
  };
  const failure = await f.handler.buildResponse(f.request);
  await assertResponse(failure, 'failed');
  assert.equal(failure.estimate.reason, 'NAVIGATION_READ_FAILED');
  assert.ok(f.logs.some((message) => message.includes('Database unavailable')));
});

test('registered operation guards sessions and isolates exact correlation for overlapping requests and failures', async () => {
  const f = await fixture();
  const socket = createMockSocket();
  const listeners = new Map();
  socket.on = (name, callback) => listeners.set(name, callback);
  let validSession = true;
  f.ctx.hasValidSessionAsync = async () => validSession;
  registerSocketHandlers(socket, { navigationRouteEstimateMessageHandler: f.handler }, f.ctx);
  const trigger = listeners.get('navigation-route-estimate-request');
  assert.ok(trigger);
  const second = {
    ...f.request,
    correlationId: '05bf6f98-a26f-4ccb-aa53-ef81259e8303',
    destinationMarketId: f.source.marketId,
  };
  await Promise.all([trigger(f.request), trigger(second)]);
  assert.equal(socket.events.length, 2);
  for (const request of [f.request, second]) {
    const event = socket.events.find(
      (entry) => entry.payload.correlationId === request.correlationId
    );
    assert.equal(event.eventName, 'navigation-route-estimate-response');
    await assertResponse(event.payload, 'supported');
    assert.equal(event.payload.estimate.destination.marketId, request.destinationMarketId);
  }
  socket.events.length = 0;
  validSession = false;
  await trigger(f.request);
  assert.equal(socket.events[0].eventName, 'invalid-session');
  const rejected = socket.events[1];
  assert.equal(rejected.eventName, 'navigation-route-estimate-response');
  await assertResponse(rejected.payload, 'unsupported');
  assert.equal(rejected.payload.estimate.reason, 'INVALID_SESSION');
  assert.equal(rejected.payload.correlationId, f.request.correlationId);
  assert.equal(socket.events.length, 2);
  assert.equal(
    socket.events.filter((event) => event.eventName === 'navigation-route-estimate-response')
      .length,
    1
  );
  assert.equal(Object.hasOwn(socket.events[0].payload, 'correlationId'), false);
  assert.equal(Object.hasOwn(socket.events[0].payload, 'estimate'), false);
  socket.events.length = 0;
  validSession = true;
  f.ctx.hasValidSessionAsync = async () => {
    throw new Error('Session database unavailable');
  };
  await trigger(second);
  assert.equal(socket.events.length, 1);
  await assertResponse(socket.events[0].payload, 'failed');
  assert.equal(socket.events[0].payload.correlationId, second.correlationId);
  assert.match(socket.events[0].payload.message, /Navigation route estimate/);
});

test('shared production calculation rejects positive-distance underflow but preserves zero distance and subnormal positive duration', async () => {
  const f = await fixture();
  const projection = await new SolarSystemGetMessageHandler(f.ctx).buildResponse({
    playerName: f.request.playerName,
    solarSystemId: 'sol',
    navigation: { shipId: f.ship.id, destinationMarketId: f.request.destinationMarketId },
  });
  const state = structuredClone(projection.navigationState);
  state.departure.positionKm = { x: 0, y: 0, z: 0 };
  state.destination.positionKm = { x: 1e-20, y: 0, z: 0 };
  assert.equal(1e-20 / Number.MAX_VALUE, 0);
  const result = estimateFromNavigationState(f.ctx, state, {
    scenarioCruiseSpeedKmPerSec: Number.MAX_VALUE,
  });
  assert.equal(result.success, false);
  assert.equal(result.estimate.reason, 'ESTIMATE_NUMERIC_INVALID');
  assert.equal(Object.hasOwn(result.estimate, 'distanceKm'), false);
  assert.equal(Object.hasOwn(result.estimate, 'duration'), false);
  assert.ok(f.logs.some((message) => message.includes('underflowed')));
  state.destination.positionKm.x = 0;
  const zero = estimateFromNavigationState(f.ctx, state, {
    scenarioCruiseSpeedKmPerSec: Number.MAX_VALUE,
  });
  assert.equal(zero.success, true);
  assert.equal(zero.estimate.duration.estimatedDurationSec, 0);
  state.destination.positionKm.x = 1;
  const positive = estimateFromNavigationState(f.ctx, state, {
    scenarioCruiseSpeedKmPerSec: Number.MAX_VALUE,
  });
  assert.equal(positive.success, true);
  assert.ok(positive.estimate.duration.estimatedDurationSec > 0);
  const { response: validate } = await validators;
  const response = await f.handler.buildResponse({ ...f.request, scenarioCruiseSpeedKmPerSec: 10 });
  response.estimate.duration.estimatedDurationSec = 0;
  assert.equal(validate(response), false, 'Nonzero distance must not permit zero duration');
  response.estimate.distanceKm = 0;
  assert.equal(validate(response), true, JSON.stringify(validate.errors));
});

test('opt-in pairs one projection with its direct endpoints and keeps old preview unchanged', async () => {
  const f = await fixture();
  const handler = new SolarSystemGetMessageHandler(f.ctx);
  const request = {
    ...f.request,
    requestIdentity: { ...f.request.requestIdentity, operation: 'solar-system-get' },
    navigation: {
      shipId: f.ship.id,
      destinationMarketId: f.request.destinationMarketId,
      candidateBodyId: 'sol-luna',
    },
  };
  delete request.shipId;
  delete request.destinationMarketId;
  const original = await handler.buildResponse(request);
  assert.equal(Object.hasOwn(original, 'navigationEstimate'), false);
  const characters = f.ctx.charactersByPlayer.get('fixturepilot');
  let reads = 0;
  f.ctx.databaseService = {
    getCharacters: async () => structuredClone(characters),
    getMarkets: async () => structuredClone(f.markets),
    getCelestialBodies: async () => {
      reads += 1;
      return structuredClone(f.bodies);
    },
  };
  const socket = createMockSocket();
  const response = await handler.handle(socket, {
    ...request,
    navigationEstimate: { scenarioCruiseSpeedKmPerSec: 10 },
  });
  assert.equal(reads, 2, 'Exactly one projection capture plus its change-check capture');
  assert.deepEqual(response.navigationState, original.navigationState);
  const paired = response.navigationEstimate;
  assert.equal(paired.success, true);
  assert.equal(paired.association, 'same-response-direct-endpoints');
  const state = response.navigationState;
  const direct = Math.hypot(
    ...['x', 'y', 'z'].map(
      (axis) => state.destination.positionKm[axis] - state.departure.positionKm[axis]
    )
  );
  assert.ok(Math.abs(paired.estimate.distanceKm - direct) < 0.000001);
  assert.equal(paired.estimate.duration.estimatedDurationSec, paired.estimate.distanceKm / 10);
  assert.equal(paired.estimate.referenceEpochMs, state.epochMs);
  assert.deepEqual(socket.events, [{ eventName: 'solar-system-get-response', payload: response }]);
  const { paired: validate, previewRequest } = await validators;
  assert.equal(previewRequest({ ...request, navigationEstimate: {} }), true);
  // Direct handler responses receive correlation metadata from the socket registry.
  const echoed = {
    ...response,
    correlationId: request.correlationId,
    requestIdentity: request.requestIdentity,
  };
  assert.equal(validate(echoed), true, JSON.stringify(validate.errors));
  const missingState = structuredClone(echoed);
  delete missingState.navigationState;
  assert.equal(validate(missingState), false);
  const ineligible = structuredClone(echoed);
  ineligible.navigationState.previewEligibility = {
    status: 'ineligible',
    reason: 'KNOWN_INVALID_DESTINATION',
  };
  assert.equal(validate(ineligible), false);
  const distanceOnly = await handler.buildResponse({ ...request, navigationEstimate: {} });
  assert.deepEqual(distanceOnly.navigationEstimate.estimate.duration, {
    status: 'unavailable',
    reason: 'SCENARIO_SPEED_NOT_SUPPLIED',
  });
});

test('paired rejection preserves valid preview and rejects missing selection, changed sources and ineligible destinations', async () => {
  const f = await fixture();
  const handler = new SolarSystemGetMessageHandler(f.ctx);
  const request = {
    playerName: f.request.playerName,
    solarSystemId: 'sol',
    navigation: { shipId: f.ship.id, destinationMarketId: f.request.destinationMarketId },
  };
  const original = await handler.buildResponse(request);
  for (const options of [
    null,
    [],
    { scenarioCruiseSpeedKmPerSec: 0 },
    { candidateBodyId: 'sol-luna' },
    { scenarioCruiseSpeedKmPerSec: Number.MIN_VALUE },
  ]) {
    const response = await handler.buildResponse({ ...request, navigationEstimate: options });
    assert.equal(response.success, true);
    assert.deepEqual(response.navigationState, original.navigationState);
    assert.equal(response.navigationEstimate.success, false);
    assert.equal(Object.hasOwn(response.navigationEstimate.estimate, 'distanceKm'), false);
  }
  const missing = await handler.handle(createMockSocket(), {
    playerName: f.request.playerName,
    solarSystemId: 'sol',
    navigationEstimate: {},
  });
  assert.equal(missing.navigationEstimate.estimate.reason, 'NAVIGATION_REQUEST_INVALID');
  assert.equal(missing.success, false);
  const invalid = await handler.buildResponse({
    ...request,
    navigation: null,
    navigationEstimate: {},
  });
  assert.equal(invalid.navigationEstimate.success, false);
  const blocked = await handler.buildResponse({
    ...request,
    navigation: { ...request.navigation, destinationMarketId: 'sol-earth-orbit' },
    navigationEstimate: {},
  });
  assert.equal(blocked.navigationEstimate.estimate.reason, 'KNOWN_INVALID_DESTINATION');
  const { previewRequest } = await validators;
  assert.equal(
    previewRequest({ ...f.request, navigationEstimate: {} }),
    false,
    'navigation required'
  );
  let reads = 0;
  f.ctx.databaseService = {
    getCharacters: async () => structuredClone(f.ctx.charactersByPlayer.get('fixturepilot')),
    getMarkets: async () => structuredClone(f.markets),
    getCelestialBodies: async () => {
      const bodies = structuredClone(f.bodies);
      if (++reads === 2) bodies[0].updatedAt = '2026-11-16T00:00:00.000Z';
      return bodies;
    },
  };
  const changed = await handler.buildResponse({ ...request, navigationEstimate: {} });
  assert.equal(changed.navigationEstimate.estimate.reason, 'SOURCES_CHANGED');
  assert.equal(changed.navigationEstimate.success, false);
  f.ctx.databaseService.getCharacters = async () => {
    throw new Error('Unavailable');
  };
  const failed = await handler.buildResponse({ ...request, navigationEstimate: {} });
  assert.equal(failed.navigationEstimate.estimate.reason, 'NAVIGATION_READ_FAILED');
  assert.equal(failed.navigationEstimate.estimate.status, 'failed');
});

test(
  'server exposes the isolated baseline over an authenticated Socket.IO connection',
  { timeout: 10000 },
  async (t) => {
    const f = await fixture();
    const { server, io, messageHandlerContext: ctx } = createServer({ initializeContext: false });
    t.after(async () => {
      await new Promise((resolve) => io.close(resolve));
    });
    ctx.registeredPlayers.set('fixturepilot', {
      ...f.ctx.getPlayer(f.request.playerName),
      sessionKey: f.request.sessionKey,
    });
    ctx.charactersByPlayer.set('fixturepilot', f.ctx.charactersByPlayer.get('fixturepilot'));
    for (const body of f.bodies) ctx.celestialBodiesById.set(body.id, body);
    for (const market of f.markets) ctx.marketsByKey.set(`sol:${market.marketId}`, market);
    await registerTrustedNavigationPlacementAsync(ctx, {
      playerName: f.request.playerName,
      shipId: f.ship.id,
      sourceMarketId: f.source.marketId,
      offsetKm: { x: 0, y: 0, z: 0 },
    });
    ctx.seedSolarSystemCelestialBodiesAsync = async () => {
      throw new Error('Socket estimate must not seed');
    };
    ctx.refreshCharacterPresence = () => {
      throw new Error('Socket estimate must not refresh presence');
    };
    const client = connectClient(await listen(server));
    t.after(() => closeClient(client));
    await waitForEvent(client, 'connect');
    const responsePromise = waitForEvent(client, 'navigation-route-estimate-response');
    client.emit('navigation-route-estimate-request', {
      ...f.request,
      scenarioCruiseSpeedKmPerSec: 10,
    });
    const response = await responsePromise;
    await assertResponse(response, 'supported');
    assert.equal(response.correlationId, f.request.correlationId);
    assert.equal(
      response.estimate.duration.estimatedDurationSec,
      response.estimate.distanceKm / 10
    );
    const pairedPromise = waitForEvent(client, 'solar-system-get-response');
    client.emit('solar-system-get-request', {
      ...f.request,
      requestIdentity: {
        operation: 'solar-system-get',
        entityType: 'solar-system',
        containerId: 'sol',
      },
      navigation: { shipId: f.ship.id, destinationMarketId: f.request.destinationMarketId },
      navigationEstimate: {},
    });
    const paired = await pairedPromise;
    const { paired: validatePaired } = await validators;
    assert.equal(validatePaired(paired), true, JSON.stringify(validatePaired.errors));
    assert.equal(paired.correlationId, f.request.correlationId);
    assert.equal(paired.navigationEstimate.success, true);
    assert.equal(paired.navigationEstimate.estimate.distanceKm, response.estimate.distanceKm);
    for (const [options, candidateBodyId, reason] of [
      [{ scenarioCruiseSpeedKmPerSec: 150 }, 'sol-luna', undefined],
      [{ scenarioCruiseSpeedKmPerSec: 10 }, 'sol-luna', 'SCENARIO_SPEED_INVALID'],
      [{}, 'sol-luna', 'SCENARIO_SPEED_INVALID'],
      [{ scenarioCruiseSpeedKmPerSec: 150 }, undefined, 'CANDIDATE_REQUIRED'],
      [null, 'sol-luna', 'NAVIGATION_REQUEST_INVALID'],
    ]) {
      const predictionPromise = waitForEvent(client, 'solar-system-get-response');
      client.emit('solar-system-get-request', {
        ...f.request,
        requestIdentity: { operation: 'solar-system-get', entityType: 'solar-system', containerId: 'sol' },
        navigation: { shipId: f.ship.id, destinationMarketId: f.request.destinationMarketId,
          ...(candidateBodyId ? { candidateBodyId } : {}) },
        navigationEstimate: {},
        navigationPrediction: options,
      });
      const predicted = await predictionPromise;
      assert.equal(validatePaired(predicted), true, JSON.stringify(validatePaired.errors));
      assert.equal(predicted.correlationId, f.request.correlationId);
      assert.equal(predicted.navigationState.status, 'supported');
      assert.deepEqual(predicted.navigationEstimate, paired.navigationEstimate);
      assert.equal(predicted.navigationPrediction.success, reason === undefined);
      assert.equal(predicted.navigationPrediction.prediction.reason, reason);
    }
  }
);

test('OpenAPI examples and strict response variants exclude preview data and success-shaped failures', async () => {
  const { operation, request, response } = await validators;
  for (const example of Object.values(operation.requestBody.content['application/json'].examples)) {
    assert.equal(request(example.value), true, JSON.stringify(request.errors));
  }
  const examples = operation.responses['200'].content['application/json'].examples;
  for (const example of Object.values(examples)) {
    assert.equal(response(example.value), true, JSON.stringify(response.errors));
  }
  for (const mutate of [
    (value) => {
      value.estimate.departure.positionKm = { x: 0, y: 0, z: 0 };
    },
    (value) => {
      value.navigationState = {};
    },
    (value) => {
      value.estimate.duration.estimatedDurationSec = 100;
    },
    (value) => {
      value.estimate.classification = 'eta';
    },
    (value) => {
      value.success = false;
    },
  ]) {
    const value = structuredClone(examples.distanceOnly.value);
    mutate(value);
    assert.equal(response(value), false);
  }
});
