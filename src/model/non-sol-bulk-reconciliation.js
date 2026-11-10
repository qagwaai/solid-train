'use strict';

const assert = require('node:assert/strict');
const { sha256, assertBodyMatches } = require('./copper-vale-catalog-reconciliation');
const { buildSeededCelestialBodiesForSolarSystem } = require('./solar-system-celestial-seed');

/** @param {any} state @param {any[]} persisted */
function reconcileBulkSeed(state, persisted) {
  assert.ok(state && state.status === 'complete', 'Bulk seed is incomplete; resume deployment before system-get');
  const { checkpointSha256, ...payload } = state;
  assert.equal(sha256(payload), checkpointSha256, 'Bulk checkpoint hash mismatch');
  assert.equal(state.baseSha256, sha256(buildSeededCelestialBodiesForSolarSystem(state.systemId, state.epoch)), 'Bulk catalog source drift');
  const byId = new Map(persisted.map((b) => [b.id, b]));
  for (const expected of state.bodies) assertBodyMatches(byId.get(expected.id), expected);
  assert.equal(state.bodiesSha256, sha256(state.bodies), 'Bulk expected bodies hash mismatch');
}

module.exports = { reconcileBulkSeed };
