'use strict';

const { createHash } = require('node:crypto');
const { MessageHandlerContext } = require('../handlers/message-handler-context');
const { createSeedMarketPayload } = require('../handlers/context/context-bootstrap-service');
const { previewCopperValeP4 } = require('./non-sol-p4-preview');
const { previewCopperValeP3 } = require('./non-sol-p3-preview');
const { previewExpandedNonSolSystem } = require('./non-sol-expanded-augmentation');
const { hillRadiusKm } = require('./non-sol-augmentation');
const { normalizeStationPlacement } = require('./station-placement');
const { computeRelativePositionKm } = require('./solar-system-celestial-seed');

const POLICY_VERSION = 'copper-vale-market-density-screen-v1';
const MIN_CLEARANCE_KM = 1000;
const GRAVITATIONAL_CONSTANT_KM3_KG_S2 = 6.6743e-20;
const CANDIDATES = Object.freeze([
  {
    marketId: 'copper-vale-hearthward-trade',
    marketName: 'Hearthward Inner Orbit Trade Exchange',
    siteName: 'Hearthward Inner Orbit Trade Station',
    hostName: 'Hearthward',
    roleTheme: 'general-trade',
    orbitalRadiusMultiple: 3,
    proposedCapability: 'Ordinary market trade only; general-trade role is descriptive.',
  },
  {
    marketId: 'copper-vale-stillglass-supply',
    marketName: 'Stillglass Reach Supply Depot',
    siteName: 'Stillglass Reach Orbital Supply Station',
    hostName: 'Stillglass Reach',
    roleTheme: 'logistics-supply',
    orbitalRadiusKm: 22000,
    proposedCapability: 'Ordinary market trade only; no logistics service mechanics.',
  },
  {
    marketId: 'copper-vale-gj9066c-exchange',
    marketName: 'GJ 9066 c Orbital Exchange',
    siteName: 'GJ 9066 c Orbital Exchange Station',
    hostName: 'GJ 9066 c',
    roleTheme: 'general-trade-logistics',
    orbitalRadiusMultiple: 2,
    proposedCapability: 'Ordinary market trade only; exchange/logistics role is descriptive.',
  },
  {
    marketId: 'copper-vale-far-compass-ship-sales',
    marketName: 'Far Compass Ship Sales Exchange',
    siteName: 'Far Compass Ship Sales Station',
    hostName: 'Far Compass',
    roleTheme: 'ship-sales',
    orbitalRadiusMultiple: 2,
    proposedCapability:
      'Existing default ship-sale listings only; no new repair, refit, or service capability.',
  },
  {
    marketId: 'copper-vale-long-horizon-research',
    marketName: 'Long Horizon Research Outpost',
    siteName: 'Long Horizon Research Outpost',
    hostName: 'Long Horizon',
    roleTheme: 'research',
    orbitalRadiusMultiple: 2,
    proposedCapability:
      'Ordinary market trade only; research theme adds no research mechanics or service.',
  },
]);

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const finitePositive = (value) => Number.isFinite(value) && value > 0;

function requirePositive(value, label) {
  if (!finitePositive(value)) {
    throw new Error(`${label} must be a finite positive number`);
  }
}

function radialEnvelopeGap(left, right) {
  const leftInner = left.inner ?? left.innerKm;
  const leftOuter = left.outer ?? left.outerKm;
  const rightInner = right.inner ?? right.innerKm;
  const rightOuter = right.outer ?? right.outerKm;
  if (leftOuter < rightInner) return rightInner - leftOuter;
  if (rightOuter < leftInner) return leftInner - rightOuter;
  return 0;
}

