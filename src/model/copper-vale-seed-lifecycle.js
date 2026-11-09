'use strict';

const { isDeepStrictEqual } = require('node:util');
const { MessageHandlerContext } = require('../handlers/message-handler-context');
const { createSeedMarketPayload } = require('../handlers/context/context-bootstrap-service');
const { previewCopperValeP4 } = require('./non-sol-p4-preview');
const { Market } = require('../db/models');
const { sha256, projectToExpectedShape, assertBodyMatches, REVISIONS,
  physicalBodyFields, resourceBodyFields, namingBodyFields } =
  require('./copper-vale-catalog-reconciliation');

const SYSTEM_ID = 'exo-gj-9066';
const STATE_SCHEMA_VERSION = 'copper-vale-seed-lifecycle-v1';
const MUTABLE_MARKET_FIELDS = Object.freeze([
  'inventory',
  'ledger',
  'shipListings',
  'lastRestockAt',
  'priceMultiplier',
]);
function marketReadbackFields(market) {
  return Object.fromEntries(
    ['marketId', 'solarSystemId', 'marketName', 'siteType', 'siteName',
      'stationPlacement', 'trajectory', 'spatial'].map((field) => [field, market[field]])
  );
}

function persistedMarketFields(market) {
  return Object.fromEntries(
    Object.entries(market).filter(([field]) => Boolean(Market.schema.path(field)))
  );
}

function buildCopperValeSeedPlan(preview = previewCopperValeP4()) {
  if (preview.systemId !== SYSTEM_ID || preview.runtimeEnabled !== false) {
    throw new Error('Copper Vale lifecycle only accepts the reviewed offline P4 preview');
  }
  const bodies = [...preview.baseBodies, ...preview.generatedBodies];
  if (bodies.length !== 57 || new Set(bodies.map((body) => body.id)).size !== bodies.length) {
    throw new Error('Copper Vale lifecycle requires the exact 57 unique reviewed body IDs');
  }
  const station = structuredClone(preview.station);
  const context = new MessageHandlerContext({
    databaseService: {},
    log: () => {},
    getCurrentTimestamp: () => preview.epoch,
  });
  const market = createSeedMarketPayload(context, station, preview.epoch);
  const expectedBodies = Object.fromEntries(
    bodies.map((body) => [body.id, sha256(body)])
  );
  const hashes = {
    sourceSha256: preview.p3InputSha256,
    physicalSha256: sha256(bodies.map(physicalBodyFields)),
    resourceSha256: sha256(bodies.map(resourceBodyFields)),
    namingSha256: sha256(bodies.map(namingBodyFields)),
    stationSha256: sha256(station),
  };
  const revisions = { ...REVISIONS };
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    systemId: SYSTEM_ID,
    epoch: preview.epoch,
    p4OutputSha256: preview.outputSha256,
    revisions,
    hashes,
    expectedBodies,
    expectedBodyIds: bodies.map((body) => body.id).sort(),
    bodies,
    station,
    market,
    expectedMarketFields: marketReadbackFields(market),
    expectedMarketSha256: sha256(marketReadbackFields(market)),
    expectedMarketSeedFields: persistedMarketFields(market),
    expectedMarketSeedSha256: sha256(persistedMarketFields(market)),
    planSha256: sha256({
      schemaVersion: STATE_SCHEMA_VERSION,
      systemId: SYSTEM_ID,
      epoch: preview.epoch,
      p4OutputSha256: preview.outputSha256,
      revisions,
      hashes,
      expectedBodies,
      expectedMarketSha256: sha256(marketReadbackFields(market)),
      expectedMarketSeedSha256: sha256(persistedMarketFields(market)),
    }),
  };
}

function assertMarketMatches(actual, plan) {
  if (!actual) throw new Error(`Missing expected seeded station ${plan.station.marketId}`);
  const actualFields = marketReadbackFields(actual);
  const projected = projectToExpectedShape(actualFields, plan.expectedMarketFields);
  if (!isDeepStrictEqual(projected, plan.expectedMarketFields)) {
    throw new Error(`Seed readback mismatch for station ${plan.station.marketId}`);
  }
  for (const [field, expectedValue] of Object.entries(plan.expectedMarketSeedFields)) {
    if (
      MUTABLE_MARKET_FIELDS.includes(field) &&
      !isDeepStrictEqual(actual[field], expectedValue)
    ) {
      continue;
    }
    if (!isDeepStrictEqual(projectToExpectedShape(actual[field], expectedValue), expectedValue)) {
      throw new Error(`Seed readback mismatch for station ${plan.station.marketId}.${field}`);
    }
  }
}

