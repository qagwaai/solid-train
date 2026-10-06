'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Ajv = require('ajv');
const Parser = require('@apidevtools/swagger-parser');
const {
  CelestialBodyUpsertMessageHandler,
} = require('../src/handlers/celestial-body-upsert-message-handler');
const {
  BODY_TYPE_ARCHETYPES,
  SURFACE_ARCHETYPE_VALUES,
} = require('../src/model/celestial-body-upsert');
const { validateCelestialBody } = require('../src/model/celestial-body-validation');
const {
  buildSeededCelestialBodiesForSolarSystem,
  computeRelativePositionKm,
} = require('../src/model/solar-system-celestial-seed');
const { getHygSystems, parseHygCsv } = require('../src/model/hyg-star-catalog');
const { generateSystemBodies } = require('../src/model/procedural-system-generator');
const {
  createTestContext,
  createCelestialBody,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function createHandler() {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'Pilot',
    characters: [{ id: 'char-1', characterName: 'Pilot' }],
  });
  return { context, handler: new CelestialBodyUpsertMessageHandler(context) };
}

async function bodySchemas() {
  const contract = await Parser.dereference(path.resolve(__dirname, '../api/openapi.yaml'));
  return [
    contract.paths['/socket/celestial-body-upsert'].post.requestBody.content['application/json']
      .schema.properties.celestialBody,
    contract.paths['/socket/celestial-body-list'].post.responses['200'].content['application/json']
      .schema.definitions.celestialBody,
    contract.paths['/socket/solar-system-get'].post.responses['200'].content['application/json']
      .schema.definitions.celestialBody,
  ];
}

test('all 63 bodyType/archetype combinations agree across runtime, request and canonical reads', async (t) => {
  const validators = (await bodySchemas()).map((schema) =>
    new Ajv({ allErrors: true }).compile(schema)
  );
  const { context, handler } = createHandler();
  let count = 0;
  for (const [bodyType, supported] of Object.entries(BODY_TYPE_ARCHETYPES)) {
    for (const surfaceArchetype of SURFACE_ARCHETYPE_VALUES) {
      const body = createCelestialBody({
        bodyType,
        surfaceArchetype,
        planetType: 'independent-custom-type',
      });
      const expected = supported.includes(surfaceArchetype);
      assert.equal(validateCelestialBody(body), expected, `${bodyType}/${surfaceArchetype}`);
      assert.equal(
        handler.buildResponse({ playerName: 'Pilot', celestialBody: body }).success,
        expected
      );
      for (const validate of validators)
        assert.equal(validate(body), expected, `${bodyType}/${surfaceArchetype}`);
      if (expected) {
        assert.equal(context.normalizeCelestialBody(body).bodyType, bodyType);
      } else {
        assert.throws(() => context.normalizeCelestialBody(body), /bodyType/);
      }
      count += 1;
    }
  }
  t.diagnostic(`${count} classification pairs checked across runtime and three schemas`);
});