function hostMoonAndRingEnvelopes(host, bodies, ringProposals) {
  const envelopes = [];
  for (const moon of bodies
    .filter((body) => body.parentBodyId === host.id && body.bodyType === 'moon')
    .sort((left, right) => left.id.localeCompare(right.id))) {
    const orbit = moon.orbitalElements;
    const moonRadiusKm = moon.physicalCatalog?.meanRadiusKm;
    if (
      !orbit ||
      !finitePositive(orbit.semiMajorAxisKm) ||
      !Number.isFinite(orbit.eccentricity) ||
      orbit.eccentricity < 0 ||
      orbit.eccentricity >= 1 ||
      !Number.isFinite(moonRadiusKm) ||
      moonRadiusKm < 0
    ) {
      throw new Error(`Moon ${moon.id} has incomplete orbital-envelope or physical-radius data`);
    }
    envelopes.push({
      sourceId: moon.id,
      sourceType: 'moon',
      innerKm: orbit.semiMajorAxisKm * (1 - orbit.eccentricity) - moonRadiusKm,
      outerKm: orbit.semiMajorAxisKm * (1 + orbit.eccentricity) + moonRadiusKm,
    });
  }
  for (const proposal of ringProposals
    .filter((entry) => entry.hostBodyId === host.id)
    .sort((left, right) => left.hostBodyId.localeCompare(right.hostBodyId))) {
    const innerKm = proposal.rings?.innerRadiusKm;
    const outerKm = proposal.rings?.outerRadiusKm;
    if (!finitePositive(innerKm) || !finitePositive(outerKm) || outerKm < innerKm) {
      throw new Error(`Ring proposal for ${host.id} has invalid radial-envelope data`);
    }
    envelopes.push({
      sourceId: `${host.id}:p2-ring-proposal`,
      sourceType: 'p2-ring-proposal',
      innerKm,
      outerKm,
    });
  }
  if (host.rings) {
    if (
      !finitePositive(host.rings.innerRadiusKm) ||
      !finitePositive(host.rings.outerRadiusKm) ||
      host.rings.outerRadiusKm < host.rings.innerRadiusKm
    ) {
      throw new Error(`Host ${host.id} has invalid ring radial-envelope data`);
    }
    envelopes.push({
      sourceId: `${host.id}:existing-rings`,
      sourceType: 'existing-rings',
      innerKm: host.rings.innerRadiusKm,
      outerKm: host.rings.outerRadiusKm,
    });
  }
  return envelopes;
}

function screenCircularOrbit({
  host,
  starMassKg,
  radiusKm,
  bodies = [],
  ringProposals = [],
  peerStations = [],
  epoch,
}) {
  if (!host || typeof host !== 'object' || Array.isArray(host) || typeof host.id !== 'string') {
    throw new Error('Station orbit screen requires a host body with an ID');
  }
  requirePositive(radiusKm, 'Station orbital radius');
  requirePositive(starMassKg, 'Primary star mass');
  const hostRadiusKm = host.physicalCatalog?.meanRadiusKm;
  const hostMassKg = host.physicalCatalog?.massKg;
  const hostOrbit = host.orbitalElements;
  const hostPosition = host.spatial?.positionKm;
  if (
    !finitePositive(hostRadiusKm) ||
    !finitePositive(hostMassKg) ||
    !hostOrbit ||
    !finitePositive(hostOrbit.semiMajorAxisKm) ||
    !Number.isFinite(hostOrbit.eccentricity) ||
    hostOrbit.eccentricity < 0 ||
    hostOrbit.eccentricity >= 1 ||
    !hostPosition ||
    host.spatial.frame !== 'barycentric' ||
    typeof host.spatial.solarSystemId !== 'string' ||
    ![hostPosition.x, hostPosition.y, hostPosition.z].every(Number.isFinite) ||
    !Number.isFinite(host.spatial.epochMs) ||
    !Number.isFinite(Date.parse(epoch))
  ) {
    throw new Error(`Station orbit host ${host.id} lacks canonical physical/orbital/snapshot data`);
  }

  const surfaceClearanceKm = radiusKm - hostRadiusKm;
  const hillPeriapsisKm = hillRadiusKm(hostOrbit, hostMassKg, starMassKg);
  if (!finitePositive(hillPeriapsisKm)) {
    throw new Error(`Station orbit host ${host.id} has an invalid periapsis Hill radius`);
  }
  const moonAndRingEnvelopes = hostMoonAndRingEnvelopes(host, bodies, ringProposals);
  const moonAndRingGaps = moonAndRingEnvelopes.map((envelope) => ({
    ...envelope,
    gapKm: radialEnvelopeGap(
      { inner: radiusKm, outer: radiusKm },
      { inner: envelope.innerKm, outer: envelope.outerKm }
    ),
  }));
  const stationGaps = peerStations
    .filter((station) => station.stationPlacement?.primaryBodyId === host.id)
    .sort((left, right) => left.marketId.localeCompare(right.marketId))
    .map((station) => {
      const peerRadiusKm = station.trajectory?.orbit?.semiMajorAxisKm;
      requirePositive(peerRadiusKm, `Peer station ${station.marketId} orbital radius`);
      return {
        marketId: station.marketId,
        method: 'same-anchor-radial-envelopes-all-phases',
        gapKm: Math.abs(radiusKm - peerRadiusKm),
      };
    });

  const orbitalPeriodSec =
    2 *
    Math.PI *
    Math.sqrt(radiusKm ** 3 / (GRAVITATIONAL_CONSTANT_KM3_KG_S2 * hostMassKg));
  if (!finitePositive(orbitalPeriodSec)) {
    throw new Error(`Station orbit around ${host.id} has a non-finite Kepler period`);
  }
  const orbit = {
    anchorBodyId: host.id,
    anchorBodyName: host.displayName,
    orbitType: 'circular',
    semiMajorAxisKm: radiusKm,
    eccentricity: 0,
    inclinationDeg: 0,
    longitudeOfAscendingNodeDeg: 0,
    argumentOfPeriapsisDeg: 0,
    meanAnomalyAtEpochDeg: 0,
    orbitalPeriodSec,
    epoch,
  };
  const placement = normalizeStationPlacement(
    {
      kind: 'body-orbit',
      primaryBodyId: host.id,
      activation: 'active',
      stationKeeping: false,
      provenance: POLICY_VERSION,
      reason: 'Offline market-density candidate; proposal only, not a database write.',
    },
    { kind: 'orbital-elements', orbit: { anchorBodyId: host.id } }
  );
  const relativePosition = computeRelativePositionKm(orbit, Date.parse(epoch));
  const positionKm = {
    x: hostPosition.x + relativePosition.x,
    y: hostPosition.y + relativePosition.y,
    z: hostPosition.z + relativePosition.z,
  };
  const hostPeriapsisKm = hostOrbit.semiMajorAxisKm * (1 - hostOrbit.eccentricity);
  const hostApoapsisKm = hostOrbit.semiMajorAxisKm * (1 + hostOrbit.eccentricity);
  const starCenteredEnvelope = {
    innerKm: Math.max(0, hostPeriapsisKm - radiusKm),
    outerKm: hostApoapsisKm + radiusKm,
  };
  const failures = [];
  if (surfaceClearanceKm < MIN_CLEARANCE_KM) failures.push('surface-clearance-below-1000-km');
  if (radiusKm / hillPeriapsisKm > 0.1) failures.push('orbit-exceeds-0.1-periapsis-hill-radius');
  if (moonAndRingGaps.some((entry) => entry.gapKm < MIN_CLEARANCE_KM)) {
    failures.push('moon-or-ring-envelope-clearance-below-1000-km');
  }
  if (stationGaps.some((entry) => entry.gapKm < MIN_CLEARANCE_KM)) {
    failures.push('same-host-station-envelope-clearance-below-1000-km');
  }

  return {
    status: failures.length ? 'blocked' : 'screened',
    failures,
    placement,
    orbit,
    spatial: {
      solarSystemId: host.spatial.solarSystemId,
      frame: 'barycentric',
      positionKm,
      epochMs: host.spatial.epochMs,
    },
    clearance: {
      hostRadiusKm,
      surfaceClearanceKm,
      periapsisHillRadiusKm: hillPeriapsisKm,
      hillFraction: radiusKm / hillPeriapsisKm,
      moonAndRingGaps,
      sameHostStationGaps: stationGaps,
      orbitalPeriodSec,
      snapshotEpoch: host.spatial.epochMs,
      starCenteredEnvelope,
    },
  };
}

