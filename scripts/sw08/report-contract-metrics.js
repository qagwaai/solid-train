'use strict';

const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const result = {
    reportsDir: path.join('artifacts', 'contracts'),
    reportPath: path.join('artifacts', 'contracts', 'sw08-weekly-metrics.json'),
    windowDays: 7,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reports-dir') {
      result.reportsDir = argv[index + 1];
      index += 1;
    } else if (arg === '--report') {
      result.reportPath = argv[index + 1];
      index += 1;
    } else if (arg === '--window-days') {
      result.windowDays = Number(argv[index + 1]);
      index += 1;
    }
  }

  return result;
}

function isTrackedReportFile(fileName) {
  return fileName === 'drift-report.json' || /^stage3-.*-report\.json$/.test(fileName);
}

function readReport(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const stat = fs.statSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    mtimeMs: stat.mtimeMs,
    parsed,
  };
}

function issueSignature(issue) {
  return [
    issue?.producerLocation || 'unknown',
    issue?.category || 'unknown',
    issue?.severity || 'unknown',
  ].join('|');
}

function collectMetrics(reports) {
  const openIssues = new Map();
  const resolvedIssues = new Set();
  const resolutions = [];

  let driftCount = 0;
  let bypassCount = 0;
  let expiredBypassCount = 0;

  for (const report of reports) {
    const summary = report.parsed?.summary || {};
    const issues = Array.isArray(report.parsed?.issues) ? report.parsed.issues : [];
    const signatures = issues.map(issueSignature);
    const hasIssues = signatures.length > 0;
    const bypassApproved = Boolean(summary.bypassApproved);
    const invalidException =
      Array.isArray(report.parsed?.exception?.errors) && report.parsed.exception.errors.length > 0;
    const isInvalidBypass = invalidException && !bypassApproved;

    driftCount += Number(summary.totalIssues || issues.length || 0);
    if (bypassApproved) {
      bypassCount += 1;
    }
    if (
      invalidException &&
      report.parsed.exception.errors.some(
        (message) => message.includes('expiryDate') || message.includes('approvals.backendLead')
      )
    ) {
      expiredBypassCount += 1;
    }

    if (hasIssues && !isInvalidBypass) {
      for (const signature of signatures) {
        if (!openIssues.has(signature) && !resolvedIssues.has(signature)) {
          openIssues.set(signature, report.mtimeMs);
        }
      }
    }

    const canClose = !hasIssues || bypassApproved;
    if (!canClose) {
      continue;
    }

    const closeSignatures = hasIssues ? signatures : Array.from(openIssues.keys());
    for (const signature of closeSignatures) {
      const openedAt = openIssues.get(signature);
      if (openedAt === undefined) {
        continue;
      }

      resolvedIssues.add(signature);
      openIssues.delete(signature);
      resolutions.push(report.mtimeMs - openedAt);
    }
  }

  const averageResolutionMs =
    resolutions.length > 0
      ? resolutions.reduce((sum, value) => sum + value, 0) / resolutions.length
      : null;

  return {
    reportsConsidered: reports.length,
    driftCount,
    bypassCount,
    expiredBypassCount,
    mttrHours:
      averageResolutionMs === null ? null : Number((averageResolutionMs / 3_600_000).toFixed(2)),
    openIncidentCount: openIssues.size,
    resolvedIncidentCount: resolutions.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const windowMs = (args.windowDays * WEEK_MS) / 7;
  const cutoffMs = Date.now() - windowMs;

  const reports = fs
    .readdirSync(args.reportsDir)
    .filter(isTrackedReportFile)
    .map((fileName) => path.join(args.reportsDir, fileName))
    .map(readReport)
    .filter((report) => report.mtimeMs >= cutoffMs)
    .sort((left, right) => left.mtimeMs - right.mtimeMs);

  const metrics = {
    generatedAt: new Date().toISOString(),
    windowDays: args.windowDays,
    source: args.reportsDir,
    ...collectMetrics(reports),
  };

  const formatted = await prettier.format(JSON.stringify(metrics, null, 2), {
    filepath: args.reportPath,
  });

  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.writeFileSync(args.reportPath, `${formatted.trimEnd()}\n`, 'utf8');

  console.log(`[sw08] weekly metrics generated: ${path.relative(process.cwd(), args.reportPath)}`);
  console.log(
    `[sw08] driftCount=${metrics.driftCount} mttrHours=${metrics.mttrHours ?? 'n/a'} bypassCount=${metrics.bypassCount} expiredBypassCount=${metrics.expiredBypassCount}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
