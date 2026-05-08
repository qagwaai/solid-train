'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSeededGateNetwork } = require('../src/model/solar-system-gate-seed');
const { createTestContext } = require('../test-support/message-handler-test-helpers');

test('buildSeededGateNetwork returns expected gate count and canonical traversal values', () => {
  const seededGates = buildSeededGateNetwork();

  assert.equal(seededGates.length, 4);

  const solToAlpha = seededGates.find((gate) => gate.gateId === 'sol-ac-g1');
  assert.ok(solToAlpha);
  assert.equal(solToAlpha.traversalCostAu, 5);
  assert.equal(solToAlpha.traversalTimeHours, 48);

  const alphaToBarnard = seededGates.find((gate) => gate.gateId === 'ac-bs-g1');
  assert.ok(alphaToBarnard);
  assert.equal(alphaToBarnard.traversalCostAu, 7);
  assert.equal(alphaToBarnard.traversalTimeHours, 72);
});

test('MessageHandlerContext loadGateNetworkAsync seeds graph and supports routed query', async () => {
  const context = createTestContext();
  context.databaseService = {
    async getJumpGatesAsync() {
      return buildSeededGateNetwork();
    },
  };

  const graph = await context.loadGateNetworkAsync();
  const totalGates = [...graph.values()].reduce((count, outgoing) => count + outgoing.length, 0);

  assert.equal(totalGates, 4);

  const solOutgoing = graph.get('sol') || [];
  assert.equal(solOutgoing.length, 1);
  assert.equal(solOutgoing[0].gateId, 'sol-ac-g1');
  assert.equal(solOutgoing[0].traversalCostAu, 5);
  assert.equal(solOutgoing[0].traversalTimeHours, 48);

  const route = await context.getHopPathBetweenSystems('sol', 'barnards-star');
  assert.deepEqual(route, { hops: 2, path: ['sol-ac-g1', 'ac-bs-g1'] });
});
