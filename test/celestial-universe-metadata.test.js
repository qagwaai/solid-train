'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('../src/model/schema-validator');
const { validateCelestialBody } = require('../src/model/celestial-body-validation');
const {
  assertUniverseMetadata,
  assertUniverseRelationships,
  generatedBodyId,
} = require('../src/model/celestial-universe-metadata');
const {
  mergeCelestialSeed,
  seedMongoUpdate,
  renameCelestialSeed,
  assertUniverseTransition,
  initialSeedDiscovery,
} = require('../src/model/celestial-seed-ownership');
const { universeBody } = require('../test-support/universe-metadata-test-helpers');
const {
  createTestContext,
  seedPlayer,
  createCelestialBody,
} = require('../test-support/message-handler-test-helpers');
const {
  CelestialBodyUpsertMessageHandler,
} = require('../src/handlers/celestial-body-upsert-message-handler');
const {
  CelestialBodyListMessageHandler,
} = require('../src/handlers/celestial-body-list-message-handler');

test('optional metadata is preserved across canonical normalization, upsert and list reads', async () => {
  const context = createTestContext();
  const body = universeBody();
  seedPlayer(context, { playerName: 'Pilot', characters: [{ id: body.createdByCharacterId }] });
  assert.equal(validateCelestialBody(body), true, JSON.stringify(validateCelestialBody.errors));
  assert.deepEqual(context.normalizeCelestialBody(body).universeMetadata, body.universeMetadata);
  const handler = new CelestialBodyUpsertMessageHandler(context);
  const response = handler.buildResponse({ playerName: 'Pilot', celestialBody: body });
  assert.equal(response.success, true, response.message);
  assert.deepEqual(response.celestialBody.universeMetadata, body.universeMetadata);
  await context.addOrUpdateCelestialBodyAsync(response.celestialBody);
  const list = await new CelestialBodyListMessageHandler(context).buildResponse({
    playerName: 'Pilot',
    solarSystemId: 'alpha-centauri',
  });
  assert.deepEqual(
    list.celestialBodies.find((entry) => entry.id === body.id).universeMetadata,
    body.universeMetadata
  );
  const legacy = createCelestialBody();
  assert.equal(context.normalizeCelestialBody(legacy).universeMetadata, undefined);
  assert.doesNotThrow(() => assertUniverseMetadata({ ...legacy, universeMetadata: null }));
});

test('request and both canonical read schemas share the exact typed metadata contract', async () => {
  const contract = await Parser.dereference(path.resolve(__dirname, '..', 'api', 'openapi.yaml'));
  const schemas = [
    contract.paths['/socket/celestial-body-upsert'].post.requestBody.content['application/json']
      .schema.properties.celestialBody,
    contract.paths['/socket/celestial-body-list'].post.responses['200'].content['application/json']
      .schema.definitions.celestialBody,
    contract.paths['/socket/solar-system-get'].post.responses['200'].content['application/json']
      .schema.definitions.celestialBody,
  ];
  const body = universeBody();
  for (const schema of schemas) {
    const validate = createSchemaValidator({ allErrors: true }).compile(schema);
    assert.equal(validate(body), true, JSON.stringify(validate.errors));
    const invalid = structuredClone(body);
    invalid.universeMetadata.provenance.fieldSources[0].derivation = 'measured-fiction';
    assert.equal(validate(invalid), false);
    for (const mutate of [
      (b) => {
        b.universeMetadata.generation = null;
      },
      (b) => {
        b.universeMetadata.provenance.rationale = null;
      },
      (b) => {
        b.universeMetadata.provenance.fieldSources[0].derivation = 'observed';
      },
      (b) => {
        b.universeMetadata.naming.lane = 'inherited';
      },
    ]) {
      const invalidMetadata = structuredClone(body);
      mutate(invalidMetadata);
      assert.equal(validate(invalidMetadata), false);
    }
  }
  assert.deepEqual(schemas[0].properties.universeMetadata, schemas[1].properties.universeMetadata);
  assert.deepEqual(schemas[1].properties.universeMetadata, schemas[2].properties.universeMetadata);
});

