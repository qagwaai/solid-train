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
const {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT
} = require('../src/model/character-add');
const {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT
} = require('../src/model/character-delete');
const {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT
} = require('../src/model/character-edit');
const {
  DRONE_LIST_REQUEST_EVENT,
  DRONE_LIST_RESPONSE_EVENT
} = require('../src/model/drone-list');
const {
  GAME_JOIN_REQUEST_EVENT,
  GAME_JOIN_RESPONSE_EVENT
} = require('../src/model/game-join');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');

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

async function registerAndLogin(client, playerName, email, password) {
  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName,
    email,
    password
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName,
    password
  });
  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, true);
  assert.equal(typeof loginResponse.sessionKey, 'string');
  assert.ok(loginResponse.sessionKey.length > 0);

  return loginResponse;
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
  assert.equal(typeof loginResponse.sessionKey, 'string');
  assert.ok(loginResponse.sessionKey.length > 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('login generates a new session key on each successful login', async () => {
  const { server, io } = createServer({ port: '3015' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const registerResponsePromise = waitForEvent(client, REGISTER_RESPONSE_EVENT);
  client.emit(REGISTER_EVENT, {
    playerName: 'SessionPilot',
    email: 'session@example.com',
    password: 'session-pass'
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const firstLoginPromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'SessionPilot',
    password: 'session-pass'
  });
  const firstLogin = await firstLoginPromise;
  assert.equal(firstLogin.success, true);

  const secondLoginPromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName: 'SessionPilot',
    password: 'session-pass'
  });
  const secondLogin = await secondLoginPromise;
  assert.equal(secondLogin.success, true);
  assert.notEqual(firstLogin.sessionKey, secondLogin.sessionKey);

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

  const loginResponse = await registerAndLogin(
    client,
    'CharacterPilot',
    'pilot@example.com',
    'pilot-pass'
  );

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'characterpilot',
    sessionKey: loginResponse.sessionKey
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

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'UnknownPilot',
    sessionKey: 'invalid-session-key'
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character add adds character and is returned by character list', async () => {
  const { server, io } = createServer({ port: '3010' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'BuilderPilot',
    'builder@example.com',
    'builder-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'builderpilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne'
  });

  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);
  assert.equal(addResponse.message, 'Character added successfully');
  assert.equal(addResponse.playerName, 'BuilderPilot');
  assert.equal(addResponse.characterName, 'RangerOne');
  assert.equal(typeof addResponse.characterId, 'string');
  assert.ok(addResponse.characterId.length > 0);

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'BuilderPilot',
    sessionKey: loginResponse.sessionKey
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.playerName, 'BuilderPilot');
  assert.equal(listResponse.characters.length, 1);
  assert.equal(listResponse.characters[0].characterName, 'RangerOne');
  assert.equal(listResponse.characters[0].id, addResponse.characterId);
  assert.equal(typeof listResponse.characters[0].createdAt, 'string');
  assert.equal(Array.isArray(listResponse.characters[0].drones), true);
  assert.equal(listResponse.characters[0].drones.length >= 1, true);
  assert.equal(typeof listResponse.characters[0].drones[0].id, 'string');
  assert.equal(typeof listResponse.characters[0].drones[0].name, 'string');

  await closeClient(client);
  io.close();
  server.close();
});

