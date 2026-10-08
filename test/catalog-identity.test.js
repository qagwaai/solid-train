'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const Parser = require('@apidevtools/swagger-parser');
const {
  SOL_CATALOG_IDENTITIES,
  assertCatalogIdentity,
  assertCatalogIdentityAssignments,
} = require('../src/model/catalog-identity');
const { validateCelestialBody } = require('../src/model/celestial-body-validation');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');
const { SOL_SYSTEM_CATALOG } = require('../src/model/sol-system-catalog');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const {
  CelestialBodyListMessageHandler,
} = require('../src/handlers/celestial-body-list-message-handler');
const {
  CelestialBodyUpsertMessageHandler,
} = require('../src/handlers/celestial-body-upsert-message-handler');
const {
  createTestContext,
  createCelestialBody,
  createMockSocket,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

const timestamp = '2026-10-08T00:00:00.000Z';
const sol = () => buildSeededCelestialBodiesForSolarSystem('sol', timestamp);

test('OpenAPI registry exactly matches curated source assignments and actual example projections', () => {
  const contract = yaml.load(
    fs.readFileSync(path.resolve(__dirname, '../api/openapi.yaml'), 'utf8')
  );
  const catalog = contract['x-catalog-identity'];
  assert.equal(catalog.namespace, 'sol');
  assert.equal(catalog.registry.length, 24);
  assert.deepEqual(
    catalog.registry.map(({ key, catalogId, bodyType }) => ({
      namespace: 'sol',
      key,
      catalogId,
      bodyType,
    })),
    SOL_CATALOG_IDENTITIES
  );
  const bodies = sol();
  for (const entry of catalog.registry) {
    const body = bodies.find((candidate) => candidate.catalogId === entry.catalogId);
    assert.ok(body, `${entry.key} is already seeded`);
    assert.deepEqual(body.catalogIdentity, { namespace: 'sol', key: entry.key });
    assert.equal(body.bodyType, entry.bodyType);
  }
  for (const example of catalog.responseProjections.examples) {
    const body = bodies.find((candidate) => candidate.id === example.id);
    for (const [key, value] of Object.entries(example)) {
      if (key === 'spatial') assert.equal(body.spatial.solarSystemId, value.solarSystemId);
      else if (key === 'orbitalElements')
        assert.equal(body.orbitalElements.anchorBodyId, value.anchorBodyId);
      else assert.deepEqual(body[key], value);
    }
  }
});

test('pilot identity survives recreation, localization and texture changes without changing hierarchy', async () => {
  const pilot = new Map([
    ['sol-earth', ['earth', 'planet', 'sol-sun', undefined]],
    ['sol-luna', ['luna', 'moon', 'sol-earth', 'sol-earth']],
    ['sol-mars', ['mars', 'planet', 'sol-sun', undefined]],
    ['sol-mercury', ['mercury', 'planet', 'sol-sun', undefined]],
  ]);
  for (const asOf of [timestamp, '2030-01-01T00:00:00.000Z']) {
    const context = createTestContext({ seedDefaults: false });
    await context.seedSolarSystemCelestialBodiesAsync({ solarSystemId: 'sol', asOf });
    for (const [id, [key, bodyType, parentBodyId, anchorBodyId]] of pilot) {
      const body = context.getCelestialBody(id);
      assert.deepEqual(body.catalogIdentity, { namespace: 'sol', key });
      assert.equal(body.id, id);
      assert.equal(body.spatial.solarSystemId, 'sol');
      assert.equal(body.bodyType, bodyType);
      assert.equal(body.parentBodyId, parentBodyId);
      assert.equal(body.orbitalElements.anchorBodyId, anchorBodyId);
      await context.addOrUpdateCelestialBodyAsync({
        ...body,
        displayName: 'Localized body label',
        visualization: { textureKey: 'changed-legacy-hint' },
      });
      await context.seedSolarSystemCelestialBodiesAsync({ solarSystemId: 'sol', asOf });
      const renamed = context.getCelestialBody(id);
      assert.equal(renamed.displayName, 'Localized body label');
      assert.equal(renamed.visualization.textureKey, 'changed-legacy-hint');
      assert.deepEqual(renamed.catalogIdentity, body.catalogIdentity);
    }
  }
  for (const body of sol()) {
    const source = SOL_SYSTEM_CATALOG.find((entry) => entry.id === body.id);
    assert.equal(body.parentBodyId, source.parentBodyId || null);
    assert.equal(body.bodyType, source.bodyType);
    assert.equal(body.surfaceArchetype, source.surfaceArchetype);
  }
});

test('procedural Earth and procedural systems omit identity, and unrelated bodies are unchanged', async () => {
  const context = createTestContext({ seedDefaults: false });
  const invented = {
    ...createCelestialBody({
      id: 'sol-earth-invented',
      bodyType: 'planet',
      surfaceArchetype: 'ocean',
    }),
    displayName: 'Earth',
    visualization: { textureKey: 'earth' },
  };
  await context.addOrUpdateCelestialBodyAsync(invented);
  assert.equal(Object.hasOwn(context.getCelestialBody(invented.id), 'catalogIdentity'), false);
  const generated = buildSeededCelestialBodiesForSolarSystem('barnards-star', timestamp);
  assert.ok(generated.length > 0);
  assert.ok(generated.every((body) => !Object.hasOwn(body, 'catalogIdentity')));
  const identities = sol().filter((body) => body.catalogIdentity);
  assert.equal(identities.length, 24);
  for (const id of [
    'sol-sun',
    'sol-jupiter',
    'sol-saturn',
    'sol-uranus',
    'sol-neptune',
    'sol-ceres',
    'sol-phobos',
  ]) {
    assert.equal(
      Object.hasOwn(
        sol().find((body) => body.id === id),
        'catalogIdentity'
      ),
      false
    );
  }
});

test('all canonical response schemas share optional strict identity; legacy clients and unknown identities remain valid', async () => {
  const contract = await Parser.dereference(path.resolve(__dirname, '../api/openapi.yaml'));
  const content = (operation) => contract.paths[`/socket/${operation}`].post;
  const list = content('celestial-body-list').responses['200'].content['application/json'].schema;
  const schemas = [
    content('celestial-body-upsert').requestBody.content['application/json'].schema.properties
      .celestialBody,
    content('celestial-body-upsert').responses['200'].content['application/json'].schema.properties
      .celestialBody,
    list.definitions.celestialBody,
    content('solar-system-get').responses['200'].content['application/json'].schema.definitions
      .celestialBody,
    content('launch-item').responses['200'].content['application/json'].schema.properties.resolution
      .properties.targetCelestialBody,
  ];
  for (const schema of schemas) {
    assert.deepEqual(schema.properties.catalogIdentity, schemas[0].properties.catalogIdentity);
    assert.ok(!schema.required.includes('catalogIdentity'));
    const validate = new Ajv({ allErrors: true }).compile(schema);
    for (const catalogIdentity of [
      undefined,
      null,
      { namespace: 'future-catalog', key: 'unknown-body' },
    ]) {
      const body = {
        ...createCelestialBody(),
        ...(catalogIdentity === undefined ? {} : { catalogIdentity }),
      };
      delete body.visualization;
      assert.equal(validate(body), true, JSON.stringify(validate.errors));
    }
    // The former response schema permits additive properties for legacy readers.
    const legacy = structuredClone(schema);
    delete legacy.properties.catalogIdentity;
    assert.equal(new Ajv().compile(legacy)(sol().find((body) => body.id === 'sol-earth')), true);
  }
});

test('malformed and incomplete identities fail schema, normalizer and explicit handler validation', () => {
  const context = createTestContext({ seedDefaults: false });
  const handler = new CelestialBodyUpsertMessageHandler(context);
  for (const catalogIdentity of [
    {},
    { namespace: 'sol' },
    { key: 'earth' },
    { namespace: '', key: 'earth' },
    { namespace: 'Sol', key: 'earth' },
    { namespace: 'sol', key: 'Earth' },
    { namespace: ' sol', key: 'earth' },
    { namespace: 'sol', key: 'earth ' },
    { namespace: 'sol', key: '' },
    { namespace: 'sol', key: 123 },
    { namespace: 'sol', key: 'earth', version: 'v1' },
    { namespace: 'sol', key: 'a'.repeat(65) },
    [],
    'sol/earth',
    false,
  ]) {
    const body = { ...createCelestialBody(), catalogIdentity };
    assert.equal(validateCelestialBody(body), false);
    assert.throws(() => context.normalizeCelestialBody(body), /Invalid catalogIdentity/);
    const response = handler.buildResponse({ playerName: 'Pilot', celestialBody: body });
    assert.equal(response.success, false);
    assert.match(response.message, /Invalid catalogIdentity/);
  }
  const earth = sol().find((body) => body.id === 'sol-earth');
  assert.throws(
    () => assertCatalogIdentity({ ...earth, catalogId: 'other-body' }),
    /curated source/
  );
  assert.throws(() => assertCatalogIdentity({ ...earth, bodyType: 'moon' }), /curated source/);
  assert.throws(
    () => assertCatalogIdentity({ ...earth, catalogIdentity: { namespace: 'sol', key: 'mars' } }),
    /curated source/
  );
  assert.throws(
    () => assertCatalogIdentity({ ...earth, catalogIdentity: { namespace: 'sol', key: 'moon' } }),
    /Conflicting/
  );
});

test('duplicate distinct-source assignments fail, but same-body game instances and separate worlds are permitted', async () => {
  const context = createTestContext({ seedDefaults: false });
  const first = { ...createCelestialBody(), catalogIdentity: { namespace: 'future', key: 'body' } };
  await context.addOrUpdateCelestialBodyAsync(first);
  await context.addOrUpdateCelestialBodyAsync({ ...first, id: 'second-instance' });
  await assert.rejects(
    context.addOrUpdateCelestialBodyAsync({
      ...first,
      id: 'distinct-body',
      catalogId: 'different-source',
    }),
    /Duplicate catalogIdentity/
  );
  await context.addOrUpdateCelestialBodyAsync({
    ...first,
    id: 'different-world',
    catalogId: 'different-source',
    spatial: { ...first.spatial, solarSystemId: 'different-world' },
  });
  const earth = sol().find((body) => body.id === 'sol-earth');
  assert.doesNotThrow(() =>
    assertCatalogIdentityAssignments([earth, { ...earth, id: 'earth-instance-2' }])
  );
});

test('system, list, radius, by-id and upsert projections preserve identity; reads never backfill', async () => {
  const context = createTestContext({ seedDefaults: false });
  seedPlayer(context, {
    playerName: 'Pilot',
    characters: [{ id: 'char-1', characterName: 'Pilot' }],
  });
  const system = await new SolarSystemGetMessageHandler(context).buildResponse({
    playerName: 'Pilot',
    solarSystemId: 'sol',
  });
  const earth = system.bodies.find((body) => body.id === 'sol-earth');
  const handler = new CelestialBodyListMessageHandler(context);
  for (const query of [{}, { positionKm: earth.spatial.positionKm, distanceKm: 0 }]) {
    const result = await handler.buildResponse({
      playerName: 'Pilot',
      solarSystemId: 'sol',
      ...query,
    });
    assert.deepEqual(
      result.celestialBodies.find((body) => body.id === earth.id).catalogIdentity,
      earth.catalogIdentity
    );
  }
  assert.deepEqual(
    (await context.getCelestialBodyByIdAsync(earth.id)).catalogIdentity,
    earth.catalogIdentity
  );
  const unknown = {
    ...createCelestialBody(),
    catalogIdentity: { namespace: 'future', key: 'unrecognized' },
  };
  const upsert = new CelestialBodyUpsertMessageHandler(context);
  const response = await upsert.handle(createMockSocket(), {
    playerName: 'Pilot',
    celestialBody: unknown,
  });
  assert.equal(response.success, true);
  assert.deepEqual(response.celestialBody.catalogIdentity, unknown.catalogIdentity);
  const duplicate = await upsert.handle(createMockSocket(), {
    playerName: 'Pilot',
    celestialBody: { ...unknown, id: 'distinct-body', catalogId: 'distinct-source' },
  });
  assert.equal(duplicate.success, false);
  assert.match(duplicate.message, /Duplicate catalogIdentity/);
  assert.equal(Object.hasOwn(duplicate, 'celestialBody'), false);
  const legacy = { ...unknown, displayName: 'Rename' };
  delete legacy.catalogIdentity;
  const updated = await upsert.handle(createMockSocket(), {
    playerName: 'Pilot',
    celestialBody: legacy,
  });
  assert.deepEqual(updated.celestialBody.catalogIdentity, unknown.catalogIdentity);
  const cleared = await upsert.handle(createMockSocket(), {
    playerName: 'Pilot',
    celestialBody: { ...legacy, catalogIdentity: null },
  });
  assert.equal(cleared.celestialBody.catalogIdentity, null);
  const oldEarth = { ...earth };
  delete oldEarth.catalogIdentity;
  context.celestialBodiesById.set(earth.id, oldEarth);
  const reread = await new SolarSystemGetMessageHandler(context).buildResponse({
    playerName: 'Pilot',
    solarSystemId: 'sol',
  });
  assert.equal(
    Object.hasOwn(
      reread.bodies.find((body) => body.id === earth.id),
      'catalogIdentity'
    ),
    false
  );
  assert.equal(Object.hasOwn(context.getCelestialBody(earth.id), 'catalogIdentity'), false);
});
