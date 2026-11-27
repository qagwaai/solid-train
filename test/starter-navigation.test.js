'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { characterSchema, celestialBodySchema } = require('../src/db/models');
const { CharacterAddMessageHandler } = require('../src/handlers/character-add-message-handler');
const { CharacterListMessageHandler } = require('../src/handlers/character-list-message-handler');
const { GameJoinMessageHandler } = require('../src/handlers/game-join-message-handler');
const { MissionUpsertMessageHandler } = require('../src/handlers/mission-upsert-message-handler');
const {
  CelestialBodyListMessageHandler,
} = require('../src/handlers/celestial-body-list-message-handler');
const { registerSocketHandlers } = require('../src/handlers/socket-handler-registry');
const { getNavigationStateAsync } = require('../src/handlers/context/navigation-state-service');
const {
  NavigationRouteEdgeBatchMessageHandler,
} = require('../src/handlers/navigation-route-edge-batch-message-handler');
const { navigationFixture } = require('../test-support/navigation-test-helpers');
const { createMockSocket } = require('../test-support/message-handler-test-helpers');
const Parser = require('@apidevtools/swagger-parser');
const path = require('node:path');
const { createSchemaValidator } = require('../src/model/schema-validator');
const playerCharacterService = require('../src/db/service/player-character-service');

