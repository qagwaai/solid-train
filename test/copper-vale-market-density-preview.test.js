'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { previewCopperValeP3 } = require('../src/model/non-sol-p3-preview');
const { previewCopperValeP4 } = require('../src/model/non-sol-p4-preview');
const {
  MIN_CLEARANCE_KM,
  previewCopperValeMarketDensity,
  screenCircularOrbit,
} = require('../src/model/copper-vale-market-density-preview');
const { computeRelativePositionKm } = require('../src/model/solar-system-celestial-seed');

const EPOCH = '2000-01-01T12:00:00.000Z';

function makeHost() {
  const radiusKm = 2000;
  const hostMassKg = 1e20;
  const starMassKg = 1e30;
  const hillFactor = Math.cbrt(hostMassKg / (3 * (starMassKg + hostMassKg)));
  return {
    host: {
      id: 'test-host',
      displayName: 'Test Host',
      parentBodyId: 'test-star',
      physicalCatalog: { massKg: hostMassKg, meanRadiusKm: radiusKm - MIN_CLEARANCE_KM },
      orbitalElements: {
        semiMajorAxisKm: (10 * radiusKm) / hillFactor,
        eccentricity: 0,
      },
      spatial: {
        solarSystemId: 'test-system',
        frame: 'barycentric',
        positionKm: { x: 10000, y: 20000, z: 30000 },
        epochMs: Date.parse(EPOCH),
      },
    },
    starMassKg,
    radiusKm,
  };
}

function screenFixture(overrides = {}) {
  const fixture = makeHost();
  return screenCircularOrbit({
    host: fixture.host,
    starMassKg: fixture.starMassKg,
    radiusKm: fixture.radiusKm,
    epoch: EPOCH,
    ...overrides,
  });
}

test('density preview preserves accepted P3/P4 outputs and exposes six stable market IDs', () => {
  const p3Before = previewCopperValeP3();
  const p4Before = previewCopperValeP4();
  const preview = previewCopperValeMarketDensity();
  const p3After = previewCopperValeP3();
  const p4After = previewCopperValeP4();

  assert.deepEqual(p3After, p3Before);
  assert.deepEqual(p4After, p4Before);
  assert.equal(preview.acceptedP3Sha256, p3Before.outputSha256);
  assert.equal(preview.acceptedP4Sha256, p4Before.outputSha256);
  assert.equal(preview.p4BaselinePreserved, true);
  assert.equal(preview.retainedMarket.marketId, 'copper-vale-asteroid-exchange');
  assert.deepEqual(preview.retainedMarket, p4Before.station);
  assert.equal(preview.totalMarkets, 6);
  assert.deepEqual(preview.marketIds, [
    'copper-vale-asteroid-exchange',
    'copper-vale-far-compass-ship-sales',
    'copper-vale-gj9066c-exchange',
    'copper-vale-hearthward-trade',
    'copper-vale-long-horizon-research',
    'copper-vale-stillglass-supply',
  ]);
  assert.equal(preview.runtimeEnabled, false);
  assert.equal(preview.databaseWrites, false);
  assert.equal(preview.proposalOnly, false);
  assert.equal(preview.ownerApprovalRequired, false);
  const research = preview.proposedAdditions.find((entry) => entry.marketId === 'copper-vale-long-horizon-research');
  assert.equal(research.marketName, 'Long Horizon Research Outpost');
  assert.equal(research.siteName, 'Long Horizon Research Outpost');
  assert.equal(preview.outputSha256, '7dbbb79542b549c19e389452def883c4ec82ee547525498d049c88d4502c5ba4');
});

