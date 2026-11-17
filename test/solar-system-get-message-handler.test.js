'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('../src/model/schema-validator');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const { SOLAR_SYSTEM_GET_RESPONSE_EVENT } = require('../src/model/solar-system-get');
const { SOL_SYSTEM_CATALOG } = require('../src/model/sol-system-catalog');
const MPC_COMET_SNAPSHOT = require('../data/sol-comets.json');
const JPL_SATELLITE_SNAPSHOT = require('../data/sol-satellites.json');
const {
  createMockSocket,
  createCelestialBody,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const { materializeStationSnapshotAsync } = require('../src/handlers/context/orbital-math');
const {
  registerTrustedNavigationPlacementAsync,
} = require('../src/handlers/context/navigation-state-service');
const navigationValidator = Parser.dereference(
  path.join(__dirname, '..', 'api', 'openapi.yaml')
).then((api) =>
  createSchemaValidator({ strict: false }).compile(
    api.paths['/socket/solar-system-get'].post.responses['200'].content['application/json'].schema
      .properties.navigationState
  )
);

async function navigationFixture() {
  const sourceEpoch = '2026-04-17T00:00:00.000Z';
  const shipEpoch = '2026-11-14T00:00:00.000Z';
  const ctx = new MessageHandlerContext({ log: () => {} });
  const bodies = buildSeededCelestialBodiesForSolarSystem('sol', sourceEpoch);
  const market = buildSeededMarketsForSolarSystem('sol').find(
    (entry) => entry.marketId === 'sol-earth-orbit'
  );
  for (const body of bodies) ctx.celestialBodiesById.set(body.id, body);
  ctx.marketsByKey.set('sol:sol-earth-orbit', market);
  const target = new MessageHandlerContext({
    log: () => {},
    celestialBodiesById: new Map(
      buildSeededCelestialBodiesForSolarSystem('sol', shipEpoch).map((body) => [body.id, body])
    ),
  });
  const station = await materializeStationSnapshotAsync(target, market);
  const ship = {
    id: 'trusted-fixture-ship',
    model: 'Scavenger Pod',
    inventory: [],
    spatial: structuredClone(station.spatial),
    ownership: {
      ownerType: 'player-character',
      playerId: 'fixture-player',
      characterId: 'fixture-character',
      npcId: null,
      factionId: null,
    },
  };
  ctx.registeredPlayers.set('fixturepilot', {
    playerId: 'fixture-player',
    playerName: 'FixturePilot',
  });
  ctx.charactersByPlayer.set('fixturepilot', [{ id: 'fixture-character', ships: [ship] }]);
  ctx.seedSolarSystemCelestialBodiesAsync = async () => {
    throw new Error('Navigation must not seed');
  };
  ctx.refreshCharacterPresence = () => {
    throw new Error('Navigation must not update presence');
  };
  const request = {
    playerName: 'FixturePilot',
    solarSystemId: 'sol',
    navigation: {
      shipId: ship.id,
      destinationMarketId: market.marketId,
      candidateBodyId: 'sol-luna',
    },
  };
  const certify = () =>
    registerTrustedNavigationPlacementAsync(ctx, {
      playerName: request.playerName,
      shipId: ship.id,
      sourceMarketId: market.marketId,
      offsetKm: { x: 0, y: 0, z: 0 },
    });
  return { ctx, ship, market, bodies, request, certify, station };
}

test('navigation evaluates an explicitly synthetic trusted placement at the unchanged ship epoch without writes', async () => {
  const fixture = await navigationFixture();
  await fixture.certify();
  fixture.request.asOf = '2020-01-01T00:00:00.000Z';
  const before = JSON.stringify([fixture.ship, fixture.market, fixture.bodies]);
  const response = await new SolarSystemGetMessageHandler(fixture.ctx).handle(
    createMockSocket(),
    fixture.request
  );
  assert.equal(response.success, true);
  const state = response.navigationState;
  const validate = await navigationValidator;
  assert.equal(validate(state), true, JSON.stringify(validate.errors));
  assert.equal(state.status, 'supported');
  assert.equal(state.epochMs, fixture.ship.spatial.epochMs);
  assert.deepEqual(state.departure.positionKm, fixture.ship.spatial.positionKm);
  assert.deepEqual(state.destination.positionKm, fixture.station.spatial.positionKm);
  assert.equal(state.destination.hostBodyId, 'sol-earth');
  assert.equal(state.destination.placementKind, null);
  assert.equal(state.candidates[0].bodyId, 'sol-luna');
  assert.notEqual(state.candidates[0].sourceEpochMs, state.epochMs);
  assert.deepEqual(
    [state.motion.status, state.clearance.status, state.gravityAssist.status],
    ['unsupported', 'unsupported', 'unsupported']
  );
  assert.equal(JSON.stringify([fixture.ship, fixture.market, fixture.bodies]), before);
  const moon = response.bodies.find((body) => body.id === 'sol-luna');
  assert.equal(
    moon.spatial.epochMs,
    fixture.bodies.find((body) => body.id === 'sol-luna').spatial.epochMs
  );
});

test('navigation rejects unknown or caller-asserted ship basis even when labels and epochs match', async () => {
  const fixture = await navigationFixture();
  fixture.ship.spatial.coordinateBasisId = 'stellar:sol:catalog-cartesian:v1';
  fixture.ship.navigationPlacement = { trusted: true };
  const response = await new SolarSystemGetMessageHandler(fixture.ctx).buildResponse(
    fixture.request
  );
  assert.equal(response.navigationState.reason, 'BASIS_UNKNOWN');
  const validate = await navigationValidator;
  assert.equal(validate(response.navigationState), true, JSON.stringify(validate.errors));
  assert.equal(Object.hasOwn(response.navigationState, 'departure'), false);
  assert.equal(fixture.ship.spatial.epochMs, Date.parse('2026-11-14T00:00:00.000Z'));
});

test('navigation fails closed for invalid selectors, unsupported systems and ownership', async () => {
  const fixture = await navigationFixture();
  const handler = new SolarSystemGetMessageHandler(fixture.ctx);
  for (const navigation of [
    null,
    [],
    { ...fixture.request.navigation, candidateBodyId: [] },
    { ...fixture.request.navigation, coordinateBasisId: 'stellar:sol:catalog-cartesian:v1' },
  ]) {
    const response = await handler.buildResponse({ ...fixture.request, navigation });
    assert.equal(response.navigationState.reason, 'NAVIGATION_REQUEST_INVALID');
  }
  assert.equal(
    (await handler.buildResponse({ ...fixture.request, solarSystemId: 'alpha-centauri' }))
      .navigationState.reason,
    'SYSTEM_UNSUPPORTED'
  );
  fixture.ship.ownership.playerId = 'another-player';
  assert.equal(
    (await handler.buildResponse(fixture.request)).navigationState.reason,
    'SHIP_NOT_OWNED'
  );
});

test('navigation revokes a trusted proof when a character ship write occurs', async () => {
  const fixture = await navigationFixture();
  await fixture.certify();
  await fixture.ctx.updateCharacterAsync('FixturePilot', 'fixture-character', {
    ships: [fixture.ship],
  });
  assert.equal(
    (await new SolarSystemGetMessageHandler(fixture.ctx).buildResponse(fixture.request))
      .navigationState.reason,
    'BASIS_UNKNOWN'
  );
});

test('navigation rejects changed source models, station anchors, inactive placement and unsupported candidates', async () => {
  for (const [mutate, reason] of [
    [
      (f) => {
        f.bodies.find((body) => body.id === 'sol-mars').orbitalElements.eccentricity += 0.01;
        f.request.navigation.candidateBodyId = 'sol-mars';
      },
      'SOURCE_UNVERIFIED',
    ],
    [
      (f) => {
        f.market.trajectory.orbit.anchorBodyId = 'sol-moon';
      },
      'STATION_HOST_UNVERIFIED',
    ],
    [
      (f) => {
        f.market.stationPlacement = {
          kind: 'body-orbit',
          primaryBodyId: 'sol-earth',
          activation: 'metadata-only',
          stationKeeping: false,
          provenance: 'fixture',
          reason: 'fixture',
        };
      },
      'STATION_PLACEMENT_UNSUPPORTED',
    ],
    [
      (f) => {
        f.request.navigation.candidateBodyId = 'sol-halley';
      },
      'EVALUATION_UNSUPPORTED',
    ],
  ]) {
    const fixture = await navigationFixture();
    await fixture.certify();
    mutate(fixture);
    const response = await new SolarSystemGetMessageHandler(fixture.ctx).buildResponse(
      fixture.request
    );
    assert.equal(response.navigationState.reason, reason);
  }
});

test('navigation pins source reads, rejects concurrent change and surfaces database failure', async () => {
  const fixture = await navigationFixture();
  await fixture.certify();
  const characters = fixture.ctx.charactersByPlayer.get('fixturepilot');
  let reads = 0;
  fixture.ctx.databaseService = {
    getCharacters: async () => structuredClone(characters),
    getMarkets: async () => [structuredClone(fixture.market)],
    getCelestialBodies: async () => {
      const bodies = structuredClone(fixture.bodies);
      if (++reads === 2) bodies[0].updatedAt = '2026-11-15T00:00:00.000Z';
      return bodies;
    },
  };
  const handler = new SolarSystemGetMessageHandler(fixture.ctx);
  assert.equal(
    (await handler.buildResponse(fixture.request)).navigationState.reason,
    'SOURCES_CHANGED'
  );
  fixture.ctx.databaseService.getCharacters = async () => {
    throw new Error('unavailable');
  };
  const failure = await handler.buildResponse(fixture.request);
  assert.equal(failure.success, false);
  assert.equal(failure.navigationState.reason, 'NAVIGATION_READ_FAILED');
});

test('navigation proof is process-context scoped and does not survive a new context', async () => {
  const fixture = await navigationFixture();
  await fixture.certify();
  const fresh = new MessageHandlerContext({
    log: () => {},
    registeredPlayers: fixture.ctx.registeredPlayers,
    charactersByPlayer: fixture.ctx.charactersByPlayer,
    celestialBodiesById: fixture.ctx.celestialBodiesById,
    marketsByKey: fixture.ctx.marketsByKey,
  });
  assert.equal(
    (await new SolarSystemGetMessageHandler(fresh).buildResponse(fixture.request)).navigationState
      .reason,
    'BASIS_UNKNOWN'
  );
});

test('navigation rejects a concurrent ship write during evaluation or placement registration', async () => {
  for (const registering of [false, true]) {
    const fixture = await navigationFixture();
    if (!registering) await fixture.certify();
    const characters = fixture.ctx.charactersByPlayer.get('fixturepilot');
    let reads = 0;
    fixture.ctx.databaseService = {
      getCharacters: async () => {
        if (++reads === 2) {
          await fixture.ctx.updateCharacterAsync('FixturePilot', 'fixture-character', {
            ships: [fixture.ship],
          });
        }
        return structuredClone(characters);
      },
      getMarkets: async () => [structuredClone(fixture.market)],
      getCelestialBodies: async () => structuredClone(fixture.bodies),
      updateCharacter: async () => {},
    };
    if (registering) {
      await assert.rejects(fixture.certify(), (error) => error.reason === 'BASIS_UNKNOWN');
    } else {
      const state = (
        await new SolarSystemGetMessageHandler(fixture.ctx).buildResponse(fixture.request)
      ).navigationState;
      assert.equal(state.reason, 'BASIS_UNKNOWN');
    }
  }
});

test('navigation rejects an altered or unsupported position epoch and requires all selected sources', async () => {
  const fixture = await navigationFixture();
  await fixture.certify();
  const handler = new SolarSystemGetMessageHandler(fixture.ctx);
  fixture.ship.spatial.epochMs = Date.parse('2100-01-01T00:00:00.000Z');
  assert.equal(
    (await handler.buildResponse(fixture.request)).navigationState.reason,
    'POSITION_EPOCH_UNSUPPORTED'
  );
  fixture.ship.spatial.epochMs = Date.parse('2026-11-14T00:00:00.001Z');
  assert.equal(
    (await handler.buildResponse(fixture.request)).navigationState.reason,
    'BASIS_UNKNOWN'
  );
  const missing = await navigationFixture();
  await missing.certify();
  missing.ctx.celestialBodiesById.delete('sol-luna');
  const failure = await new SolarSystemGetMessageHandler(missing.ctx).buildResponse(
    missing.request
  );
  assert.equal(failure.navigationState.reason, 'EVALUATION_UNSUPPORTED');
  assert.equal(Object.hasOwn(failure.navigationState, 'destination'), false);
});

test('navigation verifies the source position against the model at the documented one-metre threshold', async () => {
  for (const [offsetKm, status] of [
    [0.0009, 'supported'],
    [0.0011, 'unsupported'],
  ]) {
    const fixture = await navigationFixture();
    await fixture.certify();
    fixture.request.navigation.candidateBodyId = 'sol-mars';
    fixture.bodies.find((body) => body.id === 'sol-mars').spatial.positionKm.x += offsetKm;
    const state = (
      await new SolarSystemGetMessageHandler(fixture.ctx).buildResponse(fixture.request)
    ).navigationState;
    assert.equal(state.status, status);
    if (status === 'unsupported') assert.equal(state.reason, 'SOURCE_UNVERIFIED');
  }
});

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
  assert.equal(response.solarSystem.settlementName, null);
  assert.deepEqual(response.solarSystem.aliases, ['Alpha Centauri A']);
  assert.ok(response.bodies.length >= 6);
  assert.ok(response.stars.length === 3);
  assert.ok(response.stars.every((s) => s.bodyType === 'star'));
  assert.equal(socket.events[0].eventName, SOLAR_SYSTEM_GET_RESPONSE_EVENT);
});

