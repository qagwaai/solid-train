'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: createClient } = require('socket.io-client');
const { createServer, resolvePort } = require('../src/server');
const {
  REGISTER_EVENT,
  REGISTER_RESPONSE_EVENT
} = require('../src/model/register');
const {
  LOGIN_EVENT,
  LOGIN_RESPONSE_EVENT,
  LOGIN_FAILURE_REASONS
} = require('../src/model/login');
const {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT
} = require('../src/model/character-list');

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

test('login returns success for registered player with matching password', async () => {
  const { server, io } = createServer({ port: '3004' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'OrbitFox',
    email: 'orbit@example.com',
    password: 'safe-pass'
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'orbitfox',
    password: 'safe-pass'
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, true);
  assert.equal(loginResponse.message, 'Login successful');
  assert.equal(typeof loginResponse.playerId, 'string');
  assert.ok(loginResponse.playerId.length > 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('login rejects playerName that is not registered', async () => {
  const { server, io } = createServer({ port: '3005' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'NoSuchPilot',
    password: 'whatever'
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, false);
  assert.equal(loginResponse.message, 'Player is not registered');
  assert.equal(
    loginResponse.reason,
    LOGIN_FAILURE_REASONS.PLAYER_NOT_REGISTERED
  );
  assert.equal(loginResponse.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});

test('login rejects password mismatch for registered player', async () => {
  const { server, io } = createServer({ port: '3006' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'NovaWing',
    email: 'nova@example.com',
    password: 'correct-password'
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'novawing',
    password: 'wrong-password'
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, false);
  assert.equal(loginResponse.message, 'Password does not match');
  assert.equal(loginResponse.reason, LOGIN_FAILURE_REASONS.PASSWORD_MISMATCH);
  assert.equal(loginResponse.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});

test('login rejects payload missing required fields with UNKNOWN reason', async () => {
  const { server, io } = createServer({ port: '3007' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: '   ',
    password: ''
  });

  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, false);
  assert.equal(loginResponse.message, 'playerName and password are required');
  assert.equal(loginResponse.reason, LOGIN_FAILURE_REASONS.UNKNOWN);
  assert.equal(loginResponse.playerId, undefined);

  await closeClient(client);
  io.close();
  server.close();
});

test('character list returns per-player list for registered player', async () => {
  const { server, io } = createServer({ port: '3008' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'CharacterPilot',
    email: 'pilot@example.com',
    password: 'pilot-pass'
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'characterpilot'
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.message, 'Character list retrieved successfully');
  assert.equal(listResponse.playerName, 'CharacterPilot');
  assert.deepEqual(listResponse.characters, []);

  await closeClient(client);
  io.close();
  server.close();
});

test('character list rejects playerName that is not registered', async () => {
  const { server, io } = createServer({ port: '3009' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'UnknownPilot'
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, false);
  assert.equal(listResponse.message, 'Player is not registered');
  assert.equal(listResponse.playerName, 'UnknownPilot');
  assert.deepEqual(listResponse.characters, []);

  await closeClient(client);
  io.close();
  server.close();
});
