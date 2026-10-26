'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const yaml = require('js-yaml');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');
const { getSolarSystemById, clearRegistryCache } = require('../src/model/solar-system-registry');
const { validateCelestialBody } = require('../src/model/celestial-body-validation');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const {
  CelestialBodyListMessageHandler,
} = require('../src/handlers/celestial-body-list-message-handler');
const {
  SolarSystemListMessageHandler,
} = require('../src/handlers/solar-system-list-message-handler');
const { createTestContext, seedPlayer } = require('../test-support/message-handler-test-helpers');
const { CelestialBody } = require('../src/db/models');

const ROOT = path.resolve(__dirname, '..');
const SEED_AT = '2026-10-25T00:00:00.000Z';

test('Cygnus X-1 has two distinct canonical bodies with authoritative classification and provenance', () => {
  const bodies = buildSeededCelestialBodiesForSolarSystem('cygnus-x1', SEED_AT);
  assert.deepEqual(
    bodies.map((body) => body.id),
    ['cygnus-x1-black-hole', 'cygnus-x1-hd226868']
  );

  const [blackHole, companion] = bodies;
  assert.deepEqual(blackHole.catalogIdentity, {
    namespace: 'cygnus-x1',
    key: 'black-hole',
  });
  assert.deepEqual(companion.catalogIdentity, {
    namespace: 'cygnus-x1',
    key: 'hd226868',
  });
  assert.equal(blackHole.bodyType, 'black-hole');
  assert.equal(blackHole.surfaceArchetype, 'black-hole');
  assert.equal(companion.bodyType, 'star');
  assert.equal(companion.surfaceArchetype, 'star');

  for (const body of bodies) {
    assert.equal(body.catalogId, body.id);
    assert.equal(body.sourceScanId, 'catalog');
    assert.equal(body.createdByCharacterId, 'system-catalog');
    assert.equal(body.spatial.solarSystemId, 'cygnus-x1');
    assert.equal(body.spatial.frame, 'barycentric');
    assert.deepEqual(body.spatial.positionKm, { x: 0, y: 0, z: 0 });
    assert.equal(body.spatial.epochMs, Date.parse(SEED_AT));
    assert.deepEqual(body.observability, { visibility: 'visible', scanState: 'scanned' });
    assert.equal(body.state, 'active');
    assert.equal(body.missionId, null);
    assert.equal(body.orbitalElements, null);
    assert.equal(validateCelestialBody(body), true, JSON.stringify(validateCelestialBody.errors));
  }

  assert.equal(blackHole.hygId, null);
  assert.equal(blackHole.parentBodyId, null);
  assert.equal(companion.parentBodyId, 'cygnus-x1-black-hole');
  assert.equal(companion.hygId, '97987');
  assert.equal(companion.hipId, '98298');
  assert.equal(companion.hdId, '226868');
  assert.equal(blackHole.blackHoleProperties.massSolar, 21.2);
  assert.equal(blackHole.blackHoleProperties.massUncertaintySolar, 2.2);
  assert.equal(blackHole.blackHoleProperties.distanceParsec, 2220);
  assert.equal(blackHole.blackHoleProperties.orbitalPeriodDays, 5.599829);
  assert.equal(blackHole.blackHoleProperties.relativeBinarySemimajorAxisAU, 0.244);
  assert.equal(blackHole.blackHoleProperties.eccentricity, 0.0189);
  assert.equal(blackHole.blackHoleProperties.inclinationDeg, 27.51);
  assert.equal(blackHole.blackHoleProperties.schwarzschildReferenceRadiusKm, 62.6);
  assert.equal(blackHole.blackHoleProperties.eventHorizonRadiusKm, null);
  assert.equal(blackHole.blackHoleProperties.visualAccretionDiskOuterRadiusKm, null);
  assert.equal(companion.physicalCatalog.massSolar, 40.6);
  assert.equal(companion.physicalCatalog.massUncertaintySolar, 7.7);
  assert.equal(companion.physicalCatalog.meanRadiusKm, 22.3 * 695700);
  assert.equal(companion.physicalCatalog.meanTemperatureK, 31138);
});

test('Cygnus catalog metadata survives Mongoose document serialization', async () => {
  const bodies = buildSeededCelestialBodiesForSolarSystem('cygnus-x1', SEED_AT);
  for (const body of bodies) {
    const document = new CelestialBody(body);
    await document.validate();
    const persisted = document.toObject();
    assert.deepEqual(persisted.blackHoleProperties, body.blackHoleProperties);
    for (const [key, value] of Object.entries(body.physicalCatalog)) {
      assert.deepEqual(persisted.physicalCatalog[key], value);
    }
  }
});

