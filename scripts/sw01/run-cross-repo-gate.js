'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }
  return result;
}

function printIssue(issue, index) {
  const consumerSurface = Array.isArray(issue.consumerSurfaces)
    ? issue.consumerSurfaces.join(', ')
    : 'unknown';
  process.stderr.write(`[sw01-m3] issue#${index + 1} severity=${issue.severity || 'unknown'} owner=${issue.owner || 'unknown'}\n`);
  process.stderr.write(`[sw01-m3] producerLocation=${issue.producerLocation || 'unknown'} impactedConsumerSurface=${consumerSurface}\n`);
  process.stderr.write(`[sw01-m3] detail=${issue.detail || 'unknown'}\n`);
  process.stderr.write(`[sw01-m3] remediationHint=${issue.suggestedCompatibilityStrategy || 'none'}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(__dirname, '..', '..');
  const driftScript = path.resolve(rootDir, 'scripts', 'sw08', 'check-contract-drift.js');

  const baseline = args.baseline;
  const current = args.current;
  const report = args.report;
  const mode = args.mode || 'hard-fail';
  const exception = args.exception;

  if (!baseline || !current || !report) {
    process.stderr.write(
      '[sw01-m3] Missing required args. Usage: --baseline <path> --current <path> --report <path> [--mode hard-fail|soft-fail|report-only] [--exception <path>]\n'
    );
    process.exit(2);
  }

  const driftArgs = [
    driftScript,
    '--baseline', baseline,
    '--current', current,
    '--report', report,
    '--mode', mode,
  ];

  if (exception) {
    driftArgs.push('--exception', exception);
  }

  const result = spawnSync(process.execPath, driftArgs, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  const reportPath = path.resolve(rootDir, report);
  if (!fs.existsSync(reportPath)) {
    process.stderr.write(`[sw01-m3] Drift report not found: ${report}\n`);
    process.exit(result.status ?? 1);
  }

  const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

  if (issues.length === 0) {
    process.stderr.write('[sw01-m3] No compatibility issues detected. Forge and Nova contract surfaces are aligned.\n');
  } else {
    process.stderr.write(`[sw01-m3] actionableIssues=${issues.length}\n`);
    const previewCount = Math.min(issues.length, 5);
    for (let index = 0; index < previewCount; index += 1) {
      printIssue(issues[index], index);
    }
  }

  process.exit(result.status ?? 0);
}

if (require.main === module) {
  main();
}
