'use strict';

const fs = require('node:fs');

const CONTRACT_IMPACT_PATTERNS = [
  /^openapi\.ya?ml$/,
  /^schemas\/.+\.json$/,
  /^src\/handlers\/.+\.js$/,
  /^src\/model\/.+\.js$/,
];

const REQUIRED_CHECKBOXES = [
  /-\s*\[x\]\s*SW-08 contract-impacting change acknowledged/i,
  /-\s*\[x\]\s*SW-08 consumer surfaces reviewed/i,
  /-\s*\[x\]\s*SW-08 migration note linked or marked not-required/i,
];

function parseArgs(argv) {
  const result = {
    changedFilesPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--changed-files') {
      result.changedFilesPath = argv[index + 1];
      index += 1;
    }
  }

  return result;
}

function normalizePath(value) {
  return value.replace(/\\/g, '/').trim();
}

function isContractImpacting(filePath) {
  return CONTRACT_IMPACT_PATTERNS.some((pattern) => pattern.test(filePath));
}

function getMigrationNoteValue(prBody) {
  const match = prBody.match(/migration note:\s*(.+)/i);
  if (!match) {
    return null;
  }

  return match[1].trim();
}

function isValidMigrationNote(value) {
  if (!value) {
    return false;
  }

  if (/^not-required$/i.test(value)) {
    return true;
  }

  return /^(https?:\/\/\S+|docs\/\S+)/i.test(value);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.changedFilesPath || !fs.existsSync(args.changedFilesPath)) {
    throw new Error('Missing --changed-files path for SW-08 PR hygiene check');
  }

  const changedFiles = fs
    .readFileSync(args.changedFilesPath, 'utf8')
    .split(/\r?\n/)
    .map((entry) => normalizePath(entry))
    .filter(Boolean);

  const impactingFiles = changedFiles.filter((filePath) => isContractImpacting(filePath));
  if (impactingFiles.length === 0) {
    console.log('[sw08] PR hygiene: no contract-impacting producer files changed');
    return;
  }

  const prBody = process.env.SW08_PR_BODY || '';
  const errors = [];

  if (!prBody.trim()) {
    errors.push('PR body is required for SW-08 contract-impacting changes.');
  }

  for (const required of REQUIRED_CHECKBOXES) {
    if (!required.test(prBody)) {
      errors.push(`Missing required SW-08 checklist checkbox: ${required}`);
    }
  }

  const migrationNote = getMigrationNoteValue(prBody);
  if (!isValidMigrationNote(migrationNote)) {
    errors.push(
      'Migration note must be present as "Migration note: <url|docs/path|not-required>" for contract-impacting changes.'
    );
  }

  if (errors.length > 0) {
    console.error('[sw08] PR hygiene check failed');
    console.error(`[sw08] impacting files: ${impactingFiles.join(', ')}`);
    for (const error of errors) {
      console.error(`[sw08] ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[sw08] PR hygiene check passed for contract-impacting producer changes');
  console.log(`[sw08] impacting files: ${impactingFiles.join(', ')}`);
  console.log(`[sw08] migration note: ${migrationNote}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
