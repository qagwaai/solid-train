'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Market, GameStateDocument } = require('../db/models');
const { MessageHandlerContext } = require('../handlers/message-handler-context');
const { createSeedMarketPayload } = require('../handlers/context/context-bootstrap-service');
const { previewCopperValeMarketDensity } = require('./copper-vale-market-density-preview');
const { protectedSnapshot } = require('./copper-vale-protected-snapshot');
const {
  runCopperValeSeedLifecycle, buildCopperValeSeedPlan, sha256, SYSTEM_ID,
  assertMarketMatches, persistedMarketFields,
  MUTABLE_MARKET_FIELDS,
} = require('./copper-vale-seed-lifecycle');

const REVISION = 'copper-vale-market-density-v1';
const JOURNAL_KEY = `${REVISION}:${SYSTEM_ID}`;
const APPROVED_PREVIEW_SHA256 = '7dbbb79542b549c19e389452def883c4ec82ee547525498d049c88d4502c5ba4';

function buildCopperValeDensityPlan() {
  const preview = previewCopperValeMarketDensity();
  if (preview.outputSha256 !== APPROVED_PREVIEW_SHA256 ||
      preview.totalMarkets !== 6 || preview.proposedAdditions.length !== 5 ||
      preview.proposedAdditions.some((entry) => entry.status !== 'owner-approved')) {
    throw new Error('Density source/approved preview changed; stop for owner review');
  }
  const context = new MessageHandlerContext({ databaseService: {}, log: () => {} });
  const markets = preview.proposedAdditions.map((station) => {
    const document = new Market(createSeedMarketPayload(context, station, preview.epoch)).toObject();
    /** @type {any} */
    const normalized = { ...persistedMarketFields(document), trajectory: document.trajectory };
    delete normalized._id;
    delete normalized.__v;
    return normalized;
  });
  const plan = {
    revision: REVISION, systemId: SYSTEM_ID, previewSha256: preview.outputSha256,
    baselinePlanSha256: buildCopperValeSeedPlan().planSha256,
    addedMarketIds: markets.map((market) => market.marketId).sort(),
    markets, supply: preview.supply,
  };
  return { ...plan, planSha256: sha256(plan) };
}

async function getJournal() {
  return (await GameStateDocument.findOne({ key: JOURNAL_KEY }).lean())?.value || null;
}

function assertJournal(state, plan) {
  assert.ok(state, 'Missing density checkpoint; stop for review, do not adopt existing markets');
  assert.equal(state.planSha256, plan.planSha256, 'Density source/plan changed; stop for review');
  assert.equal(state.revision, REVISION, 'Incorrect density journal revision');
  assert.deepEqual(state.addedMarketIds, plan.addedMarketIds, 'Incorrect density journal scope');
  assert.deepEqual(Object.keys(state.ownedDocumentIds || {}).sort(), plan.addedMarketIds, 'Missing journal ownership');
  assert.equal(new Set(Object.values(state.ownedDocumentIds)).size, 5, 'Duplicate journal ownership');
  assert.ok(Object.values(state.ownedDocumentIds).every((id) => /^[a-f0-9]{24}$/.test(id)), 'Invalid journal ownership');
  assert.ok(['applying', 'complete'].includes(state.status), 'Invalid density journal status');
  assert.ok(Number.isSafeInteger(state.sequence) && state.sequence >= 0, 'Invalid journal sequence');
  assert.ok(Array.isArray(state.verifiedMarketIds), 'Invalid market checkpoints');
  assert.equal(new Set(state.verifiedMarketIds).size, state.verifiedMarketIds.length, 'Duplicate market checkpoints');
  assert.ok(state.verifiedMarketIds.every((id) => plan.addedMarketIds.includes(id)), 'Unexpected market checkpoint');
  if (state.status === 'complete') {
    assert.deepEqual([...state.verifiedMarketIds].sort(), plan.addedMarketIds, 'Incomplete durable market checkpoints');
  }
}

function assertOwnedMarket(actual, expected, state) {
  assert.equal(String(actual._id), state.ownedDocumentIds[expected.marketId],
    `Unowned collision for ${expected.marketId}; stop for review`);
  assertMarketMatches(actual, {
    station: expected,
    expectedMarketFields: Object.fromEntries(
      ['marketId', 'solarSystemId', 'marketName', 'siteType', 'siteName',
        'stationPlacement', 'trajectory', 'spatial'].map((field) => [field, expected[field]])),
    expectedMarketSeedFields: expected,
  });
  for (const [field, value] of Object.entries(expected)) {
    if (!MUTABLE_MARKET_FIELDS.includes(field)) {
      assert.deepEqual(actual[field], value, `Incorrect immutable density field ${expected.marketId}.${field}`);
    }
  }
}

async function inspect(databaseService, plan, state, snapshot) {
  const baseline = await runCopperValeSeedLifecycle(databaseService, { action: 'readback' });
  assert.equal(baseline.status, 'complete', 'Density requires completed durable P6 baseline');
  assert.equal(baseline.planSha256, plan.baselinePlanSha256, 'P6 baseline source changed');
  if (state) {
    assertJournal(state, plan);
    if (state.status === 'applying') {
      assert.deepEqual(snapshot, state.protectedBaseline, 'Protected data changed since interrupted density apply; stop for review');
    }
  }
  const actual = await Market.find({ marketId: { $in: plan.addedMarketIds } }).lean();
  if (!state && actual.length) {
    throw new Error('Missing density checkpoint with existing candidates; stop for review, no adoption');
  }
  const byId = new Map();
  for (const market of actual) {
    assert.ok(!byId.has(market.marketId), `Duplicate market ID collision: ${market.marketId}`);
    const expected = plan.markets.find((entry) => entry.marketId === market.marketId);
    assertOwnedMarket(market, expected, state);
    byId.set(market.marketId, market);
  }
  if (state) {
    for (const id of state.verifiedMarketIds) {
      assert.ok(byId.has(id), `Missing checkpointed market ${id}; stop for review`);
    }
    if (state.status === 'complete') assert.equal(byId.size, 5, 'Missing completed density markets');
  }
  return { baseline, byId };
}

