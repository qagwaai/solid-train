'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const mongoose = require('mongoose');
const { MongoConnection } = require('../src/db/connection');
const { DatabaseService } = require('../src/db/service');
const { runCopperValeSeedLifecycle, SYSTEM_ID } = require('../src/model/copper-vale-seed-lifecycle');
const { protectedSnapshot } = require('../src/model/copper-vale-protected-snapshot');
const { runContractSafetyPreflight } = require('./sw08/startup-preflight');

function parseArguments(args) {
  const allowed = new Set(['--target', '--action', '--confirm-write']);
  const values = {};
  for (const arg of args) {
    const [key, ...parts] = arg.split('=');
    if (!allowed.has(key) || Object.hasOwn(values, key)) throw new Error(`Invalid or duplicate argument: ${key}`);
    values[key] = parts.join('=');
  }
  const target = values['--target'];
  if (!target) throw new Error('Explicit --target=mongodb://localhost:27017/solid-train is required');
  const uri = new URL(target);
  if (
    uri.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) ||
    !uri.port || uri.username || uri.password || uri.search || uri.hash ||
    !/^\/[a-zA-Z0-9_-]+$/.test(uri.pathname)
  ) throw new Error('Target must be a credential-free explicit local Mongo host, port and database');
  const action = values['--action'] || 'dry-run';
  if (!['dry-run', 'apply', 'resume', 'readback'].includes(action)) throw new Error('Only dry-run, apply, resume and readback are supported');
  const writes = ['apply', 'resume'].includes(action);
  if (writes && values['--confirm-write'] !== SYSTEM_ID) throw new Error(`Writes require --confirm-write=${SYSTEM_ID}`);
  if (!writes && Object.hasOwn(values, '--confirm-write')) throw new Error('Read-only actions must not include --confirm-write');
  return { target, action, writes };
}

async function assertForgeStopped() {
  for (const host of ['127.0.0.1', '::1']) {
    await new Promise((resolve, reject) => {
      const socket = net.connect({ host, port: 3000 });
      socket.once('connect', () => {
        socket.destroy();
        reject(new Error('Stop Forge on port 3000 before persistent seed writes'));
      });
      socket.once('error', (error) => {
        if (['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH'].includes(error.code)) resolve();
        else reject(error);
      });
      socket.setTimeout(2000, () => {
        socket.destroy();
        reject(new Error(`Could not establish whether Forge is stopped on ${host}`));
      });
    });
  }
}

async function runPersistentSeed(args) {
  const options = parseArguments(args);
  runContractSafetyPreflight();
  if (options.writes) await assertForgeStopped();
  const connection = new MongoConnection({ mongoUri: options.target });
  try {
    await connection.connect();
    const db = mongoose.connection.db;
    const service = new DatabaseService();
    const before = await protectedSnapshot(db);
    const preflight = await runCopperValeSeedLifecycle(service, { action: 'dry-run' });
    console.log(`COPPER_VALE_PREFLIGHT ${JSON.stringify({
      target: options.target, database: db.databaseName,
      protectedCollections: before, ...preflight,
    })}`);
    if (options.writes) {
      const expected = options.action === 'apply' ? ['ready', 'verified'] : ['resumable'];
      if (!expected.includes(preflight.readiness)) {
        throw new Error(`Persistent ${options.action} refused: ${preflight.blockedReason || preflight.readiness}`);
      }
      await assertForgeStopped();
    }
    let result;
    try {
      result = await runCopperValeSeedLifecycle(service, { action: options.action });
    } finally {
      const after = await protectedSnapshot(db);
      assert.deepEqual(after, before, 'Protected non-Copper-Vale/player data changed during seed operation');
    }
    console.log(`COPPER_VALE_PERSISTENT_RESULT ${JSON.stringify({
      target: options.target, protectedDataUnchanged: true, ...result,
    })}`);
    return result;
  } finally {
    await connection.disconnect();
  }
}

if (require.main === module) {
  runPersistentSeed(process.argv.slice(2)).catch((error) => {
    console.error(`[copper-vale-persistent] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseArguments, assertForgeStopped, protectedSnapshot, runPersistentSeed };