test('black-hole bodyType only accepts black-hole surfaceArchetype', () => {
  const classificationSchema = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'api/schemas/celestial-classification.schema.json'), 'utf8')
  );
  const validate = new Ajv().compile(classificationSchema);
  assert.equal(
    validate({
      bodyType: 'black-hole',
      surfaceArchetype: 'black-hole',
      state: 'active',
      composition: {},
    }),
    true
  );
  assert.equal(
    validate({ bodyType: 'black-hole', surfaceArchetype: 'star', state: 'active' }),
    false
  );
  assert.equal(
    validate({ bodyType: 'star', surfaceArchetype: 'black-hole', state: 'active' }),
    false
  );
});

test('Cygnus X-1 registry and limited canonical-body list expose both curated bodies', async () => {
  clearRegistryCache();
  const summary = getSolarSystemById('cygnus-x1');
  assert.equal(summary.id, 'cygnus-x1');
  assert.equal(summary.source, 'curated');
  assert.equal(summary.positionPc, null);
  assert.equal(summary.distanceParsec, null);

  const context = createTestContext({ seedDefaults: false });
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  const systemResponse = await new SolarSystemGetMessageHandler(context).buildResponse({
    playerName: 'PilotOne',
    solarSystemId: 'cygnus-x1',
    asOf: SEED_AT,
  });
  assert.equal(systemResponse.success, true);
  assert.deepEqual(
    systemResponse.bodies.map((body) => body.id),
    ['cygnus-x1-black-hole', 'cygnus-x1-hd226868']
  );
  assert.deepEqual(systemResponse.stars.map((body) => body.id), ['cygnus-x1-hd226868']);

  const systemListResponse = await new SolarSystemListMessageHandler(context).buildResponse({
    playerName: 'PilotOne',
    search: 'cygnus-x1',
    limit: 1,
  });
  assert.equal(systemListResponse.success, true);
  assert.deepEqual(systemListResponse.solarSystems.map((system) => system.id), ['cygnus-x1']);

  const limitedResponse = await new CelestialBodyListMessageHandler(context).buildResponse({
    playerName: 'PilotOne',
    solarSystemId: 'cygnus-x1',
    limit: 2,
  });
  assert.equal(limitedResponse.success, true);
  assert.equal(limitedResponse.celestialBodies.length, 2);
  assert.deepEqual(
    new Set(limitedResponse.celestialBodies.map((body) => body.id)),
    new Set(['cygnus-x1-black-hole', 'cygnus-x1-hd226868'])
  );
  const radiusResponse = await new CelestialBodyListMessageHandler(context).buildResponse({
    playerName: 'PilotOne',
    solarSystemId: 'cygnus-x1',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 0,
    limit: 2,
  });
  assert.equal(radiusResponse.celestialBodies.length, 2);
  const singleResult = await new CelestialBodyListMessageHandler(context).buildResponse({
    playerName: 'PilotOne',
    solarSystemId: 'cygnus-x1',
    limit: 1,
  });
  assert.equal(singleResult.celestialBodies.length, 1);
});

test('OpenAPI registry and canonical examples match both Cygnus catalog sources', () => {
  const contract = yaml.load(fs.readFileSync(path.join(ROOT, 'api/openapi.yaml'), 'utf8'));
  const cygnusRegistry = contract['x-catalog-identity'].additionalRegistries.find(
    (entry) => entry.namespace === 'cygnus-x1'
  );
  assert.deepEqual(
    cygnusRegistry.registry.map(({ key, catalogId, bodyType }) => ({ key, catalogId, bodyType })),
    [
      { key: 'black-hole', catalogId: 'cygnus-x1-black-hole', bodyType: 'black-hole' },
      { key: 'hd226868', catalogId: 'cygnus-x1-hd226868', bodyType: 'star' },
    ]
  );

  const seeded = buildSeededCelestialBodiesForSolarSystem('cygnus-x1', SEED_AT);
  const examples = contract['x-catalog-identity'].canonicalBodyExamples;
  assert.equal(examples.length, 2);
  for (const example of examples) {
    const body = seeded.find((entry) => entry.id === example.id);
    assert.ok(body, `${example.id} is seeded`);
    for (const key of ['id', 'catalogId', 'catalogIdentity', 'bodyType', 'surfaceArchetype']) {
      assert.deepEqual(body[key], example[key]);
    }
  }
});
