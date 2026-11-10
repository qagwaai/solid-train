'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const policy = require('../../data/non-sol-scientific-policy-v1.json');
const {
  createSeededRandom,
  hashStringToSeed,
  AU_KM,
  orbitalPeriodSecFromAu,
} = require('./procedural-system-generator');
const {
  getSolarSystemCatalogEntries,
  buildSeededCelestialBodiesForSolarSystem,
  computeRelativePositionKm,
} = require('./solar-system-celestial-seed');
const { generatedBodyId, assertUniverseRelationships } = require('./celestial-universe-metadata');
const { initialSeedDiscovery } = require('./celestial-seed-ownership');
const { validateCelestialBody } = require('./celestial-body-validation');

const SOLAR_MASS = 1.98847e30;
const SOLAR_RADIUS_KM = 695700;
const EARTH_MASS = 5.9722e24;
const B = policy.bounds;
const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const range = (rng, bounds) => bounds[0] + (bounds[1] - bounds[0]) * rng();
const integer = (rng, bounds) => Math.floor(bounds[0] + (bounds[1] - bounds[0] + 1) * rng());

function stream(systemId, parentId, purpose) {
  return createSeededRandom(hashStringToSeed(JSON.stringify([systemId, parentId, purpose])));
}

function positive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function density(massKg, radiusKm) {
  return massKg / ((4 / 3) * Math.PI * (radiusKm * 1000) ** 3);
}

function massFromDensity(radiusKm, densityKgM3) {
  return (4 / 3) * Math.PI * (radiusKm * 1000) ** 3 * densityKgM3;
}

function hillRadiusKm(orbit, massKg, primaryMassKg) {
  return (
    orbit.semiMajorAxisKm *
    (1 - orbit.eccentricity) *
    Math.cbrt(massKg / (3 * (primaryMassKg + massKg)))
  );
}

function fluidRocheKm(hostRadiusKm, hostDensity, satelliteDensity) {
  return 2.44 * hostRadiusKm * Math.cbrt(hostDensity / satelliteDensity);
}

function equilibriumTemperatureK(luminositySolar, distanceKm, bondAlbedo = B.bondAlbedo) {
  return (
    (278.3296 * (luminositySolar * (1 - bondAlbedo)) ** 0.25) / Math.sqrt(distanceKm / AU_KM)
  );
}

function clearingDiscriminant(massKg, semiMajorAxisKm, stellarMassKg) {
  return (
    (807 * (massKg / EARTH_MASS)) /
    ((stellarMassKg / SOLAR_MASS) ** 2.5 * (semiMajorAxisKm / AU_KM) ** 1.125)
  );
}

function issue(code, bodyId, reason, attempts = 0) {
  return { code, bodyId, reason, attempts };
}

function orbitEnvelope(orbit) {
  return {
    periapsisKm: orbit.semiMajorAxisKm * (1 - orbit.eccentricity),
    apoapsisKm: orbit.semiMajorAxisKm * (1 + orbit.eccentricity),
  };
}

function separated(candidate, peers, centralMass, mutual) {
  const c = orbitEnvelope(candidate.orbit);
  return peers.every((peer) => {
    const p = orbitEnvelope(peer.orbitalElements);
    const gap = Math.max(c.periapsisKm - p.apoapsisKm, p.periapsisKm - c.apoapsisKm);
    const separation = mutual
      ? ((B.planetMutualHillSpacing *
          (candidate.orbit.semiMajorAxisKm + peer.orbitalElements.semiMajorAxisKm)) /
          2) *
        Math.cbrt((candidate.massKg + peer.physicalCatalog.massKg) / (3 * centralMass))
      : (B.testParticleHillSpacing *
          hillRadiusKm(peer.orbitalElements, peer.physicalCatalog.massKg, centralMass) *
          (1 + peer.orbitalElements.eccentricity)) /
        (1 - peer.orbitalElements.eccentricity);
    return gap > separation;
  });
}

