'use strict';

const assert = require('node:assert/strict');
const policy = require('../../data/non-sol-bulk-policy-v1.json');
const legacy = require('../../data/non-sol-scientific-policy-v1.json');
const physical = require('../../data/non-sol-scientific-policy-v2.json');
const languagePolicy = require('../../data/system-naming-weight-policy-v2.json');
const bank = require('../../data/system-naming-review-bank-v1.json');
const { sha256 } = require('../../src/model/copper-vale-catalog-reconciliation');
const { stream, makeCandidate, makeBody, candidateOrbit, stellarRejection, moonRejection,
  density, hillRadiusKm, orbitEnvelope } = require('../../src/model/non-sol-augmentation');
const { estimateRadiusEarth, classifyCatalogPlanet } = require('../../src/model/exoplanet-system-generator');
const { buildSeededCelestialBodiesForSolarSystem } = require('../../src/model/solar-system-celestial-seed');
const { assertUniverseRelationships } = require('../../src/model/celestial-universe-metadata');
const { isNamingEligible, assertNameLookup, applyBodyNames } = require('../../src/model/non-sol-p4-preview');
const { comparisonKeys } = require('../../src/model/system-naming');
const { getHamiltonScopeQuotas } = require('../../src/model/system-naming-weighted-allocation');
const { normalizeStationPlacement } = require('../../src/model/station-placement');
const inventory = require('../../data/non-sol-celestial-generation-manifest-v1.json');
const { MARKET_CATALOG_BY_ID } = require('../../src/model/market-catalog');
const { MessageHandlerContext } = require('../../src/handlers/message-handler-context');
const { createSeedMarketPayload } = require('../../src/handlers/context/context-bootstrap-service');
const { validateCelestialBody } = require('../../src/model/celestial-body-validation');
const { CelestialBody, Market } = require('../../src/db/models');
const { AU_KM } = require('../../src/model/procedural-system-generator');

const B = { ...legacy.bounds, ...physical.bounds };
const positive = (n, fallback) => Number.isFinite(n) && n > 0 ? n : fallback;
const range = (rng, lo, hi) => lo + rng() * (hi - lo);
const languageSlots = getHamiltonScopeQuotas(100, languagePolicy).flatMap((q) => Array(q.quota).fill(q));
const unprofiled = inventory.systems.filter((s) => s.profile.status === 'unassigned');
const inheritedProfiles = new Map();
let profileIndex = 0;
for (const q of getHamiltonScopeQuotas(unprofiled.length, languagePolicy))
  for (let i = 0; i < q.quota; i++) inheritedProfiles.set(unprofiled[profileIndex++].id, q);

function screeningClone(body, assumptions) {
  const clone = structuredClone(body);
  const p = clone.physicalCatalog || {};
  if (!p.massKg || !p.meanRadiusKm || (body.bodyType === 'star' && !body.luminositySolar))
    assumptions.push(`${body.id}: screening-only ${body.bodyType === 'star' ? 'solar' : 'Earth'} analog for absent positive constraints`);
  clone.physicalCatalog = { ...p,
    massKg: positive(p.massKg, body.bodyType === 'star' ? 1.98847e30 : 5.9722e24),
    meanRadiusKm: positive(p.meanRadiusKm, body.bodyType === 'star' ? 695700 : 6371) };
  if (body.bodyType === 'star') {
    const temperature = p.meanTemperatureK;
    const estimated = Number.isFinite(temperature) && temperature > 0 ?
      (clone.physicalCatalog.meanRadiusKm / 695700) ** 2 * (temperature / 5772) ** 4 : 1;
    clone.luminositySolar = positive(body.luminositySolar, estimated);
    if (!body.luminositySolar) assumptions.push(`${body.id}: modeled screening luminosity ${clone.luminositySolar} solar`);
  }
  return clone;
}