test('canonical rejection mutations agree between upsert handler and fully resolved request schema', async (t) => {
  const validate = new Ajv({ allErrors: true, strictNumbers: true }).compile(
    (await bodySchemas())[0]
  );
  const { handler } = createHandler();
  const mutations = [
    ...[
      'bodyType',
      'surfaceArchetype',
      'spatial',
      'observability',
      'state',
      'catalogId',
      'createdAt',
    ].map((key) => [
      key,
      (body) => {
        delete body[key];
      },
    ]),
    [
      'null bodyType',
      (body) => {
        body.bodyType = null;
      },
    ],
    [
      'unknown bodyType',
      (body) => {
        body.bodyType = 'satellite';
      },
    ],
    [
      'prototype bodyType',
      (body) => {
        body.bodyType = '__proto__';
      },
    ],
    [
      'constructor bodyType',
      (body) => {
        body.bodyType = 'constructor';
      },
    ],
    [
      'null archetype',
      (body) => {
        body.surfaceArchetype = null;
      },
    ],
    [
      'unknown archetype',
      (body) => {
        body.surfaceArchetype = 'volcanic';
      },
    ],
    [
      'invalid pair',
      (body) => {
        body.bodyType = 'star';
      },
    ],
    [
      'missing frame',
      (body) => {
        delete body.spatial.frame;
      },
    ],
    [
      'missing epoch',
      (body) => {
        delete body.spatial.epochMs;
      },
    ],
    [
      'missing coordinate',
      (body) => {
        delete body.spatial.positionKm.z;
      },
    ],
    [
      'null position',
      (body) => {
        body.spatial.positionKm = null;
      },
    ],
    [
      'nonfinite coordinate',
      (body) => {
        body.spatial.positionKm.x = Infinity;
      },
    ],
    [
      'invalid visibility',
      (body) => {
        body.observability.visibility = 'unknown';
      },
    ],
    [
      'missing scan state',
      (body) => {
        delete body.observability.scanState;
      },
    ],
    [
      'implicit state',
      (body) => {
        body.state = 'ACTIVE';
      },
    ],
    [
      'active missing composition',
      (body) => {
        delete body.composition;
      },
    ],
    [
      'active null composition',
      (body) => {
        body.composition = null;
      },
    ],
    [
      'destroyed null composition',
      (body) => {
        body.state = 'destroyed';
        body.composition = null;
      },
    ],
    [
      'incomplete composition',
      (body) => {
        delete body.composition.rarity;
      },
    ],
    [
      'blank composition',
      (body) => {
        body.composition.material = ' ';
      },
    ],
    [
      'invalid unscanned composition',
      (body) => {
        body.state = 'unscanned';
        body.composition.rarity = 'Legendary';
      },
    ],
    [
      'invalid luminosity',
      (body) => {
        body.luminositySolar = -1;
      },
    ],
    [
      'invalid spectrum',
      (body) => {
        body.spectralClass = 5;
      },
    ],
    [
      'partial orbit',
      (body) => {
        body.orbitalElements = { semiMajorAxisKm: 1 };
      },
    ],
    [
      'zero period',
      (body) => {
        body.orbitalElements = {
          ...buildSeededCelestialBodiesForSolarSystem('sol')[1].orbitalElements,
          orbitalPeriodSec: 0,
        };
      },
    ],
    [
      'hyperbolic orbit',
      (body) => {
        body.orbitalElements = {
          ...buildSeededCelestialBodiesForSolarSystem('sol')[1].orbitalElements,
          eccentricity: 1,
        };
      },
    ],
    [
      'invalid epoch',
      (body) => {
        body.orbitalElements = {
          ...buildSeededCelestialBodiesForSolarSystem('sol')[1].orbitalElements,
          epoch: 'yesterday',
        };
      },
    ],
    [
      'missing identity',
      (body) => {
        delete body.id;
        body.missionId = null;
      },
    ],
  ];
  for (const [name, mutate] of mutations) {
    const body = createCelestialBody();
    mutate(body);
    assert.equal(validate(body), false, `schema: ${name}`);
    assert.equal(
      handler.buildResponse({ playerName: 'Pilot', celestialBody: body }).success,
      false,
      `runtime: ${name}`
    );
  }
  for (const composition of [
    undefined,
    null,
    { rarity: 'Common', material: 'ice', textureColor: '#eeeeee' },
  ]) {
    const body = createCelestialBody({ state: 'unscanned' });
    if (composition === undefined) delete body.composition;
    else body.composition = composition;
    assert.equal(validate(body), true);
    const response = handler.buildResponse({ playerName: 'Pilot', celestialBody: body });
    assert.equal(response.success, true);
  }
  t.diagnostic(
    `${mutations.length} rejection mutations and 3 unscanned composition cases validated`
  );
});

test('every current seeded producer validates canonical request and read schemas, with source stellar values', async (t) => {
  const validators = (await bodySchemas()).map((schema) =>
    new Ajv({ allErrors: true }).compile(schema)
  );
  const { context } = createHandler();
  let count = 0;
  for (const system of getHygSystems()) {
    const bodies = buildSeededCelestialBodiesForSolarSystem(
      system.systemId,
      '2026-05-18T00:00:00.000Z'
    );
    for (const body of bodies) {
      assert.equal(
        validateCelestialBody(body),
        true,
        `${body.id}: ${JSON.stringify(validateCelestialBody.errors)}`
      );
      const normalized = context.normalizeCelestialBody(body);
      for (const validate of validators) {
        assert.equal(validate(normalized), true, `${body.id}: ${JSON.stringify(validate.errors)}`);
      }
      if (body.bodyType === 'star') {
        const source = system.stars.find((star) => star.hygId === body.hygId);
        assert.ok(source, `HYG source for ${body.id}`);
        assert.equal(normalized.spectralClass, source.spectralClass);
        assert.equal(normalized.luminositySolar, source.luminositySolar);
      }
      count += 1;
    }
  }
  t.diagnostic(`${count} seeded bodies checked, including curated and procedural companions`);
});

test('unknown stellar source data remains null instead of becoming a generation measurement', () => {
  const [unknown] = parseHygCsv('id,spect,lum,system_id,system_role\n999,,,unknown,primary');
  assert.equal(unknown.spectralClass, null);
  assert.equal(unknown.luminositySolar, null);
  const generated = generateSystemBodies({ solarSystemId: 'unknown', stars: [unknown] });
  assert.equal(generated.stars[0].spectralClass, null);
  assert.equal(generated.stars[0].luminositySolar, null);
});