function assertStateMatchesPlan(state, plan) {
  if (!state) throw new Error('No Copper Vale lifecycle checkpoint exists');
  if (
    !Array.isArray(state.verifiedBodyIds) ||
    new Set(state.verifiedBodyIds).size !== state.verifiedBodyIds.length ||
    state.verifiedBodyIds.some((id) => !plan.expectedBodyIds.includes(id))
  ) {
    throw new Error('Copper Vale lifecycle checkpoint has invalid verified body IDs');
  }
  if (
    state.schemaVersion !== plan.schemaVersion ||
    state.systemId !== plan.systemId ||
    state.planSha256 !== plan.planSha256 ||
    state.p4OutputSha256 !== plan.p4OutputSha256 ||
    !isDeepStrictEqual(state.hashes, plan.hashes) ||
    !isDeepStrictEqual(state.revisions, plan.revisions) ||
    !isDeepStrictEqual(state.expectedBodyIds, plan.expectedBodyIds) ||
    !isDeepStrictEqual(state.expectedBodies, plan.expectedBodies) ||
    state.expectedMarketSha256 !== plan.expectedMarketSha256 ||
    state.expectedMarketSeedSha256 !== plan.expectedMarketSeedSha256
  ) {
    throw new Error(
      'Copper Vale source/catalog seed plan changed; lifecycle is paused for owner re-review'
    );
  }
}

async function getExpectedBodies(databaseService, plan) {
  const actualBodies = await databaseService.getCelestialBodies({ solarSystemId: SYSTEM_ID });
  const byId = new Map(actualBodies.map((body) => [body.id, body]));
  for (const expected of plan.bodies) assertBodyMatches(byId.get(expected.id), expected);
  return { actualBodies, byId };
}

async function readback(databaseService, plan, state) {
  assertStateMatchesPlan(state, plan);
  const { byId } = await getExpectedBodies(databaseService, plan);
  const markets = await databaseService.getMarkets({ solarSystemId: SYSTEM_ID });
  const actualMarket = markets.find((market) => market.marketId === plan.station.marketId);
  assertMarketMatches(actualMarket, plan);
  if (state.status === 'complete' &&
      (!isDeepStrictEqual([...state.verifiedBodyIds].sort(), plan.expectedBodyIds) ||
        state.marketVerified !== true)) {
    throw new Error('Completed checkpoint does not contain every exact body and station verification');
  }
  return {
    systemId: SYSTEM_ID,
    status: state.status,
    expectedBodyIds: plan.expectedBodyIds,
    verifiedBodyIds: [...byId.keys()].filter((id) => plan.expectedBodies[id]).sort(),
    stationId: plan.station.marketId,
    hashes: plan.hashes,
    revisions: plan.revisions,
    planSha256: plan.planSha256,
    p4OutputSha256: plan.p4OutputSha256,
  };
}

function stateForPlan(plan, status = 'applying') {
  return {
    schemaVersion: plan.schemaVersion,
    systemId: SYSTEM_ID,
    status,
    planSha256: plan.planSha256,
    p4OutputSha256: plan.p4OutputSha256,
    revisions: plan.revisions,
    hashes: plan.hashes,
    expectedBodyIds: plan.expectedBodyIds,
    expectedBodies: plan.expectedBodies,
    expectedMarketSha256: plan.expectedMarketSha256,
    expectedMarketSeedSha256: plan.expectedMarketSeedSha256,
    verifiedBodyIds: [],
    marketVerified: false,
    updatedAt: new Date().toISOString(),
  };
}

async function persistState(databaseService, state) {
  state.updatedAt = new Date().toISOString();
  await databaseService.setCopperValeSeedLifecycleState(state);
}