function nameBodies(bodies, base, row, offset = 0, narrativeOffset = 0) {
  const eligible = bodies.filter((b) => isNamingEligible(b)).sort((a, b) => a.id.localeCompare(b.id));
  if (!eligible.length) return { bodies, counts: { inherited: 0, narrative: 0, languages: {} } };
  const inheritedCount = Math.round((offset + eligible.length) * 0.6) - Math.round(offset * 0.6);
  const narrativeCount = eligible.length - inheritedCount;
  const assignments = {};
  const counts = { inherited: inheritedCount, narrative: narrativeCount, languages: {} };
  for (const [index, body] of eligible.entries()) {
    const inherited = index < inheritedCount;
    const q = inherited ? languagePolicy.languages.find((l) => l.id === row.profile.policyLanguageId) || inheritedProfiles.get(row.id) :
      languageSlots[(narrativeOffset + index - inheritedCount) % 100];
    const language = q?.language || row.profile.language || 'English';
    const candidates = bank.multilingualProposals.filter((p) =>
      q?.candidateLanguageLabels.includes(p.language) || p.language === language);
    const candidate = candidates.length ? candidates[index % candidates.length] : null;
    const stem = candidate?.name || (inherited ? row.displayName : 'Horizon');
    const preferredName = `${stem} ${body.bodyType} ${index + 1}`;
    assignments[body.id] = { preferredName, lane: inherited ? 'inherited' : 'narrative',
      language, motivation: candidate?.provisionalGloss || 'Hypothetical game-world editorial name' };
    counts.languages[language] = (counts.languages[language] || 0) + 1;
  }
  const named = applyBodyNames(bodies, { version: policy.version, assignments,
    eligibility: { moonMinimumDiameterKm: 200, storyImportantBodyIds: [] } });
  assertNameLookup(named);
  // Existing catalog aliases may already be ambiguous; preserve them exactly.
  // Do not introduce any new qualified lookup collisions.
  const existingKeys = new Set(base.flatMap((b) =>
    [b.displayName, ...(b.universeMetadata?.naming?.aliases || [])].flatMap(comparisonKeys)));
  for (const body of named) assert.ok(!comparisonKeys(body.displayName).some((k) => existingKeys.has(k)),
    `New name collides with catalog: ${body.displayName}`);
  return { bodies: named, counts };
}

function buildStation(systemId, row, bodies, star) {
  for (const host of bodies.filter((b) => b.bodyType === 'planet')) {
    const radius = host.physicalCatalog.meanRadiusKm;
    const hill = hillRadiusKm(host.orbitalElements, host.physicalCatalog.massKg, star.physicalCatalog.massKg);
    for (const factor of [2, 3, 4, 6, 10]) {
      const axis = radius * factor;
      if (axis - radius < 1000 || axis >= hill * 0.1) continue;
      const envelopes = bodies.filter((b) => b.parentBodyId === host.id && b.orbitalElements)
        .map((b) => orbitEnvelope(b.orbitalElements));
      if (host.rings) envelopes.push({ periapsisKm: host.rings.innerRadiusKm, apoapsisKm: host.rings.outerRadiusKm });
      if (envelopes.some((e) => axis >= e.periapsisKm - 1000 && axis <= e.apoapsisKm + 1000)) continue;
      const orbit = candidateOrbit(() => 0, axis, 0, host, 0, policy.epoch);
      orbit.anchorBodyName = host.displayName;
      orbit.orbitType = 'circular';
      const stationPlacement = normalizeStationPlacement({ kind: 'body-orbit',
        primaryBodyId: host.id, activation: 'active', stationKeeping: false,
        provenance: policy.version, reason: 'Hypothetical initial screened market' },
      { kind: 'orbital-elements', orbit });
      return { marketId: `${systemId}-bulk-initial-exchange`, solarSystemId: systemId,
        marketName: `${row.displayName} Initial Exchange`, siteName: `${host.displayName} Orbital Station`,
        siteType: 'station', isStarterMarket: false, priceMultiplier: 1, driftPercentPerHour: 4,
        restockIntervalMinutes: 60, stationPlacement, trajectory: { kind: 'orbital-elements', orbit },
        spatial: { ...host.spatial, positionKm: { ...host.spatial.positionKm, x: host.spatial.positionKm.x + axis } } };
    }
  }
  return null;
}

