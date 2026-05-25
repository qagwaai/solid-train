'use strict';

const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const result = {
    reportsDir: path.join('artifacts', 'contracts'),
    reportPath: path.join('artifacts', 'contracts', 'sw08-trend-report.json'),
    weeklyDays: 7,
    rollingDays: 30,
    recurrenceThreshold: 2,
    nearExpiryDays: 7,
    failOnRecurrence: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reports-dir') {
      result.reportsDir = argv[index + 1];
      index += 1;
    } else if (arg === '--report') {
      result.reportPath = argv[index + 1];
      index += 1;
    } else if (arg === '--weekly-days') {
      result.weeklyDays = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--rolling-days') {
      result.rollingDays = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--recurrence-threshold') {
      result.recurrenceThreshold = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--near-expiry-days') {
      result.nearExpiryDays = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--fail-on-recurrence') {
      result.failOnRecurrence = true;
    } else if (arg === '--window-days') {
      // Backward-compatible alias used by Stage 4 script invocation.
      const windowDays = Number(argv[index + 1]);
      result.weeklyDays = windowDays;
      result.rollingDays = Math.max(result.rollingDays, windowDays);
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

function isFixturePath(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.replace(/\\/g, '/').toLowerCase();
  return normalized.startsWith('test/fixtures/sw08/');
}

function isFixtureReport(report) {
  const metadata = report.parsed?.metadata || {};
  return isFixturePath(metadata.baselinePath) || isFixturePath(metadata.currentPath);
}

function issueSignature(issue) {
  return [
    issue?.producerLocation || 'unknown',
    issue?.category || 'unknown',
    issue?.severity || 'unknown',
  ].join('|');
}

function sortCounts(map) {
  return Object.entries(map)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([key, count]) => ({ key, count }));
}

