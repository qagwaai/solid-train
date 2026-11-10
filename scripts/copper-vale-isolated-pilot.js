'use strict';

const { fork } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { MongoMemoryServer } = require('mongodb-memory-server');

function requireOptIn(args) {
  if (args.length !== 1 || args[0] !== '--isolated') {
    throw new Error('Explicit opt-in required: npm run pilot:copper-vale -- --isolated (no URI/port overrides)');
  }
}

// Keep only OS necessities. In particular, no DB, NODE_OPTIONS, dotenv, port,
// host, or MongoMemoryServer environment overrides reach the backend child.
function childEnvironment() {
  const allowed = /^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i;
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.test(key)));
}

async function launchIsolatedPilot(args) {
  requireOptIn(args);
  let mongo;
  let child;
  let stopping;
  let workerDirectory;
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        if (child.connected) child.send({ type: 'stop' });
        else child.kill('SIGTERM');
        await exited;
        clearTimeout(timer);
      }
      if (mongo) await mongo.stop();
      if (workerDirectory) await fs.rmdir(workerDirectory);
    })();
    return stopping;
  };
  const onSignal = () => { void stop(); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    // No URI is accepted from callers. MongoMemoryServer owns the local process.
    mongo = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1', port: 0, dbName: 'copper-vale-p6' },
    });
    if (stopping) throw new Error('Pilot stopped during Mongo startup');
    workerDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'copper-vale-p6-worker-'));
    child = fork(path.join(__dirname, 'copper-vale-isolated-worker.js'), [], {
      cwd: workerDirectory,
      env: childEnvironment(),
      execArgv: [],
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Pilot startup timed out')), 120000);
      child.once('error', reject);
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('Pilot backend exited before readiness'));
        void stop();
      });
      child.on('message', (message) => {
        if (message.type === 'failed') {
          clearTimeout(timer);
          reject(new Error(message.message));
        } else if (message.type === 'ready') {
          clearTimeout(timer);
          resolve(message);
        }
      });
      child.send({ type: 'start', uri: mongo.getUri('copper-vale-p6') });
    });
    const baseUrl = `http://127.0.0.1:${ready.port}`;
    const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(10000) });
    if (!health.ok || (await health.json()).status !== 'ok') throw new Error('Pilot health check failed');
    // Exercise the existing session transport without creating a seeded account.
    const transport = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!transport.ok || !(await transport.text()).startsWith('0{')) throw new Error('Socket.IO readiness failed');
    let lifecycleRequestId = 0;
    const runSeedLifecycle = (action) => {
      if (!['dry-run', 'apply', 'resume', 'readback', 'rollback'].includes(action)) {
        return Promise.reject(new Error(`Unsupported Copper Vale lifecycle action: ${action}`));
      }
      const requestId = `copper-vale-p6-${++lifecycleRequestId}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          child.removeListener('message', onMessage);
          reject(new Error(`Copper Vale lifecycle '${action}' timed out`));
        }, 30000);
        const onMessage = (message) => {
          if (message.type !== 'seed-lifecycle-result' || message.requestId !== requestId) return;
          clearTimeout(timer);
          child.removeListener('message', onMessage);
          if (message.error) reject(new Error(message.error));
          else resolve(message.result);
        };
        child.on('message', onMessage);
        child.send({ type: 'seed-lifecycle', action, requestId });
      });
    };
    return {
      ...ready,
      baseUrl,
      backendPid: child.pid,
      mongoPid: mongo.instanceInfo.instance.mongodProcess.pid,
      runSeedLifecycle,
      stop: async () => {
        await stop();
        process.removeListener('SIGINT', onSignal);
        process.removeListener('SIGTERM', onSignal);
      },
    };
  } catch (error) {
    await stop();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    throw error;
  }
}

if (require.main === module) {
  launchIsolatedPilot(process.argv.slice(2)).then((pilot) => {
    console.log(`COPPER_VALE_P6_READY ${JSON.stringify({
      baseUrl: pilot.baseUrl,
      health: `${pilot.baseUrl}/health`,
      contract: `${pilot.baseUrl}/openapi.yaml`,
      socketPath: '/socket.io',
      systemId: pilot.systemId,
      bodyCount: pilot.bodyCount,
      stationId: pilot.stationId,
      p3InputSha256: pilot.p3InputSha256,
      p4OutputSha256: pilot.p4OutputSha256,
    })}`);
    console.log('Use normal UI registration, then login. No preseeded account or credentials. Ctrl+C stops only this pilot and deletes its Mongo.');
  }).catch((error) => {
    console.error(`[copper-vale-p6] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { launchIsolatedPilot, requireOptIn, childEnvironment };