test('drone list returns drones for a character', async () => {
  const { server, io } = createServer({ port: '3023' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'DronePilot',
    'drone@example.com',
    'drone-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'DronePilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne'
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const droneListResponsePromise = waitForEvent(client, DRONE_LIST_RESPONSE_EVENT);
  client.emit(DRONE_LIST_REQUEST_EVENT, {
    playerName: 'dronepilot',
    characterId: addResponse.characterId,
    sessionKey: loginResponse.sessionKey
  });
  const droneListResponse = await droneListResponsePromise;

  assert.equal(droneListResponse.success, true);
  assert.equal(droneListResponse.message, 'Drone list retrieved successfully');
  assert.equal(droneListResponse.playerName, 'DronePilot');
  assert.equal(droneListResponse.characterId, addResponse.characterId);
  assert.equal(Array.isArray(droneListResponse.drones), true);
  assert.equal(droneListResponse.drones.length >= 1, true);
  assert.equal(typeof droneListResponse.drones[0].id, 'string');
  assert.equal(typeof droneListResponse.drones[0].name, 'string');

  await closeClient(client);
  io.close();
  server.close();
});

test('drone list handles character missing from player list', async () => {
  const { server, io } = createServer({ port: '3024' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgeDronePilot',
    'edge-drone@example.com',
    'edge-drone-pass'
  );

  const droneListResponsePromise = waitForEvent(client, DRONE_LIST_RESPONSE_EVENT);
  client.emit(DRONE_LIST_REQUEST_EVENT, {
    playerName: 'EdgeDronePilot',
    characterId: 'missing-character-id',
    sessionKey: loginResponse.sessionKey
  });
  const droneListResponse = await droneListResponsePromise;

  assert.equal(droneListResponse.success, false);
  assert.equal(droneListResponse.message, 'Character is not in player list');
  assert.equal(droneListResponse.playerName, 'EdgeDronePilot');
  assert.equal(droneListResponse.characterId, 'missing-character-id');
  assert.deepEqual(droneListResponse.drones, []);

  await closeClient(client);
  io.close();
  server.close();
});

test('drone list emits invalid session for wrong session key', async () => {
  const { server, io } = createServer({ port: '3025' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(
    client,
    'SessionDronePilot',
    'session-drone@example.com',
    'session-drone-pass'
  );

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(DRONE_LIST_REQUEST_EVENT, {
    playerName: 'SessionDronePilot',
    characterId: 'any-id',
    sessionKey: 'wrong-session-key'
  });
  const invalidSession = await invalidSessionPromise;

  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character add rejects request for unregistered player', async () => {
  const { server, io } = createServer({ port: '3011' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'MissingPilot',
    sessionKey: 'invalid-session-key',
    characterName: 'GhostUnit'
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character delete removes character from player list', async () => {
  const { server, io } = createServer({ port: '3012' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'DeletePilot',
    'delete@example.com',
    'delete-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'DeletePilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'TempCharacter'
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const deleteResponsePromise = waitForEvent(
    client,
    CHARACTER_DELETE_RESPONSE_EVENT
  );
  client.emit(CHARACTER_DELETE_REQUEST_EVENT, {
    playerName: 'deletepilot',
    sessionKey: loginResponse.sessionKey,
    characterId: addResponse.characterId
  });

  const deleteResponse = await deleteResponsePromise;
  assert.equal(deleteResponse.success, true);
  assert.equal(deleteResponse.message, 'Character deleted successfully');
  assert.equal(deleteResponse.playerName, 'DeletePilot');
  assert.equal(deleteResponse.characterId, addResponse.characterId);

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'DeletePilot',
    sessionKey: loginResponse.sessionKey
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('character delete handles character not found for player', async () => {
  const { server, io } = createServer({ port: '3013' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgePilot',
    'edge@example.com',
    'edge-pass'
  );

  const deleteResponsePromise = waitForEvent(
    client,
    CHARACTER_DELETE_RESPONSE_EVENT
  );
  client.emit(CHARACTER_DELETE_REQUEST_EVENT, {
    playerName: 'EdgePilot',
    sessionKey: loginResponse.sessionKey,
    characterId: 'missing-character-id'
  });

  const deleteResponse = await deleteResponsePromise;
  assert.equal(deleteResponse.success, false);
  assert.equal(deleteResponse.message, 'Character is not in player list');
  assert.equal(deleteResponse.playerName, 'EdgePilot');
  assert.equal(deleteResponse.characterId, 'missing-character-id');

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'EdgePilot',
    sessionKey: loginResponse.sessionKey
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('character delete rejects request for unregistered player', async () => {
  const { server, io } = createServer({ port: '3014' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const invalidSessionPromise = waitForEvent(
    client,
    INVALID_SESSION_EVENT
  );
  client.emit(CHARACTER_DELETE_REQUEST_EVENT, {
    playerName: 'UnknownDeletePilot',
    sessionKey: 'invalid-session-key',
    characterId: 'any-id'
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character list emits invalid session event when session key does not match', async () => {
  const { server, io } = createServer({ port: '3016' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(client, 'SessionMismatchPilot', 'mismatch@example.com', 'mismatch-pass');

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'SessionMismatchPilot',
    sessionKey: 'wrong-session-key'
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('character edit updates character name in player list', async () => {
  const { server, io } = createServer({ port: '3017' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EditPilot',
    'edit@example.com',
    'edit-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'EditPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'OldName'
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const editResponsePromise = waitForEvent(client, CHARACTER_EDIT_RESPONSE_EVENT);
  client.emit(CHARACTER_EDIT_REQUEST_EVENT, {
    playerName: 'editpilot',
    sessionKey: loginResponse.sessionKey,
    characterId: addResponse.characterId,
    characterName: 'NewName'
  });

  const editResponse = await editResponsePromise;
  assert.equal(editResponse.success, true);
  assert.equal(editResponse.message, 'Character edited successfully');
  assert.equal(editResponse.playerName, 'EditPilot');
  assert.equal(editResponse.characterId, addResponse.characterId);
  assert.equal(editResponse.characterName, 'NewName');

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'EditPilot',
    sessionKey: loginResponse.sessionKey
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 1);
  assert.equal(listResponse.characters[0].id, addResponse.characterId);
  assert.equal(listResponse.characters[0].characterName, 'NewName');

  await closeClient(client);
  io.close();
  server.close();
});

test('character edit handles character not found for player', async () => {
  const { server, io } = createServer({ port: '3018' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgeEditPilot',
    'edge-edit@example.com',
    'edge-edit-pass'
  );

  const editResponsePromise = waitForEvent(client, CHARACTER_EDIT_RESPONSE_EVENT);
  client.emit(CHARACTER_EDIT_REQUEST_EVENT, {
    playerName: 'EdgeEditPilot',
    sessionKey: loginResponse.sessionKey,
    characterId: 'missing-character-id',
    characterName: 'GhostName'
  });

  const editResponse = await editResponsePromise;
  assert.equal(editResponse.success, false);
  assert.equal(editResponse.message, 'Character is not in player list');
  assert.equal(editResponse.playerName, 'EdgeEditPilot');
  assert.equal(editResponse.characterId, 'missing-character-id');

  const listResponsePromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'EdgeEditPilot',
    sessionKey: loginResponse.sessionKey
  });

  const listResponse = await listResponsePromise;
  assert.equal(listResponse.success, true);
  assert.equal(listResponse.characters.length, 0);

  await closeClient(client);
  io.close();
  server.close();
});

test('character edit emits invalid session for wrong session key', async () => {
  const { server, io } = createServer({ port: '3019' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(client, 'SessionEditPilot', 'session-edit@example.com', 'session-edit-pass');

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(CHARACTER_EDIT_REQUEST_EVENT, {
    playerName: 'SessionEditPilot',
    sessionKey: 'wrong-session-key',
    characterId: 'any-id',
    characterName: 'NewName'
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});

test('game join marks a character as joined in the player character list', async () => {
  const { server, io } = createServer({ port: '3020' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'JoinPilot',
    'join@example.com',
    'join-pass'
  );

  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName: 'JoinPilot',
    sessionKey: loginResponse.sessionKey,
    characterName: 'RangerOne'
  });
  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);

  const gameJoinResponsePromise = waitForEvent(client, GAME_JOIN_RESPONSE_EVENT);
  client.emit(GAME_JOIN_REQUEST_EVENT, {
    playerName: 'joinpilot',
    sessionKey: loginResponse.sessionKey,
    characterId: addResponse.characterId
  });
  const gameJoinResponse = await gameJoinResponsePromise;
  assert.equal(gameJoinResponse.success, true);
  assert.equal(gameJoinResponse.message, 'Character joined game successfully');
  assert.equal(gameJoinResponse.playerName, 'JoinPilot');
  assert.equal(gameJoinResponse.characterId, addResponse.characterId);

  const firstListPromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'JoinPilot',
    sessionKey: loginResponse.sessionKey
  });
  const firstList = await firstListPromise;
  assert.equal(firstList.success, true);
  assert.equal(firstList.characters.length, 1);
  assert.equal(firstList.characters[0].inGame, true);
  assert.equal(typeof firstList.characters[0].gameJoinedAt, 'string');
  assert.equal(typeof firstList.characters[0].gameLastMessageReceivedAt, 'string');

  const secondListPromise = waitForEvent(client, CHARACTER_LIST_RESPONSE_EVENT);
  client.emit(CHARACTER_LIST_REQUEST_EVENT, {
    playerName: 'JoinPilot',
    sessionKey: loginResponse.sessionKey
  });
  const secondList = await secondListPromise;
  assert.equal(secondList.success, true);
  assert.equal(secondList.characters.length, 1);
  assert.ok(
    Date.parse(secondList.characters[0].gameLastMessageReceivedAt) >=
      Date.parse(firstList.characters[0].gameLastMessageReceivedAt)
  );

  await closeClient(client);
  io.close();
  server.close();
});

test('game join handles character missing from player list', async () => {
  const { server, io } = createServer({ port: '3021' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  const loginResponse = await registerAndLogin(
    client,
    'EdgeJoinPilot',
    'edge-join@example.com',
    'edge-join-pass'
  );

  const gameJoinResponsePromise = waitForEvent(client, GAME_JOIN_RESPONSE_EVENT);
  client.emit(GAME_JOIN_REQUEST_EVENT, {
    playerName: 'EdgeJoinPilot',
    sessionKey: loginResponse.sessionKey,
    characterId: 'missing-character-id'
  });

  const gameJoinResponse = await gameJoinResponsePromise;
  assert.equal(gameJoinResponse.success, false);
  assert.equal(gameJoinResponse.message, 'Character is not in player list');
  assert.equal(gameJoinResponse.playerName, 'EdgeJoinPilot');
  assert.equal(gameJoinResponse.characterId, 'missing-character-id');

  await closeClient(client);
  io.close();
  server.close();
});

test('game join emits invalid session for wrong session key', async () => {
  const { server, io } = createServer({ port: '3022' });
  const port = await listen(server);

  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  await registerAndLogin(
    client,
    'SessionJoinPilot',
    'session-join@example.com',
    'session-join-pass'
  );

  const invalidSessionPromise = waitForEvent(client, INVALID_SESSION_EVENT);
  client.emit(GAME_JOIN_REQUEST_EVENT, {
    playerName: 'SessionJoinPilot',
    sessionKey: 'wrong-session-key',
    characterId: 'any-id'
  });

  const invalidSession = await invalidSessionPromise;
  assert.equal(invalidSession.message, INVALID_SESSION_MESSAGE);

  await closeClient(client);
  io.close();
  server.close();
});
