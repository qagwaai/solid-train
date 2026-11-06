'use strict';

// Explicit opt-in command: node --test test-support/system-naming-rollout.mongo.js
// Never reads MONGODB_URI or starts a server. Each Node test file runs in its own process.
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const { DatabaseService } = require('../src/db/service');
const { SolarSystem, GameStateDocument, CelestialBody, Player } = require('../src/db/models');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const { getSystemNamingManifest } = require('../src/model/system-naming');
const { buildSolarSystemSearchTerms } = require('../src/model/solar-system-search');
const {
  getExoplanetSystemSeedHash,
  clearExoplanetCatalogCache,
} = require('../src/model/exoplanet-catalog');
const {
  buildSeededCelestialBodiesForSolarSystem,
  getSolarSystemCelestialSeedVersion,
} = require('../src/model/solar-system-celestial-seed');
const {
  seedSolarSystemCelestialBodiesAsync,
} = require('../src/handlers/context/celestial-operations-service');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const historical = require('../test/fixtures/system-naming-proposal-manifest-v1.json');
const batch = require('../data/system-naming-weighted-batch-v1.json');

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const presentationIndependent = ({
  displayName,
  settlementName,
  aliases,
  searchTerms,
  ...record
}) => record;
const stableStored = ({ createdAt, updatedAt, __v, ...record }) => record;
const uri = 'mongodb://127.0.0.1:27017';
const prefix = 'stellar_naming_rollout_test_';