function stationToStationScreens(stations, bodies) {
  const byId = new Map(bodies.map((body) => [body.id, body]));
  const screens = [];
  const sortedStations = [...stations].sort((left, right) =>
    left.marketId.localeCompare(right.marketId)
  );
  for (let leftIndex = 0; leftIndex < sortedStations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sortedStations.length; rightIndex += 1) {
      const left = sortedStations[leftIndex];
      const right = sortedStations[rightIndex];
      const leftHost = byId.get(left.stationPlacement.primaryBodyId);
      const rightHost = byId.get(right.stationPlacement.primaryBodyId);
      if (leftHost.id === rightHost.id) {
        const minimumDistanceKm = Math.abs(
          left.trajectory.orbit.semiMajorAxisKm - right.trajectory.orbit.semiMajorAxisKm
        );
        screens.push({
          marketIds: [left.marketId, right.marketId],
          method: 'same-anchor-radial-envelopes-all-phases',
          minimumSeparationKm: minimumDistanceKm,
          status: minimumDistanceKm >= MIN_CLEARANCE_KM ? 'screened' : 'blocked',
        });
        continue;
      }
      if (
        leftHost.parentBodyId !== rightHost.parentBodyId ||
        !leftHost.orbitalElements ||
        !rightHost.orbitalElements
      ) {
        screens.push({
          marketIds: [left.marketId, right.marketId],
          method: 'unresolved-common-primary',
          status: 'blocked',
          reason: 'No shared primary orbital envelope is available for all-time screening.',
        });
        continue;
      }
      const minimumSeparationKm = radialEnvelopeGap(
        left.clearance.starCenteredEnvelope ||
          starCenteredEnvelope(leftHost, left.trajectory.orbit.semiMajorAxisKm),
        right.clearance.starCenteredEnvelope ||
          starCenteredEnvelope(rightHost, right.trajectory.orbit.semiMajorAxisKm)
      );
      screens.push({
        marketIds: [left.marketId, right.marketId],
        method: 'conservative-star-centered-kepler-radial-envelopes-all-phases',
        minimumSeparationKm,
        status: minimumSeparationKm >= MIN_CLEARANCE_KM ? 'screened' : 'blocked',
      });
    }
  }
  return screens;
}

