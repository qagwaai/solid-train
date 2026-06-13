'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = {
    drift: 'api/artifacts/contracts/drift-report.json',
    trend: null,
    out: 'reports/sw-08-contract-safety-gate/report.md',
    stage: 'stage3',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--drift') {
      args.drift = argv[index + 1];
      index += 1;
    } else if (token === '--trend') {
      args.trend = argv[index + 1];
      index += 1;
    } else if (token === '--out') {
      args.out = argv[index + 1];
      index += 1;
    } else if (token === '--stage') {
      args.stage = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asRelative(rootDir, targetPath) {
  return path.relative(rootDir, targetPath).replace(/\\/g, '/');
}

function buildReport({ stage, driftPath, drift, trendPath, trend }) {
  const driftIssues = Number(drift?.summary?.totalIssues || 0);
  const hardFailEnforced = Boolean(drift?.summary?.hardFailEnforced);
  const bypassApproved = Boolean(drift?.summary?.bypassApproved);

  const trendRecurrenceActive = Boolean(trend?.rolling30?.recurrenceEscalation?.active);
  const trendFailOnRecurrence = Boolean(trend?.config?.failOnRecurrence);

  const stage3Pass = driftIssues === 0 || bypassApproved;
  const stage5Pass = stage3Pass && (!trend || !trendFailOnRecurrence || !trendRecurrenceActive);
  const decision = stage === 'stage5' ? (stage5Pass ? 'pass' : 'fail') : stage3Pass ? 'pass' : 'fail';

  const lines = [
    '# SW-08 Contract Safety Gate Report',
    '',
    `Stage: ${stage}`,
    `Decision: ${decision}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Inputs',
    '',
    `- Drift report: ${driftPath}`,
    ...(trendPath ? [`- Trend report: ${trendPath}`] : []),
    '',
    '## Drift Summary',
    '',
    `- totalIssues: ${driftIssues}`,
    `- hardFailEnforced: ${hardFailEnforced}`,
    `- bypassApproved: ${bypassApproved}`,
  ];

  if (trend) {
    lines.push('', '## Stage 5 Trend Summary', '');
    lines.push(`- failOnRecurrence: ${trendFailOnRecurrence}`);
    lines.push(`- recurrenceEscalation.active: ${trendRecurrenceActive}`);
    lines.push(`- weekly.driftCount: ${trend?.weekly?.driftCount ?? 'n/a'}`);
    lines.push(`- rolling30.driftCount: ${trend?.rolling30?.driftCount ?? 'n/a'}`);
  }

  lines.push('', '## Result Rationale', '');
  if (decision === 'pass') {
    lines.push('- Contract drift gate conditions satisfied.');
  } else {
    lines.push('- Contract drift gate conditions NOT satisfied.');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(__dirname, '..', '..');

  const driftAbsolutePath = path.resolve(rootDir, args.drift);
  const trendAbsolutePath = args.trend ? path.resolve(rootDir, args.trend) : null;
  const outAbsolutePath = path.resolve(rootDir, args.out);

  const drift = readJson(driftAbsolutePath);
  const trend = trendAbsolutePath && fs.existsSync(trendAbsolutePath) ? readJson(trendAbsolutePath) : null;

  const markdown = buildReport({
    stage: args.stage,
    driftPath: asRelative(rootDir, driftAbsolutePath),
    drift,
    trendPath: trendAbsolutePath ? asRelative(rootDir, trendAbsolutePath) : null,
    trend,
  });

  fs.mkdirSync(path.dirname(outAbsolutePath), { recursive: true });
  fs.writeFileSync(outAbsolutePath, markdown, 'utf8');
  console.log(`[sw08] wrote gate report: ${asRelative(rootDir, outAbsolutePath)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