/** @param {{version: string, sources: Record<string, string>}} [activePolicy] */
function makeBody(
  systemId,
  parent,
  bodyType,
  slot,
  candidate,
  sourceSha256,
  epoch,
  activePolicy = policy
) {
  const id = generatedBodyId({ solarSystemId: systemId, parentBodyId: parent.id, bodyType, slot });
  const displayName = `${parent.displayName || parent.id} ${bodyType} ${slot}`;
  const relative = computeRelativePositionKm(candidate.orbit, Date.parse(epoch));
  const fields = [
    { field: 'physicalCatalog.massKg', derivation: 'estimated' },
    { field: 'physicalCatalog.meanRadiusKm', derivation: 'seeded' },
    { field: 'orbitalElements', derivation: 'seeded' },
    { field: 'orbitalElements.orbitalPeriodSec', derivation: 'estimated' },
    { field: 'physical', derivation: 'estimated' },
    { field: 'spatial', derivation: 'estimated' },
    { field: 'composition', derivation: 'authored' },
    { field: 'observability', derivation: 'authored' },
  ];
  const body = {
    id,
    catalogId: id,
    sourceScanId: 'non-sol-preview',
    createdByCharacterId: 'system-catalog',
    createdAt: epoch,
    updatedAt: epoch,
    missionId: null,
    missionInstanceId: null,
    isCatalogBody: true,
    displayName,
    parentBodyId: parent.id,
    bodyType,
    surfaceArchetype:
      candidate.surfaceArchetype ??
      (bodyType === 'moon'
        ? candidate.icy
          ? 'icy-moon'
          : 'rocky-moon'
        : bodyType === 'planet'
          ? 'rocky'
          : bodyType === 'dwarf-planet'
            ? 'icy-moon'
            : 'asteroid'),
    ...initialSeedDiscovery(bodyType),
    spatial: {
      solarSystemId: systemId,
      frame: 'barycentric',
      epochMs: Date.parse(epoch),
      positionKm: {
        x: parent.spatial.positionKm.x + relative.x,
        y: parent.spatial.positionKm.y + relative.y,
        z: parent.spatial.positionKm.z + relative.z,
      },
    },
    orbitalElements: candidate.orbit,
    physical: { estimatedMassKg: candidate.massKg, estimatedDiameterM: candidate.radiusKm * 2000 },
    physicalCatalog: {
      massKg: candidate.massKg,
      meanRadiusKm: candidate.radiusKm,
      compositionTags: candidate.compositionTags ?? [candidate.icy ? 'ice' : 'silicate'],
    },
    composition: {
      rarity: 'Common',
      material: candidate.material ?? (candidate.icy ? 'ice' : 'silicate'),
      textureColor: '#9a9a9a',
    },
    destroyedAt: null,
    destroyedReason: null,
    debrisSeed: null,
    debris: [],
    universeMetadata: {
      schemaVersion: 'non-sol-universe-v1',
      provenance: {
        origin: 'hypothetical',
        sourceReferences: Object.values(activePolicy.sources),
        rationale:
          'Offline hypothetical representative; software sampling budgets are not observed population counts.',
        fieldSources: fields.map((entry) => ({
          ...entry,
          reference: activePolicy.version,
          uncertainty:
            'Authored sample constrained by approximate analytic screens, not a measured value or N-body stability proof.',
        })),
      },
      generation: {
        generatorVersion: activePolicy.version,
        seedKey: JSON.stringify([systemId, parent.id, bodyType, slot]),
        sourceSha256,
      },
      lifecycle: { status: 'active', retiredAt: null, reason: null },
      naming: {
        preferredName: displayName,
        aliases: [],
        lane: 'systematic',
        language: null,
        motivation: null,
        policyVersion: 'non-sol-preview-labels-v1',
      },
    },
  };
  return body;
}

function starPeers(bodies, starId) {
  return bodies.filter(
    (body) => body.parentBodyId === starId && ['planet', 'dwarf-planet'].includes(body.bodyType)
  );
}

function candidateOrbit(rng, axisKm, eccentricity, parent, bodyMassKg, epoch = policy.epoch) {
  return {
    semiMajorAxisKm: axisKm,
    eccentricity,
    inclinationDeg: range(rng, [0, 15]),
    longitudeOfAscendingNodeDeg: range(rng, [0, 360]),
    argumentOfPeriapsisDeg: range(rng, [0, 360]),
    meanAnomalyAtEpochDeg: range(rng, [0, 360]),
    orbitalPeriodSec: orbitalPeriodSecFromAu(
      axisKm / AU_KM,
      parent.physicalCatalog.massKg + bodyMassKg
    ),
    epoch,
    anchorBodyId: parent.id,
  };
}

