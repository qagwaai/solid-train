'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { CelestialBody, GameStateDocument, Market, Player } = require('../src/db/models');
const { SOL_SYSTEM_CATALOG } = require('../src/model/sol-system-catalog');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const { SOLAR_SYSTEM_MARKET_SEED_STATE_KEY } = require('../src/model/solar-system-market-seed');
const { computeRelativeOrbitPositionKm } = require('../src/handlers/context/orbital-math');

const EXPECTED_MARKETS = {
  'sol-mercury-orbit': {
    id: '6af08ff4762513ce5686c0eb',
    anchorBodyId: 'sol-mercury',
    oldSemiMajorAxisKm: 2200,
    eccentricity: 0.03,
    orbitalPeriodSec: 86400,
    inclinationDeg: 0,
    meanAnomalyAtEpochDeg: 0,
  },
  'sol-venus-orbit': {
    id: '6af08ff4762513ce5686c0ec',
    anchorBodyId: 'sol-venus',
    oldSemiMajorAxisKm: 3500,
    eccentricity: 0.01,
    orbitalPeriodSec: 120000,
    inclinationDeg: 1.5,
    meanAnomalyAtEpochDeg: 23,
  },
  'sol-earth-orbit': {
    id: '6af08ff4762513ce5686c0ed',
    anchorBodyId: 'sol-earth',
    oldSemiMajorAxisKm: 4200,
    eccentricity: 0.01,
    orbitalPeriodSec: 108000,
    inclinationDeg: 0,
    meanAnomalyAtEpochDeg: 46,
  },
  'sol-moon-orbit': {
    id: '6af08ff4762513ce5686c0ee',
    anchorBodyId: 'sol-luna',
    oldSemiMajorAxisKm: 1200,
    eccentricity: 0.02,
    orbitalPeriodSec: 54000,
    inclinationDeg: 1.5,
    meanAnomalyAtEpochDeg: 69,
  },
  'sol-jupiter-orbit': {
    id: '6af08ff4762513ce5686c0f0',
    anchorBodyId: 'sol-jupiter',
    oldSemiMajorAxisKm: 9800,
    eccentricity: 0.04,
    orbitalPeriodSec: 260000,
    inclinationDeg: 1.5,
    meanAnomalyAtEpochDeg: 115,
  },
  'sol-saturn-orbit': {
    id: '6af08ff4762513ce5686c0f1',
    anchorBodyId: 'sol-saturn',
    oldSemiMajorAxisKm: 8600,
    eccentricity: 0.03,
    orbitalPeriodSec: 245000,
    inclinationDeg: 0,
    meanAnomalyAtEpochDeg: 138,
  },
  'sol-uranus-orbit': {
    id: '6af08ff4762513ce5686c0f2',
    anchorBodyId: 'sol-uranus',
    oldSemiMajorAxisKm: 7200,
    eccentricity: 0.02,
    orbitalPeriodSec: 230000,
    inclinationDeg: 1.5,
    meanAnomalyAtEpochDeg: 161,
  },
  'sol-neptune-orbit': {
    id: '6af08ff4762513ce5686c0f3',
    anchorBodyId: 'sol-neptune',
    oldSemiMajorAxisKm: 7400,
    eccentricity: 0.03,
    orbitalPeriodSec: 240000,
    inclinationDeg: 0,
    meanAnomalyAtEpochDeg: 184,
  },
};

