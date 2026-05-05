'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoConnection } = require('../src/db/connection');

test('MongoConnection.connect invokes mongoose.connect and toggles status', async () => {
  const originalConnect = mongoose.connect;
  const connection = new MongoConnection({ mongoUri: 'mongodb://example:27017/test-db' });

  let connectCalls = 0;
  mongoose.connect = async (uri, options) => {
    connectCalls += 1;
    assert.equal(uri, 'mongodb://example:27017/test-db');
    assert.equal(typeof options.connectTimeoutMS, 'number');
  };

  try {
    await connection.connect();
    assert.equal(connection.getConnectionStatus(), true);
    assert.equal(connectCalls, 1);

    await connection.connect();
    assert.equal(connectCalls, 1);
  } finally {
    mongoose.connect = originalConnect;
  }
});

test('MongoConnection.connect logs and rethrows connect failures', async () => {
  const originalConnect = mongoose.connect;
  const connection = new MongoConnection({ mongoUri: 'mongodb://example:27017/test-db' });

  mongoose.connect = async () => {
    throw new Error('connect failed');
  };

  try {
    await assert.rejects(connection.connect(), /connect failed/);
    assert.equal(connection.getConnectionStatus(), false);
  } finally {
    mongoose.connect = originalConnect;
  }
});

test('MongoConnection.disconnect invokes mongoose.disconnect and toggles status', async () => {
  const originalConnect = mongoose.connect;
  const originalDisconnect = mongoose.disconnect;
  const connection = new MongoConnection({ mongoUri: 'mongodb://example:27017/test-db' });

  mongoose.connect = async () => {};
  let disconnectCalls = 0;
  mongoose.disconnect = async () => {
    disconnectCalls += 1;
  };

  try {
    await connection.connect();
    assert.equal(connection.getConnectionStatus(), true);

    await connection.disconnect();
    assert.equal(connection.getConnectionStatus(), false);
    assert.equal(disconnectCalls, 1);

    await connection.disconnect();
    assert.equal(disconnectCalls, 1);
  } finally {
    mongoose.connect = originalConnect;
    mongoose.disconnect = originalDisconnect;
  }
});

test('MongoConnection.disconnect logs and rethrows disconnect failures', async () => {
  const originalConnect = mongoose.connect;
  const originalDisconnect = mongoose.disconnect;
  const connection = new MongoConnection({ mongoUri: 'mongodb://example:27017/test-db' });

  mongoose.connect = async () => {};
  mongoose.disconnect = async () => {
    throw new Error('disconnect failed');
  };

  try {
    await connection.connect();
    await assert.rejects(connection.disconnect(), /disconnect failed/);
    assert.equal(connection.getConnectionStatus(), true);
  } finally {
    mongoose.connect = originalConnect;
    mongoose.disconnect = originalDisconnect;
  }
});