test('SolarSystemGetMessageHandler returns the full expanded Sol catalog', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  const socket = createMockSocket();
  const handler = new SolarSystemGetMessageHandler(context);

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
  });

  assert.equal(response.success, true);
  assert.equal(response.bodies.length, SOL_SYSTEM_CATALOG.length);
  assert.equal(
    response.bodies.length,
    1 + 8 + 5 + 4 + JPL_SATELLITE_SNAPSHOT.records.length + MPC_COMET_SNAPSHOT.records.length
  );
  assert.equal(
    response.bodies.filter((body) => body.bodyType === 'comet').length,
    MPC_COMET_SNAPSHOT.records.length
  );
  assert.equal(
    response.bodies.filter((body) => body.bodyType === 'moon').length,
    JPL_SATELLITE_SNAPSHOT.records.length
  );
  assert.equal(
    response.bodies.some((body) => body.bodyType === 'asteroid'),
    false
  );

  const candidate = response.bodies.find((body) => body.id === 'sol-2026-ed138');
  assert.ok(candidate);
  assert.equal(candidate.bodyType, 'tno');
  assert.match(candidate.discovery.discoveryNotes, /dwarf-planet candidate/i);
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
  seedPlayer(context, {
    playerName: 'PilotOne',
    characters: [{ id: 'char-1', characterName: 'Pilot' }],
  });
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
    playerName: 'PilotOne',
    solarSystemId: 'sol',
  });
  const moon = response.bodies.find((entry) => entry.id === body.id);
  assert.equal(moon.bodyType, 'moon');
  assert.equal(moon.surfaceArchetype, 'icy-moon');
  assert.deepEqual(moon.physicalCatalog, physicalCatalog);
  assert.deepEqual(moon.physical, body.physical);
  assert.equal(moon.visualization, undefined);
});
