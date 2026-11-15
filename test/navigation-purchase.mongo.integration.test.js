'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');
const { createSchemaValidator } = require('../src/model/schema-validator');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { MarketBuyMessageHandler } = require('../src/handlers/market-buy-message-handler');
const { ShipUpsertMessageHandler } = require('../src/handlers/ship-upsert-message-handler');
const { SolarSystemGetMessageHandler } = require('../src/handlers/solar-system-get-message-handler');
const { CharacterAddMessageHandler } = require('../src/handlers/character-add-message-handler');
const { registerSocketHandlers } = require('../src/handlers/socket-handler-registry');
const { createMockSocket } = require('../test-support/message-handler-test-helpers');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { materializeStationSnapshotAsync } = require('../src/handlers/context/orbital-math');

let harness;
let schemas;
const playerName = 'NavigationBuyer';
const sessionKey = randomUUID();
const contract = Parser.dereference(path.join(__dirname, '..', 'api', 'openapi.yaml'));

test.before(async () => {
  harness = await createMongoTestHarness();
  const api = await contract;
  const validator = createSchemaValidator({ strict: false });
  schemas = {
    navigation: validator.compile(api.paths['/socket/solar-system-get'].post.responses['200']
      .content['application/json'].schema.properties.navigationState),
    purchase: validator.compile(api.paths['/socket/market-buy'].post.responses['200']
      .content['application/json'].schema),
  };
});
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => { await harness.clearDatabase(); });

async function reload() {
  const ctx = new MessageHandlerContext({ databaseService: harness.databaseService,
    createId: randomUUID, log: () => {} });
  await ctx.getPlayerAsync(playerName);
  await ctx.getCharactersAsync(playerName, { strict: true });
  for (const market of await harness.databaseService.getMarkets({ solarSystemId: 'sol' })) {
    ctx.cacheMarket(market);
  }
  return ctx;
}

async function setup() {
  const db = harness.databaseService;
  await db.registerPlayer({ playerId: randomUUID(), playerName,
    email: 'navigation-buyer@example.invalid', password: 'test-only-password' });
  await db.updatePlayer(playerName, { sessionKey });
  const ctx = await reload();
  const created = await new CharacterAddMessageHandler(ctx).handle(createMockSocket(), {
    playerName, characterName: 'Navigation Buyer',
  });
  assert.equal(created.success, true);
  const characterId = created.characterId;
  const character = ctx.findCharacter(playerName, characterId);
  await ctx.updateCharacterAsync(playerName, characterId, { creditLedger: [
    ...character.creditLedger,
    { id: randomUUID(), type: 'put', amount: 2000, description: 'Isolated test funds',
      timestamp: ctx.getCurrentTimestamp(), referenceId: null },
  ] });
  const seeded = await ctx.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'sol', asOf: '2026-04-17T00:00:00.000Z',
  });
  assert.equal(seeded.success, true);
  assert.equal((await ctx.seedSolarSystemMarketsAsync({ solarSystemId: 'sol' })).success, true);
  return { ctx, characterId, legacyId: character.ships[0].id };
}

async function request(ctx, event, payload) {
  const socket = createMockSocket();
  const listeners = new Map();
  socket.on = (name, callback) => listeners.set(name, callback);
  registerSocketHandlers(socket, {
    marketBuyMessageHandler: new MarketBuyMessageHandler(ctx),
    solarSystemGetMessageHandler: new SolarSystemGetMessageHandler(ctx),
    shipUpsertMessageHandler: new ShipUpsertMessageHandler(ctx),
  }, ctx);
  assert.ok(listeners.has(event), `Missing registry entry for ${event}`);
  await listeners.get(event)({
    playerName, sessionKey, correlationId: randomUUID(),
    requestIdentity: { operation: event.replace('-request', ''), entityType: 'ship', containerId: 'sol' },
    ...payload,
  });
  assert.equal(socket.events.length, 1);
  return socket.events[0].payload;
}

async function buy(ctx, characterId, overrides = {}) {
  return request(ctx, 'market-buy-request', {
    characterId, marketId: 'sol-mars-orbit', solarSystemId: 'sol',
    itemId: 'scavenger-pod', quantity: 1, requestId: randomUUID(), ...overrides,
  });
}

async function navigation(ctx, shipId, destinationMarketId = 'sol-pluto-orbit') {
  return request(ctx, 'solar-system-get-request', {
    solarSystemId: 'sol', navigation: { shipId, destinationMarketId, candidateBodyId: 'sol-earth' },
  });
}