function makeCandidate(rng, bodyType, parent, axisBoundsKm) {
  const radiusBounds =
    bodyType === 'asteroid'
      ? B.asteroidRadiusKm
      : bodyType === 'comet'
        ? B.cometRadiusKm
        : bodyType === 'moon'
          ? B.moonRadiusKm
          : bodyType === 'planet'
            ? B.planetRadiusKm
            : B.dwarfPlanetRadiusKm;
  const radiusKm = range(rng, radiusBounds);
  const icy = ['comet', 'dwarf-planet'].includes(bodyType) || (bodyType === 'moon' && rng() < 0.5);
  const densityKgM3 = range(rng, icy ? B.iceDensityKgM3 : B.rockDensityKgM3);
  const axisKm = Math.exp(range(rng, axisBoundsKm.map(Math.log)));
  const eccentricity = range(
    rng,
    bodyType === 'comet'
      ? B.cometEccentricity
      : bodyType === 'asteroid'
        ? B.asteroidEccentricity
        : B.solidEccentricity
  );
  const massKg = massFromDensity(radiusKm, densityKgM3);
  return {
    radiusKm,
    densityKgM3,
    icy,
    massKg,
    orbit: candidateOrbit(rng, axisKm, eccentricity, parent, massKg),
  };
}

function stellarRejection(candidate, type, star, peers, bounds = B) {
  const envelope = orbitEnvelope(candidate.orbit);
  if (
    envelope.periapsisKm <= bounds.stellarClearanceRadii * star.physicalCatalog.meanRadiusKm ||
    envelope.apoapsisKm > bounds.maxStellarOrbitAu * AU_KM
  )
    return 'STELLAR_CLEARANCE_OR_EXTENT';
  const hot = equilibriumTemperatureK(star.luminositySolar, envelope.periapsisKm, bounds.bondAlbedo);
  const cold = equilibriumTemperatureK(star.luminositySolar, envelope.apoapsisKm, bounds.bondAlbedo);
  if (
    hot > bounds.solidTemperatureK[1] ||
    cold < bounds.solidTemperatureK[0] ||
    (candidate.icy && hot > bounds.maxIceTemperatureK)
  )
    return 'THERMAL_BOUNDS';
  if (
    !separated(
      candidate,
      peers,
      star.physicalCatalog.massKg,
      ['planet', 'dwarf-planet'].includes(type)
    )
  )
    return 'ORBIT_SPACING';
  const pi = clearingDiscriminant(
    candidate.massKg,
    candidate.orbit.semiMajorAxisKm,
    star.physicalCatalog.massKg
  );
  if (type === 'planet' && pi < 10) return 'PLANET_CLEARING_PROXY';
  if (type === 'dwarf-planet' && pi >= 0.1) return 'DWARF_CLEARING_PROXY';
  return null;
}

function moonRejection(candidate, host, star, peers, usedMass, ringOuterKm, bounds = B) {
  const hostOrbit = orbitEnvelope(host.orbitalElements);
  const temperature = equilibriumTemperatureK(star.luminositySolar, hostOrbit.periapsisKm, bounds.bondAlbedo);
  if (temperature > bounds.maxMoonTemperatureK || (candidate.icy && temperature > bounds.maxIceTemperatureK))
    return 'MOON_THERMAL_BOUNDS';
  const envelope = orbitEnvelope(candidate.orbit);
  const radius = host.physicalCatalog.meanRadiusKm;
  const roche = fluidRocheKm(
    radius,
    density(host.physicalCatalog.massKg, radius),
    candidate.densityKgM3
  );
  const inner = Math.max(radius + candidate.radiusKm, roche * bounds.rocheClearanceFactor, ringOuterKm);
  const outer =
    hillRadiusKm(host.orbitalElements, host.physicalCatalog.massKg, star.physicalCatalog.massKg) *
    bounds.moonHillFraction;
  if (envelope.periapsisKm <= inner || envelope.apoapsisKm >= outer)
    return 'MOON_ROCHE_HILL_CLEARANCE';
  if (usedMass + candidate.massKg > host.physicalCatalog.massKg * bounds.satelliteMassFraction)
    return 'MOON_MASS_BUDGET';
  if (!separated(candidate, peers, host.physicalCatalog.massKg, true)) return 'MOON_SPACING';
  return null;
}

/**
 * Pure offline augmentation. Never imported by runtime seeders; base bodies remain byte-for-byte unchanged.
 * @param {string} systemId
 * @param {{epoch?: string}} [options]
 */