test('new starter survives storage rehydration and can preview a route', async () => {
  const f = await navigationFixture();
  const ctx = f.ctx;
  ctx.refreshCharacterPresence = () => {};
  ctx.getPlayer('FixturePilot').sessionKey = 'fixture-session';
  let id = 0;
  ctx.createId = () => `starter-${++id}`;
  const epochMs = Date.parse('2026-11-23T00:00:00.000Z');
  ctx.gameClock = {
    read: () => ({
      status: 'supported',
      epochMs,
      running: false,
      generation: 1,
      lineage: 'fixture-clock',
      timeScaleId: 'stellar:unix-ms-uniform:v1',
      durability: 'durable-mongo-game-state',
    }),
    persistAsync: async () => true,
  };
  let stored;
  const asteroids = new Map();
  ctx.databaseService = {
    async addItems() {},
    async addStarterCharacter(_playerName, character) {
      const doc = new mongoose.Document(
        {
          ...character,
          ships: character.ships.map((ship) => ({ ...ship, shipName: ship.name })),
        },
        characterSchema
      );
      await doc.validate();
      stored = doc.toObject();
      return { characters: [stored] };
    },
    async getCharacters() {
      return stored ? [structuredClone(stored)] : [];
    },
    async getPlayerByName() {
      return {
        playerId: 'fixture-player',
        playerName: 'FixturePilot',
        sessionKey: 'fixture-session',
      };
    },
    async getMissions() {
      return structuredClone(stored.missions);
    },
    async addOrUpdateMission(_player, _character, mission) {
      const index = stored.missions.findIndex((entry) => entry.missionId === mission.missionId);
      if (index >= 0) stored.missions[index] = structuredClone(mission);
      else stored.missions.push(structuredClone(mission));
      return { characters: [structuredClone(stored)] };
    },
    async getCelestialBodies(query) {
      if (query.missionId) return [...asteroids.values()].map((item) => structuredClone(item));
      return structuredClone(f.bodies);
    },
    async getMarkets() {
      return structuredClone(f.markets);
    },
    async addOrUpdateCelestialBody(body) {
      const doc = new mongoose.Document(body, celestialBodySchema);
      await doc.validate();
      const result = doc.toObject();
      asteroids.set(body.id, result);
      return structuredClone(result);
    },
    async findCelestialBodiesNearPosition(query) {
      return [...asteroids.values()]
        .filter(
          (body) =>
            body.createdByCharacterId === query.createdByCharacterId &&
            body.missionId === query.missionId &&
            body.spatial.solarSystemId === query.solarSystemId &&
            (!query.stateValues || query.stateValues.includes(body.state))
        )
        .map((body) => ({
          celestialBody: structuredClone(body),
          distanceKm: Math.hypot(
            body.spatial.positionKm.x - query.positionKm.x,
            body.spatial.positionKm.y - query.positionKm.y,
            body.spatial.positionKm.z - query.positionKm.z
          ),
        }))
        .filter((entry) => entry.distanceKm <= query.distanceKm);
    },
  };
  const listeners = new Map();
  const events = [];
  const socket = {
    on(name, listener) {
      listeners.set(name, listener);
    },
    emit(name, payload) {
      events.push({ name, payload });
    },
  };
  const mission = new MissionUpsertMessageHandler(ctx);
  registerSocketHandlers(
    socket,
    {
      characterAddMessageHandler: new CharacterAddMessageHandler(ctx),
      gameJoinMessageHandler: new GameJoinMessageHandler(ctx),
      missionUpsertMessageHandler: mission,
      celestialBodyListMessageHandler: new CelestialBodyListMessageHandler(ctx),
      navigationRouteEdgeBatchMessageHandler: new NavigationRouteEdgeBatchMessageHandler(ctx),
    },
    ctx
  );
  const correlationId = '36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66';
  const base = { playerName: 'FixturePilot', sessionKey: 'fixture-session', correlationId };
  async function send(event, request, responseEvent) {
    const previous = events.length;
    await listeners.get(event)(request);
    const emitted = events.slice(previous).find((event) => event.name === responseEvent);
    assert.ok(emitted, `No ${responseEvent} emitted`);
    return emitted.payload;
  }
  const createRequest = {
    ...base,
    characterName: 'New Pilot',
    requestIdentity: {
      operation: 'character-add',
      entityType: 'character',
      containerId: 'fixture-player',
    },
  };
  const created = await send('character-add-request', createRequest, 'character-add-response');
  assert.equal(created.success, true, JSON.stringify(created));
  assert.equal(stored.starterEpochMs, epochMs);
  assert.equal(stored.ships[0].navigationPlacement.placementRule, 'starter-belt-sol-xy-v1');
  assert.equal(stored.ships[0].navigationPlacement.transactionId, undefined);
  ctx.cacheCharacters('FixturePilot', [structuredClone(stored)]);
  const roster = await new CharacterListMessageHandler(ctx).buildResponse({
    playerName: 'FixturePilot',
    sessionKey: 'fixture-session',
    correlationId: '36ea198f-0df8-4fa9-82b3-7bdfe0d9fd66',
    requestIdentity: {
      operation: 'character-list',
      entityType: 'character',
      containerId: 'fixture-player',
    },
  });
  assert.equal(roster.success, true, JSON.stringify(roster));
  assert.equal(roster.characters[0].creditLedger[0].id, 'starter-1-starting-credits');
  const joinRequest = {
    ...base,
    characterId: created.characterId,
    requestIdentity: {
      operation: 'game-join',
      entityType: 'game-session',
      containerId: created.characterId,
    },
  };
  const joined = await send('game-join-request', joinRequest, 'game-join-response');
  assert.equal(joined.success, true, JSON.stringify(joined));
  const activationRequest = {
    ...base,
    characterId: created.characterId,
    missionId: 'first-target',
    status: 'active',
    requestIdentity: {
      operation: 'mission-upsert',
      entityType: 'mission',
      containerId: created.characterId,
    },
  };
  const activated = await send(
    'mission-upsert-request',
    activationRequest,
    'mission-upsert-response'
  );
  assert.equal(activated.success, true, JSON.stringify({ activated, logs: f.logs }));
  assert.equal(stored.missions[0].status, 'active');
  assert.equal(asteroids.size, 10);
  const fieldRequest = {
    ...base,
    solarSystemId: 'sol',
    positionKm: stored.ships[0].spatial.positionKm,
    distanceKm: 40,
    createdByCharacterId: created.characterId,
    missionId: 'first-target',
    requestIdentity: {
      operation: 'celestial-body-list',
      entityType: 'celestial-body',
      containerId: 'sol',
    },
  };
  const field = await send(
    'celestial-body-list-request',
    fieldRequest,
    'celestial-body-list-response'
  );
  assert.equal(field.success, true, JSON.stringify(field));
  assert.equal(field.total, 10);
  assert.equal(field.hasMore, false);
  assert.deepEqual(
    new Set(field.celestialBodies.map((body) => body.id)),
    new Set(asteroids.keys())
  );
  const state = await getNavigationStateAsync(ctx, 'FixturePilot', 'sol', {
    shipId: stored.ships[0].id,
    destinationMarketId: 'sol-pluto-orbit',
  });
  assert.equal(state.navigationState.status, 'supported', JSON.stringify(state.navigationState));
  assert.equal(state.navigationState.departure.provenance.sourceKind, 'starter-belt');
  const api = await Parser.dereference(path.join(__dirname, '..', 'api', 'openapi.yaml'));
  const schema =
    api.paths['/socket/solar-system-get'].post.responses['200'].content['application/json'].schema
      .properties.navigationState;
  const validate = createSchemaValidator({ allErrors: true }).compile(schema);
  assert.equal(validate(state.navigationState), true, JSON.stringify(validate.errors));
  ctx.gameClock.persistAsync = async () => false;
  const failedCreation = await send(
    'character-add-request',
    {
      ...createRequest,
      characterName: 'Second Pilot',
    },
    'character-add-response'
  );
  assert.equal(failedCreation.success, false);
  assert.equal(Object.hasOwn(failedCreation, 'characterName'), false);
  assert.equal(Object.hasOwn(failedCreation, 'characterId'), false);
  const validateCreation = createSchemaValidator({ allErrors: true }).compile(
    api.paths['/socket/character-add'].post.responses['200'].content['application/json'].schema
  );
  assert.equal(validateCreation(failedCreation), true, JSON.stringify(validateCreation.errors));
  assert.equal(validateCreation({ ...failedCreation, success: true }), false);
  assert.equal(validateCreation({ ...failedCreation, characterId: 'invented-id' }), false);
  const routeRequest = {
    playerName: 'FixturePilot',
    sessionKey: 'fixture-session',
    operation: 'navigation-route-edge-batch.v1',
    phase: 'bootstrap',
    correlationId,
    requestIdentity: { entityType: 'solar-system', containerId: 'sol' },
    selection: {
      solarSystemId: 'sol',
      shipId: stored.ships[0].id,
      destination: { kind: 'market', id: 'sol-pluto-orbit' },
      candidateBodyIds: ['sol-earth'],
    },
    scenarioCruiseSpeedKmPerSec: 12466.489225,
    profileId: 'stellar-sol-station-100au-v1',
    navigationMode: 'bounded-preview-100au',
    jobs: [
      { jobId: 'direct', prefixBodyIds: [], target: { kind: 'market', id: 'sol-pluto-orbit' } },
    ],
  };
  const route = await send(
    'navigation-route-edge-batch-request',
    routeRequest,
    'navigation-route-edge-batch-response'
  );
  assert.equal(route.success, true, JSON.stringify(route));
  assert.equal(route.batch.capture.flightAuthorized, false);
  for (const [operation, request, response] of [
    ['/socket/character-add', createRequest, created],
    ['/socket/game-join', joinRequest, joined],
    ['/socket/mission-upsert', activationRequest, activated],
    ['/socket/celestial-body-list', fieldRequest, field],
    ['/socket/navigation-route-edge-batch', routeRequest, route],
  ]) {
    const endpoint = api.paths[operation].post;
    for (const [schema, value] of [
      [endpoint.requestBody.content['application/json'].schema, request],
      [endpoint.responses['200'].content['application/json'].schema, response],
    ]) {
      const validateMessage = createSchemaValidator({ allErrors: true }).compile(schema);
      assert.equal(validateMessage(value), true, JSON.stringify(validateMessage.errors));
    }
  }
  for (const [bodyId, body] of asteroids) {
    assert.match(bodyId, /^cb-starter-1-first-target-a(?:10|[1-9])$/);
    assert.equal(body.spatial.epochMs, epochMs);
    const position = stored.ships[0].spatial.positionKm;
    assert.ok(
      Math.hypot(
        body.spatial.positionKm.x - position.x,
        body.spatial.positionKm.y - position.y,
        body.spatial.positionKm.z - position.z
      ) < 21
    );
  }
  const missingId = asteroids.keys().next().value;
  const repeated = await send(
    'mission-upsert-request',
    activationRequest,
    'mission-upsert-response'
  );
  assert.equal(repeated.success, true, JSON.stringify(repeated));
  assert.equal(asteroids.size, 10);
  asteroids.delete(missingId);
  const incomplete = await send(
    'mission-upsert-request',
    activationRequest,
    'mission-upsert-response'
  );
  assert.equal(incomplete.success, false);
  assert.equal(asteroids.has(missingId), false);
  asteroids.clear();
  const empty = await send(
    'celestial-body-list-request',
    fieldRequest,
    'celestial-body-list-response'
  );
  assert.equal(empty.success, true);
  assert.deepEqual(empty.celestialBodies, []);
  const missing = await send(
    'mission-upsert-request',
    activationRequest,
    'mission-upsert-response'
  );
  assert.equal(missing.success, false);
  assert.equal(asteroids.size, 0);
  ctx.databaseService.findCelestialBodiesNearPosition = async () => {
    throw new Error('test failure');
  };
  const failed = await send(
    'celestial-body-list-request',
    fieldRequest,
    'celestial-body-list-response'
  );
  assert.equal(failed.success, false);
  assert.deepEqual(failed.celestialBodies, []);
  stored.ships[0].spatial.positionKm.x += 1;
  const invalid = await getNavigationStateAsync(ctx, 'FixturePilot', 'sol', {
    shipId: stored.ships[0].id,
    destinationMarketId: 'sol-pluto-orbit',
  });
  assert.equal(invalid.navigationState.status, 'unsupported');
});