test('authenticated gameplay purchase persists lineage and survives a fresh context with unchanged ship state', async () => {
  const { ctx, characterId, legacyId } = await setup();
  const before = await harness.databaseService.getCharacters(playerName);
  const rejected = await request(ctx, 'market-buy-request', { sessionKey: 'invalid', characterId });
  assert.ok(rejected.message.toLowerCase().includes('session'));
  const purchase = await buy(ctx, characterId);
  assert.equal(purchase.success, true, JSON.stringify(purchase));
  assert.equal(schemas.purchase(purchase), true, JSON.stringify(schemas.purchase.errors));
  assert.equal(purchase.transaction.purchasedShip.navigationPlacement.status, 'supported');
  const missingOutcome = structuredClone(purchase);
  delete missingOutcome.transaction.purchasedShip.navigationPlacement;
  assert.equal(schemas.purchase(missingOutcome), false, 'Supported purchase requires its issuance outcome');
  const shipId = purchase.transaction.purchasedShip.id;
  const saved = (await harness.databaseService.getCharacters(playerName))[0].ships.find((ship) => ship.id === shipId);
  assert.equal(saved.navigationPlacement.status, 'committed');
  assert.equal((await navigation(ctx, legacyId)).navigationState.reason, 'BASIS_UNKNOWN');
  const storedSource = await materializeStationSnapshotAsync(ctx, ctx.getMarket('sol-mars-orbit', 'sol'));
  const storedDestination = await materializeStationSnapshotAsync(ctx, ctx.getMarket('sol-pluto-orbit', 'sol'));
  assert.notEqual(storedSource.spatial.epochMs, saved.spatial.epochMs);
  const evaluatedBodies = buildSeededCelestialBodiesForSolarSystem('sol', new Date(saved.spatial.epochMs).toISOString());
  const evaluated = new MessageHandlerContext({ log: () => {},
    celestialBodiesById: new Map(evaluatedBodies.map((body) => [body.id, body])) });
  const expectedDestination = await materializeStationSnapshotAsync(evaluated, ctx.getMarket('sol-pluto-orbit', 'sol'));
  for (const context of [ctx, await reload()]) {
    const response = await navigation(context, shipId);
    assert.equal(response.navigationState.status, 'supported', JSON.stringify(response));
    assert.equal(schemas.navigation(response.navigationState), true, JSON.stringify(schemas.navigation.errors));
    assert.equal(response.navigationState.departure.provenance.kind, 'trusted-persisted-placement');
    assert.deepEqual(response.navigationState.departure.positionKm, saved.spatial.positionKm);
    assert.equal(response.navigationState.epochMs, saved.spatial.epochMs);
    assert.notEqual(response.navigationState.epochMs, response.navigationState.destination.hostSourceEpochMs);
    assert.deepEqual(response.navigationState.destination.positionKm, expectedDestination.spatial.positionKm);
    assert.deepEqual(response.navigationState.destination.hostPositionKm,
      evaluatedBodies.find((body) => body.id === 'sol-pluto').spatial.positionKm);
    assert.deepEqual(response.navigationState.candidates[0].positionKm,
      evaluatedBodies.find((body) => body.id === 'sol-earth').spatial.positionKm);
    assert.notDeepEqual(response.navigationState.destination.positionKm, storedDestination.spatial.positionKm);
    const storedCandidate = response.bodies.find((body) => body.id === 'sol-earth');
    assert.notDeepEqual(response.navigationState.candidates[0].positionKm, storedCandidate.spatial.positionKm);
    assert.equal(storedCandidate.spatial.epochMs, storedSource.spatial.epochMs);
    assert.deepEqual(response.navigationState.previewEligibility, {
      status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED',
    });
    assert.equal(response.navigationState.clearance.status, 'unsupported');
    assert.equal(response.navigationState.gravityAssist.status, 'unsupported');
  }
  const after = (await harness.databaseService.getCharacters(playerName))[0];
  assert.deepEqual(after.ships.find((ship) => ship.id === legacyId).spatial, before[0].ships[0].spatial);
  assert.deepEqual(after.ships.find((ship) => ship.id === shipId).spatial, saved.spatial);
  assert.deepEqual((await materializeStationSnapshotAsync(ctx, ctx.getMarket('sol-pluto-orbit', 'sol'))).spatial,
    storedDestination.spatial);
  assert.equal(ctx.normalizeCharacter(after).ships.some((ship) => ship.navigationPlacement), false);
});

test('forged attestations are rejected; inventory updates preserve lineage but spatial changes durably revoke it', async () => {
  const { ctx, characterId } = await setup();
  const purchase = await buy(ctx, characterId);
  const shipId = purchase.transaction.purchasedShip.id;
  const original = ctx.findCharacter(playerName, characterId).ships.find((ship) => ship.id === shipId);
  const spatial = structuredClone(original.spatial);
  const forged = await request(ctx, 'ship-upsert-request', {
    characterId, ship: { id: shipId, model: original.model, navigationPlacement: original.navigationPlacement },
  });
  assert.equal(forged.reason, 'NAVIGATION_PLACEMENT_READ_ONLY');
  const replacement = await harness.databaseService.getCharacters(playerName);
  const legacy = replacement[0].ships.find((ship) => ship.id !== shipId);
  legacy.navigationPlacement = { ...original.navigationPlacement, shipId: legacy.id };
  await harness.databaseService.updatePlayer(playerName, { characters: replacement });
  assert.equal((await harness.databaseService.getCharacters(playerName))[0]
    .ships.find((ship) => ship.id === legacy.id).navigationPlacement, undefined);
  const inventory = await request(ctx, 'ship-upsert-request', { characterId, ship: { id: shipId, inventory: [] } });
  assert.equal(inventory.success, true);
  assert.equal((await navigation(await reload(), shipId)).navigationState.status, 'supported');
  const changed = structuredClone(spatial);
  changed.positionKm.x += 1;
  assert.equal((await request(ctx, 'ship-upsert-request', { characterId, ship: { id: shipId, spatial: changed } })).success, true);
  assert.equal((await request(ctx, 'ship-upsert-request', { characterId, ship: { id: shipId, spatial } })).success, true);
  assert.equal((await navigation(await reload(), shipId)).navigationState.reason, 'BASIS_UNKNOWN');
});