test('all five additions clear host, moon/ring, and station envelopes and use consistent barycentric snapshots', () => {
  const p4 = previewCopperValeP4();
  const bodies = [...p4.baseBodies, ...p4.generatedBodies];
  const preview = previewCopperValeMarketDensity();
  assert.equal(preview.proposedAdditions.length, 5);
  for (const candidate of preview.proposedAdditions) {
    assert.equal(candidate.status, 'owner-approved');
    assert.equal(candidate.namingStatus, 'owner-approved-neutral-English-descriptor');
    assert.equal(candidate.spatial.frame, 'barycentric');
    assert.equal(candidate.spatial.epochMs, Date.parse(preview.epoch));
    assert.equal(candidate.trajectory.orbit.epoch, preview.epoch);
    assert.ok(candidate.clearance.surfaceClearanceKm >= MIN_CLEARANCE_KM);
    assert.ok(candidate.clearance.hillFraction <= 0.1);
    assert.ok(candidate.clearance.orbitalPeriodSec > 0);
    assert.ok(Number.isFinite(candidate.clearance.orbitalPeriodSec));
    assert.ok(
      candidate.clearance.moonAndRingGaps.every((envelope) => envelope.gapKm >= MIN_CLEARANCE_KM)
    );
    const host = bodies.find((body) => body.id === candidate.stationPlacement.primaryBodyId);
    const relative = computeRelativePositionKm(
      candidate.trajectory.orbit,
      Date.parse(candidate.trajectory.orbit.epoch)
    );
    assert.deepEqual(candidate.spatial.positionKm, {
      x: host.spatial.positionKm.x + relative.x,
      y: host.spatial.positionKm.y + relative.y,
      z: host.spatial.positionKm.z + relative.z,
    });
  }
  assert.equal(preview.stationToStationScreenSummary.pairCount, 15);
  assert.equal(preview.stationToStationScreenSummary.screenedPairs, 15);
  assert.equal(preview.stationToStationScreenSummary.blockedPairs, 0);
  assert.ok(
    preview.stationToStationScreens.every(
      (pair) =>
        pair.status === 'screened' &&
        pair.minimumSeparationKm >= MIN_CLEARANCE_KM &&
        pair.method.includes('all-phases')
    )
  );
  assert.equal(
    preview.stationToStationScreens.find((pair) =>
      pair.marketIds.includes('copper-vale-hearthward-trade')
    ).method,
    'same-anchor-radial-envelopes-all-phases'
  );

  const supply = preview.proposedAdditions.find(
    (candidate) => candidate.marketId === 'copper-vale-stillglass-supply'
  );
  const ring = preview.p2RingProposal.find(
    (proposal) => proposal.hostBodyId === supply.stationPlacement.primaryBodyId
  );
  assert.ok(ring);
  assert.ok(
    supply.clearance.moonAndRingGaps.some((entry) => entry.sourceType === 'p2-ring-proposal')
  );
  assert.ok(
    supply.trajectory.orbit.semiMajorAxisKm - ring.rings.outerRadiusKm >= MIN_CLEARANCE_KM
  );
});

test('preview is deterministic and host/envelope ordering does not affect a site screen', () => {
  const first = previewCopperValeMarketDensity();
  const second = previewCopperValeMarketDensity();
  assert.deepEqual(second, first);

  const preview = previewCopperValeP4();
  const host = preview.generatedBodies.find((body) => body.displayName === 'Hearthward');
  const bodies = [...preview.baseBodies, ...preview.generatedBodies];
  const peer = preview.station;
  const args = {
    host,
    starMassKg: preview.baseBodies.find((body) => body.bodyType === 'star').physicalCatalog.massKg,
    radiusKm: 3 * host.physicalCatalog.meanRadiusKm,
    bodies,
    peerStations: [peer],
    epoch: preview.epoch,
  };
  assert.deepEqual(
    screenCircularOrbit(args),
    screenCircularOrbit({
      ...args,
      bodies: [...bodies].reverse(),
      peerStations: [...args.peerStations].reverse(),
    })
  );
});

