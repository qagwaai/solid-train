'use strict';

// The URI is received over private parent IPC, not argv, a file, or environment.
const { MongoConnection } = require('../src/db/connection');
const { DatabaseService } = require('../src/db/service');
const { seedCopperValeIsolatedPilot } = require('../src/model/copper-vale-isolated-pilot');
const { createServer } = require('../src/server');
const { runContractSafetyPreflight } = require('./sw08/startup-preflight');

let connection;
let runtime;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    if (runtime) await new Promise((resolve) => runtime.io.close(resolve));
    if (connection) await connection.disconnect();
  } finally {
    process.exit(0);
  }
}

async function start(message) {
  const uri = new URL(message.uri);
  if (uri.protocol !== 'mongodb:' || uri.hostname !== '127.0.0.1' ||
      !uri.port || uri.username || uri.password || uri.pathname !== '/copper-vale-p5') {
    throw new Error('Worker requires an internally generated loopback pilot URI');
  }
  runContractSafetyPreflight();
  connection = new MongoConnection({ mongoUri: message.uri });
  await connection.connect(); // No in-memory fallback.
  const databaseService = new DatabaseService();
  const audit = await seedCopperValeIsolatedPilot(databaseService);
  runtime = createServer({ port: '3000', databaseService, initializeContext: false });
  await runtime.messageHandlerContext.initializeAsync({ seedDefaults: false });
  await new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    // The OS allocates a free separate port; never use the existing server's port.
    runtime.server.listen(0, '127.0.0.1', resolve);
  });
  const port = runtime.server.address().port;
  process.send({ type: 'ready', port, ...audit });
}

if (!process.send) {
  console.error('This worker must be started by the opt-in isolated pilot launcher.');
  process.exitCode = 1;
} else {
  process.once('message', (message) => {
    if (message.type !== 'start') {
      void stop();
      return;
    }
    start(message).catch(async (error) => {
      process.send({ type: 'failed', message: error.message });
      await stop();
    });
    process.on('message', (next) => {
      if (next.type === 'stop') stop();
    });
  });
  process.once('disconnect', stop);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
