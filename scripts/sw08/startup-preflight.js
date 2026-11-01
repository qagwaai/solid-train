'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { analyzeDrift } = require('./check-contract-drift');
const { buildArtifact } = require('./generate-contract-artifact');

function assertNoContractVariance(baselineArtifact, currentArtifact, baselineLabel) {
  const report = analyzeDrift(baselineArtifact, currentArtifact);
  if (report.summary.totalIssues === 0) {
    return report;
  }

  const issueLines = report.issues
    .slice(0, 10)
    .map((issue) => `  - [${issue.category}] ${issue.producerLocation}: ${issue.detail}`);
  const remainingCount = report.issues.length - issueLines.length;
  if (remainingCount > 0) {
    issueLines.push(`  - ...and ${remainingCount} more issue(s)`);
  }

  throw new Error(
    [
      `[contract-preflight] Startup blocked: ${report.summary.totalIssues} contract variance issue(s) against ${baselineLabel}.`,
      ...issueLines,
      'Resolve the contract changes or update the baseline through the approved migration process before starting the server.',
    ].join('\n')
  );
}

function runContractSafetyPreflight(rootDir = path.resolve(__dirname, '..', '..')) {
  const baselinePath = path.join(
    rootDir,
    'api',
    'artifacts',
    'contracts',
    'baseline-contract-artifact.json'
  );
  if (!fs.existsSync(baselinePath)) {
    throw new Error(
      `[contract-preflight] Startup blocked: approved contract baseline not found at ${baselinePath}.`
    );
  }

  const baselineArtifact = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const currentArtifact = buildArtifact(rootDir);
  return assertNoContractVariance(
    baselineArtifact,
    currentArtifact,
    path.relative(rootDir, baselinePath)
  );
}

module.exports = {
  assertNoContractVariance,
  runContractSafetyPreflight,
};
