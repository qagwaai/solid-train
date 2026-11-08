'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const policy = require('../../data/non-sol-scientific-policy-v2.json');
const legacyPolicy = require('../../data/non-sol-scientific-policy-v1.json');
const {
  stream, density, massFromDensity, makeBody, makeCandidate, candidateOrbit,
  orbitEnvelope, stellarRejection, moonRejection, hillRadiusKm, fluidRocheKm,
  equilibriumTemperatureK,
} = require('./non-sol-augmentation');
const { estimateRadiusEarth, classifyCatalogPlanet } = require('./exoplanet-system-generator');
const {
  getSolarSystemCatalogEntries, buildSeededCelestialBodiesForSolarSystem,
} = require('./solar-system-celestial-seed');
const { AU_KM } = require('./procedural-system-generator');
const { assertUniverseRelationships } = require('./celestial-universe-metadata');
const { validateCelestialBody } = require('./celestial-body-validation');

const EARTH_MASS_KG = 5.9722e24;
const EARTH_RADIUS_KM = 6371;
const B = { ...legacyPolicy.bounds, ...policy.bounds };
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const range = (rng, limits) => limits[0] + rng() * (limits[1] - limits[0]);
const integer = (rng, limits) => Math.floor(range(rng, [limits[0], limits[1] + 1]));
const logRange = (rng, limits) => Math.exp(range(rng, limits.map(Math.log)));
const giant = (body) => body.bodyType === 'planet' &&
  ['gas-giant', 'ice-giant', 'super-jupiter'].includes(body.surfaceArchetype);
const supportedPlanetAppearances = ['rocky', 'super-earth', 'sub-neptune', 'ice-giant', 'gas-giant'];

function assertCanonical(body) {
  if (!validateCelestialBody(body)) {
    throw new Error(`Invalid expanded body ${body.id}: ${JSON.stringify(validateCelestialBody.errors)}`);
  }
}

function planetCandidate(rng, parent, axisBounds) {
  const massEarth = logRange(rng, B.planetMassEarth);
  const radiusEarth = estimateRadiusEarth(massEarth) * range(rng, B.planetRadiusScatter);
  const radiusKm = radiusEarth * EARTH_RADIUS_KM;
  const massKg = massEarth * EARTH_MASS_KG;
  const densityKgM3 = density(massKg, radiusKm);
  const orbit = candidateOrbit(rng, logRange(rng, axisBounds), range(rng, [0, 0.08]), parent, massKg);
  const temperatureK = equilibriumTemperatureK(parent.luminositySolar, orbitEnvelope(orbit).periapsisKm);
  const surfaceArchetype = classifyCatalogPlanet({
    radiusEarth, massEarth, teqK: temperatureK, density: densityKgM3 / 1000,
  });
  const solid = ['rocky', 'super-earth'].includes(surfaceArchetype);
  return {
    massKg, radiusKm, densityKgM3, orbit, icy: false, surfaceArchetype,
    compositionTags: [solid ? 'silicate' : 'modeled-volatile-envelope'],
    material: solid ? 'silicate' : 'modeled-volatile-envelope',
  };
}

function candidateFor(rng, type, parent, axisBounds) {
  if (type === 'planet') return planetCandidate(rng, parent, axisBounds);
  if (type !== 'tno') return makeCandidate(rng, type, parent, axisBounds);
  const radiusKm = range(rng, B.tnoRadiusKm);
  const densityKgM3 = range(rng, legacyPolicy.bounds.iceDensityKgM3);
  const massKg = massFromDensity(radiusKm, densityKgM3);
  return {
    radiusKm, densityKgM3, massKg, icy: true, surfaceArchetype: 'icy-moon',
    orbit: candidateOrbit(rng, logRange(rng, axisBounds), range(rng, [0, 0.08]), parent, massKg),
  };
}

function countBodies(bodies) {
  const byType = Object.fromEntries(
    ['star', 'black-hole', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'tno', 'comet']
      .map((type) => [type, 0])
  );
  const planetAppearances = Object.fromEntries(
    ['rocky', 'lava', 'ocean', 'gas-giant', 'ice-giant', 'super-earth', 'sub-neptune',
      'hot-neptune', 'hot-jupiter', 'super-jupiter'].map((type) => [type, 0])
  );
  const moonAppearances = { 'rocky-moon': 0, 'icy-moon': 0, lava: 0 };
  for (const body of bodies) {
    if (!Object.hasOwn(byType, body.bodyType)) throw new Error(`Unknown count category: ${body.bodyType}`);
    byType[body.bodyType]++;
    if (body.bodyType === 'planet') {
      if (!Object.hasOwn(planetAppearances, body.surfaceArchetype)) throw new Error('Unknown planet appearance');
      planetAppearances[body.surfaceArchetype]++;
    }
    if (body.bodyType === 'moon') {
      if (!Object.hasOwn(moonAppearances, body.surfaceArchetype)) throw new Error('Unknown moon appearance');
      moonAppearances[body.surfaceArchetype]++;
    }
  }
  return { total: bodies.length, byType, planetAppearances, moonAppearances };
}

