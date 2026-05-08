'use strict';

const http = require('node:http');
const assert = require('node:assert/strict');
const { io: createClient } = require('socket.io-client');
const { REGISTER_EVENT, REGISTER_RESPONSE_EVENT } = require('../src/model/register');
const { LOGIN_EVENT, LOGIN_RESPONSE_EVENT } = require('../src/model/login');

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
    reconnection: false,
  });
}

function waitForEvent(socket, eventName) {
  return new Promise((resolve) => {
    socket.once(eventName, resolve);
  });
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            body,
          });
        });
      })
      .on('error', reject);
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
    password,
  });
  const registerResponse = await registerResponsePromise;
  assert.equal(registerResponse.success, true);

  const loginResponsePromise = waitForEvent(client, LOGIN_RESPONSE_EVENT);
  client.emit(LOGIN_EVENT, {
    playerName,
    password,
  });
  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.success, true);
  assert.equal(typeof loginResponse.sessionKey, 'string');
  assert.ok(loginResponse.sessionKey.length > 0);

  return loginResponse;
}

module.exports = {
  listen,
  connectClient,
  waitForEvent,
  httpGetJson,
  closeClient,
  registerAndLogin,
};
