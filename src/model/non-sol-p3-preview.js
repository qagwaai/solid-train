'use strict';

const { createHash } = require('node:crypto');
const { previewExpandedNonSolSystem } = require('./non-sol-expanded-augmentation');
const { hillRadiusKm } = require('./non-sol-augmentation');
const { normalizeStationPlacement } = require('./station-placement');
const { MARKET_CATALOG_BY_ID } = require('./market-catalog');

const SYSTEM_ID = 'exo-gj-9066';
const RESOURCE_POLICY_VERSION = 'copper-vale-asteroid-resources-v1';
const STATION_POLICY_VERSION = 'copper-vale-station-placement-v1';
const STATION_ID = 'copper-vale-asteroid-exchange';
const RESOURCE_COUNTS = Object.freeze({
  silicon: 10,
  iron: 8,
  carbon: 4,
  nickel: 2,
  copper: 2,
});
const RESOURCE_IDS = Object.freeze(Object.keys(RESOURCE_COUNTS));
const GRAVITATIONAL_CONSTANT_KM3_KG_S2 = 6.6743e-20;
const MIN_CLEARANCE_KM = 1000;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stableIdHash = (value) => sha256(`${RESOURCE_POLICY_VERSION}|${value}`);

function assertMaterialCatalog() {
  for (const id of RESOURCE_IDS) {
    const material = MARKET_CATALOG_BY_ID.get(id);
    if (!material || material.rarity !== 'Common') {
      throw new Error(`P3 material '${id}' is not an existing Common market item`);
    }
  }
}

function assignAsteroidResources(bodies) {
  assertMaterialCatalog();
  const asteroids = bodies.filter((body) => body.bodyType === 'asteroid');
  if (asteroids.length !== 26) {
    throw new Error(
      `Copper Vale P3 requires exactly 26 generated asteroids; found ${asteroids.length}`
    );
  }
  const ordered = [...asteroids].sort(
    (a, b) => stableIdHash(a.id).localeCompare(stableIdHash(b.id)) || a.id.localeCompare(b.id)
  );
  const assignments = new Map();
  let index = 0;
  for (const [materialItemType, count] of Object.entries(RESOURCE_COUNTS)) {
    for (let offset = 0; offset < count; offset++) {
      assignments.set(ordered[index++].id, materialItemType);
    }
  }
  return bodies.map((body) => {
    const materialItemType = assignments.get(body.id);
    if (!materialItemType) return body;
    return {
      ...body,
      composition: { ...body.composition, material: materialItemType, rarity: 'Common' },
      universeMetadata: {
        ...body.universeMetadata,
        provenance: {
          ...body.universeMetadata.provenance,
          fieldSources: [
            ...body.universeMetadata.provenance.fieldSources,
            {
              field: 'universeMetadata.resourceProfile',
              derivation: 'authored',
              reference: RESOURCE_POLICY_VERSION,
              uncertainty: 'Hypothetical gameplay deposit; not measured bulk composition.',
            },
          ],
        },
        resourceProfile: {
          materialItemTypes: [materialItemType],
          abundance: 'moderate',
          accessibility: 'accessible',
          policyVersion: RESOURCE_POLICY_VERSION,
        },
      },
    };
  });
}

function stationOrbitFor(preview) {
  const hostId = 'exo-gj-9066-generated-planet-d569077cea00ac968d730c15';
  const host = [...preview.baseBodies, ...preview.generatedBodies].find(
    (body) => body.id === hostId
  );
  const star = preview.baseBodies.find((body) => body.bodyType === 'star');
  if (
    !host ||
    !star ||
    host.bodyType !== 'planet' ||
    host.surfaceArchetype !== 'rocky' ||
    !host.orbitalElements ||
    !host.spatial ||
    host.spatial.frame !== 'barycentric' ||
    !Number.isFinite(host.spatial.epochMs) ||
    !Number.isFinite(host.physicalCatalog?.massKg) ||
    !Number.isFinite(host.physicalCatalog?.meanRadiusKm)
  ) {
    throw new Error(
      'Preferred Copper Vale station host is missing canonical physical/snapshot data'
    );
  }
  const radiusKm = host.physicalCatalog.meanRadiusKm * 2;
  const hostRadiusKm = host.physicalCatalog.meanRadiusKm;
  const clearanceKm = radiusKm - hostRadiusKm;
  const hillPeriapsisKm = hillRadiusKm(
    host.orbitalElements,
    host.physicalCatalog.massKg,
    star.physicalCatalog.massKg
  );
  if (clearanceKm < MIN_CLEARANCE_KM || radiusKm > 0.1 * hillPeriapsisKm) {
    throw new Error('Copper Vale station orbit fails surface-clearance or Hill-radius screen');
  }
  const envelopes = [];
  for (const body of [...preview.baseBodies, ...preview.generatedBodies]) {
    if (body.id === host.id) continue;
    if (body.parentBodyId === host.id && body.bodyType === 'moon' && body.orbitalElements) {
      const orbit = body.orbitalElements;
      envelopes.push({
        inner: orbit.semiMajorAxisKm * (1 - orbit.eccentricity),
        outer: orbit.semiMajorAxisKm * (1 + orbit.eccentricity),
      });
    }
  }
  for (const ring of preview.ringProposals.filter((entry) => entry.hostBodyId === host.id)) {
    envelopes.push({ inner: ring.rings.innerRadiusKm, outer: ring.rings.outerRadiusKm });
  }
  if (host.rings)
    envelopes.push({
      inner: host.rings.innerRadiusKm,
      outer: host.rings.outerRadiusKm,
    });
  const envelopeGapsKm = envelopes.map((envelope) =>
    Math.min(Math.abs(radiusKm - envelope.inner), Math.abs(radiusKm - envelope.outer))
  );
  if (
    envelopes.some(
      (envelope, index) =>
        envelopeGapsKm[index] < MIN_CLEARANCE_KM ||
        (radiusKm >= envelope.inner && radiusKm <= envelope.outer)
    )
  ) {
    throw new Error('Copper Vale station orbit fails ring/moon radial-envelope clearance');
  }
  const envelopeGapKm = envelopeGapsKm.length ? Math.min(...envelopeGapsKm) : Infinity;
  const periodSec =
    2 *
    Math.PI *
    Math.sqrt(radiusKm ** 3 / (GRAVITATIONAL_CONSTANT_KM3_KG_S2 * host.physicalCatalog.massKg));
  const epoch = new Date(host.spatial.epochMs).toISOString();
  return {
    host,
    radiusKm,
    clearanceKm,
    hillPeriapsisKm,
    envelopeGapKm,
    periodSec,
    epoch,
    orbit: {
      anchorBodyId: host.id,
      anchorBodyName: host.displayName,
      orbitType: 'circular',
      semiMajorAxisKm: radiusKm,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: periodSec,
      epoch,
    },
  };
}

