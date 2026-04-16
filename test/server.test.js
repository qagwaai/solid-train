'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: createClient } = require('socket.io-client');
const { createServer, resolvePort } = require('../src/server');
const {
  REGISTER_EVENT,
  REGISTER_RESPONSE_EVENT
} = require('../src/model/register');

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

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      resolve(server.address().port);
    });
    server.on('error', reject);
  });
}

function connectClient(port) {
  return createClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
}

function waitForEvent(socket, eventName) {
  return new Promise((resolve) => {
    socket.once(eventName, resolve);
  });
}

async function closeClient(socket) {
  if (!socket || !socket.connected) {
    return;
  }

  await new Promise((resolve) => {
    socket.once('disconnect', resolve);
    socket.disconnect();
  });
}

test('register returns success and playerId for a unique playerName', async () => {
  const { server, io } = createServer({ port: '3001' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const responsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'CaptainPixel',
    email: 'captain@example.com',
    password: 'super-secret'
  });

  const response = await responsePromise;
  assert.equal(response.success, true);
  assert.equal(response.message, 'Registration successful');
  assert.equal(typeof response.playerId, 'string');
  assert.ok(response.playerId.length > 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('register rejects duplicate playerName', async () => {
  const { server, io } = createServer({ port: '3002' });
  const port = await listen(server);

  const firstClient = connectClient(port);
  await waitForEvent(firstClient, 'connect');

  const firstResponsePromise = waitForEvent(firstClient, REGISTER_RESPONSE_EVENT);
  firstClient.emit(REGISTER_EVENT, {
    playerName: 'ShadowRider',
    email: 'first@example.com',
    password: 'secret-1'
  });

  const firstResponse = await firstResponsePromise;
  assert.equal(firstResponse.success, true);

  const secondClient = connectClient(port);
  await waitForEvent(secondClient, 'connect');

  const secondResponsePromise = waitForEvent(secondClient, REGISTER_RESPONSE_EVENT);
  secondClient.emit(REGISTER_EVENT, {
    playerName: 'shadowrider',
    email: 'second@example.com',
    password: 'secret-2'
  });

  const secondResponse = await secondResponsePromise;
  assert.equal(secondResponse.success, false);
  assert.equal(secondResponse.message, 'playerName already exists');
  assert.equal(secondResponse.playerId, undefined);

  await closeClient(firstClient);
  await closeClient(secondClient);
  io.close();
  server.close();
});

test('register rejects payload missing required fields', async () => {
  const { server, io } = createServer({ port: '3003' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const responsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: '   ',
    email: 'mail@example.com',
    password: 'x'
  });

  const response = await responsePromise;
  assert.equal(response.success, false);
  assert.equal(response.message, 'playerName, email, and password are required');
  assert.equal(response.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});