function collectMetrics(reports, options) {
  const openIssues = new Map();
  const resolvedIssues = new Set();
  const resolutions = [];
  const byClass = {};
  const byOwner = {};
  const repeated = new Map();
  const nearExpiryExceptions = [];

  let driftCount = 0;
  let bypassCount = 0;
  let expiredBypassCount = 0;
  const nowMs = Date.now();
  const nearExpiryCutoffMs = nowMs + options.nearExpiryDays * 24 * 60 * 60 * 1000;

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

    const exception = report.parsed?.exception;
    if (exception && !Array.isArray(exception.errors) && typeof exception.expiryDate === 'string') {
      const expiryMs = Date.parse(exception.expiryDate);
      if (!Number.isNaN(expiryMs) && expiryMs > nowMs && expiryMs <= nearExpiryCutoffMs) {
        nearExpiryExceptions.push({
          report: report.fileName,
          owner: exception.owner || summary.owner || 'unassigned',
          expiryDate: exception.expiryDate,
          followUpTicket: exception.followUpTicket || null,
        });
      }
    }

    for (const issue of issues) {
      const category = issue?.category || 'unknown';
      const owner = issue?.owner || 'unassigned';
      byClass[category] = (byClass[category] || 0) + 1;
      byOwner[owner] = (byOwner[owner] || 0) + 1;

      const signature = issueSignature(issue);
      const existing = repeated.get(signature) || {
        producerLocation: issue?.producerLocation || 'unknown',
        category,
        owner,
        occurrences: 0,
      };
      existing.occurrences += 1;
      repeated.set(signature, existing);
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

  const repeatOffenders = [...repeated.values()]
    .filter((entry) => entry.occurrences >= options.recurrenceThreshold)
    .sort((left, right) => {
      if (right.occurrences !== left.occurrences) {
        return right.occurrences - left.occurrences;
      }
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category);
      }
      return left.producerLocation.localeCompare(right.producerLocation);
    });

  return {
    reportsConsidered: reports.length,
    driftCount,
    byClass: sortCounts(byClass),
    byOwner: sortCounts(byOwner),
    bypassCount,
    expiredBypassCount,
    mttrHours:
      averageResolutionMs === null ? null : Number((averageResolutionMs / 3_600_000).toFixed(2)),
    openIncidentCount: openIssues.size,
    resolvedIncidentCount: resolutions.length,
    repeatOffenders,
    recurrenceEscalationActive: repeatOffenders.length > 0,
    nearExpiryExceptions: nearExpiryExceptions.sort((left, right) =>
      left.expiryDate.localeCompare(right.expiryDate)
    ),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allReports = fs
    .readdirSync(args.reportsDir)
    .filter(isTrackedReportFile)
    .map((fileName) => path.join(args.reportsDir, fileName))
    .map(readReport)
    .sort((left, right) => left.mtimeMs - right.mtimeMs);

  const nonFixtureReports = allReports.filter((report) => !isFixtureReport(report));
  const nowMs = Date.now();
  const weeklyCutoffMs = nowMs - (args.weeklyDays * WEEK_MS) / 7;
  const rollingCutoffMs = nowMs - (args.rollingDays * WEEK_MS) / 7;

  const weeklyReports = nonFixtureReports.filter((report) => report.mtimeMs >= weeklyCutoffMs);
  const rollingReports = nonFixtureReports.filter((report) => report.mtimeMs >= rollingCutoffMs);

  const weekly = collectMetrics(weeklyReports, {
    recurrenceThreshold: args.recurrenceThreshold,
    nearExpiryDays: args.nearExpiryDays,
  });
  const rolling30 = collectMetrics(rollingReports, {
    recurrenceThreshold: args.recurrenceThreshold,
    nearExpiryDays: args.nearExpiryDays,
  });

  const metrics = {
    generatedAt: new Date().toISOString(),
    source: args.reportsDir,
    thresholds: {
      recurrenceThreshold: args.recurrenceThreshold,
      nearExpiryDays: args.nearExpiryDays,
      weeklyDays: args.weeklyDays,
      rollingDays: args.rollingDays,
    },
    falsePositiveBaseline: {
      reportsTotal: allReports.length,
      reportsExcludedAsFixtures: allReports.length - nonFixtureReports.length,
      fixtureNoiseRate:
        allReports.length === 0
          ? 0
          : Number(
              (((allReports.length - nonFixtureReports.length) / allReports.length) * 100).toFixed(
                2
              )
            ),
    },
    windows: {
      weekly,
      rolling30,
    },
    recurrenceEscalation: {
      active: rolling30.recurrenceEscalationActive,
      repeatOffenders: rolling30.repeatOffenders,
      nextAction: rolling30.recurrenceEscalationActive
        ? 'Escalate repeat-drift surfaces to backend/frontend leads and require compatibility mitigation before next release.'
        : 'No recurrence escalation required.',
    },
    exceptionHygiene: {
      nearExpiryExceptions: rolling30.nearExpiryExceptions,
      expiredExceptionFailures30d: rolling30.expiredBypassCount,
      failClosedExpired: true,
    },
  };

  const formatted = await prettier.format(JSON.stringify(metrics, null, 2), {
    filepath: args.reportPath,
  });

  fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
  fs.writeFileSync(args.reportPath, `${formatted.trimEnd()}\n`, 'utf8');

  console.log(`[sw08] weekly metrics generated: ${path.relative(process.cwd(), args.reportPath)}`);
  console.log(
    `[sw08] weekly.driftCount=${metrics.windows.weekly.driftCount} weekly.mttrHours=${metrics.windows.weekly.mttrHours ?? 'n/a'} weekly.bypassCount=${metrics.windows.weekly.bypassCount} weekly.expiredBypassCount=${metrics.windows.weekly.expiredBypassCount}`
  );
  console.log(
    `[sw08] rolling30.driftCount=${metrics.windows.rolling30.driftCount} rolling30.mttrHours=${metrics.windows.rolling30.mttrHours ?? 'n/a'} recurrenceEscalation=${metrics.recurrenceEscalation.active}`
  );

  if (args.failOnRecurrence && metrics.recurrenceEscalation.active) {
    console.error('[sw08] recurrence threshold exceeded; escalation required');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