function buildStation(preview) {
  const placement = {
    kind: 'body-orbit',
    primaryBodyId: 'exo-gj-9066-generated-planet-d569077cea00ac968d730c15',
    activation: 'active',
    stationKeeping: false,
    provenance: STATION_POLICY_VERSION,
    reason: 'Offline Copper Vale P3 marketplace orbit; metadata activation only.',
  };
  const resolvedPlacement = normalizeStationPlacement(placement, {
    kind: 'orbital-elements',
    orbit: { anchorBodyId: placement.primaryBodyId },
  });
  const { host, orbit, radiusKm } = stationOrbitFor(preview);
  return {
    marketId: STATION_ID,
    solarSystemId: SYSTEM_ID,
    marketName: 'Copper Vale Asteroid Exchange',
    siteType: 'station',
    siteName: 'Copper Vale Inner Planet Orbital Station',
    isStarterMarket: false,
    priceMultiplier: 1,
    driftPercentPerHour: 4,
    restockIntervalMinutes: 60,
    stationPlacement: resolvedPlacement,
    trajectory: { kind: 'orbital-elements', orbit },
    spatial: {
      solarSystemId: SYSTEM_ID,
      frame: 'barycentric',
      positionKm: {
        x: host.spatial.positionKm.x + radiusKm,
        y: host.spatial.positionKm.y,
        z: host.spatial.positionKm.z,
      },
      epochMs: host.spatial.epochMs,
    },
    provenance: { policyVersion: STATION_POLICY_VERSION, origin: 'hypothetical' },
  };
}

function previewCopperValeP3(options = {}) {
  if (options.systemId !== undefined && options.systemId !== SYSTEM_ID) {
    throw new Error('Copper Vale P3 preview is bounded to exo-gj-9066');
  }
  const expanded = previewExpandedNonSolSystem(SYSTEM_ID, options);
  const generatedBodies = assignAsteroidResources(expanded.generatedBodies);
  const resourceCounts = Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  for (const body of generatedBodies) {
    if (body.bodyType === 'asteroid') {
      const [material] = body.universeMetadata.resourceProfile.materialItemTypes;
      resourceCounts[material]++;
    }
  }
  const station = buildStation({ ...expanded, generatedBodies });
  const stationOrbit = stationOrbitFor({ ...expanded, generatedBodies });
  const result = {
    schemaVersion: 'copper-vale-p3-preview-v1',
    systemId: SYSTEM_ID,
    epoch: expanded.epoch,
    resourcePolicyVersion: RESOURCE_POLICY_VERSION,
    stationPolicyVersion: STATION_POLICY_VERSION,
    runtimeEnabled: false,
    databaseWrites: false,
    expandedPreviewSha256: expanded.outputSha256,
    baseBodies: expanded.baseBodies,
    generatedBodies,
    station,
    resourceCounts,
    stationClearance: {
      hostRadiusKm: stationOrbit.host.physicalCatalog.meanRadiusKm,
      surfaceClearanceKm: stationOrbit.clearanceKm,
      hillPeriapsisKm: stationOrbit.hillPeriapsisKm,
      hillFraction: stationOrbit.radiusKm / stationOrbit.hillPeriapsisKm,
      stationRadiusKm: stationOrbit.radiusKm,
      orbitalPeriodSec: stationOrbit.periodSec,
      moonAndRingEnvelopeGapKm: stationOrbit.envelopeGapKm,
      snapshotEpoch: station.spatial.epochMs,
    },
  };
  return { ...result, outputSha256: sha256(JSON.stringify(result)) };
}

module.exports = {
  SYSTEM_ID,
  RESOURCE_POLICY_VERSION,
  RESOURCE_COUNTS,
  STATION_ID,
  previewCopperValeP3,
};
