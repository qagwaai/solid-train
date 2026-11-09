'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { DatabaseService } = require('../src/db/service');
const { previewCopperValeP4 } = require('../src/model/non-sol-p4-preview');
const {
  buildCopperValeSeedPlan,
  runCopperValeSeedLifecycle,
} = require('../src/model/copper-vale-seed-lifecycle');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');

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

test('dry-run is write-free; apply, exact durable readback and rerun are idempotent', async () => {
  const dryRun = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'dry-run' });
  assert.equal(dryRun.writes, false);
  assert.equal(dryRun.expectedBodyCount, 57);
  assert.equal(dryRun.state, 'absent');
  assert.equal(dryRun.readiness, 'ready');
  assert.equal((await harness.databaseService.getCelestialBodies({ solarSystemId: 'exo-gj-9066' })).length, 0);
  assert.equal((await harness.databaseService.getMarkets({ solarSystemId: 'exo-gj-9066' })).length, 0);
  assert.deepEqual(Object.keys(dryRun.hashes).sort(), [
    'namingSha256', 'physicalSha256', 'resourceSha256', 'sourceSha256', 'stationSha256',
  ]);
  assert.deepEqual(Object.keys(dryRun.revisions).sort(), [
    'naming', 'physical', 'resource', 'source', 'station',
  ]);

  const first = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  assert.equal(first.status, 'complete');
  assert.equal(first.bodyCount, 57);
  assert.equal(first.verifiedBodyIds.length, 57);
  assert.equal(first.stationId, 'copper-vale-asteroid-exchange');

  const freshService = new DatabaseService();
  const durable = await runCopperValeSeedLifecycle(freshService, { action: 'readback' });
  assert.equal(durable.status, 'complete');
  assert.deepEqual(durable.verifiedBodyIds, first.expectedBodyIds);

  const second = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  assert.equal(second.status, 'complete');
  assert.equal(second.resumed, false);
  assert.deepEqual(second.expectedBodyIds, first.expectedBodyIds);
  assert.equal((await harness.databaseService.getCelestialBodies({ solarSystemId: 'exo-gj-9066' })).length, 57);
  assert.equal((await harness.databaseService.getMarkets({ solarSystemId: 'exo-gj-9066' })).length, 1);
});

test('resume verifies and adopts a durable body written before its checkpoint', async () => {
  const plan = buildCopperValeSeedPlan();
  await assert.rejects(
    runCopperValeSeedLifecycle(harness.databaseService, {
      action: 'apply',
      afterBodyWrite: async (id) => {
        assert.equal(id, plan.bodies[0].id);
        throw new Error('simulated worker interruption');
      },
    }),
    /simulated worker interruption/
  );
  const interrupted = await harness.databaseService.getCopperValeSeedLifecycleState();
  assert.equal(interrupted.status, 'applying');
  assert.deepEqual(interrupted.verifiedBodyIds, []);
  const interruptedDryRun = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'dry-run' });
  assert.equal(interruptedDryRun.readiness, 'resumable');
  assert.deepEqual(interruptedDryRun.checkedBodyIds, [plan.bodies[0].id]);
  assert.ok(await harness.databaseService.getCelestialBodyById(plan.bodies[0].id));

  const resumed = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'resume' });
  assert.equal(resumed.status, 'complete');
  assert.equal(resumed.resumed, true);
  assert.deepEqual(resumed.verifiedBodyIds, plan.expectedBodyIds);
  const state = await harness.databaseService.getCopperValeSeedLifecycleState();
  assert.deepEqual(state.verifiedBodyIds, plan.expectedBodyIds);
});

