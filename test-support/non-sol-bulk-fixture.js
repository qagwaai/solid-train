'use strict';

const manifest = require('../data/non-sol-celestial-generation-manifest-v1.json');
const { generateBulkSystem } = require('../scripts/lib/non-sol-bulk-generator');

async function bulkFixture(id) {
  const row = manifest.systems.find((system) => system.id === id);
  if (!row) throw new Error(`Unknown non-Sol fixture system: ${id}`);
  const plan = await generateBulkSystem(row);
  if (plan.status !== 'ready') throw new Error(`Non-Sol fixture ${id} is not ready: ${plan.reason}`);
  return plan;
}

module.exports = { bulkFixture };
