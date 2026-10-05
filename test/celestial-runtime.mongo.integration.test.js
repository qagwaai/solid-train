'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const Ajv = require('ajv');
const Parser = require('@apidevtools/swagger-parser');
const { createServer } = require('../src/server');
const { DatabaseService } = require('../src/db/service');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { createCelestialBody } = require('../test-support/message-handler-test-helpers');
const {
  listen,
  connectClient,
  waitForEvent,
  closeClient,
  registerAndLogin,
} = require('../test-support/socket-test-helpers');
const { LOGIN_EVENT, LOGIN_RESPONSE_EVENT } = require('../src/model/login');
const {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
} = require('../src/model/character-add');
const {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
} = require('../src/model/celestial-body-list');
const {
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
} = require('../src/model/celestial-body-upsert');
const {
  SOLAR_SYSTEM_GET_REQUEST_EVENT,
  SOLAR_SYSTEM_GET_RESPONSE_EVENT,
} = require('../src/model/solar-system-get');

let mongoHarness;

test.before(async () => {
  mongoHarness = await createMongoTestHarness();
});

test.after(async () => {
  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

function createRequestMetadata(operation, containerId) {
  return {
    correlationId: randomUUID(),
    requestIdentity: {
      operation,
      entityType: operation === 'solar-system-get' ? 'solar-system' : 'celestial-body',
      containerId,
    },
  };
}

function emitAndWait(client, requestEvent, responseEvent, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(responseEvent, onResponse);
      reject(new Error(`Timed out waiting for ${responseEvent}`));
    }, 10000);
    const onResponse = (response) => {
      clearTimeout(timeout);
      resolve(response);
    };
    client.once(responseEvent, onResponse);
    client.emit(requestEvent, payload);
  });
}

async function closeRuntime(runtime) {
  if (runtime) {
    await new Promise((resolve) => runtime.io.close(resolve));
  }
}

function compileRuntimeResponseValidators(contract) {
  const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
  const operations = [
    ['/socket/solar-system-get', SOLAR_SYSTEM_GET_RESPONSE_EVENT],
    ['/socket/celestial-body-list', CELESTIAL_BODY_LIST_RESPONSE_EVENT],
    ['/socket/celestial-body-upsert', CELESTIAL_BODY_UPSERT_RESPONSE_EVENT],
  ];
  const validators = new Map();
  for (const [operationPath, responseEvent] of operations) {
    const schema =
      contract.paths[operationPath].post.responses['200'].content['application/json'].schema;
    validators.set(responseEvent, ajv.compile(schema));
  }
  return validators;
}

function assertSchemaValid(validators, eventName, response) {
  const validate = validators.get(eventName);
  assert.ok(validate, `No response schema for ${eventName}`);
  assert.equal(
    validate(response),
    true,
    `${eventName} schema errors: ${JSON.stringify(validate.errors)}`
  );
}