test('invalid provenance, names, resources and retired catalog bodies fail explicitly', () => {
  for (const mutate of [
    (b) => {
      b.universeMetadata.generation = null;
    },
    (b) => {
      b.universeMetadata.provenance.rationale = null;
    },
    (b) => {
      b.universeMetadata.provenance.fieldSources[0].derivation = 'observed';
    },
    (b) => {
      b.universeMetadata.provenance.fieldSources.push(
        b.universeMetadata.provenance.fieldSources[0]
      );
    },
    (b) => {
      b.universeMetadata.naming.preferredName = 'Other';
    },
    (b) => {
      b.universeMetadata.naming.aliases = ['Test I'];
    },
    (b) => {
      b.universeMetadata.naming.aliases = ['old', 'OLD'];
    },
    (b) => {
      b.universeMetadata.naming.lane = 'inherited';
    },
    (b) => {
      b.universeMetadata.resourceProfile.materialItemTypes = ['made-up-ore'];
    },
    (b) => {
      b.universeMetadata.lifecycle.status = 'retired';
    },
    (b) => {
      b.universeMetadata.population = {
        id: 'comets',
        kind: 'comet-reservoir',
        hostBodyId: 'star',
        abundance: 'sparse',
        estimatedTotalCount: null,
        policyVersion: 'v1',
      };
    },
    (b) => {
      b.universeMetadata.unknown = true;
    },
  ]) {
    const body = universeBody();
    mutate(body);
    assert.throws(() => assertUniverseMetadata(body));
  }
  const catalog = universeBody();
  catalog.universeMetadata.provenance.origin = 'catalog';
  catalog.universeMetadata.lifecycle = {
    status: 'retired',
    retiredAt: '2026-11-07T00:00:00.000Z',
    reason: 'policy',
  };
  assert.throws(() => assertUniverseMetadata(catalog), /Only generated/);
});

test('identity is independent of names, epochs and policy versions; invalid scope is rejected', () => {
  const input = {
    solarSystemId: 'alpha-centauri',
    parentBodyId: 'primary',
    bodyType: 'moon',
    slot: 'moon-01',
  };
  assert.equal(
    generatedBodyId(input),
    generatedBodyId({ ...input, displayName: 'Other', version: 'v2' })
  );
  assert.notEqual(generatedBodyId(input), generatedBodyId({ ...input, slot: 'moon-02' }));
  for (const bad of [
    { ...input, solarSystemId: 'sol' },
    { ...input, bodyType: 'black-hole' },
    { ...input, slot: '' },
    { ...input, parentBodyId: ' ' },
  ])
    assert.throws(() => generatedBodyId(bad));
});

test('population and name relationships require consistent, local canonical hosts', () => {
  const host = universeBody({
    id: 'host',
    bodyType: 'star',
    surfaceArchetype: 'star',
    displayName: 'Host',
  });
  delete host.universeMetadata.resourceProfile;
  const body = universeBody();
  body.universeMetadata.population = {
    id: 'outer-belt',
    kind: 'asteroid-belt',
    hostBodyId: 'host',
    abundance: 'sparse',
    estimatedTotalCount: 1000,
    policyVersion: 'test-v1',
  };
  assert.doesNotThrow(() => assertUniverseRelationships([host, body]));
  assert.throws(() => assertUniverseRelationships([body]), /Unresolved population/);
  const duplicate = universeBody({ id: 'duplicate', displayName: 'Other' });
  duplicate.universeMetadata.population = {
    ...body.universeMetadata.population,
    abundance: 'rich',
  };
  assert.throws(
    () => assertUniverseRelationships([host, body, duplicate]),
    /Inconsistent population/
  );
  duplicate.universeMetadata.naming.aliases = ['Test I'];
  assert.throws(() => assertUniverseRelationships([host, body, duplicate]), /collision/);
});

test('non-Sol seed ownership preserves scan/depletion/destruction history and retirement', () => {
  const seed = universeBody();
  const previous = structuredClone(seed);
  previous.state = 'destroyed';
  previous.destroyedAt = '2026-11-07T01:00:00.000Z';
  previous.destroyedReason = 'mined';
  previous.debris = [{ material: 'Iron', rarity: 'Common', quantity: 4, itemType: 'iron' }];
  previous.observability.scanState = 'scanned';
  previous.universeMetadata.lifecycle = {
    status: 'retired',
    retiredAt: '2026-11-07T02:00:00.000Z',
    reason: 'policy revision',
  };
  const merged = mergeCelestialSeed(previous, seed);
  assert.equal(merged.state, 'destroyed');
  assert.deepEqual(merged.debris, previous.debris);
  assert.deepEqual(merged.universeMetadata.lifecycle, previous.universeMetadata.lifecycle);
  const update = seedMongoUpdate(merged);
  assert.equal(update.$set.state, undefined);
  assert.equal(update.$setOnInsert.state, 'destroyed');
  assert.equal(update.$set['universeMetadata.lifecycle'], undefined);
  assert.deepEqual(
    update.$setOnInsert['universeMetadata.lifecycle'],
    previous.universeMetadata.lifecycle
  );
  assert.throws(
    () => mergeCelestialSeed({ ...previous, isCatalogBody: false }, seed),
    /player-created/
  );
  assert.throws(
    () => mergeCelestialSeed(previous, { ...seed, catalogId: 'different' }),
    /identity/
  );
  assert.throws(() => assertUniverseTransition(previous, seed), /Retirement history/);
});

