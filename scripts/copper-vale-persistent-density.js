'use strict';

const { MongoConnection } = require('../src/db/connection');
const { DatabaseService } = require('../src/db/service');
const { runCopperValeDensityLifecycle } = require('../src/model/copper-vale-market-density-lifecycle');
const { parseArguments, assertForgeStopped } = require('./copper-vale-persistent-seed');
const { runContractSafetyPreflight } = require('./sw08/startup-preflight');

async function runPersistentDensity(args) {
  const options = parseArguments(args);
  runContractSafetyPreflight();
  if (options.writes) await assertForgeStopped();
  const connection = new MongoConnection({ mongoUri: options.target });
  try {
    await connection.connect();
    const service = new DatabaseService();
    const preflight = await runCopperValeDensityLifecycle(service, { action: 'dry-run' });
    console.log(`COPPER_VALE_DENSITY_PREFLIGHT ${JSON.stringify({ target: options.target, ...preflight })}`);
    if (options.writes) {
      const expected = options.action === 'apply' ? ['ready', 'verified'] : ['resumable'];
      if (!expected.includes(preflight.readiness)) {
        throw new Error(`Persistent density ${options.action} refused: ${preflight.blockedReason || preflight.readiness}`);
      }
      await assertForgeStopped();
    }
    const result = await runCopperValeDensityLifecycle(service, { action: options.action });
    console.log(`COPPER_VALE_DENSITY_RESULT ${JSON.stringify({ target: options.target, protectedDataUnchanged: true, ...result })}`);
    return result;
  } finally {
    await connection.disconnect();
  }
}

if (require.main === module) {
  runPersistentDensity(process.argv.slice(2)).catch((error) => {
    console.error(`[copper-vale-density] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runPersistentDensity };
