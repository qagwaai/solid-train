'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { LaunchItemMessageHandler } = require('../src/handlers/launch-item-message-handler');
const { ItemUpsertMessageHandler } = require('../src/handlers/item-upsert-message-handler');
const {
  MarketListByLocationMessageHandler,
} = require('../src/handlers/market-list-by-location-message-handler');
const { MarketSellMessageHandler } = require('../src/handlers/market-sell-message-handler');
const { MarketBuyMessageHandler } = require('../src/handlers/market-buy-message-handler');
const { CharacterAddMessageHandler } = require('../src/handlers/character-add-message-handler');
const { previewCopperValeP3 } = require('../src/model/non-sol-p3-preview');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { createMockSocket, seedPlayer } = require('../test-support/message-handler-test-helpers');

const NOW = '2026-11-07T00:00:00.000Z';
const TARGET_HOST = 'exo-gj-9066-generated-planet-d569077cea00ac968d730c15';
let harness;

function createContext() {
  return new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => NOW,
    databaseService: harness.databaseService,
    log: () => {},
  });
}

test.before(async () => {
  harness = await createMongoTestHarness();
});

test.after(async () => {
  if (harness) await harness.teardown();
});

test.beforeEach(async () => {
  await harness.clearDatabase();
});

test('Copper Vale P3 isolated Mongo path mines, materializes a station, trades, and preserves state on reseed', async () => {
  const preview = previewCopperValeP3();
  const context = createContext();
  for (const body of [...preview.baseBodies, ...preview.generatedBodies]) {
    await harness.databaseService.addOrUpdateCelestialBody(body);
  }
  const asteroid = preview.generatedBodies.find((body) => body.bodyType === 'asteroid');
  const host = preview.generatedBodies.find((body) => body.id === TARGET_HOST);
  assert.ok(host);
  const selectedMaterial = asteroid.composition.material;

  const station = context.createSeedMarketPayload(preview.station, NOW);
  assert.equal(
    (await harness.databaseService.getMarkets({ solarSystemId: 'exo-gj-9066' })).filter(
      (market) => market.siteType === 'station'
    ).length,
    0,
    'isolated fresh database has no durable Copper Vale station to retain'
  );
  await harness.databaseService.upsertMarket(station);
  await harness.databaseService.registerPlayer({
    playerId: 'copper-pilot',
    playerName: 'CopperPilot',
    email: 'copper@example.com',
    password: 'test-secret',
  });
  seedPlayer(context, {
    playerName: 'CopperPilot',
    playerId: 'copper-pilot',
    sessionKey: 'copper-session',
  });
  const character = await new CharacterAddMessageHandler(context).handle(createMockSocket(), {
    playerName: 'CopperPilot',
    sessionKey: 'copper-session',
    characterName: 'Copper Pilot',
  });
  assert.equal(character.success, true, character.message);
  const characterId = character.characterId;
  const shipId = `${characterId}-ship-1`;
  const dartId = `${shipId}-item-1`;

  const launch = await new LaunchItemMessageHandler(context).handle(createMockSocket(), {
    playerName: 'CopperPilot',
    characterId,
    shipId,
    sessionKey: 'copper-session',
    targetCelestialBodyId: asteroid.id,
    hotkey: 1,
    itemId: dartId,
    itemType: 'expendable-dart-drone',
  });
  assert.equal(launch.success, true, launch.message);
  assert.equal(launch.resolution.targetDestroyed, true);
  assert.equal(launch.resolution.yieldedMaterials.length, 1);
  assert.equal(launch.resolution.yieldedMaterials[0].material, selectedMaterial);
  assert.equal(launch.resolution.yieldedMaterials[0].quantity, 100);
  const yieldedItem = launch.resolution.yieldedItems[0];
  assert.equal(yieldedItem.itemType, selectedMaterial);
  assert.equal(yieldedItem.quantity, 100);
  const inventoryTransfer = await new ItemUpsertMessageHandler(context).handle(createMockSocket(), {
    playerName: 'CopperPilot',
    sessionKey: 'copper-session',
    item: {
      ...yieldedItem,
      state: 'contained',
      container: { containerType: 'ship', containerId: shipId },
      spatial: null,
    },
  });
  assert.equal(inventoryTransfer.success, true, inventoryTransfer.message);
  const secondDartInventory = await new ItemUpsertMessageHandler(context).handle(
    createMockSocket(),
    {
      playerName: 'CopperPilot',
      sessionKey: 'copper-session',
      item: {
        id: 'p3-dart-second',
        itemType: 'expendable-dart-drone',
        displayName: 'Expendable Dart Drone',
        state: 'contained',
        container: { containerType: 'ship', containerId: shipId },
        owningPlayerId: 'copper-pilot',
        owningCharacterId: characterId,
        launchable: true,
      },
    }
  );
  assert.equal(secondDartInventory.success, true, secondDartInventory.message);
  const duplicateLaunch = await new LaunchItemMessageHandler(context).handle(createMockSocket(), {
    playerName: 'CopperPilot',
    characterId,
    shipId,
    sessionKey: 'copper-session',
    targetCelestialBodyId: asteroid.id,
    hotkey: 2,
    itemId: 'p3-dart-second',
    itemType: 'expendable-dart-drone',
  });
  assert.equal(duplicateLaunch.success, false);
  assert.match(duplicateLaunch.message, /already destroyed/);
  const [unconsumedSecondDart] = await context.getItemsByIdsAsync(['p3-dart-second']);
  assert.equal(unconsumedSecondDart.state, 'contained');
  const savedTarget = await harness.databaseService.getCelestialBodyById(asteroid.id);
  assert.equal(savedTarget.state, 'destroyed');
  assert.equal(savedTarget.debris.length, 1);

  const freshContext = createContext();
  seedPlayer(freshContext, { playerName: 'CopperPilot', playerId: 'copper-pilot' });
  const freshTarget = await freshContext.getCelestialBodyByIdAsync(asteroid.id);
  assert.equal(freshTarget.destroyedAt, savedTarget.destroyedAt);
  const freshMarkets = await freshContext.getMarketsAsync({
    solarSystemId: 'exo-gj-9066',
    asOf: NOW,
  });
  const freshStation = freshMarkets.find((market) => market.marketId === preview.station.marketId);
  assert.ok(freshStation);
  assert.equal(freshStation.stationPlacement.primaryBodyId, TARGET_HOST);
  assert.equal(freshStation.spatial.epochMs, host.spatial.epochMs);
  assert.deepEqual(
    freshStation.spatial.positionKm,
    preview.station.spatial.positionKm,
    'station snapshot resolves exactly from the persisted host snapshot and orbit'
  );
  const listing = await new MarketListByLocationMessageHandler(freshContext).buildResponse({
    playerName: 'CopperPilot',
    sessionKey: 'copper-session',
    solarSystemId: 'exo-gj-9066',
    positionKm: freshStation.spatial.positionKm,
    distanceAu: 1,
    limit: 10,
    locationTypes: ['station'],
  });
  const listed = listing.markets.find((market) => market.marketId === preview.station.marketId);
  assert.ok(listed);
  const stationDescriptor = listing.markets
    .flatMap((market) => market.route?.stations || [])
    .find((entry) => entry.marketId === preview.station.marketId);
  assert.ok(stationDescriptor?.descriptor);
  assert.equal(listed.isDocked, false);

  await context.getMarketsAsync({ solarSystemId: 'exo-gj-9066', asOf: NOW });
  const sell = await new MarketSellMessageHandler(context).handle(createMockSocket(), {
    requestId: 'p3-sell',
    playerName: 'CopperPilot',
    characterId,
    sessionKey: 'copper-session',
    marketId: preview.station.marketId,
    solarSystemId: 'exo-gj-9066',
    itemId: selectedMaterial,
    quantity: 10,
  });
  assert.equal(sell.success, true, sell.message);
  const buy = await new MarketBuyMessageHandler(context).handle(createMockSocket(), {
    requestId: 'p3-buy',
    playerName: 'CopperPilot',
    characterId,
    sessionKey: 'copper-session',
    marketId: preview.station.marketId,
    solarSystemId: 'exo-gj-9066',
    itemId: selectedMaterial,
    quantity: 1,
  });
  assert.equal(buy.success, true, buy.message);

  let marketBeforeRerun = (
    await harness.databaseService.getMarkets({
      solarSystemId: 'exo-gj-9066',
    })
  ).find((market) => market.marketId === preview.station.marketId);
  marketBeforeRerun.priceMultiplier = 1.37;
  await harness.databaseService.upsertMarket(marketBeforeRerun);
  marketBeforeRerun = (
    await harness.databaseService.getMarkets({
      solarSystemId: 'exo-gj-9066',
    })
  ).find((market) => market.marketId === preview.station.marketId);
  const stockBeforeRerun = marketBeforeRerun.inventory.find(
    (entry) => entry.itemId === selectedMaterial
  ).stock;
  const ledgerLengthBeforeRerun = marketBeforeRerun.ledger.length;
  const bodyBeforeRerun = await harness.databaseService.getCelestialBodyById(asteroid.id);
  const resourceProfile = bodyBeforeRerun.universeMetadata.resourceProfile;
  const composition = bodyBeforeRerun.composition;
  const observability = bodyBeforeRerun.observability;
  const shipInventoryBeforeRerun = await harness.databaseService.getItemsByContainer(
    'ship',
    shipId
  );
  const characterBeforeRerun = (await harness.databaseService.getCharacters('CopperPilot')).find(
    (entry) => entry.id === characterId
  );
  const itemCountBeforeRerun = (
    await harness.databaseService.getItemsByIds(
      launch.resolution.yieldedItems.map((item) => item.id)
    )
  ).length;

  const p3BodyForTarget = preview.generatedBodies.find((body) => body.id === asteroid.id);
  await harness.databaseService.addOrUpdateCelestialBody(p3BodyForTarget, {
    preserveGameplay: true,
  });
  const rerunMarket = {
    ...marketBeforeRerun,
    stationPlacement: preview.station.stationPlacement,
    trajectory: preview.station.trajectory,
    spatial: preview.station.spatial,
  };
  await harness.databaseService.upsertMarket(rerunMarket);
  const persistedAfterRerun = await harness.databaseService.getCelestialBodyById(asteroid.id);
  const marketAfterRerun = (
    await harness.databaseService.getMarkets({
      solarSystemId: 'exo-gj-9066',
    })
  ).find((market) => market.marketId === preview.station.marketId);
  assert.equal(persistedAfterRerun.state, 'destroyed');
  assert.equal(persistedAfterRerun.destroyedAt, bodyBeforeRerun.destroyedAt);
  assert.deepEqual(persistedAfterRerun.debris, bodyBeforeRerun.debris);
  assert.deepEqual(persistedAfterRerun.composition, composition);
  assert.deepEqual(persistedAfterRerun.observability, observability);
  assert.deepEqual(persistedAfterRerun.universeMetadata.resourceProfile, resourceProfile);
  assert.equal(
    marketAfterRerun.inventory.find((entry) => entry.itemId === selectedMaterial).stock,
    stockBeforeRerun
  );
  assert.equal(marketAfterRerun.ledger.length, ledgerLengthBeforeRerun);
  assert.equal(marketAfterRerun.priceMultiplier, 1.37);
  assert.deepEqual(
    await harness.databaseService.getItemsByContainer('ship', shipId),
    shipInventoryBeforeRerun
  );
  const characterAfterRerun = (await harness.databaseService.getCharacters('CopperPilot')).find(
    (entry) => entry.id === characterId
  );
  assert.deepEqual(characterAfterRerun.creditLedger, characterBeforeRerun.creditLedger);
  assert.equal(
    (
      await harness.databaseService.getItemsByIds(
        launch.resolution.yieldedItems.map((item) => item.id)
      )
    ).length,
    itemCountBeforeRerun
  );
});
