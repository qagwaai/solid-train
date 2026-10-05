'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const { SOLAR_SYSTEM_GET_RESPONSE_EVENT } = require('../src/model/solar-system-get');
const {
  createMockSocket,
  createCelestialBody,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('SolarSystemGetMessageHandler seeds Alpha Centauri and returns curated bodies', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemGetMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'alpha-centauri',
  });

  assert.equal(response.success, true);
  assert.equal(response.solarSystem.id, 'alpha-centauri');
  assert.equal(response.solarSystem.isMultiStar, true);
  assert.ok(response.bodies.length >= 6);
  assert.ok(response.stars.length === 3);
  assert.ok(response.stars.every((s) => s.bodyType === 'star'));
  assert.equal(socket.events[0].eventName, SOLAR_SYSTEM_GET_RESPONSE_EVENT);
});

test('SolarSystemGetMessageHandler returns failure for unknown system', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemGetMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'not-a-system',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Unknown solar system');
});

test('SolarSystemGetMessageHandler validates required fields', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemGetMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, false);
  assert.match(response.message, /required/);
});

test('SolarSystemGetMessageHandler returns canonical asteroid fields for mission-generated bodies', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  await context.addOrUpdateCelestialBodyAsync(
    createCelestialBody({
      id: 'cb-mission-a1',
      bodyType: 'asteroid',
      missionId: 'first-target',
      createdByCharacterId: 'character-1',
      displayName: 'Starter Rock',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 111, y: -22, z: 7 },
        epochMs: 1713360000000,
      },
      physical: {
        estimatedMassKg: 15000000000,
        estimatedDiameterM: 120,
      },
      clusterId: 'cluster-a',
      clusterCenterKm: { x: 0, y: 0, z: 0 },
      localOffsetKm: { x: 111, y: -22, z: 7 },
      distanceFromClusterCenterKm: 113.376,
      visualization: { colorHex: '#8f99a7', textureKey: 'asteroid-iron' },
    })
  );

  const handler = new SolarSystemGetMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
  });

  assert.equal(response.success, true);
  const asteroid = response.bodies.find((body) => body.id === 'cb-mission-a1');
  assert.ok(asteroid);
  assert.equal(asteroid.bodyType, 'asteroid');
  assert.equal(asteroid.displayName, 'Starter Rock');
  assert.deepEqual(asteroid.spatial.positionKm, { x: 111, y: -22, z: 7 });
  assert.equal(asteroid.physicalCatalog, undefined);
  assert.deepEqual(asteroid.physical, {
    estimatedMassKg: 15000000000,
    estimatedDiameterM: 120,
  });

  assert.deepEqual(asteroid.visualization, {
    colorHex: '#8f99a7',
    textureKey: 'asteroid-iron',
  });
  assert.equal(asteroid.clusterId, 'cluster-a');
  assert.deepEqual(asteroid.clusterCenterKm, { x: 0, y: 0, z: 0 });
  assert.deepEqual(asteroid.localOffsetKm, { x: 111, y: -22, z: 7 });
  assert.equal(asteroid.distanceFromClusterCenterKm, 113.376);
});

test('SolarSystemGetMessageHandler preserves catalog provenance and does not infer mission classification', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', characters: [{ id: 'char-1', characterName: 'Pilot' }] });
  const physicalCatalog = {
    massKg: 204000000000000000000,
    meanRadiusKm: 256,
    equatorialRadiusKm: 270,
    compositionTags: ['silicate'],
  };
  const body = createCelestialBody({
    id: 'mission-scanned-moon',
    missionId: 'survey',
    bodyType: 'moon',
    surfaceArchetype: 'icy-moon',
    physicalCatalog,
    physical: { estimatedDiameterM: 100, estimatedMassKg: 15000000000 },
  });
  await context.addOrUpdateCelestialBodyAsync(body);
  const response = await new SolarSystemGetMessageHandler(context).buildResponse({
    playerName: 'PilotOne', solarSystemId: 'sol',
  });
  const moon = response.bodies.find((entry) => entry.id === body.id);
  assert.equal(moon.bodyType, 'moon');
  assert.equal(moon.surfaceArchetype, 'icy-moon');
  assert.deepEqual(moon.physicalCatalog, physicalCatalog);
  assert.deepEqual(moon.physical, body.physical);
  assert.equal(moon.visualization, undefined);
});