/**
 * Scoped offline experiment, not a fitted occurrence simulation or runtime seeder.
 * @param {string} systemId
 * @param {{epoch?: string}} [options]
 */
function previewExpandedNonSolSystem(systemId, options = {}) {
  if (!policy.scope.includes(systemId)) throw new Error('Expanded preview requires one of the five approved non-Sol pilot IDs');
  const epoch = options.epoch ?? policy.epoch;
  if (typeof epoch !== 'string' || !Number.isFinite(Date.parse(epoch)) ||
      new Date(epoch).toISOString() !== epoch) throw new Error('Preview epoch must be canonical UTC ISO milliseconds');
  const catalog = getSolarSystemCatalogEntries(systemId, policy.epoch);
  if (!catalog) throw new Error(`Missing pilot catalog: ${systemId}`);
  const baseBodies = buildSeededCelestialBodiesForSolarSystem(systemId, epoch);
  const sourceSha256 = hash({ entries: catalog.entries, policy, legacyPolicy });
  const generatedBodies = [];
  const ringProposals = [];
  const evidence = [];
  const rejected = [];
  const exclusions = [];
  const familyBlockers = Object.entries(policy.familyBlockers).map(([family, code]) => ({ family, code }));
  const blocked = policy.systemExclusions[systemId];
  const stars = baseBodies.filter((body) => body.bodyType === 'star');
  const star = stars[0];
  const countPlan = {
    planet: integer(stream(systemId, systemId, 'planet-count'), policy.budgets.planets),
    asteroid: integer(stream(systemId, systemId, 'asteroid-count'), policy.budgets.asteroids),
    comet: integer(stream(systemId, systemId, 'comet-count'), policy.budgets.comets),
    outerMinorBodies: integer(stream(systemId, systemId, 'outer-count'), policy.budgets.outerMinorBodies),
  };
  if (blocked) exclusions.push({ bodyId: systemId, ...blocked });
  else if (stars.length !== 1 || baseBodies.some((body) => body.bodyType === 'black-hole') ||
    !Number.isFinite(star.luminositySolar) || star.luminositySolar <= 0 ||
    !Number.isFinite(star.physicalCatalog?.massKg) || star.physicalCatalog.massKg <= 0 ||
    !Number.isFinite(star.physicalCatalog?.meanRadiusKm) || star.physicalCatalog.meanRadiusKm <= 0) {
    throw new Error('Approved pilot no longer has complete single-star constraints; review its source changes');
  }
  if (!blocked && (
    star.physicalCatalog.massKg / 1.98847e30 < B.stellarMassSolar[0] ||
    star.physicalCatalog.massKg / 1.98847e30 > B.stellarMassSolar[1] ||
    star.physicalCatalog.meanRadiusKm / 695700 < B.stellarRadiusSolar[0] ||
    star.physicalCatalog.meanRadiusKm / 695700 > B.stellarRadiusSolar[1] ||
    /III|IV|II|(^|\s)(WD|D[ABOQZ])/.test(star.spectralClass || '')
  )) throw new Error('Pilot stellar properties are outside the reviewed domain');
  const peers = () => [...baseBodies, ...generatedBodies].filter(
    (body) => body.parentBodyId === star.id && ['planet', 'dwarf-planet'].includes(body.bodyType)
  );

  function addSlot(parent, type, slot, axisBounds, screen) {
    const rng = stream(systemId, parent.id, `${type}:${slot}`);
    const rejectionCounts = {};
    for (let attempt = 1; attempt <= policy.budgets.attemptsPerSlot; attempt++) {
      const candidate = candidateFor(rng, type, parent, axisBounds);
      const reason = screen(candidate);
      if (reason) {
        rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
        continue;
      }
      const body = makeBody(systemId, parent, type, slot, candidate, sourceSha256, epoch, policy);
      if (type === 'planet') {
        body.universeMetadata.provenance.rationale =
          'Hypothetical exploration of source-supported planet regimes, not a measured occurrence draw. Shared mean mass-radius fit with authored +/-15% radius scatter; composition and appearance are modeled, not detected.';
        const radiusSource = body.universeMetadata.provenance.fieldSources.find(
          (entry) => entry.field === 'physicalCatalog.meanRadiusKm'
        );
        radiusSource.derivation = 'estimated';
        radiusSource.reference = policy.sources.massRadius;
        body.universeMetadata.provenance.fieldSources.push({
          field: 'surfaceArchetype', derivation: 'estimated', reference: policy.sources.massRadius,
          uncertainty: 'Modeled appearance; composition is not an observed inference.',
        });
      }
      if (type === 'asteroid' || type === 'comet') {
        body.universeMetadata.population = {
          id: `${systemId}:${type}:reservoir`,
          kind: type === 'comet' ? 'comet-reservoir' : 'scattered-asteroids',
          hostBodyId: parent.id, abundance: 'moderate', estimatedTotalCount: null,
          policyVersion: policy.version,
        };
      }
      assertCanonical(body);
      generatedBodies.push(body);
      evidence.push({
        bodyId: body.id, densityKgM3: candidate.densityKgM3, attempts: attempt, rejectionCounts,
        equilibriumTemperatureAtPeriapsisK: equilibriumTemperatureK(
          star.luminositySolar,
          orbitEnvelope(parent.bodyType === 'star' ? candidate.orbit : parent.orbitalElements).periapsisKm
        ),
        model: type === 'planet' ? 'shared-mean-mass-radius-with-authored-scatter' : 'spherical-mass-density',
      });
      return body;
    }
    rejected.push({ parentBodyId: parent.id, type, slot, code: 'BOUNDED_PLACEMENT_FAILED',
      attempts: policy.budgets.attemptsPerSlot, rejectionCounts });
    return null;
  }

  if (!blocked) {
    if (peers().some((body) => !body.orbitalElements ||
        !Number.isFinite(body.physicalCatalog?.massKg) || body.physicalCatalog.massKg <= 0 ||
        !Number.isFinite(body.physicalCatalog?.meanRadiusKm) || body.physicalCatalog.meanRadiusKm <= 0)) {
      throw new Error('Incomplete existing pilot planet constraints; do not generate through source gaps');
    }
    const innerAu = Math.max(B.minStellarOrbitAu,
      star.physicalCatalog.meanRadiusKm * B.stellarClearanceRadii / AU_KM,
      Math.sqrt(star.luminositySolar) * 0.3);
    let additionalGiants = 0;
    for (let index = 0; index < countPlan.planet; index++) {
      const body = addSlot(star, 'planet', `slot-${String(index + 1).padStart(2, '0')}`,
        [innerAu * AU_KM, B.maxStellarOrbitAu * AU_KM], (candidate) => {
          if (!supportedPlanetAppearances.includes(candidate.surfaceArchetype)) return 'UNSUPPORTED_PLANET_ENVIRONMENT';
          if (candidate.densityKgM3 < B.planetDensityKgM3[0] || candidate.densityKgM3 > B.planetDensityKgM3[1])
            return 'PLANET_DENSITY_BOUNDS';
          const isGiant = candidate.surfaceArchetype === 'gas-giant' ||
            candidate.massKg / EARTH_MASS_KG >= B.giantMinMassEarth;
          if (isGiant && (additionalGiants >= policy.budgets.additionalGiants ||
              orbitEnvelope(candidate.orbit).apoapsisKm > B.giantMaxAxisAu * AU_KM))
            return 'GIANT_CAP_OR_SURVEY_DOMAIN';
          return stellarRejection(candidate, 'planet', star, peers(), B);
        });
      if (body && (body.surfaceArchetype === 'gas-giant' ||
        body.physicalCatalog.massKg / EARTH_MASS_KG >= B.giantMinMassEarth)) additionalGiants++;
    }
    const dwarfCount = Math.min(countPlan.outerMinorBodies,
      integer(stream(systemId, systemId, 'dwarf-count'), [0, policy.budgets.dwarfSubset]));
    for (let index = 0; index < countPlan.outerMinorBodies; index++) {
      const type = index < dwarfCount ? 'dwarf-planet' : 'tno';
      addSlot(star, type, `slot-${String(index + 1).padStart(2, '0')}`,
        [Math.max(B.outerMinAxisAu, Math.sqrt(star.luminositySolar) * 5) * AU_KM,
          B.maxStellarOrbitAu * AU_KM],
        (candidate) => stellarRejection(candidate, type, star, peers(), B));
    }
    for (const type of ['asteroid', 'comet']) {
      for (let index = 0; index < countPlan[type]; index++) {
        addSlot(star, type, `slot-${String(index + 1).padStart(2, '0')}`,
          [innerAu * AU_KM, B.maxStellarOrbitAu * AU_KM],
          (candidate) => stellarRejection(candidate, type, star, peers(), B));
      }
    }
    for (const host of peers().sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
      const radius = host.physicalCatalog.meanRadiusKm;
      const hostMass = host.physicalCatalog.massKg;
      const hill = hillRadiusKm(host.orbitalElements, hostMass, star.physicalCatalog.massKg);
      const temperatureK = equilibriumTemperatureK(star.luminositySolar, orbitEnvelope(host.orbitalElements).periapsisKm);
      let ringOuterKm = host.rings?.outerRadiusKm || 0;
      if (!host.rings && stream(systemId, host.id, 'ring-presence')() < 0.25) {
        const innerRadiusKm = radius * 1.2;
        const outerRadiusKm = Math.min(fluidRocheKm(radius, density(hostMass, radius), 1000) * 0.9,
          hill * B.ringHillFraction);
        if (temperatureK <= B.maxIceTemperatureK && outerRadiusKm > innerRadiusKm) {
          ringProposals.push({
            hostBodyId: host.id, material: 'modeled-ice', massKg: hostMass * B.ringMassFraction,
            rings: { innerRadiusKm, outerRadiusKm, tiltDeg: 0, colorHex: '#b8b4a7', opacity: 0.4, approximate: true },
            provenance: { origin: 'hypothetical', reference: policy.sources.roche,
              rationale: 'Authored optional cold ring proposal. Analytic screening only; occurrence/lifetime not calibrated.' },
          });
          ringOuterKm = outerRadiusKm;
        } else exclusions.push({ bodyId: host.id, code: 'RING_ROCHE_HILL_THERMAL' });
      }
      const requested = integer(stream(systemId, host.id, 'moon-count'),
        giant(host) ? policy.budgets.moonsPerGiant : policy.budgets.moonsPerOtherHost);
      let usedMass = 0;
      const moonPeers = [...baseBodies, ...generatedBodies].filter(
        (body) => body.bodyType === 'moon' && body.parentBodyId === host.id
      );
      usedMass = moonPeers.reduce((sum, body) => sum + body.physicalCatalog.massKg, 0);
      for (let index = 0; index < requested; index++) {
        const limits = [Math.max(radius * 2, ringOuterKm * 1.1), hill * B.moonHillFraction];
        if (limits[1] <= limits[0]) {
          exclusions.push({ bodyId: host.id, code: 'NO_MOON_REGION' });
          break;
        }
        const body = addSlot(host, 'moon', `slot-${String(index + 1).padStart(2, '0')}`, limits,
          (candidate) => moonRejection(candidate, host, star, moonPeers, usedMass, ringOuterKm, B));
        if (body) {
          usedMass += body.physicalCatalog.massKg;
          moonPeers.push(body);
        }
      }
    }
  }
  const allBodies = [...baseBodies, ...generatedBodies];
  assertUniverseRelationships(allBodies);
  const asteroidCount = generatedBodies.filter((body) => body.bodyType === 'asteroid').length;
  if (!asteroidCount) exclusions.push({ bodyId: systemId, code: 'REQUIRED_ASTEROID_COVERAGE_BLOCKED' });
  const populations = new Map();
  for (const body of generatedBodies) {
    const population = body.universeMetadata.population;
    if (population) populations.set(population.id, population);
  }
  const result = {
    schemaVersion: 'non-sol-preview-v2', policyVersion: policy.version,
    policySha256: hash({ policy, legacyPolicy }), sourceSha256, systemId, epoch,
    runtimeEnabled: false, databaseWrites: false, occurrenceCalibrated: false,
    samplingInterpretation: policy.samplingInterpretation,
    status: asteroidCount > 0 ? 'preview-valid' : 'blocked',
    baseBodies, generatedBodies, ringProposals, populationDescriptors: [...populations.values()],
    countPlan, evidence, rejected, exclusions, familyBlockers,
    counts: { existing: countBodies(baseBodies), additions: countBodies(generatedBodies), combined: countBodies(allBodies) },
    coverage: { representativeAsteroids: asteroidCount, playableMiningVerified: false, stationVerified: false },
  };
  return { ...result, outputSha256: hash(result) };
}

function validateExpandedPreview(preview) {
  const expected = previewExpandedNonSolSystem(preview.systemId, { epoch: preview.epoch });
  // Deterministic replay verifies every identity, source, physical screen, count and exclusion, not just the digest.
  if (!isDeepStrictEqual(preview, expected)) throw new Error('Expanded preview differs from deterministic validated replay');
  return true;
}

module.exports = { previewExpandedNonSolSystem, validateExpandedPreview, countBodies, planetCandidate };
