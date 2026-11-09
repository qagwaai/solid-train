'use strict';

const assert = require('node:assert/strict');
const policy = require('../../data/non-sol-market-density-policy-v2.json');
const evidence = require('../../data/non-sol-market-density-baseline-v2.json');
const { allocations, buildDensityPlan } = require('./non-sol-market-density-plan');
const { sha256 } = require('../../src/model/copper-vale-catalog-reconciliation');

function allocationsV2(ids) {
  const result = allocations(ids);
  for (const [id, override] of Object.entries(policy.overrides)) {
    if (result.has(id)) result.set(id, { profile: override.profile, target: override.target });
  }
  return result;
}

function buildDensityPlanV2(base, allocation) {
  const existing = evidence.markets.filter((m) => m.solarSystemId === base.systemId);
  const override = policy.overrides[base.systemId];
  if (override) {
    assert.deepEqual(allocation, { profile: override.profile, target: override.target }, 'Explicit v2 override required');
    assert.deepEqual([...existing.map((m) => m.marketId), base.market.marketId].sort(),
      [...override.existingMarketIds].sort(), 'Exact v2 baseline IDs required');
  }
  return buildDensityPlan(base, allocation, { version: policy.version, existing,
    legacyGeometryFindings: evidence.legacyGeometryFindings.filter((f) =>
      existing.some((m) => m.marketId === f.marketId)),
    baselineEvidenceSha256: sha256(evidence) });
}

module.exports = { policy, evidence, allocationsV2, buildDensityPlanV2 };