test('retrograde source periods retain their sign but propagate using duration, not a one-second clamp', () => {
  const body = buildSeededCelestialBodiesForSolarSystem('sol').find(
    (entry) => entry.id === 'sol-triton'
  );
  const orbit = body.orbitalElements;
  assert.ok(orbit.orbitalPeriodSec < -1);
  const asOf = Date.parse(orbit.epoch) + Math.abs(orbit.orbitalPeriodSec) * 250;
  assert.deepEqual(
    computeRelativePositionKm(orbit, asOf),
    computeRelativePositionKm(
      { ...orbit, orbitalPeriodSec: Math.abs(orbit.orbitalPeriodSec) },
      asOf
    )
  );
  assert.notDeepEqual(
    computeRelativePositionKm(orbit, asOf),
    computeRelativePositionKm({ ...orbit, orbitalPeriodSec: 1 }, asOf)
  );
});

test('pre-release contract versions and shared schema references remain consistent through dependent reads', async () => {
  for (const file of [
    'api/openapi.yaml',
    'api/openapi/celestial/openapi.yaml',
    'api/openapi/solarsystem/openapi.yaml',
  ]) {
    const contract = await Parser.parse(path.resolve(__dirname, '..', file));
    assert.equal(contract.openapi, '3.1.0');
    assert.equal(contract.info.version, '4.0.0');
  }
  const read = (name) =>
    JSON.parse(
      fs.readFileSync(path.resolve(__dirname, `../api/schemas/${name}.schema.json`), 'utf8')
    );
  const request = read('celestial-body-upsert-request');
  for (const name of ['celestial-body-list-response', 'solar-system-get-response']) {
    const response = read(name);
    const body = response.definitions.celestialBody;
    assert.equal(body.properties.orbitalElements.$ref, './orbital-elements.schema.json');
    assert.equal(
      response.definitions.physicalCatalog.$ref,
      './celestial-physical-catalog.schema.json'
    );
    assert.equal(
      response.definitions.physicalState.$ref,
      './celestial-physical-estimates.schema.json'
    );
    assert.deepEqual(
      body.properties.bodyType,
      request.properties.celestialBody.properties.bodyType
    );
    assert.deepEqual(body.allOf, request.properties.celestialBody.allOf);
    assert.ok(body.required.includes('bodyType'));
    assert.ok(body.required.includes('state'));
    assert.ok(body.required.includes('spatial'));
    assert.ok(body.required.includes('observability'));
  }
  assert.equal(
    request.properties.celestialBody.properties.orbitalElements.$ref,
    './orbital-elements.schema.json'
  );
  assert.equal(
    request.properties.celestialBody.properties.spatial.$ref,
    './spatial-state.schema.json'
  );
  assert.equal(
    request.properties.celestialBody.properties.physicalCatalog.$ref,
    './celestial-physical-catalog.schema.json'
  );
  assert.equal(
    request.properties.celestialBody.properties.physical.$ref,
    './celestial-physical-estimates.schema.json'
  );
  const spatialState = read('spatial-state');
  assert.ok(spatialState.description.includes('right-handed Cartesian'));
  assert.ok(spatialState.description.includes('does not identify'));
  assert.equal(spatialState.properties.frame.enum[0], 'barycentric');
  assert.equal(spatialState.properties.basisId, undefined);
  assert.equal(
    read('celestial-body-list-response').definitions.spatialState.$ref,
    './spatial-state.schema.json'
  );
  assert.equal(
    read('solar-system-get-response').definitions.spatialState.$ref,
    './spatial-state.schema.json'
  );
  assert.equal(
    read('ship-list-response').properties.ships.items.properties.spatial.$ref,
    './spatial-state.schema.json'
  );
  assert.equal(
    read('ship-list-by-owner-response').properties.ships.items.properties.spatial.$ref,
    './spatial-state.schema.json'
  );
  const marketResponse = read('market-list-by-location-response');
  for (const name of ['routeFeedGate', 'routeFeedStation', 'routeFeedEncounterShip']) {
    const marketSpatial = marketResponse.definitions[name].properties.spatial;
    assert.deepEqual(marketSpatial.required, ['solarSystemId', 'frame', 'positionKm', 'epochMs']);
    assert.equal(marketSpatial.additionalProperties, false);
    assert.equal(marketSpatial.properties.positionKm.additionalProperties, false);
  }
  assert.ok(
    read('orbital-elements').description.includes(
      'Rz(longitudeOfAscendingNodeDeg) Rx(inclinationDeg) Rz(argumentOfPeriapsisDeg)'
    )
  );
  assert.equal(
    request.properties.celestialBody.properties.orbitalElements.$ref,
    './orbital-elements.schema.json'
  );
  assert.equal(
    read('celestial-body-upsert-response').properties.celestialBody.$ref,
    './celestial-body-list-response.schema.json#/definitions/celestialBody'
  );
  assert.equal(
    read('launch-item-response').properties.resolution.properties.targetCelestialBody.$ref,
    './celestial-body-list-response.schema.json#/definitions/celestialBody'
  );
});