async function generateBulkSystem(row, options = {}) {
  assert.notEqual(row.id, 'sol');
  assert.notEqual(row.id, 'exo-gj-9066');
  const baseBodies = buildSeededCelestialBodiesForSolarSystem(row.id, policy.epoch);
  const sourceSha256 = sha256({ row, baseBodies, policy, legacy, physical, languagePolicy, bank, options });
  const assumptions = [];
  const constraints = baseBodies.map((b) => screeningClone(b, assumptions));
  const star = constraints.find((b) => b.bodyType === 'star');
  const companions = star ? constraints.filter((b) => b.id !== star.id &&
    (['star', 'black-hole'].includes(b.bodyType) ||
      (b.bodyType === 'planet' && b.physicalCatalog.massKg > star.physicalCatalog.massKg * 0.01))) : [];
  const rejected = [];
  const generated = [];
  const blocked = async (reason, kind = 'no-viable-screened-proposal') => {
    if (!options.aggregate && companions.length) {
      const alternative = await generateBulkSystem(row, { ...options, aggregate: true });
      if (alternative.status === 'ready') return alternative;
      alternative.assumptions.unshift(`Circumprimary attempt exhausted: ${reason}`);
      return alternative;
    }
    if (!options.extended) {
      const alternative = await generateBulkSystem(row, { ...options, extended: true });
      if (alternative.status === 'ready') return alternative;
      alternative.assumptions.unshift(`Standard-domain attempt exhausted: ${reason}`);
      return alternative;
    }
    return { systemId: row.id, status: 'blocked', kind, reason, sourceSha256, assumptions, rejected,
      baseSha256: sha256(baseBodies), generatedBodies: [] };
  };
  if (!star) return blocked('NO_SUPPORTED_STELLAR_ANCHOR', 'runtime-unrepresentable');
  let binaryOuter = 0;
  for (const other of companions) {
    binaryOuter = Math.max(binaryOuter, other.orbitalElements ? orbitEnvelope(other.orbitalElements).apoapsisKm :
      (other.blackHoleProperties?.relativeBinarySemimajorAxisAU || 0) * AU_KM);
    if (options.aggregate) {
      star.physicalCatalog.massKg += other.physicalCatalog.massKg;
      if (other.bodyType === 'star') star.luminositySolar += other.luminositySolar;
    }
  }
  let maxAxis = Math.max(100 * AU_KM, Math.sqrt(star.luminositySolar) * 50 * AU_KM,
    options.aggregate ? binaryOuter * 50 : 0);
  if (options.extended) {
    const catalogExtent = Math.max(0, ...constraints.filter((b) =>
      ['planet', 'dwarf-planet'].includes(b.bodyType) && b.orbitalElements)
      .map((b) => orbitEnvelope(b.orbitalElements).apoapsisKm));
    maxAxis = Math.max(maxAxis, catalogExtent * 50);
    assumptions.push('Extended outer game-world reservoir beyond catalog radial envelopes; ambient heating assumed, long-term Galactic/encounter survival uncalibrated');
  }
  if (!options.aggregate) for (const other of companions) {
    const separation = other.orbitalElements ? orbitEnvelope(other.orbitalElements).periapsisKm :
      (other.blackHoleProperties?.relativeBinarySemimajorAxisAU || 0) * AU_KM;
    if (separation) {
      maxAxis = Math.min(maxAxis, separation * 0.1);
      assumptions.push(`${other.id}: known companion limits circumprimary domain to 0.1 separation`);
    } else assumptions.push(`${other.id}: unknown separation modeled as distant companion`);
  }
  const inner = Math.max(0.000001 * AU_KM, star.physicalCatalog.meanRadiusKm * 5,
    options.aggregate ? Math.max(binaryOuter * 5, AU_KM) : 0,
    Math.sqrt(star.luminositySolar) * 0.3 * AU_KM);
  const bounds = { ...B, maxStellarOrbitAu: maxAxis / AU_KM, solidTemperatureK: [0, 700] };
  if (options.aggregate) assumptions.push('Distant aggregate Kepler orbit about catalog anchor; effective summed mass/luminosity, approximate anchored frame');
  if (maxAxis <= inner) return blocked('NO_CIRCUMPRIMARY_CLEARANCE_REGION');
  const peers = () => [...constraints, ...generated].filter((b) =>
    b.parentBodyId === star.id && ['planet', 'dwarf-planet'].includes(b.bodyType) && b.orbitalElements &&
    !companions.some((c) => c.id === b.id));
  function slot(type, parent, index, limits, screen) {
    const rng = stream(row.id, parent.id, `${policy.version}:${type}:${index}`);
    const rejections = {};
    for (let attempt = 0; attempt < policy.attemptsPerSlot; attempt++) {
      let candidate;
      if (type === 'planet') {
        const massEarth = Math.exp(range(rng, Math.log(0.3), Math.log(60)));
        const radiusEarth = estimateRadiusEarth(massEarth) * range(rng, 0.85, 1.15);
        const massKg = massEarth * 5.9722e24;
        candidate = { massKg, radiusKm: radiusEarth * 6371, icy: false,
          densityKgM3: density(massKg, radiusEarth * 6371),
          surfaceArchetype: classifyCatalogPlanet({ massEarth, radiusEarth }),
          orbit: candidateOrbit(rng, Math.exp(range(rng, ...limits.map(Math.log))), range(rng, 0, 0.04), parent, massKg, policy.epoch) };
      } else {
        candidate = makeCandidate(rng, type, parent, limits);
        if (type === 'tno') {
          candidate.icy = true;
          candidate.surfaceArchetype = 'icy-moon';
        }
      }
      const reason = screen(candidate);
      if (reason) { rejections[reason] = (rejections[reason] || 0) + 1; continue; }
      const body = makeBody(row.id, parent, type, `bulk-v1-${index}`, candidate, sourceSha256, policy.epoch, policy);
      if (options.aggregate && parent.id === star.id) {
        body.orbitalElements.circumbinary = true;
        body.orbitalElements.circumbinaryStarIds = constraints.filter((b) => b.bodyType === 'star').map((b) => b.id);
      }
      if (type === 'asteroid') {
        const material = ['silicon', 'iron', 'carbon', 'nickel', 'copper'][index % 5];
        assert.equal(MARKET_CATALOG_BY_ID.get(material).rarity, 'Common');
        body.composition.material = material;
        body.universeMetadata.resourceProfile = { materialItemTypes: [material], abundance: 'moderate',
          accessibility: 'accessible', policyVersion: policy.version };
      }
      generated.push(body);
      return body;
    }
    rejected.push({ type, parentBodyId: parent.id, slot: index, reasons: rejections });
    return null;
  }
  for (const type of ['planet', 'dwarf-planet', 'asteroid', 'comet', 'tno'])
    for (let i = 0; i < policy.budgets[type]; i++) slot(type, star, i, [inner, maxAxis],
      (c) => {
        if (type === 'planet' && (c.densityKgM3 < B.planetDensityKgM3[0] || c.densityKgM3 > B.planetDensityKgM3[1]))
          return 'PLANET_DENSITY_BOUNDS';
        const reason = stellarRejection(c, type, star, peers(), bounds);
        return reason === 'PLANET_CLEARING_PROXY' ? null : reason;
      });
  for (const host of [...peers()]) {
    const moons = constraints.filter((b) => b.parentBodyId === host.id && b.bodyType === 'moon' && b.orbitalElements);
    let used = moons.reduce((sum, b) => sum + b.physicalCatalog.massKg, 0);
    const limits = [host.physicalCatalog.meanRadiusKm * 3,
      hillRadiusKm(host.orbitalElements, host.physicalCatalog.massKg, star.physicalCatalog.massKg) * B.moonHillFraction];
    if (limits[1] <= limits[0]) continue;
    for (let i = 0; i < policy.budgets.moon; i++) {
      const moon = slot('moon', host, i, limits,
        (c) => moonRejection(c, host, star, moons, used, host.rings?.outerRadiusKm || 0, B));
      if (moon) { moons.push(moon); used += moon.physicalCatalog.massKg; }
    }
  }
  const named = nameBodies(generated, baseBodies, row, options.namingOffset, options.narrativeOffset);
  const station = buildStation(row.id, row, [...baseBodies, ...named.bodies], star);
  if (!station) return blocked('NO_SCREENED_USABLE_STATION');
  if (!generated.some((b) => b.bodyType === 'asteroid')) return blocked('NO_SCREENED_RESOURCE_ASTEROID');
  if (!generated.some((b) => b.bodyType === 'planet')) return blocked('NO_SCREENED_ADDITIONAL_PLANET');
  if (!generated.some((b) => b.bodyType === 'moon')) return blocked('NO_SCREENED_MOON');
  const context = new MessageHandlerContext({ databaseService: {}, log: () => {},
    getCurrentTimestamp: () => policy.epoch });
  const market = createSeedMarketPayload(context, station, policy.epoch);
  const bodies = [...baseBodies, ...named.bodies];
  assertUniverseRelationships(bodies);
  for (const body of bodies) {
    assert.ok(validateCelestialBody(body), JSON.stringify(validateCelestialBody.errors));
    await new CelestialBody(body).validate();
  }
  await new Market(market).validate();
  const result = { schemaVersion: policy.version, systemId: row.id, status: 'ready',
    scientificStatus: 'hypothetical-uncertain', runtimeCompatible: true, sourceSha256,
    baseSha256: sha256(baseBodies), assumptions, rejected, naming: named.counts,
    baseBodies, generatedBodies: named.bodies, station, market };
  return { ...result, planSha256: sha256(result) };
}

module.exports = { generateBulkSystem, policy, buildStation, screeningClone };
