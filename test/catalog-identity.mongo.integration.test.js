'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { createCelestialBody } = require('../test-support/message-handler-test-helpers');
const { CelestialBody } = require('../src/db/models');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');

let harness;
test.before(async () => {
  harness = await createMongoTestHarness();
});
test.after(async () => {
  if (harness) await harness.teardown();
});
test.beforeEach(async () => {
  await harness.clearDatabase();
});

test('Mongo persists pilot and expansion identities, keeps renamed sources and legacy writer identity', async () => {
  const service = harness.databaseService;
  const bodies = buildSeededCelestialBodiesForSolarSystem('sol', '2026-10-08T00:00:00.000Z');
  for (const body of bodies.filter((entry) => entry.catalogIdentity)) {
    await service.addOrUpdateCelestialBody(body);
  }
  const earth = await service.getCelestialBodyById('sol-earth');
  assert.deepEqual(earth.catalogIdentity, { namespace: 'sol', key: 'earth' });
  const renamed = { ...bodies.find((body) => body.id === earth.id), displayName: 'Terra' };
  delete renamed.catalogIdentity;
  await service.addOrUpdateCelestialBody(renamed);
  const updated = await service.getCelestialBodyById(earth.id);
  assert.equal(updated.displayName, 'Terra');
  assert.deepEqual(updated.catalogIdentity, earth.catalogIdentity);
  assert.equal(updated.parentBodyId, earth.parentBodyId);
  const nearby = await service.findCelestialBodiesNearPosition({
    solarSystemId: 'sol',
    positionKm: earth.spatial.positionKm,
    distanceKm: 0,
  });
  assert.deepEqual(nearby[0].celestialBody.catalogIdentity, earth.catalogIdentity);
  const listed = await service.getCelestialBodies({ solarSystemId: 'sol' });
  assert.equal(listed.length, 24);
  const context = new MessageHandlerContext({ databaseService: service, log: () => {} });
  assert.deepEqual(
    (await context.getCelestialBodyByIdAsync(earth.id)).catalogIdentity,
    earth.catalogIdentity
  );
  assert.equal(
    (await context.getCelestialBodiesAsync({ solarSystemId: 'sol' })).filter(
      (body) => body.catalogIdentity
    ).length,
    24
  );
  assert.deepEqual(
    (
      await context.getCelestialBodiesNearPositionAsync({
        solarSystemId: 'sol',
        positionKm: earth.spatial.positionKm,
        distanceKm: 0,
      })
    )[0].celestialBody.catalogIdentity,
    earth.catalogIdentity
  );
});

test('Mongo explicitly rejects malformed identity before coercion and detects concurrent duplicate assignments', async () => {
  const service = harness.databaseService;
  const base = createCelestialBody();
  await assert.rejects(
    service.addOrUpdateCelestialBody({
      ...base,
      catalogIdentity: { namespace: 'sol' },
    }),
    /Invalid canonical celestial body/
  );
  const doc = new CelestialBody({ ...base, catalogIdentity: { namespace: 'Sol', key: 'earth' } });
  await assert.rejects(doc.validate(), /catalogIdentity/);
  const first = { ...base, catalogIdentity: { namespace: 'future', key: 'one-body' } };
  const second = { ...first, id: 'other-body', catalogId: 'other-source' };
  const results = await Promise.allSettled([
    service.addOrUpdateCelestialBody(first),
    service.addOrUpdateCelestialBody(second),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failed = results.find((result) => result.status === 'rejected');
  assert.match(failed.reason.message, /Duplicate catalogIdentity/);
  const winner = results.find((result) => result.status === 'fulfilled').value;
  await service.addOrUpdateCelestialBody({
    ...first,
    catalogId: winner.catalogId,
    id: 'same-body-instance',
  });
  assert.equal((await service.getCelestialBodies()).length, 2);
  await service.addOrUpdateCelestialBody({
    ...second,
    id: 'separate-world',
    spatial: { ...second.spatial, solarSystemId: 'other-world' },
  });
});

test('fresh database recreation and curated reseeding reproduce the same identities and never add bodies', async () => {
  const service = harness.databaseService;
  const bodies = buildSeededCelestialBodiesForSolarSystem('sol', '2026-10-08T00:00:00.000Z');
  for (let recreation = 0; recreation < 2; recreation += 1) {
    if (recreation) await harness.clearDatabase();
    for (const body of bodies) await service.addOrUpdateCelestialBody(body);
    const persisted = await service.getCelestialBodies({ solarSystemId: 'sol' });
    assert.equal(persisted.length, bodies.length);
    for (const body of bodies) {
      const actual = persisted.find((entry) => entry.id === body.id);
      assert.deepEqual(actual.catalogIdentity, body.catalogIdentity);
      assert.equal(actual.parentBodyId, body.parentBodyId);
      assert.equal(actual.bodyType, body.bodyType);
      assert.equal(actual.surfaceArchetype, body.surfaceArchetype);
      assert.equal(
        actual.orbitalElements?.anchorBodyId || null,
        body.orbitalElements?.anchorBodyId || null
      );
    }
  }
});
