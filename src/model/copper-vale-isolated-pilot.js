'use strict';

const assert = require('node:assert/strict');
const { MessageHandlerContext } = require('../handlers/message-handler-context');
const { createSeedMarketPayload } = require('../handlers/context/context-bootstrap-service');
const { getCelestialBodyByIdAsync } = require('../handlers/context/celestial-operations-service');
const { getMarketsAsync } = require('../handlers/context/market-service');
const { previewCopperValeP4, resolveNamedBody } = require('./non-sol-p4-preview');

// Only the isolated launcher calls this. Normal seed dispatch and manifests stay disabled.
async function seedCopperValeIsolatedPilot(databaseService) {
  const preview = previewCopperValeP4();
  const bodies = [...preview.baseBodies, ...preview.generatedBodies];
  assert.equal(bodies.length, 57);
  assert.equal((await databaseService.getCelestialBodies({})).length, 0, 'Fresh DB required');
  assert.equal((await databaseService.getMarkets({})).length, 0, 'Fresh DB required');
  for (const body of bodies) {
    await databaseService.addOrUpdateCelestialBody(body, { preserveGameplay: true });
  }
  const context = new MessageHandlerContext({
    databaseService,
    log: () => {},
    getCurrentTimestamp: () => preview.epoch,
  });
  await databaseService.upsertMarket(createSeedMarketPayload(context, preview.station, preview.epoch));

  // Read through a fresh canonical context, never through a hand-populated cache.
  const persisted = await databaseService.getCelestialBodies({});
  assert.equal(persisted.length, 57);
  for (const expected of bodies) {
    const actual = await getCelestialBodyByIdAsync(context, expected.id);
    assert.ok(actual, `Missing durable body ${expected.id}`);
    for (const field of [
      'id', 'displayName', 'parentBodyId', 'bodyType', 'spatial',
      'physicalCatalog', 'orbitalElements', 'composition', 'universeMetadata',
    ]) {
      if (expected[field] == null) {
        assert.ok(actual[field] == null, `${expected.id}: unexpected ${field}`);
      } else {
        assert.partialDeepStrictEqual(actual[field], expected[field], `${expected.id}: ${field}`);
      }
    }
    assert.equal(resolveNamedBody(persisted, preview.systemId, expected.displayName).id, expected.id);
    for (const alias of expected.universeMetadata?.naming?.aliases || []) {
      assert.equal(resolveNamedBody(persisted, preview.systemId, alias).id, expected.id);
    }
  }
  const markets = await getMarketsAsync(context, { solarSystemId: preview.systemId, asOf: preview.epoch });
  assert.equal(markets.length, 1);
  for (const field of ['marketId', 'marketName', 'siteName', 'stationPlacement', 'trajectory', 'spatial']) {
    assert.partialDeepStrictEqual(markets[0][field], preview.station[field], `Station: ${field}`);
  }
  for (const blocked of preview.unchangedSystems) {
    assert.equal(blocked.status, 'blocked');
    assert.equal(blocked.generatedBodyCount, 0);
    assert.equal(blocked.namingChanged, false);
    assert.equal((await databaseService.getCelestialBodies({ solarSystemId: blocked.systemId })).length, 0);
    assert.equal((await databaseService.getMarkets({ solarSystemId: blocked.systemId })).length, 0);
  }
  return {
    systemId: preview.systemId,
    bodyCount: persisted.length,
    stationId: preview.station.marketId,
    epoch: preview.epoch,
    p3InputSha256: preview.p3InputSha256,
    p4OutputSha256: preview.outputSha256,
    unchangedSystems: preview.unchangedSystems,
  };
}

module.exports = { seedCopperValeIsolatedPilot };