test('name-only updates preserve physical and mutable fields without duplicate systematic labels', () => {
  const body = universeBody();
  const changed = renameCelestialSeed(body, {
    ...body.universeMetadata.naming,
    preferredName: 'Voyager',
    aliases: ['Test I'],
    lane: 'narrative',
    language: 'English',
    motivation: 'Later expedition',
  });

  assert.equal(changed.displayName, 'Voyager');
  assert.deepEqual(changed.physical, body.physical);
  assert.deepEqual(changed.spatial, body.spatial);
  assert.equal(changed.id, body.id);
  const retired = structuredClone(body);
  retired.universeMetadata.lifecycle = {
    status: 'retired',
    retiredAt: '2026-11-07T00:00:00.000Z',
    reason: 'policy',
  };
  assert.doesNotThrow(() => assertUniverseTransition(body, retired));
  retired.state = 'destroyed';
  assert.throws(() => assertUniverseTransition(body, retired), /Retirement cannot change/);
});

test('initial discovery policy is explicit and non-Sol database failure cannot reset cached history', async () => {
  assert.deepEqual(initialSeedDiscovery('planet'), {
    state: 'active',
    observability: { visibility: 'visible', scanState: 'scanned' },
  });

  assert.deepEqual(initialSeedDiscovery('asteroid'), {
    state: 'unscanned',
    observability: { visibility: 'visible', scanState: 'unscanned' },
  });
  assert.throws(() => initialSeedDiscovery('belt'));
  const context = createTestContext();
  const previous = universeBody();
  previous.state = 'destroyed';
  context.celestialBodiesById.set(previous.id, previous);
  context.databaseService = {
    getSolarSystemCelestialSeedState: async () => {
      throw new Error('test database unavailable');
    },
  };
  const result = await context.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'alpha-centauri',
  });
  assert.equal(result.success, false);
  assert.equal(result.source, 'database-error');
  assert.equal(context.celestialBodiesById.get(previous.id).state, 'destroyed');
});

test('non-Sol seed readback failure cannot publish success or a completed seed version', async () => {
  const context = createTestContext();
  const previous = universeBody();
  context.celestialBodiesById.set(previous.id, previous);
  let completed = false;
  context.databaseService = {
    getSolarSystemCelestialSeedState: async () => null,
    addOrUpdateCelestialBody: async (body) => body,
    getCelestialBodies: async () => [],
    setSolarSystemCelestialSeedState: async () => {
      completed = true;
    },
  };
  const result = await context.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'alpha-centauri',
  });
  assert.equal(result.success, false);
  assert.match(result.message, /missing expected durable bodies/);
  assert.equal(completed, false);
  assert.equal(context.celestialBodiesById.get(previous.id), previous);
});

test('an incomplete current seed cache cannot claim non-Sol persistence success', async () => {
  const context = createTestContext();
  const previous = universeBody();
  context.celestialBodiesById.set(previous.id, previous);
  const {
    getSolarSystemCelestialSeedVersion,
  } = require('../src/model/solar-system-celestial-seed');
  context.databaseService = {
    getSolarSystemCelestialSeedState: async () => ({
      seedVersion: getSolarSystemCelestialSeedVersion('alpha-centauri'),
    }),
    getCelestialBodies: async () => [previous],
  };
  const result = await context.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'alpha-centauri',
  });
  assert.equal(result.success, false);
  assert.match(result.message, /missing expected durable bodies/);
  assert.equal(context.celestialBodiesById.get(previous.id), previous);
});

test('an acknowledged write without a durable body cannot replace cached gameplay history', async () => {
  const context = createTestContext();
  const previous = universeBody();
  context.celestialBodiesById.set(previous.id, previous);
  context.databaseService = { addOrUpdateCelestialBody: async () => null };
  await assert.rejects(() => context.addOrUpdateCelestialBodyAsync(previous), /no durable body/);
  assert.equal(context.celestialBodiesById.get(previous.id), previous);
});

test('ownership comparisons ignore object-key order without permitting protected or historical changes', () => {
  const previous = universeBody();
  previous.universeMetadata.naming.lane = 'protected';
  previous.universeMetadata.lifecycle = {
    status: 'retired',
    retiredAt: '2026-11-07T00:00:00.000Z',
    reason: 'policy',
  };
  const incoming = structuredClone(previous);
  incoming.universeMetadata.naming = Object.fromEntries(
    Object.entries(incoming.universeMetadata.naming).reverse()
  );
  incoming.universeMetadata.lifecycle = Object.fromEntries(
    Object.entries(incoming.universeMetadata.lifecycle).reverse()
  );
  assert.doesNotThrow(() => assertUniverseTransition(previous, incoming));
  incoming.universeMetadata.lifecycle.reason = 'rewritten history';
  assert.throws(() => assertUniverseTransition(previous, incoming), /Retirement history/);
  const active = universeBody();
  const retired = structuredClone(active);
  retired.composition = Object.fromEntries(Object.entries(active.composition).reverse());
  retired.universeMetadata.lifecycle = previous.universeMetadata.lifecycle;
  assert.doesNotThrow(() => assertUniverseTransition(active, retired));
});