test('source/catalog changes are separately hashed and block resume without mutating data', async () => {
  const original = previewCopperValeP4();
  const originalPlan = buildCopperValeSeedPlan(original);
  const physical = structuredClone(original);
  physical.generatedBodies[0].physicalCatalog.meanRadiusKm += 1;
  const physicalPlan = buildCopperValeSeedPlan(physical);
  assert.notEqual(physicalPlan.hashes.physicalSha256, originalPlan.hashes.physicalSha256);
  assert.equal(physicalPlan.hashes.resourceSha256, originalPlan.hashes.resourceSha256);
  assert.equal(physicalPlan.hashes.namingSha256, originalPlan.hashes.namingSha256);

  const resource = structuredClone(original);
  resource.generatedBodies[0].composition.material = 'P6 test-only changed resource';
  const resourcePlan = buildCopperValeSeedPlan(resource);
  assert.notEqual(resourcePlan.hashes.resourceSha256, originalPlan.hashes.resourceSha256);
  assert.equal(resourcePlan.hashes.physicalSha256, originalPlan.hashes.physicalSha256);

  const naming = structuredClone(original);
  naming.generatedBodies[0].displayName = 'P6 test-only changed name';
  const namingPlan = buildCopperValeSeedPlan(naming);
  assert.notEqual(namingPlan.hashes.namingSha256, originalPlan.hashes.namingSha256);
  assert.equal(namingPlan.hashes.physicalSha256, originalPlan.hashes.physicalSha256);

  const station = structuredClone(original);
  station.station.siteName = 'P6 test-only changed station';
  const stationPlan = buildCopperValeSeedPlan(station);
  assert.notEqual(stationPlan.hashes.stationSha256, originalPlan.hashes.stationSha256);

  await assert.rejects(
    runCopperValeSeedLifecycle(harness.databaseService, {
      action: 'apply',
      afterBodyWrite: async () => { throw new Error('interrupt'); },
    }),
    /interrupt/
  );
  const before = await harness.databaseService.getCelestialBodies({ solarSystemId: 'exo-gj-9066' });
  const staleDryRun = await runCopperValeSeedLifecycle(harness.databaseService, {
    action: 'dry-run',
    plan: physicalPlan,
  });

  assert.equal(staleDryRun.readiness, 'blocked');
  assert.match(staleDryRun.blockedReason, /source\/catalog seed plan changed/);
  await assert.rejects(
    runCopperValeSeedLifecycle(harness.databaseService, { action: 'resume', plan: physicalPlan }),
    /source\/catalog seed plan changed/
  );
  const after = await harness.databaseService.getCelestialBodies({ solarSystemId: 'exo-gj-9066' });
  assert.deepEqual(after, before);
});

test('resume adopts a station written before its checkpoint without resetting gameplay prices or stock', async () => {
  const plan = buildCopperValeSeedPlan();
  await assert.rejects(
    runCopperValeSeedLifecycle(harness.databaseService, {
      action: 'apply',
      afterMarketWrite: async () => { throw new Error('station-write interruption'); },
    }),
    /station-write interruption/
  );
  const state = await harness.databaseService.getCopperValeSeedLifecycleState();
  assert.equal(state.status, 'applying');
  assert.equal(state.marketVerified, false);
  assert.equal(state.verifiedBodyIds.length, 57);
  await mongoose.model('Market').updateOne(
    { marketId: plan.station.marketId },
    { $set: { priceMultiplier: 1.31, 'inventory.0.stock': 17 } }
  );
  const resumed = await runCopperValeSeedLifecycle(new DatabaseService(), { action: 'resume' });
  assert.equal(resumed.status, 'complete');
  const markets = await harness.databaseService.getMarkets({ solarSystemId: plan.systemId });
  assert.equal(markets.length, 1);
  assert.equal(markets[0].priceMultiplier, 1.31);
  assert.equal(markets[0].inventory[0].stock, 17);
});

test('readback refuses missing bodies, immutable tampering, and altered durable expectations', async () => {
  const plan = buildCopperValeSeedPlan();
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  const CelestialBody = mongoose.model('CelestialBody');
  await CelestialBody.deleteOne({ id: plan.expectedBodyIds[0] });
  await assert.rejects(
    runCopperValeSeedLifecycle(new DatabaseService(), { action: 'readback' }),
    /Missing expected seeded body/
  );

  await harness.clearDatabase();
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  await CelestialBody.updateOne({ id: plan.expectedBodyIds[1] }, { $set: { displayName: 'tampered' } });
  await assert.rejects(
    runCopperValeSeedLifecycle(new DatabaseService(), { action: 'readback' }),
    /Seed readback mismatch/
  );

  await harness.clearDatabase();
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  await mongoose.model('Market').updateOne(
    { marketId: plan.station.marketId },
    { $set: { siteName: 'tampered station' } }
  );
  await assert.rejects(
    runCopperValeSeedLifecycle(new DatabaseService(), { action: 'readback' }),
    /Seed readback mismatch for station/
  );

  await harness.clearDatabase();
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  const state = await harness.databaseService.getCopperValeSeedLifecycleState();
  state.expectedBodies[plan.expectedBodyIds[0]] = 'tampered-seed-hash';
  await harness.databaseService.setCopperValeSeedLifecycleState(state);
  await assert.rejects(
    runCopperValeSeedLifecycle(new DatabaseService(), { action: 'readback' }),
    /source\/catalog seed plan changed/
  );
});