function previewNonSolSystem(systemId, options = {}) {
  if (typeof systemId !== 'string' || !/^[a-z0-9-]+$/.test(systemId) || systemId === 'sol') {
    throw new Error('Preview requires a canonical non-Sol system ID');
  }
  const epoch = options.epoch ?? policy.epoch;
  if (
    typeof epoch !== 'string' ||
    !Number.isFinite(Date.parse(epoch)) ||
    new Date(epoch).toISOString() !== epoch
  ) {
    throw new Error('Preview epoch must be canonical UTC ISO milliseconds');
  }
  const catalog = getSolarSystemCatalogEntries(systemId, policy.epoch);
  if (!catalog) throw new Error(`Unknown non-Sol system: ${systemId}`);
  const baseBodies = buildSeededCelestialBodiesForSolarSystem(systemId, epoch);
  const sourceSha256 = sha256({ entries: catalog.entries, policy });
  const generated = [];
  const rejected = [];
  const exclusions = [];
  const ringProposals = [];
  const evidence = [];
  const stars = baseBodies.filter((body) => body.bodyType === 'star');
  let star = stars[0];
  const knownExclusion = policy.systemExclusions[systemId];
  if (knownExclusion) {
    exclusions.push({
      ...issue(knownExclusion.code, systemId, knownExclusion.reason),
      source: knownExclusion.source,
    });
    star = null;
  } else if (baseBodies.some((body) => body.bodyType === 'black-hole')) {
    exclusions.push(
      issue(
        'COMPACT_REMNANT_MODEL_REQUIRED',
        systemId,
        'Accretion/radiation and binary geometry require separate reviewed P3 modeling.'
      )
    );
    star = null;
  } else if (stars.length !== 1) {
    exclusions.push(
      issue(
        'MULTIPLE_STAR_MODEL_REQUIRED',
        systemId,
        'Hierarchical binary stability/irradiation is not reduced to independent Kepler ellipses.'
      )
    );
    star = null;
  } else if (
    !positive(star.physicalCatalog?.massKg) ||
    !positive(star.physicalCatalog?.meanRadiusKm) ||
    !positive(star.luminositySolar)
  ) {
    exclusions.push(
      issue(
        'MISSING_STELLAR_FACTS',
        star.id,
        'Positive stellar mass, radius and luminosity are required; no solar fallback.'
      )
    );
    star = null;
  }
  if (
    star &&
    (star.physicalCatalog.massKg / SOLAR_MASS < B.stellarMassSolar[0] ||
      star.physicalCatalog.massKg / SOLAR_MASS > B.stellarMassSolar[1] ||
      star.physicalCatalog.meanRadiusKm / SOLAR_RADIUS_KM < B.stellarRadiusSolar[0] ||
      star.physicalCatalog.meanRadiusKm / SOLAR_RADIUS_KM > B.stellarRadiusSolar[1] ||
      /III|IV|II|(^|\s)(WD|D[ABOQZ])/.test(star.spectralClass || ''))
  ) {
    exclusions.push(
      issue(
        'STELLAR_EVOLUTION_MODEL_REQUIRED',
        star.id,
        'Outside conservative main-sequence mass/radius domain or explicitly evolved spectrum; no universal planet-clearing lifetime assumption.'
      )
    );
    star = null;
  }
  if (
    star &&
    (catalog.entries.some((entry) => entry.circumbinary) ||
      baseBodies
        .filter((body) => ['planet', 'dwarf-planet'].includes(body.bodyType))
        .some(
          (body) =>
            body.parentBodyId !== star.id ||
            !body.orbitalElements ||
            !positive(body.physicalCatalog?.massKg) ||
            !positive(body.physicalCatalog?.meanRadiusKm)
        ))
  ) {
    exclusions.push(
      issue(
        'INCOMPLETE_CATALOG_CONSTRAINTS',
        star.id,
        'Cannot screen existing planets without orbital geometry and positive mass/radius.'
      )
    );
    star = null;
  }
  const abundance = ['sparse', 'moderate', 'rich'][
    integer(stream(systemId, systemId, 'abundance'), [0, 2])
  ];
  const countPlan = {
    asteroid: integer(
      stream(systemId, systemId, 'asteroid-count'),
      policy.budgets.asteroids[abundance]
    ),
    comet: integer(stream(systemId, systemId, 'comet-count'), policy.budgets.comets),
    planet: integer(stream(systemId, systemId, 'planet-count'), policy.budgets.planets),
    'dwarf-planet': integer(stream(systemId, systemId, 'dwarf-count'), policy.budgets.dwarfPlanets),
  };

  function addSlot(parent, type, slot, axisBounds, check) {
    const rng = stream(systemId, parent.id, `${type}:${slot}`);
    let lastReason = 'NO_VALID_REGION';
    const rejectionCounts = {};
    for (let attempt = 1; attempt <= policy.budgets.attemptsPerSlot; attempt++) {
      const candidate = makeCandidate(rng, type, parent, axisBounds);
      const reason = check(candidate);
      if (reason) {
        lastReason = reason;
        rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
        continue;
      }
      const body = makeBody(systemId, parent, type, slot, candidate, sourceSha256, epoch);
      if (['asteroid', 'comet'].includes(type)) {
        body.universeMetadata.population = {
          id: `${systemId}:${type}:reservoir`,
          kind: type === 'comet' ? 'comet-reservoir' : 'scattered-asteroids',
          hostBodyId: parent.id,
          abundance,
          estimatedTotalCount: null,
          policyVersion: policy.version,
        };
      }
      generated.push(body);
      evidence.push({
        bodyId: body.id,
        densityKgM3: candidate.densityKgM3,
        attempts: attempt,
        rejectionCounts,
        equilibriumTemperatureAtPeriapsisK:
          parent.bodyType === 'star'
            ? equilibriumTemperatureK(
                parent.luminositySolar,
                orbitEnvelope(candidate.orbit).periapsisKm
              )
            : equilibriumTemperatureK(
                star.luminositySolar,
                orbitEnvelope(parent.orbitalElements).periapsisKm
              ),
        clearingDiscriminant: ['planet', 'dwarf-planet'].includes(type)
          ? clearingDiscriminant(
              candidate.massKg,
              candidate.orbit.semiMajorAxisKm,
              parent.physicalCatalog.massKg
            )
          : null,
      });
      return body;
    }
    rejected.push({
      ...issue(
        lastReason,
        generatedBodyId({ solarSystemId: systemId, parentBodyId: parent.id, bodyType: type, slot }),
        `No candidate passed the ${type} screen. Optional absence is permitted; required asteroid absence blocks coverage.`,
        policy.budgets.attemptsPerSlot
      ),
      rejectionCounts,
    });
    return null;
  }

  if (star) {
    const peers = () => starPeers([...baseBodies, ...generated], star.id);
    const innerAu = Math.max(
      B.minStellarOrbitAu,
      (star.physicalCatalog.meanRadiusKm * B.stellarClearanceRadii) / AU_KM,
      Math.sqrt(star.luminositySolar) * 0.3
    );
    for (const type of ['planet', 'dwarf-planet', 'asteroid', 'comet']) {
      for (let index = 0; index < countPlan[type]; index++) {
        const slot = `slot-${String(index + 1).padStart(2, '0')}`;
        const min =
          type === 'dwarf-planet'
            ? Math.max(innerAu, Math.sqrt(star.luminositySolar) * 5)
            : innerAu;
        if (min >= B.maxStellarOrbitAu) {
          rejected.push(
            issue(
              'NO_VALID_REGION',
              `${systemId}:${type}:${slot}`,
              'Thermal/stellar region exceeds preview extent.'
            )
          );
          continue;
        }
        addSlot(star, type, slot, [min * AU_KM, B.maxStellarOrbitAu * AU_KM], (candidate) =>
          stellarRejection(candidate, type, star, peers())
        );
      }
    }
    let moonCount = 0;
    for (const host of peers().sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
      const hostMass = host.physicalCatalog.massKg;
      const radius = host.physicalCatalog.meanRadiusKm;
      const hostDensity = density(hostMass, radius);
      const hill = hillRadiusKm(host.orbitalElements, hostMass, star.physicalCatalog.massKg);
      const temperature = equilibriumTemperatureK(
        star.luminositySolar,
        orbitEnvelope(host.orbitalElements).periapsisKm
      );
      let ringOuterKm = host.rings?.outerRadiusKm || 0;
      if (!host.rings && stream(systemId, host.id, 'ring-presence')() < 0.25) {
        const inner = radius * 1.2;
        const outer = Math.min(
          fluidRocheKm(radius, hostDensity, 1000) * 0.9,
          hill * B.ringHillFraction
        );
        if (temperature <= B.maxIceTemperatureK && outer > inner) {
          const rings = {
            innerRadiusKm: inner,
            outerRadiusKm: outer,
            tiltDeg: 0,
            colorHex: '#b8b4a7',
            opacity: 0.4,
            approximate: true,
          };
          ringProposals.push({
            hostBodyId: host.id,
            rings,
            massKg: hostMass * B.ringMassFraction,
            provenance: {
              origin: 'hypothetical',
              reference: policy.sources.roche,
              policyVersion: policy.version,
              rationale:
                'Cold modeled icy ring within fluid Roche and conservative Hill bounds; no catalog host mutation.',
            },
          });
          ringOuterKm = outer;
        } else
          exclusions.push(
            issue('RING_ROCHE_HILL_THERMAL', host.id, 'Optional icy ring has no screened region.')
          );
      }
      const requested = Math.min(
        integer(stream(systemId, host.id, 'moon-count'), policy.budgets.moonsPerHost),
        policy.budgets.moonsPerSystem - moonCount
      );
      let usedMass = 0;
      const moonPeers = [];
      for (let index = 0; index < requested; index++) {
        const axisBounds = [Math.max(radius * 2, ringOuterKm * 1.1), hill * B.moonHillFraction];
        if (axisBounds[1] <= axisBounds[0]) {
          exclusions.push(
            issue(
              'NO_MOON_REGION',
              host.id,
              'Conservative Hill boundary lies inside physical/ring clearance.'
            )
          );
          break;
        }
        const body = addSlot(
          host,
          'moon',
          `slot-${String(index + 1).padStart(2, '0')}`,
          axisBounds,
          (candidate) => moonRejection(candidate, host, star, moonPeers, usedMass, ringOuterKm)
        );
        if (body) {
          usedMass += body.physicalCatalog.massKg;
          moonPeers.push(body);
          moonCount++;
        }
      }
    }
  }
  const result = {
    schemaVersion: 'non-sol-preview-v1',
    policyVersion: policy.version,
    policySha256: sha256(policy),
    systemId,
    epoch,
    sourceSha256,
    runtimeEnabled: false,
    databaseWrites: false,
    status: generated.some((body) => body.bodyType === 'asteroid') ? 'preview-valid' : 'blocked',
    baseBodies,
    generatedBodies: generated,
    ringProposals,
    countPlan,
    abundance,
    evidence,
    rejected,
    exclusions,
    coverage: {
      representativeAsteroids: generated.filter((body) => body.bodyType === 'asteroid').length,
      playableMiningVerified: false,
      stationVerified: false,
    },
  };
  if (result.status === 'blocked')
    result.exclusions.push(
      issue(
        'REQUIRED_ASTEROID_COVERAGE_BLOCKED',
        systemId,
        'No valid representative asteroid; never insert an invalid fallback or claim playable coverage.'
      )
    );
  validatePreview(result);
  return { ...result, outputSha256: sha256(result) };
}