function starCenteredEnvelope(host, stationRadiusKm) {
  const hostOrbit = host.orbitalElements;
  if (!hostOrbit || !finitePositive(hostOrbit.semiMajorAxisKm)) {
    throw new Error(`Station host ${host.id} has no primary-centered orbit for envelope screening`);
  }
  const hostPeriapsisKm = hostOrbit.semiMajorAxisKm * (1 - hostOrbit.eccentricity);
  const hostApoapsisKm = hostOrbit.semiMajorAxisKm * (1 + hostOrbit.eccentricity);
  return {
    innerKm: Math.max(0, hostPeriapsisKm - stationRadiusKm),
    outerKm: hostApoapsisKm + stationRadiusKm,
  };
}

function aggregateCanonicalSupply(markets, epoch) {
  const context = new MessageHandlerContext({ createId: () => 'offline-preview-only' });
  const payloads = markets.map((market) => createSeedMarketPayload(context, market, epoch));
  const perItem = new Map();
  for (const payload of payloads) {
    for (const item of payload.inventory) {
      const totals = perItem.get(item.itemId) || {
        itemId: item.itemId,
        marketRows: 0,
        stock: 0,
        maxStock: 0,
        restockPerInterval: 0,
      };
      totals.marketRows += 1;
      totals.stock += item.stock;
      totals.maxStock += item.maxStock;
      totals.restockPerInterval += item.restockPerInterval;
      perItem.set(item.itemId, totals);
    }
  }
  const defaultShipListings = payloads.reduce(
    (total, payload) => total + payload.shipListings.length,
    0
  );
  const defaultShipUnits = payloads.reduce(
    (total, payload) =>
      total +
      payload.shipListings.reduce((shipTotal, listing) => shipTotal + listing.quantityAvailable, 0),
    0
  );
  const shipStarterInventoryUnits = payloads.reduce(
    (total, payload) =>
      total +
      payload.shipListings.reduce(
        (shipTotal, listing) =>
          shipTotal +
          listing.starterInventory.reduce((inventoryTotal, item) => inventoryTotal + item.quantity, 0),
        0
      ),
    0
  );
  return {
    marketCount: payloads.length,
    inventoryRows: payloads.reduce((total, payload) => total + payload.inventory.length, 0),
    aggregateStock: [...perItem.values()].reduce((total, item) => total + item.stock, 0),
    aggregateMaxStock: [...perItem.values()].reduce((total, item) => total + item.maxStock, 0),
    aggregateRestockPerInterval: [...perItem.values()].reduce(
      (total, item) => total + item.restockPerInterval,
      0
    ),
    aggregateRestockCapacityPerInterval: [...perItem.values()].reduce(
      (total, item) => total + item.restockPerInterval,
      0
    ),
    perItem: [...perItem.values()].sort((left, right) =>
      left.itemId.localeCompare(right.itemId)
    ),
    defaultShipListings,
    defaultShipUnits,
    shipStarterInventoryUnits,
  };
}