test('pending and failed purchases cannot expose supported lineage; rollback restores stock and credits', async () => {
  const { ctx, characterId } = await setup();
  const db = harness.databaseService;
  const credits = ctx.calculateCharacterCredits(ctx.findCharacter(playerName, characterId));
  const originalCommit = db.commitNavigationPlacement;
  db.commitNavigationPlacement = async (_player, _character, ship) => {
    assert.equal((await navigation(await reload(), ship.id)).navigationState.reason, 'BASIS_UNKNOWN');
    throw new Error('Injected final completion failure');
  };
  try {
    const result = await buy(ctx, characterId);
    assert.equal(result.success, false);
    assert.equal(result.reason, 'PARTIAL_WRITE_REVERSED');
  } finally {
    db.commitNavigationPlacement = originalCommit;
  }
  const fresh = await reload();
  assert.equal(fresh.findCharacter(playerName, characterId).ships.length, 1);
  assert.equal(ctx.calculateCharacterCredits(fresh.findCharacter(playerName, characterId)), credits);
  const market = fresh.getMarket('sol-mars-orbit', 'sol');
  assert.equal(market.shipListings[0].status, 'available');
  assert.deepEqual(market.ledger.map((entry) => entry.direction), ['buy', 'reversal']);
});

test('duplicate and concurrent requests cannot issue multiple ships from one persisted listing', async () => {
  const { ctx, characterId } = await setup();
  const second = await reload();
  const results = await Promise.all([buy(ctx, characterId), buy(second, characterId)]);
  assert.equal(results.filter((result) => result.success).length, 1);
  const winner = results.find((result) => result.success);
  const fresh = await reload();
  const duplicate = await buy(fresh, characterId, { requestId: winner.transaction.requestId });
  assert.equal(duplicate.success, false);
  assert.equal(fresh.findCharacter(playerName, characterId).ships.length, 2);
});

test('Earth placement remains unrepaired and excluded while unrelated source market changes preserve lineage', async () => {
  const { ctx, characterId } = await setup();
  const db = harness.databaseService;
  const purchase = await buy(ctx, characterId);
  const shipId = purchase.transaction.purchasedShip.id;
  const source = (await db.getMarkets({ solarSystemId: 'sol' })).find((market) => market.marketId === 'sol-mars-orbit');
  await db.upsertMarket({ ...source, priceMultiplier: 1.2 });
  const fresh = await reload();
  assert.equal((await navigation(fresh, shipId)).navigationState.status, 'supported');
  const earthBefore = (await db.getMarkets({ solarSystemId: 'sol' })).find((market) => market.marketId === 'sol-earth-orbit');
  const response = await navigation(fresh, shipId, 'sol-earth-orbit');
  assert.equal(response.navigationState.status, 'supported');
  assert.deepEqual(response.navigationState.previewEligibility, {
    status: 'ineligible', reason: 'KNOWN_INVALID_DESTINATION',
  });
  const earthPurchase = await buy(fresh, characterId, { marketId: 'sol-earth-orbit' });
  assert.equal(earthPurchase.success, true);
  assert.equal(schemas.purchase(earthPurchase), true, JSON.stringify(schemas.purchase.errors));
  assert.equal(earthPurchase.transaction.purchasedShip.navigationPlacement.status, 'unsupported');
  assert.equal(earthPurchase.transaction.purchasedShip.navigationPlacement.reason, 'KNOWN_INVALID_SOURCE');
  const missingOutcome = structuredClone(earthPurchase);
  delete missingOutcome.transaction.purchasedShip.navigationPlacement;
  assert.equal(schemas.purchase(missingOutcome), false, 'Unsupported purchase requires its issuance outcome');
  assert.equal((await navigation(await reload(), earthPurchase.transaction.purchasedShip.id)).navigationState.reason, 'BASIS_UNKNOWN');
  const earthAfter = (await db.getMarkets({ solarSystemId: 'sol' })).find((market) => market.marketId === 'sol-earth-orbit');
  assert.deepEqual(earthAfter.spatial, earthBefore.spatial);
  assert.deepEqual(earthAfter.trajectory, earthBefore.trajectory);
});