function validatePreview(preview) {
  if (
    preview.runtimeEnabled !== false ||
    preview.databaseWrites !== false ||
    preview.schemaVersion !== 'non-sol-preview-v1' ||
    preview.policyVersion !== policy.version ||
    preview.policySha256 !== sha256(policy)
  ) {
    throw new Error('Preview must remain offline and use the current policy');
  }
  const base = buildSeededCelestialBodiesForSolarSystem(preview.systemId, preview.epoch);
  if (!isDeepStrictEqual(base, preview.baseBodies))
    throw new Error('Preview changed catalog bodies');
  const catalog = getSolarSystemCatalogEntries(preview.systemId, policy.epoch);
  if (!catalog || preview.sourceSha256 !== sha256({ entries: catalog.entries, policy })) {
    throw new Error('Preview source digest does not match the catalog/policy');
  }
  const bodies = [...preview.baseBodies, ...preview.generatedBodies];
  const byId = new Map(bodies.map((body) => [body.id, body]));
  assertUniverseRelationships(bodies);
  const evidence = new Map(preview.evidence.map((entry) => [entry.bodyId, entry]));
  if (
    evidence.size !== preview.evidence.length ||
    evidence.size !== preview.generatedBodies.length
  ) {
    throw new Error('Every generated body needs exactly one evidence record');
  }
  const counts = {};
  const moonMass = new Map();
  const ringByHost = new Map(preview.ringProposals.map((entry) => [entry.hostBodyId, entry]));
  if (ringByHost.size !== preview.ringProposals.length) throw new Error('Duplicate ring proposals');
  function assertCanonical(body) {
    if (!validateCelestialBody(body)) {
      throw new Error(
        `Invalid generated body ${body.id}: ${JSON.stringify(validateCelestialBody.errors)}`
      );
    }
  }
  for (const body of preview.generatedBodies) {
    assertCanonical(body);
    if (!['planet', 'dwarf-planet', 'asteroid', 'comet', 'moon'].includes(body.bodyType)) {
      throw new Error('Unsupported generated category');
    }
    const [systemId, parentId, bodyType, slot] = JSON.parse(
      body.universeMetadata.generation.seedKey
    );
    if (
      systemId !== preview.systemId ||
      parentId !== body.parentBodyId ||
      bodyType !== body.bodyType ||
      body.id !==
        generatedBodyId({ solarSystemId: systemId, parentBodyId: parentId, bodyType, slot }) ||
      body.catalogId !== body.id ||
      body.universeMetadata.generation.sourceSha256 !== preview.sourceSha256
    ) {
      throw new Error('Generated durable identity or source digest changed');
    }
    const parent = byId.get(body.parentBodyId);
    if (!parent || body.orbitalElements.anchorBodyId !== parent.id)
      throw new Error('Generated parent/anchor unresolved');
    const physical = body.physicalCatalog;
    if (
      body.physical.estimatedMassKg !== physical.massKg ||
      body.physical.estimatedDiameterM !== physical.meanRadiusKm * 2000
    ) {
      throw new Error('Generated physical estimates disagree with modeled mass/radius');
    }
    const recorded = evidence.get(body.id);
    if (
      !recorded ||
      !Number.isInteger(recorded.attempts) ||
      recorded.attempts < 1 ||
      recorded.attempts > policy.budgets.attemptsPerSlot
    )
      throw new Error('Generated candidate attempt budget invalid');
    if (
      !recorded ||
      !positive(recorded.densityKgM3) ||
      Math.abs(density(physical.massKg, physical.meanRadiusKm) / recorded.densityKgM3 - 1) >
        B.densityRelativeTolerance
    )
      throw new Error('Generated mass/radius/density mismatch');
    const icy = body.physicalCatalog.compositionTags.includes('ice');
    const densityBounds = icy ? B.iceDensityKgM3 : B.rockDensityKgM3;
    if (
      !positive(physical.massKg) ||
      !positive(physical.meanRadiusKm) ||
      recorded.densityKgM3 < densityBounds[0] ||
      recorded.densityKgM3 > densityBounds[1]
    ) {
      throw new Error('Generated physical bounds invalid');
    }
    const radiusBounds =
      body.bodyType === 'asteroid'
        ? B.asteroidRadiusKm
        : body.bodyType === 'comet'
          ? B.cometRadiusKm
          : body.bodyType === 'moon'
            ? B.moonRadiusKm
            : body.bodyType === 'planet'
              ? B.planetRadiusKm
              : B.dwarfPlanetRadiusKm;
    if (physical.meanRadiusKm < radiusBounds[0] || physical.meanRadiusKm > radiusBounds[1]) {
      throw new Error('Generated radius outside category bounds');
    }
    const eccentricityBounds =
      body.bodyType === 'comet'
        ? B.cometEccentricity
        : body.bodyType === 'asteroid'
          ? B.asteroidEccentricity
          : B.solidEccentricity;
    if (
      body.orbitalElements.eccentricity < eccentricityBounds[0] ||
      body.orbitalElements.eccentricity > eccentricityBounds[1] ||
      body.orbitalElements.epoch !== policy.epoch ||
      body.spatial.epochMs !== Date.parse(preview.epoch)
    ) {
      throw new Error('Generated eccentricity or epoch outside policy');
    }
    const candidate = {
      orbit: body.orbitalElements,
      massKg: physical.massKg,
      radiusKm: physical.meanRadiusKm,
      densityKgM3: recorded.densityKgM3,
      icy,
    };
    let reason;
    if (body.bodyType === 'moon') {
      const star = byId.get(parent.parentBodyId);
      if (!star || star.bodyType !== 'star') throw new Error('Moon stellar host unresolved');
      const siblings = preview.generatedBodies.filter(
        (entry) =>
          entry.bodyType === 'moon' && entry.parentBodyId === parent.id && entry.id !== body.id
      );
      const usedMass = siblings.reduce((sum, entry) => sum + entry.physicalCatalog.massKg, 0);
      moonMass.set(parent.id, siblings.length + 1);
      reason = moonRejection(
        candidate,
        parent,
        star,
        siblings,
        usedMass,
        ringByHost.get(parent.id)?.rings.outerRadiusKm || parent.rings?.outerRadiusKm || 0
      );
    } else {
      if (parent.bodyType !== 'star') throw new Error('Generated stellar host invalid');
      reason = stellarRejection(
        candidate,
        body.bodyType,
        parent,
        starPeers(bodies, parent.id).filter((p) => p.id !== body.id)
      );
    }
    if (reason) throw new Error(`Generated body fails scientific screen: ${reason}`);
    counts[body.bodyType] = (counts[body.bodyType] || 0) + 1;
    const period = orbitalPeriodSecFromAu(
      body.orbitalElements.semiMajorAxisKm / AU_KM,
      parent.physicalCatalog.massKg + body.physicalCatalog.massKg
    );
    if (Math.abs(body.orbitalElements.orbitalPeriodSec / period - 1) > B.periodRelativeTolerance) {
      throw new Error('Generated orbit violates Kepler period');
    }
    const offset = computeRelativePositionKm(body.orbitalElements, Date.parse(preview.epoch));
    for (const axis of ['x', 'y', 'z']) {
      if (
        !Number.isFinite(body.spatial.positionKm[axis]) ||
        Math.abs(body.spatial.positionKm[axis] - parent.spatial.positionKm[axis] - offset[axis]) >
          1e-4
      ) {
        throw new Error('Generated spatial snapshot does not resolve the parent orbit');
      }
    }
  }
  for (const type of ['asteroid', 'comet', 'planet', 'dwarf-planet']) {
    const budget =
      type === 'asteroid'
        ? policy.budgets.asteroids[preview.abundance]
        : type === 'planet'
          ? policy.budgets.planets
          : type === 'comet'
            ? policy.budgets.comets
            : policy.budgets.dwarfPlanets;
    if (
      !budget ||
      !Number.isInteger(preview.countPlan[type]) ||
      preview.countPlan[type] < budget[0] ||
      preview.countPlan[type] > budget[1] ||
      (counts[type] || 0) > preview.countPlan[type]
    )
      throw new Error('Representative budget exceeded');
  }
  if (
    (counts.moon || 0) > policy.budgets.moonsPerSystem ||
    [...moonMass.values()].some((count) => count > policy.budgets.moonsPerHost[1])
  ) {
    throw new Error('Moon budget exceeded');
  }
  for (const proposal of preview.ringProposals) {
    const host = byId.get(proposal.hostBodyId);
    const star = host && byId.get(host.parentBodyId);
    if (!host || host.rings || !star || star.bodyType !== 'star')
      throw new Error('Ring proposal overwrites catalog or has no host');
    const rings = proposal.rings;
    const radius = host.physicalCatalog.meanRadiusKm;
    const limit = fluidRocheKm(radius, density(host.physicalCatalog.massKg, radius), 1000) * 0.9;
    if (
      !(
        rings.innerRadiusKm >= radius * 1.2 &&
        rings.outerRadiusKm > rings.innerRadiusKm &&
        rings.outerRadiusKm <= limit &&
        rings.outerRadiusKm <=
          B.ringHillFraction *
            hillRadiusKm(
              host.orbitalElements,
              host.physicalCatalog.massKg,
              star.physicalCatalog.massKg
            )
      ) ||
      equilibriumTemperatureK(
        star.luminositySolar,
        orbitEnvelope(host.orbitalElements).periapsisKm
      ) > B.maxIceTemperatureK ||
      proposal.massKg > host.physicalCatalog.massKg * B.ringMassFraction
    )
      throw new Error('Ring scientific bounds invalid');
  }
  if (
    (preview.status === 'preview-valid') !== (counts.asteroid || 0) > 0 ||
    preview.coverage.representativeAsteroids !== (counts.asteroid || 0) ||
    preview.coverage.playableMiningVerified !== false ||
    preview.coverage.stationVerified !== false
  ) {
    throw new Error('Preview coverage cannot claim playable or persistent success');
  }
  if (preview.outputSha256 !== undefined) {
    const { outputSha256, ...content } = preview;
    if (outputSha256 !== sha256(content)) throw new Error('Preview output digest mismatch');
  }
  return true;
}

module.exports = {
  previewNonSolSystem,
  validatePreview,
  hillRadiusKm,
  fluidRocheKm,
  equilibriumTemperatureK,
  clearingDiscriminant,
  density,
  massFromDensity,
  orbitEnvelope,
  stream,
  stellarRejection,
  moonRejection,
  makeBody,
  makeCandidate,
  candidateOrbit,
};