test(
  'authenticated celestial socket operations match schemas and survive Mongo reconnect',
  { timeout: 120000 },
  async () => {
    const contract = await Parser.dereference(path.resolve(__dirname, '../api/openapi.yaml'));
    const validators = compileRuntimeResponseValidators(contract);
    const username = 'CelestialRuntimePilot';
    const password = 'celestial-runtime-password';
    const runtimeOptions = {
      databaseService: mongoHarness.databaseService,
      initializeContext: false,
    };
    let runtime = createServer(runtimeOptions);
    let client;
    let disconnected = false;

    try {
      const port = await listen(runtime.server);
      client = connectClient(port);
      await waitForEvent(client, 'connect');
      const login = await registerAndLogin(
        client,
        username,
        'celestial-runtime@example.com',
        password
      );

      const character = await emitAndWait(
        client,
        CHARACTER_ADD_REQUEST_EVENT,
        CHARACTER_ADD_RESPONSE_EVENT,
        { playerName: username, sessionKey: login.sessionKey, characterName: 'Catalog Pilot' }
      );
      assert.equal(character.success, true);

      const systemRequest = {
        playerName: username,
        sessionKey: login.sessionKey,
        solarSystemId: 'alpha-centauri',
        ...createRequestMetadata('solar-system-get', 'alpha-centauri'),
      };
      const systemResponse = await emitAndWait(
        client,
        SOLAR_SYSTEM_GET_REQUEST_EVENT,
        SOLAR_SYSTEM_GET_RESPONSE_EVENT,
        systemRequest
      );
      assert.equal(systemResponse.success, true);
      assertSchemaValid(validators, SOLAR_SYSTEM_GET_RESPONSE_EVENT, systemResponse);
      const companion = systemResponse.stars.find(
        (body) => body.id === 'alpha-centauri-star-secondary'
      );
      assert.ok(companion);
      assert.equal(companion.parentBodyId, 'alpha-centauri-star-primary');
      assert.equal(companion.orbitalElements?.anchorBodyId ?? null, null);

      const bodiesToUpsert = [
        createCelestialBody({
          id: 'runtime-alpha-star-zero',
          catalogId: 'runtime-alpha-star-zero',
          sourceScanId: 'runtime-alpha-star-zero',
          createdByCharacterId: character.characterId,
          bodyType: 'star',
          surfaceArchetype: 'star',
          displayName: 'Runtime Zero Star',
          spectralClass: 'M',
          luminositySolar: 0,
          spatial: {
            solarSystemId: 'alpha-centauri',
            frame: 'barycentric',
            positionKm: { x: 101, y: -202, z: 303 },
            epochMs: 1780000000000,
          },
        }),
        createCelestialBody({
          id: 'runtime-alpha-star-unknown',
          catalogId: 'runtime-alpha-star-unknown',
          sourceScanId: 'runtime-alpha-star-unknown',
          createdByCharacterId: character.characterId,
          bodyType: 'star',
          surfaceArchetype: 'star',
          displayName: 'Runtime Unknown Star',
          spatial: {
            solarSystemId: 'alpha-centauri',
            frame: 'barycentric',
            positionKm: { x: -404, y: 505, z: -606 },
            epochMs: 1780000000000,
          },
        }),
      ];
      delete bodiesToUpsert[1].spectralClass;
      delete bodiesToUpsert[1].luminositySolar;

      for (const body of bodiesToUpsert) {
        const upsertResponse = await emitAndWait(
          client,
          CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
          CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
          {
            playerName: username,
            sessionKey: login.sessionKey,
            ...createRequestMetadata('celestial-body-upsert', body.id),
            celestialBody: body,
          }
        );
        assert.equal(upsertResponse.success, true);
        assertSchemaValid(validators, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT, upsertResponse);
      }

      const listResponse = await emitAndWait(
        client,
        CELESTIAL_BODY_LIST_REQUEST_EVENT,
        CELESTIAL_BODY_LIST_RESPONSE_EVENT,
        {
          playerName: username,
          sessionKey: login.sessionKey,
          solarSystemId: 'alpha-centauri',
          ...createRequestMetadata('celestial-body-list', 'alpha-centauri'),
        }
      );
      assert.equal(listResponse.success, true);
      assertSchemaValid(validators, CELESTIAL_BODY_LIST_RESPONSE_EVENT, listResponse);

      await closeClient(client);
      client = null;
      await closeRuntime(runtime);
      runtime = null;
      await mongoHarness.mongoConnection.disconnect();
      disconnected = true;
      await mongoHarness.mongoConnection.connect();
      disconnected = false;

      const freshService = new DatabaseService();
      const storedZero = await freshService.getCelestialBodyById('runtime-alpha-star-zero');
      const storedUnknown = await freshService.getCelestialBodyById('runtime-alpha-star-unknown');
      assert.equal(storedZero.spatial.solarSystemId, 'alpha-centauri');
      assert.deepEqual(storedZero.spatial.positionKm, { x: 101, y: -202, z: 303 });
      assert.equal(storedZero.spectralClass, 'M');
      assert.equal(storedZero.luminositySolar, 0);
      assert.equal(storedUnknown.spatial.solarSystemId, 'alpha-centauri');
      assert.deepEqual(storedUnknown.spatial.positionKm, { x: -404, y: 505, z: -606 });
      assert.equal(storedUnknown.spectralClass, null);
      assert.equal(storedUnknown.luminositySolar, null);

      runtime = createServer(runtimeOptions);
      const freshPort = await listen(runtime.server);
      client = connectClient(freshPort);
      await waitForEvent(client, 'connect');
      const loginPromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
      client.emit(LOGIN_EVENT, { playerName: username, password });
      const freshLogin = await loginPromise;
      assert.equal(freshLogin.success, true);

      const freshSystemResponse = await emitAndWait(
        client,
        SOLAR_SYSTEM_GET_REQUEST_EVENT,
        SOLAR_SYSTEM_GET_RESPONSE_EVENT,
        {
          ...systemRequest,
          sessionKey: freshLogin.sessionKey,
        }
      );
      assert.equal(freshSystemResponse.success, true);
      assertSchemaValid(validators, SOLAR_SYSTEM_GET_RESPONSE_EVENT, freshSystemResponse);
      for (const [id, expectedSpectralClass, expectedLuminosity] of [
        ['runtime-alpha-star-zero', 'M', 0],
        ['runtime-alpha-star-unknown', null, null],
      ]) {
        const persistedInGet = freshSystemResponse.bodies.find((body) => body.id === id);
        assert.ok(persistedInGet, `${id} in solar-system-get`);
        assert.equal(persistedInGet.spectralClass, expectedSpectralClass);
        assert.equal(persistedInGet.luminositySolar, expectedLuminosity);
      }

      const freshListResponse = await emitAndWait(
        client,
        CELESTIAL_BODY_LIST_REQUEST_EVENT,
        CELESTIAL_BODY_LIST_RESPONSE_EVENT,
        {
          playerName: username,
          sessionKey: freshLogin.sessionKey,
          solarSystemId: 'alpha-centauri',
          ...createRequestMetadata('celestial-body-list', 'alpha-centauri'),
        }
      );
      assert.equal(freshListResponse.success, true);
      assertSchemaValid(validators, CELESTIAL_BODY_LIST_RESPONSE_EVENT, freshListResponse);
      assert.deepEqual(
        freshListResponse.celestialBodies.find((body) => body.id === 'runtime-alpha-star-zero')
          .spatial.positionKm,
        { x: 101, y: -202, z: 303 }
      );
      assert.equal(
        freshListResponse.celestialBodies.find((body) => body.id === 'runtime-alpha-star-unknown')
          .luminositySolar,
        null
      );
    } finally {
      if (client) {
        await closeClient(client);
      }
      await closeRuntime(runtime);
      if (disconnected) {
        await mongoHarness.mongoConnection.connect();
      }
    }
  }
);