test('physical screens accept exact limits and reject values just outside each limit', () => {
  const fixture = makeHost();
  const moon = {
    id: 'boundary-moon',
    bodyType: 'moon',
    parentBodyId: fixture.host.id,
    physicalCatalog: { meanRadiusKm: 0 },
    orbitalElements: { semiMajorAxisKm: fixture.radiusKm + MIN_CLEARANCE_KM, eccentricity: 0 },
  };
  const peer = {
    marketId: 'boundary-peer',
    stationPlacement: { primaryBodyId: fixture.host.id },
    trajectory: { orbit: { semiMajorAxisKm: fixture.radiusKm + MIN_CLEARANCE_KM } },
  };
  const atBoundary = screenFixture({ bodies: [moon], peerStations: [peer] });
  assert.equal(atBoundary.status, 'screened');
  assert.equal(atBoundary.clearance.surfaceClearanceKm, MIN_CLEARANCE_KM);
  assert.ok(Math.abs(atBoundary.clearance.hillFraction - 0.1) < 1e-12);
  assert.equal(atBoundary.clearance.moonAndRingGaps[0].gapKm, MIN_CLEARANCE_KM);
  assert.equal(atBoundary.clearance.sameHostStationGaps[0].gapKm, MIN_CLEARANCE_KM);

  assert.ok(
    screenFixture({ radiusKm: fixture.radiusKm - 0.001 }).failures.includes(
      'surface-clearance-below-1000-km'
    )
  );
  assert.ok(
    screenFixture({ radiusKm: fixture.radiusKm * (1 + 1e-8) }).failures.includes(
      'orbit-exceeds-0.1-periapsis-hill-radius'
    )
  );
  const tooCloseMoon = {
    ...moon,
    orbitalElements: {
      ...moon.orbitalElements,
      semiMajorAxisKm: fixture.radiusKm + MIN_CLEARANCE_KM - 0.001,
    },
  };
  assert.ok(
    screenFixture({ bodies: [tooCloseMoon] }).failures.includes(
      'moon-or-ring-envelope-clearance-below-1000-km'
    )
  );
  const tooClosePeer = {
    ...peer,
    trajectory: {
      orbit: { semiMajorAxisKm: fixture.radiusKm + MIN_CLEARANCE_KM - 0.001 },
    },
  };
  assert.ok(
    screenFixture({ peerStations: [tooClosePeer] }).failures.includes(
      'same-host-station-envelope-clearance-below-1000-km'
    )
  );
});

test('invalid orbit inputs fail clearly instead of yielding an unscreened candidate', () => {
  assert.throws(() => screenFixture({ radiusKm: NaN }), /finite positive number/);
  assert.throws(
    () => screenCircularOrbit({ host: {}, starMassKg: 1e30, radiusKm: 2000, epoch: EPOCH }),
    /requires a host body with an ID/
  );
  const fixture = makeHost();
  assert.throws(
    () =>
      screenCircularOrbit({
        host: { ...fixture.host, physicalCatalog: { meanRadiusKm: 1000 } },
        starMassKg: fixture.starMassKg,
        radiusKm: fixture.radiusKm,
        epoch: EPOCH,
      }),
    /lacks canonical physical\/orbital\/snapshot data/
  );
});

test('full canonical per-market inventory and default ship listings are repeated six times', () => {
  const { supply } = previewCopperValeMarketDensity();
  assert.equal(supply.marketCount, 6);
  assert.equal(supply.inventoryRows, 126);
  assert.equal(supply.perItem.length, 21);
  assert.ok(supply.perItem.every((item) => item.marketRows === 6));
  assert.equal(supply.aggregateStock, 71520);
  assert.equal(supply.aggregateMaxStock, 71520);
  assert.equal(supply.aggregateRestockCapacityPerInterval, 5706);
  assert.equal(supply.aggregateRestockPerInterval, 5706);
  assert.equal(supply.defaultShipListings, 6);
  assert.equal(supply.defaultShipUnits, 6);
  assert.equal(supply.shipStarterInventoryUnits, 36);
  assert.equal(supply.aggregateStock / 6, 11920);
  assert.equal(supply.aggregateRestockCapacityPerInterval / 6, 951);
});

test('role themes do not claim new research, repair, or logistics mechanics', () => {
  const preview = previewCopperValeMarketDensity();
  const research = preview.proposedAdditions.find((entry) => entry.roleTheme === 'research');
  const shipSales = preview.proposedAdditions.find((entry) => entry.roleTheme === 'ship-sales');
  const supply = preview.proposedAdditions.find((entry) => entry.roleTheme === 'logistics-supply');
  assert.match(research.proposedCapability, /no research mechanics/);
  assert.match(shipSales.proposedCapability, /no new repair, refit/);
  assert.match(supply.proposedCapability, /no logistics service mechanics/);
});