function previewCopperValeMarketDensity(options = {}) {
  const p4 = previewCopperValeP4(options);
  const bodies = [...p4.baseBodies, ...p4.generatedBodies];
  const p2 = previewExpandedNonSolSystem(p4.systemId, { epoch: p4.epoch });
  const star = p4.baseBodies.find((body) => body.bodyType === 'star');
  if (!star || !finitePositive(star.physicalCatalog?.massKg)) {
    throw new Error('Copper Vale density screening requires canonical primary-star mass');
  }
  const acceptedStation = structuredClone(p4.station);
  const p3 = previewCopperValeP3(options);
  /** @type {Array<any>} */
  const stations = [
    {
      ...acceptedStation,
      status: 'retained-existing',
      roleTheme: 'mining-exchange',
      capabilityScope: 'Existing ordinary market; mining/exchange role is descriptive.',
      clearance: {
        method: 'accepted-P3-screen',
        ...p3.stationClearance,
      },
    },
  ];
  const candidateResults = [];
  for (const candidate of CANDIDATES) {
    const host = bodies.find((body) => body.displayName === candidate.hostName);
    if (!host) throw new Error(`Density candidate host is missing from P4: ${candidate.hostName}`);
    const radiusKm =
      candidate.orbitalRadiusKm ??
      host.physicalCatalog.meanRadiusKm * candidate.orbitalRadiusMultiple;
    const screened = screenCircularOrbit({
      host,
      starMassKg: star.physicalCatalog.massKg,
      radiusKm,
      bodies,
      ringProposals: p2.ringProposals,
      peerStations: stations,
      epoch: p4.epoch,
    });
    const result = {
      marketId: candidate.marketId,
      marketName: candidate.marketName,
      siteName: candidate.siteName,
      solarSystemId: p4.systemId,
      siteType: 'station',
      isStarterMarket: false,
      priceMultiplier: 1,
      driftPercentPerHour: 4,
      restockIntervalMinutes: 60,
      stationPlacement: screened.placement,
      trajectory: { kind: 'orbital-elements', orbit: screened.orbit },
      spatial: screened.spatial,
      provenance: { policyVersion: POLICY_VERSION, origin: 'hypothetical' },
      status: screened.status === 'screened' ? 'owner-approved' : 'blocked',
      roleTheme: candidate.roleTheme,
      proposedCapability: candidate.proposedCapability,
      capabilityScope: candidate.proposedCapability,
      namingStatus: 'owner-approved-neutral-English-descriptor',
      clearance: screened.clearance,
      ...(screened.failures.length ? { screenFailures: screened.failures } : {}),
    };
    candidateResults.push(result);
    if (screened.status === 'screened') {
      const pairScreens = stationToStationScreens([...stations, result], bodies).filter((entry) =>
        entry.marketIds.includes(result.marketId)
      );
      const blockedStationPairs = pairScreens.filter((entry) => entry.status !== 'screened');
      if (blockedStationPairs.length) {
        result.status = 'blocked';
        result.screenFailures = [
          ...(result.screenFailures || []),
          'station-station-envelope-clearance-below-1000-km-or-unresolved',
        ];
      } else {
        stations.push(result);
      }
    }
  }

  const stationPairScreens = stationToStationScreens(stations, bodies);
  const acceptedMarkets = stations.filter(
    (station) => station.status === 'retained-existing' || station.status === 'owner-approved'
  );
  const blockedPairs = stationPairScreens.filter((entry) => entry.status !== 'screened');
  const supply = aggregateCanonicalSupply(acceptedMarkets, p4.epoch);
  const result = {
    schemaVersion: 'copper-vale-market-density-preview-v1',
    policyVersion: POLICY_VERSION,
    systemId: p4.systemId,
    epoch: p4.epoch,
    runtimeEnabled: false,
    databaseWrites: false,
    proposalOnly: false,
    ownerApprovalRequired: false,
    acceptedP3Sha256: p4.p3InputSha256,
    acceptedP4Sha256: p4.outputSha256,
    p4BaselinePreserved: true,
    totalMarkets: acceptedMarkets.length,
    retainedMarketIds: [p4.station.marketId],
    retainedMarket: p4.station,
    marketIds: acceptedMarkets.map((market) => market.marketId).sort(),
    markets: acceptedMarkets,
    proposedAdditions: candidateResults,
    stationToStationScreens: stationPairScreens,
    stationToStationScreenSummary: {
      pairCount: stationPairScreens.length,
      screenedPairs: stationPairScreens.filter((entry) => entry.status === 'screened').length,
      blockedPairs: blockedPairs.length,
      methods: [
        'Same-anchor radial envelopes provide a phase-independent separation.',
        'Different hosts use conservative star-centered Kepler radial envelopes; they do not depend on snapshot phases.',
      ],
      dynamicsLimitation:
        'Analytic Kepler/radial-envelope screening only; not an N-body, resonance, perturbation, station-keeping, thermal, radiation, or long-term stability proof.',
    },
    physicalThresholds: {
      minSurfaceClearanceKm: MIN_CLEARANCE_KM,
      maxPeriapsisHillFraction: 0.1,
      minMoonAndRingEnvelopeGapKm: MIN_CLEARANCE_KM,
      minStationEnvelopeGapKm: MIN_CLEARANCE_KM,
      moonEnvelopeIncludesMoonPhysicalRadius: true,
    },
    p2RingProposal: p2.ringProposals,
    supply,
  };
  return { ...result, outputSha256: hash(result) };
}

module.exports = {
  CANDIDATES,
  MIN_CLEARANCE_KM,
  POLICY_VERSION,
  previewCopperValeMarketDensity,
  screenCircularOrbit,
};
