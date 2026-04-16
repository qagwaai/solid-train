'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, resolvePort } = require('../src/server');

test('resolvePort returns default port when not set', () => {
  assert.equal(resolvePort(undefined), 3000);
});

test('resolvePort throws for invalid port', () => {
  assert.throws(() => resolvePort('70000'), /PORT must be a valid number/);
});

test('createServer returns server and io instances', () => {
  const { port, server, io } = createServer({ port: '4000' });

  assert.equal(port, 4000);
  assert.equal(typeof server.listen, 'function');
  assert.equal(typeof io.close, 'function');

  io.close();
  server.close();
});