async function checkpoint(state, changes) {
  const next = { ...state, ...changes, sequence: state.sequence + 1 };
  const result = await GameStateDocument.updateOne(
    { key: JOURNAL_KEY, 'value.sequence': state.sequence, 'value.planSha256': state.planSha256 },
    { $set: { value: next, updatedAt: new Date() } });
  assert.equal(result.modifiedCount, 1, 'Concurrent/stale density checkpoint; stop and explicitly resume');
  return next;
}

async function runCopperValeDensityLifecycle(databaseService, options = {}) {
  const action = options.action || 'dry-run';
  assert.ok(['dry-run', 'apply', 'resume', 'readback'].includes(action), 'Unsupported density action');
  const approved = buildCopperValeDensityPlan();
  const plan = options.plan || approved;
  assert.deepEqual(plan, approved, 'Density source/plan changed; stop for owner review');
  const snapshotOptions = { addedMarketIds: plan.addedMarketIds, journalKey: JOURNAL_KEY };
  const before = await protectedSnapshot(mongoose.connection.db, snapshotOptions);
  let state = await getJournal();
  const report = (extra) => ({
    action, revision: REVISION, journalKey: JOURNAL_KEY, planSha256: plan.planSha256,
    previewSha256: plan.previewSha256, addedMarketIds: plan.addedMarketIds,
    approvedMarketCount: 6, addedMarketCount: 5, bodyCount: 57,
    initialSupply: plan.supply, protectedCollections: before, ...extra,
  });
  try {
    let checked;
    try {
      checked = await inspect(databaseService, plan, state, before);
    } catch (error) {
      if (action === 'dry-run') return report({ writes: false, readiness: 'blocked', blockedReason: error.message });
      throw error;
    }
    if (action === 'dry-run') {
      return report({ writes: false, readiness: !state ? 'ready' : state.status === 'complete' ? 'verified' : 'resumable' });
    }
    if (action === 'readback' || state?.status === 'complete') {
      assertJournal(state, plan);
      assert.equal(state.status, 'complete', 'Density readback requires complete durable checkpoint');
      return report({ writes: false, status: 'complete', verifiedMarketIds: [...checked.byId.keys()].sort() });
    }
    if (action === 'resume') {
      assertJournal(state, plan);
      assert.equal(state.status, 'applying', 'Explicit resume requires interrupted/applying journal');
    } else {
      assert.ok(!state, 'Existing density checkpoint requires explicit resume');
      // Allocate ownership before insertion: a matching unrelated document cannot
      // be adopted even in the write-before-checkpoint interruption window.
      state = {
        revision: REVISION, planSha256: plan.planSha256, addedMarketIds: plan.addedMarketIds,
        ownedDocumentIds: Object.fromEntries(plan.addedMarketIds.map((id) => [id, String(new mongoose.Types.ObjectId())])),
        status: 'applying', sequence: 0, verifiedMarketIds: [], protectedBaseline: before,
      };
      await GameStateDocument.init();
      await Market.init();
      await GameStateDocument.create({ key: JOURNAL_KEY, value: state });
    }
    for (const expected of plan.markets) {
      const existing = await Market.find({ marketId: expected.marketId }).lean();
      assert.ok(existing.length <= 1, `Duplicate market ID collision: ${expected.marketId}`);
      if (existing.length) {
        assertOwnedMarket(existing[0], expected, state);
      } else {
        assert.ok(!state.verifiedMarketIds.includes(expected.marketId), 'Missing checkpointed market; stop for review');
        // Insert only; never upsert/reset an existing market.
        await Market.create({ ...expected, _id: state.ownedDocumentIds[expected.marketId] });
        if (typeof options.afterMarketWrite === 'function') await options.afterMarketWrite(expected.marketId);
        const durable = await Market.findOne({ _id: state.ownedDocumentIds[expected.marketId] }).lean();
        assertOwnedMarket(durable, expected, state);
      }
      if (!state.verifiedMarketIds.includes(expected.marketId)) {
        state = await checkpoint(state, { verifiedMarketIds: [...state.verifiedMarketIds, expected.marketId].sort() });
      }
    }
    const final = await inspect(databaseService, plan, state,
      await protectedSnapshot(mongoose.connection.db, snapshotOptions));
    assert.deepEqual([...final.byId.keys()].sort(), plan.addedMarketIds, 'Final exact five durable readback failed');
    state = await checkpoint(state, { status: 'complete' });
    // Completion is itself read back from Mongo, not the local state variable.
    const durableState = await getJournal();
    await inspect(databaseService, plan, durableState, before);
    assert.equal(durableState.status, 'complete', 'Completion checkpoint was not durable');
    return report({ status: 'complete', writes: true, verifiedMarketIds: durableState.verifiedMarketIds });
  } finally {
    assert.deepEqual(await protectedSnapshot(mongoose.connection.db, snapshotOptions), before,
      'Density operation changed protected bodies/original station/P6/gameplay data; stop for review');
  }
}

module.exports = { REVISION, JOURNAL_KEY, APPROVED_PREVIEW_SHA256, buildCopperValeDensityPlan, runCopperValeDensityLifecycle };