const CATALOG = new Map(SOL_SYSTEM_CATALOG.map((entry) => [entry.id, entry]));
const OLD_SEED_VERSION = '2026-10-station-snapshot-v2';
const NEW_SEED_VERSION = '2026-11-station-snapshot-v3';

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function revision(value) {
  return require('node:crypto').createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function isTriple(value) {
  return value && ['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]));
}

function normalizeAngleRadians(ctx, value) {
  const tau = Math.PI * 2;
  return ((value % tau) + tau) % tau;
}

function abort(reason, report) {
  report.status = 'aborted';
  report.failure = reason;
  throw Object.assign(new Error(reason), { report });
}

async function main() {
  const execute = process.argv.includes('--execute');
  const reportPathArg = process.argv.find((arg) => arg.startsWith('--report='));
  const reportPath = reportPathArg
    ? path.resolve(reportPathArg.slice('--report='.length))
    : path.resolve(__dirname, '..', '..', '..', 'Users', 'Peter Girard', '.copilot', 'session-state', '2ec5080c-2138-4315-bd97-8184208e0457', 'files', 'sol-station-orbit-migration-report.json');
  const uri = process.env.MONGODB_URI;
  const report = {
    status: 'prepared',
    mode: execute ? 'execute' : 'prepare-only',
    startedAt: new Date().toISOString(),
    writesPerformed: false,
    marketWrites: [],
    seedStateWrite: null,
    rollback: [],
  };

  if (!execute) {
    report.status = 'prepared-no-execution';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write('No live action. Re-run with --execute only after explicit maintenance approval.\n');
    return;
  }
  if (!uri) abort('MONGODB_URI is required', report);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const seedMarkets = buildSeededMarketsForSolarSystem('sol').filter((market) =>
      Object.prototype.hasOwnProperty.call(EXPECTED_MARKETS, market.marketId)
    );
    const seedById = new Map(seedMarkets.map((market) => [market.marketId, market]));

    const liveMarkets = await Market.find({
      solarSystemId: 'sol',
      marketId: { $in: Object.keys(EXPECTED_MARKETS) },
    }).lean();
    const liveById = new Map(liveMarkets.map((market) => [market.marketId, market]));

    for (const [marketId, expected] of Object.entries(EXPECTED_MARKETS)) {
      const live = liveById.get(marketId);
      if (!live) abort(`Missing exact live market ${marketId}`, report);
      if (String(live._id) !== expected.id) abort(`Market _id mismatch for ${marketId}`, report);
      if (live.solarSystemId !== 'sol') abort(`Market system mismatch for ${marketId}`, report);
      const orbit = live.trajectory?.orbit;
      if (!orbit) abort(`Missing live orbit for ${marketId}`, report);
      if (orbit.anchorBodyId !== expected.anchorBodyId) abort(`Host anchor mismatch for ${marketId}`, report);
      if (orbit.semiMajorAxisKm !== expected.oldSemiMajorAxisKm) abort(`Partial or unexpected orbit state for ${marketId}`, report);
      for (const [field, value] of [
        ['eccentricity', expected.eccentricity],
        ['orbitalPeriodSec', expected.orbitalPeriodSec],
        ['inclinationDeg', expected.inclinationDeg],
        ['meanAnomalyAtEpochDeg', expected.meanAnomalyAtEpochDeg],
        ['longitudeOfAscendingNodeDeg', 0],
        ['argumentOfPeriapsisDeg', 0],
        ['epoch', '2026-01-01T00:00:00.000Z'],
      ]) {
        if (orbit[field] !== value) abort(`Orbit ${field} mismatch for ${marketId}`, report);
      }

      const host = await CelestialBody.findOne({ id: expected.anchorBodyId }).lean();
      const entry = CATALOG.get(expected.anchorBodyId);
      if (
        !host ||
        host.id !== expected.anchorBodyId ||
        host.bodyType !== entry.bodyType ||
        host.parentBodyId !== entry.parentBodyId ||
        host.catalogId !== expected.anchorBodyId ||
        host.isCatalogBody !== true ||
        host.sourceScanId !== 'catalog' ||
        host.createdByCharacterId !== 'system-catalog' ||
        host.state !== 'active' ||
        host.spatial?.solarSystemId !== 'sol' ||
        host.spatial?.frame !== 'barycentric' ||
        !isTriple(host.spatial?.positionKm) ||
        !Number.isSafeInteger(host.spatial?.epochMs)
      ) {
        abort(`Host source/position mismatch for ${marketId}`, report);
      }

      const seed = seedById.get(marketId);
      const seedOrbit = seed?.trajectory?.orbit;
      if (!seedOrbit || seedOrbit.anchorBodyId !== expected.anchorBodyId) abort(`Seed mismatch for ${marketId}`, report);
    }

    const seedStateDocument = await GameStateDocument.findOne({ key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY }).lean();
    const systems = seedStateDocument?.value?.systems;
    const solSeedState = Array.isArray(systems)
      ? systems.find((entry) => entry.solarSystemId === 'sol')
      : null;
    if (!solSeedState || solSeedState.seedVersion !== OLD_SEED_VERSION) {
      abort(`Unexpected Sol seed state; expected ${OLD_SEED_VERSION}`, report);
    }

    const players = await Player.find({
      'characters.ships.navigationPlacement.sourceMarketId': { $in: Object.keys(EXPECTED_MARKETS) },
    }).lean();
    const dependentPlacements = [];
    for (const player of players) {
      for (const character of player.characters || []) {
        for (const ship of character.ships || []) {
          const placement = ship.navigationPlacement;
          if (placement && Object.prototype.hasOwnProperty.call(EXPECTED_MARKETS, placement.sourceMarketId)) {
            dependentPlacements.push({
              playerId: player.playerId || null,
              characterId: character.id,
              shipId: ship.id,
              sourceMarketId: placement.sourceMarketId,
              lineageId: placement.lineageId,
              sourceModelRevision: placement.sourceModelRevision,
              shipRevision: placement.shipRevision,
              epochMs: placement.epochMs,
            });
          }
        }
      }
    }
    if (dependentPlacements.length > 0) {
      abort(`Dependent navigation placements found: ${dependentPlacements.length}`, {
        ...report,
        dependentPlacements,
      });
    }

    report.preUpdate = {};
    report.postUpdate = {};
    const ctx = {
      normalizeAngleRadians,
      normalizeMarketOrbit: (orbit) => orbit,
      isTriple,
      getCelestialBodyByIdAsync: async (id) => CelestialBody.findOne({ id }).lean(),
    };

    const applied = [];
    for (const [marketId, expected] of Object.entries(EXPECTED_MARKETS)) {
      const live = liveById.get(marketId);
      const seed = seedById.get(marketId);
      const orbit = { ...live.trajectory.orbit, semiMajorAxisKm: seed.trajectory.orbit.semiMajorAxisKm };
      const host = await CelestialBody.findOne({ id: expected.anchorBodyId }).lean();
      const relative = computeRelativeOrbitPositionKm(ctx, orbit, new Date(host.spatial.epochMs).toISOString());
      const spatial = {
        solarSystemId: 'sol',
        frame: host.spatial.frame,
        positionKm: {
          x: host.spatial.positionKm.x + relative.x,
          y: host.spatial.positionKm.y + relative.y,
          z: host.spatial.positionKm.z + relative.z,
        },
        epochMs: host.spatial.epochMs,
      };
      const radius = CATALOG.get(expected.anchorBodyId).physical.meanRadiusKm;
      const periapsis = orbit.semiMajorAxisKm * (1 - orbit.eccentricity);
      if (Math.abs(periapsis - (radius + 10000)) >= 1e-9) abort(`Periapsis invariant failure for ${marketId}`, report);

      report.preUpdate[marketId] = {
        marketObjectId: String(live._id),
        __v: live.__v,
        semiMajorAxisKm: live.trajectory.orbit.semiMajorAxisKm,
        spatial: live.spatial,
        orbitRevision: revision(live.trajectory.orbit),
      };

      const result = await Market.findOneAndUpdate(
        {
          _id: live._id,
          marketId,
          solarSystemId: 'sol',
          __v: live.__v,
          'trajectory.orbit.semiMajorAxisKm': expected.oldSemiMajorAxisKm,
        },
        {
          $set: {
            'trajectory.orbit.semiMajorAxisKm': orbit.semiMajorAxisKm,
            spatial,
          },
          $inc: { __v: 1 },
        },
        { returnDocument: 'after', runValidators: true }
      ).lean();
      if (!result) {
        await rollbackMarkets(applied, report);
        abort(`Conditional Market update failed for ${marketId}`, report);
      }
      applied.push({
        marketId,
        objectId: String(live._id),
        oldValue: report.preUpdate[marketId],
        newValue: {
          __v: result.__v,
          semiMajorAxisKm: result.trajectory.orbit.semiMajorAxisKm,
          spatial: result.spatial,
          orbitRevision: revision(result.trajectory.orbit),
        },
      });
      report.writesPerformed = true;
    }
    report.marketWrites = applied;

    const filteredSystems = systems.filter((entry) => entry.solarSystemId !== 'sol');
    filteredSystems.push({
      solarSystemId: 'sol',
      seedVersion: NEW_SEED_VERSION,
      seededAt: solSeedState.seededAt,
    });
    const seedResult = await GameStateDocument.findOneAndUpdate(
      { _id: seedStateDocument._id, key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY, __v: seedStateDocument.__v },
      {
        $set: { key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY, value: { systems: filteredSystems }, updatedAt: new Date() },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after', runValidators: true }
    ).lean();
    if (!seedResult) {
      await rollbackMarkets(applied, report);
      await rollbackSeedState(seedStateDocument, report);
      abort('Conditional seed-state update failed', report);
    }
    report.seedStateWrite = {
      objectId: String(seedStateDocument._id),
      oldSeedVersion: OLD_SEED_VERSION,
      newSeedVersion: NEW_SEED_VERSION,
      __vBefore: seedStateDocument.__v,
      __vAfter: seedResult.__v,
    };

    const verification = await verifyPostUpdate(report);
    report.postUpdate = verification;
    if (!verification.success) {
      await rollbackSeedState(seedStateDocument, report);
      await rollbackMarkets(applied, report);
      abort(`Post-update verification failed: ${verification.failures.join('; ')}`, report);
    }
    report.status = 'succeeded';
    report.completedAt = new Date().toISOString();
  } catch (error) {
    if (error.report) {
      report.status = error.report.status || 'aborted';
      report.failure = error.report.failure || error.message;
    } else {
      report.status = 'aborted';
      report.failure = error.message;
    }
  } finally {
    await mongoose.disconnect();
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}

async function rollbackMarkets(applied, report) {
  for (const item of [...applied].reverse()) {
    const result = await Market.findOneAndUpdate(
      {
        _id: item.objectId,
        marketId: item.marketId,
        solarSystemId: 'sol',
        __v: item.newValue.__v,
      },
      {
        $set: {
          'trajectory.orbit.semiMajorAxisKm': item.oldValue.semiMajorAxisKm,
          spatial: item.oldValue.spatial,
        },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after', runValidators: true }
    ).lean();
    report.rollback.push({
      marketId: item.marketId,
      success: Boolean(result),
      restoredSemiMajorAxisKm: item.oldValue.semiMajorAxisKm,
    });
  }
}

async function rollbackSeedState(seedStateDocument, report) {
  const result = await GameStateDocument.findOneAndUpdate(
    { _id: seedStateDocument._id, key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY },
    {
      $set: {
        key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY,
        value: seedStateDocument.value,
        updatedAt: seedStateDocument.updatedAt,
      },
      $inc: { __v: 1 },
    },
    { returnDocument: 'after', runValidators: true }
  ).lean();
  report.rollback.push({
    seedState: true,
    success: Boolean(result),
    restoredSeedVersion: OLD_SEED_VERSION,
  });
}

async function verifyPostUpdate(report) {
  const failures = [];
  const records = {};
  for (const [marketId, expected] of Object.entries(EXPECTED_MARKETS)) {
    const live = await Market.findOne({ _id: expected.id, marketId, solarSystemId: 'sol' }).lean();
    if (!live) {
      failures.push(`missing ${marketId}`);
      continue;
    }
    const orbit = live.trajectory?.orbit;
    const seed = buildSeededMarketsForSolarSystem('sol').find((entry) => entry.marketId === marketId);
    if (!orbit || orbit.semiMajorAxisKm !== seed.trajectory.orbit.semiMajorAxisKm) {
      failures.push(`semiMajorAxis mismatch ${marketId}`);
    }
    const radius = CATALOG.get(expected.anchorBodyId).physical.meanRadiusKm;
    const periapsis = orbit?.semiMajorAxisKm * (1 - orbit.eccentricity);
    if (!Number.isFinite(periapsis) || Math.abs(periapsis - (radius + 10000)) >= 1e-9) {
      failures.push(`periapsis invariant ${marketId}`);
    }
    records[marketId] = {
      objectId: String(live._id),
      __v: live.__v,
      semiMajorAxisKm: orbit?.semiMajorAxisKm,
      spatialEpochMs: live.spatial?.epochMs,
      spatialPositionKm: live.spatial?.positionKm,
      orbitRevision: orbit ? revision(orbit) : null,
    };
  }
  const seedState = await GameStateDocument.findOne({ key: SOLAR_SYSTEM_MARKET_SEED_STATE_KEY }).lean();
  const solSeed = seedState?.value?.systems?.find((entry) => entry.solarSystemId === 'sol');
  if (solSeed?.seedVersion !== NEW_SEED_VERSION) failures.push('Sol seed state is not v3');
  return { success: failures.length === 0, failures, records, seedStateVersion: solSeed?.seedVersion || null };
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
