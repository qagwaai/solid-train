'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTestContext
} = require('../test-support/message-handler-test-helpers');

test('createTestContext emits default seed IDs, then monotonic generated IDs', () => {
  const context = createTestContext();

  assert.equal(context.createId(), 'player-1');
  assert.equal(context.createId(), 'session-1');
  assert.equal(context.createId(), 'session-2');
  assert.equal(context.createId(), 'character-1');
  assert.equal(context.createId(), 'generated-1');
  assert.equal(context.createId(), 'generated-2');
  assert.equal(context.createId(), 'generated-3');
});

test('createTestContext accepts custom seedIds and still falls back monotonically', () => {
  const context = createTestContext({
    seedIds: ['custom-a', ' custom-b ', '', '   ', null]
  });

  assert.equal(context.createId(), 'custom-a');
  assert.equal(context.createId(), 'custom-b');
  assert.equal(context.createId(), 'generated-1');
  assert.equal(context.createId(), 'generated-2');
});

test('createTestContext counters are isolated per context instance', () => {
  const contextA = createTestContext({ seedIds: [] });
  const contextB = createTestContext({ seedIds: [] });

  assert.equal(contextA.createId(), 'generated-1');
  assert.equal(contextA.createId(), 'generated-2');
  assert.equal(contextB.createId(), 'generated-1');
  assert.equal(contextB.createId(), 'generated-2');
});