test('gameplay mutations survive complete reruns and durable readback', async () => {
  const plan = buildCopperValeSeedPlan();
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  const CelestialBody = mongoose.model('CelestialBody');
  const Market = mongoose.model('Market');
  const changedBodyId = plan.expectedBodyIds.find((id) =>
    plan.bodies.find((body) => body.id === id).bodyType === 'asteroid'
  );
  await CelestialBody.updateOne(
    { id: changedBodyId },
    { $set: { state: 'destroyed', destroyedAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T01:00:00.000Z' } }
  );
  await Market.updateOne(
    { marketId: plan.station.marketId },
    {
      $set: {
        'inventory.0.stock': 3,
        ledger: [{
          transactionId: 'pilot-trade-1',
          requestId: null,
          characterId: 'pilot-character',
          itemId: 'ore',
          direction: 'buy',
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
          timestamp: '2026-11-08T00:00:00.000Z',
          reversalOfTransactionId: null,
        }],
      },
    }
  );
  const bodyBefore = await harness.databaseService.getCelestialBodyById(changedBodyId);
  const marketBefore = (await harness.databaseService.getMarkets({ solarSystemId: 'exo-gj-9066' }))
    .find((entry) => entry.marketId === plan.station.marketId);

  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  const bodyAfter = await new DatabaseService().getCelestialBodyById(changedBodyId);
  const marketAfter = (await new DatabaseService().getMarkets({ solarSystemId: 'exo-gj-9066' }))
    .find((entry) => entry.marketId === plan.station.marketId);
  assert.equal(bodyAfter.state, 'destroyed');
  assert.deepEqual(bodyAfter.composition, bodyBefore.composition);
  assert.equal(marketAfter.inventory[0].stock, 3);
  assert.deepEqual(marketAfter.ledger, marketBefore.ledger);

  const rollback = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'rollback' });
  assert.equal(rollback.status, 'refused');
  assert.match(rollback.reason, /no reviewed policy/);
  assert.ok(await harness.databaseService.getCelestialBodyById(changedBodyId));
  assert.equal((await harness.databaseService.getMarkets({ solarSystemId: 'exo-gj-9066' })).length, 1);
});

test('rollback removes only pristine journaled partial writes and refuses gameplay-used records', async () => {
  const plan = buildCopperValeSeedPlan();
  await assert.rejects(
    runCopperValeSeedLifecycle(harness.databaseService, {
      action: 'apply',
      afterBodyWrite: async () => { throw new Error('stop-after-write'); },
    }),
    /stop-after-write/
  );
  const firstId = plan.bodies[0].id;
  const rollback = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'rollback' });
  assert.equal(rollback.status, 'rolled-back');
  assert.deepEqual(rollback.deletedBodyIds, [firstId]);
  assert.equal(await harness.databaseService.getCelestialBodyById(firstId), null);
  assert.equal((await harness.databaseService.getCelestialBodies({ solarSystemId: 'exo-gj-9066' })).length, 0);

  await harness.clearDatabase();
  await assert.rejects(
    runCopperValeSeedLifecycle(harness.databaseService, {
      action: 'apply',
      afterBodyWrite: async () => { throw new Error('stop-after-write'); },
    }),
    /stop-after-write/
  );
  const usedId = plan.bodies[0].id;
  await mongoose.model('CelestialBody').updateOne(
    { id: usedId },
    { $set: { state: 'destroyed', destroyedAt: '2026-11-08T00:00:00.000Z' } }
  );
  const refused = await runCopperValeSeedLifecycle(harness.databaseService, { action: 'rollback' });
  assert.equal(refused.status, 'refused');
  assert.deepEqual(refused.deletedBodyIds, []);
  assert.deepEqual(refused.usedBodyIds, [usedId]);
  assert.equal((await harness.databaseService.getCelestialBodyById(usedId)).state, 'destroyed');
});