async function runCopperValeSeedLifecycle(databaseService, options = {}) {
  const action = options.action || 'apply';
  if (!['dry-run', 'apply', 'resume', 'readback', 'rollback'].includes(action)) {
    throw new Error(`Unsupported Copper Vale lifecycle action: ${action}`);
  }
  const plan = options.plan || buildCopperValeSeedPlan();
  let currentState = await databaseService.getCopperValeSeedLifecycleState();

  if (action === 'dry-run') {
    let readiness = 'ready';
    let blockedReason = null;
    const checkedBodyIds = [];
    try {
      const actualBodies = await databaseService.getCelestialBodies({ solarSystemId: SYSTEM_ID });
      const markets = await databaseService.getMarkets({ solarSystemId: SYSTEM_ID });
      if (!currentState) {
        if (actualBodies.length || markets.length) {
          throw new Error('First apply requires an empty Copper Vale pilot system');
        }
      } else {
        assertStateMatchesPlan(currentState, plan);
        const byId = new Map(actualBodies.map((body) => [body.id, body]));
        for (const expected of plan.bodies) {
          const actual = byId.get(expected.id);
          if (actual) {
            assertBodyMatches(actual, expected);
            checkedBodyIds.push(expected.id);
          }
        }
        const expectedMarket = markets.find((market) => market.marketId === plan.station.marketId);
        const unexpectedMarkets = markets.filter((market) => market.marketId !== plan.station.marketId);
        // Completed P6 owns only its original station. Later additive overlays
        // have independent journals and must not invalidate baseline readback.
        if (unexpectedMarkets.length && currentState.status !== 'complete') {
          throw new Error('Unexpected Copper Vale market exists during incomplete P6');
        }
        if (expectedMarket) assertMarketMatches(expectedMarket, plan);
        if (currentState.status === 'complete') {
          await readback(databaseService, plan, currentState);
          readiness = 'verified';
        } else if (['applying', 'interrupted'].includes(currentState.status)) {
          readiness = 'resumable';
        } else {
          throw new Error(`Checkpoint state '${currentState.status}' cannot be resumed`);
        }
      }
    } catch (error) {
      readiness = 'blocked';
      blockedReason = error.message;
    }
    return {
      action,
      systemId: SYSTEM_ID,
      sourceSha256: plan.hashes.sourceSha256,
      hashes: plan.hashes,
      revisions: plan.revisions,
      expectedBodyIds: plan.expectedBodyIds,
      expectedBodyCount: plan.expectedBodyIds.length,
      stationId: plan.station.marketId,
      p3InputSha256: plan.hashes.sourceSha256,
      p4OutputSha256: plan.p4OutputSha256,
      state: currentState?.status || 'absent',
      readiness,
      blockedReason,
      checkedBodyIds: checkedBodyIds.sort(),
      planSha256: plan.planSha256,
      writes: false,
    };
  }

  if (action === 'readback') {
    return { action, ...(await readback(databaseService, plan, currentState)) };
  }

  if (action === 'rollback') {
    assertStateMatchesPlan(currentState, plan);
    if (currentState.status === 'complete' ||
        (await databaseService.getMarkets({ solarSystemId: SYSTEM_ID })).length > 0) {
      return {
        action,
        status: 'refused',
        reason: 'Station/gameplay retirement has no reviewed policy; no records were deleted.',
        deletedBodyIds: [],
      };
    }
    const allBodies = await databaseService.getCelestialBodies({ solarSystemId: SYSTEM_ID });
    const byId = new Map(allBodies.map((body) => [body.id, body]));
    const usedIds = [];
    for (const expected of plan.bodies) {
      const actual = byId.get(expected.id);
      if (actual && !assertBodyMatches(actual, expected).pristine) {
        usedIds.push(expected.id);
      }
    }
    if (usedIds.length) {
      return {
        action,
        status: 'refused',
        reason: 'Gameplay-mutated seed bodies are preserved; no records were deleted.',
        usedBodyIds: usedIds.sort(),
        deletedBodyIds: [],
      };
    }
    const deletedBodyIds = [];
    for (const expected of plan.bodies) {
      if (byId.has(expected.id)) {
        const deleted = await databaseService.deleteCelestialBodyById(expected.id);
        if (!deleted) throw new Error(`Failed to safely roll back seed body ${expected.id}`);
        deletedBodyIds.push(expected.id);
      }
    }
    await persistState(databaseService, { ...currentState, status: 'rolled-back' });
    return { action, status: 'rolled-back', deletedBodyIds: deletedBodyIds.sort() };
  }

  if (action === 'resume') {
    assertStateMatchesPlan(currentState, plan);
    if (!['applying', 'interrupted'].includes(currentState.status)) {
      throw new Error(`Cannot resume Copper Vale lifecycle in state '${currentState.status}'`);
    }
  } else if (currentState) {
    assertStateMatchesPlan(currentState, plan);
    if (currentState.status === 'complete') {
      return {
        action,
        status: 'complete',
        resumed: false,
        bodyCount: plan.expectedBodyIds.length,
        p3InputSha256: plan.hashes.sourceSha256,
        p4OutputSha256: plan.p4OutputSha256,
        ...(await readback(databaseService, plan, currentState)),
      };
    }
    throw new Error('Existing Copper Vale lifecycle checkpoint requires explicit resume');
  } else {
    const bodies = await databaseService.getCelestialBodies({ solarSystemId: SYSTEM_ID });
    const markets = await databaseService.getMarkets({ solarSystemId: SYSTEM_ID });
    if (bodies.length || markets.length) {
      throw new Error('First Copper Vale lifecycle apply requires an empty pilot system');
    }
    currentState = stateForPlan(plan);
    await persistState(databaseService, currentState);
  }

  let state = currentState;
  const existingBodies = new Map(
    (await databaseService.getCelestialBodies({ solarSystemId: SYSTEM_ID }))
      .map((body) => [body.id, body])
  );
  for (const expected of plan.bodies) {
    const existing = existingBodies.get(expected.id);
    if (existing) {
      assertBodyMatches(existing, expected);
    } else {
      await databaseService.addOrUpdateCelestialBody(expected, { preserveGameplay: true });
      if (typeof options.afterBodyWrite === 'function') {
        await options.afterBodyWrite(expected.id);
      }
      const actual = await databaseService.getCelestialBodyById(expected.id);
      assertBodyMatches(actual, expected);
    }
    if (!state.verifiedBodyIds.includes(expected.id)) {
      state = { ...state, verifiedBodyIds: [...state.verifiedBodyIds, expected.id].sort() };
      await persistState(databaseService, state);
    }
  }

  const verified = await getExpectedBodies(databaseService, plan);
  if (!isDeepStrictEqual(
    plan.expectedBodyIds,
    [...verified.byId.keys()].filter((id) => plan.expectedBodies[id]).sort()
  )) {
    throw new Error('Durable body readback does not contain the exact expected body ID set');
  }
  if (!isDeepStrictEqual([...state.verifiedBodyIds].sort(), plan.expectedBodyIds)) {
    throw new Error('Durable body checkpoints do not contain the exact expected body ID set');
  }

  const markets = await databaseService.getMarkets({ solarSystemId: SYSTEM_ID });
  let actualMarket = markets.find((market) => market.marketId === plan.station.marketId);
  if (!actualMarket) {
    if (markets.length) throw new Error('Unexpected Copper Vale market; refusing station upsert');
    const persisted = await databaseService.upsertMarket(plan.market);
    if (!persisted) throw new Error(`Failed to persist station ${plan.station.marketId}`);
    if (typeof options.afterMarketWrite === 'function') {
      await options.afterMarketWrite(plan.station.marketId);
    }
    actualMarket = (await databaseService.getMarkets({ solarSystemId: SYSTEM_ID }))
      .find((market) => market.marketId === plan.station.marketId);
  }
  assertMarketMatches(actualMarket, plan);
  state = { ...state, marketVerified: true };
  await persistState(databaseService, state);

  const verifiedReadback = await readback(databaseService, plan, state);
  if (!isDeepStrictEqual(verifiedReadback.verifiedBodyIds, plan.expectedBodyIds)) {
    throw new Error('Final durable readback did not verify every expected body ID');
  }
  state = { ...state, status: 'complete', verifiedBodyIds: plan.expectedBodyIds, marketVerified: true };
  await persistState(databaseService, state);
  return {
    action,
    status: 'complete',
    resumed: action === 'resume',
    bodyCount: plan.expectedBodyIds.length,
    p3InputSha256: plan.hashes.sourceSha256,
    p4OutputSha256: plan.p4OutputSha256,
    ...await readback(databaseService, plan, state),
  };
}

module.exports = {
  REVISIONS,
  SYSTEM_ID,
  STATE_SCHEMA_VERSION,
  buildCopperValeSeedPlan,
  runCopperValeSeedLifecycle,
  sha256,
  assertMarketMatches,
  persistedMarketFields,
  MUTABLE_MARKET_FIELDS,
};