test('starter activation does not seed when mission storage fails or does not acknowledge the write', async () => {
  for (const failure of ['read', 'write']) {
    const f = await navigationFixture();
    const ctx = f.ctx;
    ctx.refreshCharacterPresence = () => {};
    const character = ctx.findCharacter('FixturePilot', 'fixture-character');
    character.starterEpochMs = Date.parse('2026-11-23T00:00:00.000Z');
    character.missions = [{ missionId: 'first-target', status: 'available' }];
    let fieldWrites = 0;
    ctx.databaseService = {
      async getMissions() {
        if (failure === 'read') throw new Error('mission read failed');
        return structuredClone(character.missions);
      },
      async addOrUpdateMission() {
        return null;
      },
      async getCelestialBodies() {
        return [];
      },
      async addOrUpdateCelestialBody() {
        fieldWrites++;
      },
    };
    const response = await new MissionUpsertMessageHandler(ctx).handle(createMockSocket(), {
      playerName: 'FixturePilot',
      characterId: 'fixture-character',
      missionId: 'first-target',
      status: 'active',
    });
    assert.equal(response.success, false);
    assert.equal(character.missions[0].status, 'available');
    assert.equal(fieldWrites, 0);
  }
});

test('starter creation stops before creating items if the clock checkpoint fails', async () => {
  const f = await navigationFixture();
  f.ctx.refreshCharacterPresence = () => {};
  f.ctx.createId = () => 'new-character';
  f.ctx.gameClock = {
    read: () => ({
      status: 'supported',
      epochMs: Date.parse('2026-11-23T00:00:00.000Z'),
      running: true,
      generation: 1,
      lineage: 'fixture-clock',
      timeScaleId: 'stellar:unix-ms-uniform:v1',
      durability: 'durable-mongo-game-state',
    }),
    persistAsync: async () => false,
  };
  const response = await new CharacterAddMessageHandler(f.ctx).handle(createMockSocket(), {
    playerName: 'FixturePilot',
    characterName: 'New Pilot',
  });
  assert.equal(response.success, false);
  assert.equal(f.ctx.itemsById.size, 0);
});

test('ordinary character writes cannot issue starter navigation provenance', async () => {
  let written;
  const player = {
    async findOneAndUpdate(_query, update) {
      written = update.$push.characters;
      return { toObject: () => ({}) };
    },
  };
  await playerCharacterService.addCharacter(
    { buildPlayerNameQuery: () => ({}), log: () => {} },
    player,
    'FixturePilot',
    { ships: [{ id: 'ship', navigationPlacement: { placementRule: 'starter-belt-sol-xy-v1' } }] }
  );
  assert.equal(written.ships[0].navigationPlacement, undefined);
});