test(
  'actual Mongo: full-registry disabled sync, activation, search, repeat sync and rollback preserve bodies/save refs',
  { timeout: 120000 },
  async (t) => {
    const owner = randomUUID();
    const dbName = `${prefix}${owner.replaceAll('-', '')}`;
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
    const manifestBytes = fs.readFileSync(require.resolve('../data/system-naming-manifest.json'));
    let owned = false;
    t.after(async () => {
      try {
        await mongoose.disconnect();
        if (owned) {
          assert.ok(dbName.startsWith(prefix));
          const marker = await client.db(dbName).collection('rollout_ownership').findOne({ owner });
          assert.equal(marker?.dbName, dbName);
          assert.equal(marker?.owner, owner);
          await client.db(dbName).dropDatabase();
          assert.deepEqual(await client.db(dbName).listCollections().toArray(), []);
          t.diagnostic(`CLEANUP verified: dropped only owned ${dbName}; owner=${owner}`);
        }
      } finally {
        await client.close();
        assert.deepEqual(
          fs.readFileSync(require.resolve('../data/system-naming-manifest.json')),
          manifestBytes
        );
      }
    });
    await client.connect(); // Unavailable Mongo is a test FAILURE, never a skip or fallback.
    await client.db('admin').command({ ping: 1 });
    assert.deepEqual(await client.db(dbName).listCollections().toArray(), []);
    await client.db(dbName).createCollection('rollout_ownership');
    owned = true;
    await client.db(dbName).collection('rollout_ownership').insertOne({ owner, dbName });
    t.diagnostic(`ISOLATED database=${dbName}; owner=${owner}; explicit loopback connection`);
    assert.equal(mongoose.connection.readyState, 0);
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 4000 });
    assert.equal(mongoose.connection.name, dbName);
    for (const model of [SolarSystem, GameStateDocument, CelestialBody, Player]) {
      assert.equal(model.db.name, dbName);
    }
    const service = new DatabaseService({ log: () => {} });
    const manifest = getSystemNamingManifest();
    assert.equal(manifest.runtimeEnabled, true);
    const baseline = getSolarSystemRegistry({ namingManifest: historical });
    const disabledManifest = structuredClone(manifest);
    disabledManifest.runtimeEnabled = false;
    const disabled = getSolarSystemRegistry({ namingManifest: disabledManifest });
    const active = getSolarSystemRegistry();
    assert.equal(baseline.length, 4845);
    assert.equal(disabled.length, baseline.length);
    assert.equal(active.length, baseline.length);
    const assignedIds = batch.rows.map((row) => row.systemId);
    const bodiesHash = () =>
      hash(
        assignedIds.map((id) =>
          buildSeededCelestialBodiesForSolarSystem(id, '2026-11-05T00:00:00.000Z')
        )
      );
    const seedHashes = () =>
      assignedIds.map((id) => [
        id,
        getExoplanetSystemSeedHash(id),
        getSolarSystemCelestialSeedVersion(id),
      ]);
    const originalSeedHashes = seedHashes();
    const originalGeneratedBodies = bodiesHash();
    // Simulate an existing pre-searchTerms registry and its real historical startup hash.
    await SolarSystem.collection.insertMany(baseline);
    await GameStateDocument.create({
      key: 'solar-system-registry-sync-state',
      value: { hash: hash(baseline) },
    });
    assert.equal(await SolarSystem.countDocuments({ searchTerms: { $exists: true } }), 0);
    const existingIds = (await SolarSystem.find().sort({ id: 1 }).lean()).map(({ id, _id }) => [
      id,
      String(_id),
    ]);

    const representatives = ['exo-gj-9066', 'exo-kepler-397', 'sol'];
    for (const id of representatives) {
      for (const body of buildSeededCelestialBodiesForSolarSystem(id, '2026-11-05T00:00:00.000Z')) {
        await service.addOrUpdateCelestialBody(body);
      }
      await service.setSolarSystemCelestialSeedState(
        id,
        getSolarSystemCelestialSeedVersion(id),
        '2026-11-05T00:00:00.000Z'
      );
    }
    const anchor = await CelestialBody.findOne({
      'spatial.solarSystemId': 'exo-gj-9066',
      bodyType: 'planet',
    }).lean();
    assert.ok(anchor);
    await service.registerPlayer({
      playerId: owner,
      playerName: 'RolloutTestPilot',
      email: 'rollout@example.test',
      password: 'test-only',
    });
    await service.addCharacter('RolloutTestPilot', {
      id: 'rollout-character',
      characterName: 'Rollout Pilot',
      createdAt: '2026-11-05T00:00:00.000Z',
      ships: [
        {
          id: 'rollout-ship',
          shipName: 'Isolation Probe',
          createdAt: '2026-11-05T00:00:00.000Z',
          spatial: {
            solarSystemId: 'exo-gj-9066',
            frame: 'barycentric',
            positionKm: { x: 1, y: 2, z: 3 },
            epochMs: Date.parse('2026-11-05T00:00:00.000Z'),
          },
        },
      ],
      missions: [],
      creditLedger: [],
    });
    const savedPlayer = await Player.findOne({ playerId: owner }).lean();
    assert.equal(savedPlayer.characters[0].ships[0].spatial.solarSystemId, 'exo-gj-9066');
    await (await Player.findOne({ playerId: owner })).validate();
    const untouchedDigest = async () =>
      hash({
        bodies: await CelestialBody.find().sort({ id: 1 }).lean(),
        players: await Player.find().sort({ playerId: 1 }).lean(),
        seedStates: await GameStateDocument.find({
          key: { $ne: 'solar-system-registry-sync-state' },
        })
          .sort({ key: 1 })
          .lean(),
      });
    const before = await untouchedDigest();
    // A reseed attempt is a hard failure, not a proxy success or swallowed fallback.
    service.addOrUpdateCelestialBody = async () => {
      throw new Error('UNAUTHORIZED RESEED');
    };
    service.setSolarSystemCelestialSeedState = async () => {
      throw new Error('UNAUTHORIZED SEED STATE WRITE');
    };
    const verifyCachePath = async () => {
      for (const solarSystemId of representatives) {
        const result = await seedSolarSystemCelestialBodiesAsync(
          {
            databaseService: service,
            celestialBodiesById: new Map(),
            toNonEmptyString: (value) => (typeof value === 'string' ? value.trim() : ''),
            getCurrentTimestamp: () => '2026-11-05T00:00:00.000Z',
            normalizeCelestialBody: (body) => body,
            log: (message) => assert.fail(message),
          },
          { solarSystemId }
        );
        assert.equal(result.source, 'database-cache');
      }
      assert.equal(await untouchedDigest(), before);
      clearExoplanetCatalogCache(); // Recompute physical hashes, do not assert cached values.
      assert.deepEqual(seedHashes(), originalSeedHashes);
      assert.equal(bodiesHash(), originalGeneratedBodies);
    };
    const readSummaries = async () =>
      (await SolarSystem.find().sort({ id: 1 }).lean()).map(stableStored);
    const verifySummaries = async (records) => {
      const stored = await readSummaries();
      assert.equal(stored.length, 4845);
      assert.deepEqual(
        stored.map(({ id, _id }) => [id, String(_id)]),
        existingIds
      );
      const expected = new Map(records.map((record) => [record.id, record]));
      for (const record of stored) {
        const input = expected.get(record.id);
        assert.equal(record.displayName, input.displayName);
        assert.equal(record.settlementName, input.settlementName);
        assert.deepEqual(record.aliases, input.aliases);
        assert.deepEqual(record.searchTerms, buildSolarSystemSearchTerms(input));
        for (const [field, value] of Object.entries(presentationIndependent(input))) {
          assert.deepEqual(
            record[field],
            value,
            `Persisted non-presentation field ${record.id}.${field}`
          );
        }
        for (const field of ['approval', 'eligibility', 'provenance', 'approvedAssignments']) {
          assert.equal(Object.hasOwn(record, field), false);
        }
      }
      return stored;
    };
    const migration = await service.syncSolarSystems(disabled);
    assert.equal(migration.skipped, false);
    assert.equal(migration.upserted, 4845);
    assert.equal(migration.removed, 0);
    assert.notEqual(migration.hash, hash(baseline));
    const disabledStored = await verifySummaries(disabled);
    assert.equal(disabledStored.filter((record) => record.settlementName !== null).length, 0);
    const assertSearch = async (query, id) => {
      const found = await service.getSolarSystems({ search: query });
      assert.ok(
        found.some((record) => record.id === id),
        `Missing search ${query} -> ${id}`
      );
    };
    await assertSearch('Xingang', 'exo-kepler-397'); // Aliases deliberately available while disabled.
    assert.equal((await service.getSolarSystems({ search: 'Copper Vale' })).length, 0);
    await verifyCachePath();
    const activation = await service.syncSolarSystems(active);
    assert.equal(activation.skipped, false);
    assert.equal(activation.upserted, 4845);
    assert.equal(activation.removed, 0);
    const activeStored = await verifySummaries(active);
    const changed = activeStored.filter(
      (record, i) => record.displayName !== disabledStored[i].displayName
    );
    assert.deepEqual(new Set(changed.map((record) => record.id)), new Set(assignedIds));
    assert.equal(
      activeStored.filter((record, i) => record.settlementName !== disabledStored[i].settlementName)
        .length,
      25
    );
    assert.deepEqual(
      activeStored.map(presentationIndependent),
      disabledStored.map(presentationIndependent)
    );
    for (const row of batch.rows) {
      await assertSearch(row.originalDesignation, row.systemId);
      await assertSearch(row.proposedSettlementName, row.systemId);
      if (row.transliteration) await assertSearch(row.transliteration, row.systemId);
    }
    for (const query of ['星', '星港']) await assertSearch(query, 'exo-kepler-397');
    for (const query of ['منارة', 'Manara'.normalize('NFD')])
      await assertSearch(query, 'exo-k2-221');
    for (const query of ['आशा', 'Asha'.normalize('NFD')])
      await assertSearch(query, 'exo-kepler-1999');
    await assertSearch('Tàishān', 'exo-toi-1846');
    assert.deepEqual(await service.getSolarSystems({ search: '.*' }), []);
    assert.deepEqual(await service.getSolarSystems({ search: '[a-z]|.*' }), []);
    const repeat = await service.syncSolarSystems(active);
    assert.deepEqual(repeat, { skipped: true, hash: activation.hash, upserted: 0, removed: 0 });
    assert.deepEqual(await readSummaries(), activeStored);
    await verifyCachePath();

    const rollback = await service.syncSolarSystems(disabled);
    assert.equal(rollback.skipped, false);
    assert.equal(rollback.hash, migration.hash);
    assert.equal(rollback.removed, 0);
    assert.deepEqual(await verifySummaries(disabled), disabledStored);
    await verifyCachePath();
    assert.equal((await service.syncSolarSystems(disabled)).skipped, true);
    for (const row of batch.rows) await assertSearch(row.originalDesignation, row.systemId);
    assert.equal((await service.getSolarSystems({ search: 'Copper Vale' })).length, 0);
    await assertSearch('Xingang', 'exo-kepler-397');
    // The get handler reads the process registry, not the rolled-back database.
    // A real rollback requires a restart to load the disabled manifest as well.
    const response = await new SolarSystemGetMessageHandler({
      toNonEmptyString: (value) => (typeof value === 'string' ? value.trim() : ''),
      getPlayer: () => ({ playerName: 'RolloutTestPilot' }),
      seedSolarSystemCelestialBodiesAsync: async () => verifyCachePath(),
      getCelestialBodiesAsync: (query) => service.getCelestialBodies(query),
    }).buildResponse({ playerName: 'RolloutTestPilot', solarSystemId: 'exo-gj-9066' });
    assert.equal(response.success, true);
    assert.equal(response.solarSystem.displayName, 'Copper Vale (GJ 9066)');
    assert.equal(response.solarSystem.settlementName, 'Copper Vale');
    for (const field of ['searchTerms', 'provenance', 'approval', 'eligibility']) {
      assert.equal(Object.hasOwn(response.solarSystem, field), false);
    }
    assert.ok(response.bodies.some((body) => body.id === anchor.id));
    assert.equal(getSystemNamingManifest().runtimeEnabled, true);
    t.diagnostic(
      `PASS: 4845 systems; 25 label/settlement changes; 0 removals; identity/source/physical digests equal; ${await CelestialBody.countDocuments()} stored bodies and saved ship refs unchanged; disabled hash=${migration.hash}; active hash=${activation.hash}`
    );
  }
);
