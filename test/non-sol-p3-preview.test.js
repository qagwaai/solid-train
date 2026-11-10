'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { previewExpandedNonSolSystem } = require('../src/model/non-sol-expanded-augmentation');
const {
  previewCopperValeP3,
  RESOURCE_COUNTS,
  RESOURCE_POLICY_VERSION,
  STATION_ID,
} = require('../src/model/non-sol-p3-preview');
const { normalizeStationPlacement } = require('../src/model/station-placement');
const { MARKET_CATALOG_BY_ID } = require('../src/model/market-catalog');

test('Copper Vale P3 preview keeps P2 generation intact and assigns the approved single Common material counts', () => {
  const p2Before = previewExpandedNonSolSystem('exo-gj-9066');
  const p3 = previewCopperValeP3();
  const p2After = previewExpandedNonSolSystem('exo-gj-9066');
  assert.equal(p2Before.outputSha256, p2After.outputSha256);
  assert.equal(p3.runtimeEnabled, false);
  assert.equal(p3.databaseWrites, false);
  assert.equal(p3.generatedBodies.length, p2Before.generatedBodies.length);
  assert.deepEqual(
    p3.generatedBodies.map(({ id, physicalCatalog, orbitalElements }) => ({
      id,
      physicalCatalog,
      orbitalElements,
    })),
    p2Before.generatedBodies.map(({ id, physicalCatalog, orbitalElements }) => ({
      id,
      physicalCatalog,
      orbitalElements,
    }))
  );
  assert.equal(p3.generatedBodies.filter((body) => body.bodyType === 'asteroid').length, 26);
  assert.deepEqual(p3.resourceCounts, RESOURCE_COUNTS);
  for (const body of p3.generatedBodies.filter((entry) => entry.bodyType === 'asteroid')) {
    const [material] = body.universeMetadata.resourceProfile.materialItemTypes;
    assert.equal(body.composition.material, material);
    assert.equal(body.composition.rarity, 'Common');
    assert.equal(MARKET_CATALOG_BY_ID.get(material).rarity, 'Common');
    assert.equal(body.universeMetadata.resourceProfile.policyVersion, RESOURCE_POLICY_VERSION);
    assert.equal(body.universeMetadata.resourceProfile.accessibility, 'accessible');
    assert.equal(body.universeMetadata.resourceProfile.materialItemTypes.length, 1);
    assert.ok(
      body.universeMetadata.provenance.fieldSources.some(
        (entry) =>
          entry.field === 'universeMetadata.resourceProfile' && entry.derivation === 'authored'
      )
    );
  }
  assert.equal(
    p3.generatedBodies.filter(
      (body) => body.bodyType !== 'asteroid' && body.universeMetadata.resourceProfile
    ).length,
    0
  );
});

test('P3 resource identity is deterministic across order and epoch while physical P2 output stays epoch-dependent', () => {
  const first = previewCopperValeP3();
  const later = previewCopperValeP3({ epoch: '2026-11-07T00:00:00.000Z' });
  const materials = (preview) =>
    Object.fromEntries(
      preview.generatedBodies
        .filter((body) => body.bodyType === 'asteroid')
        .map((body) => [body.id, body.composition.material])
        .sort(([a], [b]) => a.localeCompare(b))
    );
  assert.deepEqual(materials(first), materials(later));
  assert.notDeepEqual(first.generatedBodies[0].spatial, later.generatedBodies[0].spatial);
  assert.equal(first.station.marketId, STATION_ID);
  assert.equal(first.outputSha256, previewCopperValeP3().outputSha256);
});

test('P3 station is one active metadata body-orbit with exact analytic clearances and canonical snapshot', () => {
  const preview = previewCopperValeP3();
  const { station, stationClearance } = preview;
  const host = preview.generatedBodies.find(
    (body) => body.id === station.stationPlacement.primaryBodyId
  );
  assert.equal(host.surfaceArchetype, 'rocky');
  const placement = normalizeStationPlacement(station.stationPlacement, station.trajectory);
  assert.equal(station.siteType, 'station');
  assert.equal(preview.station.siteType, 'station');
  assert.equal(station.solarSystemId, 'exo-gj-9066');
  assert.equal(placement.activation, 'active');
  assert.equal(placement.kind, 'body-orbit');
  assert.equal(station.trajectory.orbit.anchorBodyId, placement.primaryBodyId);
  assert.equal(station.trajectory.orbit.orbitType, 'circular');
  assert.equal(station.trajectory.orbit.eccentricity, 0);
  assert.equal(station.trajectory.orbit.epoch, new Date(station.spatial.epochMs).toISOString());
  assert.equal(station.spatial.frame, 'barycentric');
  assert.ok(
    Math.abs(station.trajectory.orbit.semiMajorAxisKm - 2 * stationClearance.hostRadiusKm) < 1e-8
  );
  assert.ok(stationClearance.surfaceClearanceKm >= 1000);
  assert.ok(stationClearance.hillFraction <= 0.1);
  assert.ok(stationClearance.moonAndRingEnvelopeGapKm >= 1000);
  assert.ok(station.trajectory.orbit.orbitalPeriodSec > 0);
  assert.equal(
    preview.generatedBodies.filter(
      (body) => body.bodyType === 'market' || body.siteType === 'station'
    ).length,
    0
  );
});

test('P3 preview is bounded to Copper Vale and CLI remains explicit/offline', () => {
  assert.throws(() => previewCopperValeP3({ systemId: 'exo-hr-8799' }));
  const { main } = require('../scripts/non-sol-p3-preview');
  const preview = main([]);
  assert.equal(preview.systemId, 'exo-gj-9066');
});
