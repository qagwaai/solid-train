#!/usr/bin/env node
'use strict';

/**
 * Phase 2 of the exoplanet refresh: links every archive host to an AT-HYG /
 * HYG star (or records why it cannot), then writes:
 *   - data/exoplanet-hosts.json        hosts with a `match` block
 *   - data/exoplanet-hyg-stars.json    matched stars plus HYG multiple-star companions
 *   - data/exoplanet-match-report.json per-host decisions, candidates, and run metrics
 *
 * Usage: npm run catalog:exoplanet:match [-- --allow-match-drift]
 * Env:   EXOPLANET_CACHE_DIR, EXOPLANET_ALLOW_MATCH_DRIFT=1
 */

const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv').default;

const {
  coneRadiusArcsec,
  defaultDistancePc,
  enforceOneToOne,
  matchHost,
  resolveHostDistance,
} = require('./lib/exoplanet-crossmatch');
const {
  HYG_SOURCES,
  ensureSource,
  loadHygStars,
  scanAtHyg,
} = require('./lib/exoplanet-hyg-sources');
const { serializeSnapshot } = require('./import-exoplanet-catalog-data');
const { getHygStars } = require('../src/model/hyg-star-catalog');
const { CYGNUS_X1_HD226868 } = require('../src/model/cygnus-x1-system-catalog');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const HOSTS_FILE = path.join(DATA_DIR, 'exoplanet-hosts.json');
const HYG_STARS_FILE = path.join(DATA_DIR, 'exoplanet-hyg-stars.json');
const REPORT_FILE = path.join(DATA_DIR, 'exoplanet-match-report.json');
const OVERRIDES_FILE = path.join(DATA_DIR, 'exoplanet-overrides.json');
const OVERRIDES_SCHEMA_FILE = path.join(__dirname, 'schemas', 'exoplanet-overrides.schema.json');
const CALIBRATION_FILE = path.join(__dirname, 'lib', 'exoplanet-crossmatch-calibration.json');

const MAX_AUTO_MATCH_RATE_DRIFT = 0.02;
const HYG_LICENSE = 'CC BY-SA 4.0';
const HYG_SOURCE_URL = 'https://codeberg.org/astronexus/athyg';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateOverrides(overrides, schema = readJson(OVERRIDES_SCHEMA_FILE)) {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const errors = validate(overrides)
    ? []
    : validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`);
  const seen = new Set();
  for (const entry of overrides.hostMatches || []) {
    if (seen.has(entry.hostId)) {
      errors.push(`/hostMatches duplicate hostId ${entry.hostId}`);
    }
    seen.add(entry.hostId);
  }
  return errors;
}

/**
 * Stars Forge already ships (HYG fixture and curated catalogs), keyed by HIP,
 * so exoplanet hosts reuse their IDs instead of creating duplicates.
 */
function existingStarsByHip(
  fixtureStars = getHygStars(),
  curatedStars = [{ ...CYGNUS_X1_HD226868, systemId: 'cygnus-x1' }]
) {
  const byHip = new Map();
  for (const star of fixtureStars) {
    if (star.hipId) {
      byHip.set(String(star.hipId), {
        existingStarId: `${star.systemId}-star-${star.systemRole}`,
        existingSystemId: star.systemId,
      });
    }
  }
  for (const star of curatedStars) {
    if (star.hipId) {
      byHip.set(String(star.hipId), { existingStarId: star.id, existingSystemId: star.systemId });
    }
  }
  return byHip;
}

function round(value, digits) {
  return value === null || value === undefined ? undefined : Number(value.toFixed(digits));
}

function existingFor(existingByHip, ...hips) {
  for (const hip of hips) {
    if (hip && existingByHip.has(String(hip))) {
      return existingByHip.get(String(hip));
    }
  }
  return {};
}

function buildMatchBlock(result, host, existingByHip) {
  const block = { decision: result.decision, tier: result.tier ?? null };
  if (result.decision === 'matched') {
    block.atHygId = result.star.atHygId;
    block.hygId = result.star.hygId;
    Object.assign(block, existingFor(existingByHip, result.star.hip, host.hipId));
  } else if (result.decision === 'review' && result.star) {
    block.candidateAtHygId = result.star.atHygId;
  }
  if (result.tier === 'scored') {
    block.posterior = round(result.posterior, 4);
  }
  return block;
}

function buildReportRecord(result, previousReviewIds = new Set()) {
  const record = {
    hostId: result.hostId,
    decision: result.decision,
    tier: result.tier ?? null,
    atHygId: result.star ? result.star.atHygId : null,
    separationArcsec: round(result.separation, 3) ?? null,
    reasons: result.reasons.filter(Boolean),
  };
  if (result.decision === 'review' && previousReviewIds.has(result.hostId)) {
    record.carriedOver = true;
  }
  if (result.tier === 'scored' || result.ranked.length) {
    record.posterior = round(result.posterior, 4) ?? null;
    record.margin = round(result.margin, 4) ?? null;
    record.candidates = result.ranked
      .slice(0, 3)
      .map((candidate) => [
        candidate.star.atHygId,
        round(candidate.posterior, 4),
        round(candidate.separation, 3),
      ]);
  }
  return record;
}

function hygStarRecord(star, hygStar, role, hostIds, existing) {
  const record = {
    atHygId: star.atHygId,
    hygId: star.hygId,
    role,
    hostIds,
    gaiaDr3Id: star.gaia,
    hipId: star.hip,
    hdId: star.hd,
    hrId: star.hr,
    glName: star.gl,
    bayer: star.bayer,
    flamsteed: star.flam,
    constellation: star.con,
    properName: star.proper || (hygStar && hygStar.proper),
    raDeg: round(star.raDeg, 7),
    decDeg: round(star.decDeg, 7),
    positionSource: star.posSrc,
    distancePc: star.distancePc,
    distanceSource: star.distSrc,
    xPc: star.x,
    yPc: star.y,
    zPc: star.z,
    vMag: star.vMag,
    absMag: star.absMag,
    colorIndexBv: star.ci,
    pmRaMasYr: star.pmRa,
    pmDecMasYr: star.pmDec,
    radialVelocityKms: star.rv,
    spectralType: star.spect,
    luminositySolar: hygStar && hygStar.lum,
    hygBase: hygStar && hygStar.base,
    hygComp: hygStar && hygStar.comp,
    hygCompPrimary: hygStar && hygStar.compPrimary,
    ...existing,
  };
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined)
  );
}

/**
 * Builds the HYG star slice: every matched host star, plus HYG multiple-star
 * companions of those stars (D11: companions only ride along with a system
 * that has planets, so no planetless HYG system is ever emitted).
 */
function buildHygStarSlice(results, hyg, starsByHygId, existingByHip) {
  const records = new Map();
  const missingCompanions = [];
  const matched = results.filter((result) => result.decision === 'matched');
  for (const result of matched) {
    const hygStar = result.star.hygId ? hyg.byId.get(result.star.hygId) : null;
    records.set(
      result.star.atHygId,
      hygStarRecord(
        result.star,
        hygStar,
        'host',
        [result.hostId],
        existingFor(existingByHip, result.star.hip)
      )
    );
  }
  for (const result of matched) {
    const hygStar = result.star.hygId ? hyg.byId.get(result.star.hygId) : null;
    const group = hygStar && hygStar.base ? hyg.baseGroups.get(hygStar.base) : [];
    for (const companionHygId of group) {
      if (companionHygId === result.star.hygId) {
        continue;
      }
      const companion = starsByHygId.get(companionHygId);
      if (!companion) {
        missingCompanions.push(companionHygId);
        continue;
      }
      const existingRecord = records.get(companion.atHygId);
      if (existingRecord) {
        if (
          existingRecord.role === 'companion' &&
          !existingRecord.hostIds.includes(result.hostId)
        ) {
          existingRecord.hostIds.push(result.hostId);
        }
        continue;
      }
      records.set(
        companion.atHygId,
        hygStarRecord(
          companion,
          hyg.byId.get(companionHygId),
          'companion',
          [result.hostId],
          existingFor(existingByHip, companion.hip)
        )
      );
    }
  }
  const sorted = [...records.values()].sort((a, b) => Number(a.atHygId) - Number(b.atHygId));
  for (const record of sorted) {
    record.hostIds.sort();
  }
  return { records: sorted, missingCompanions: [...new Set(missingCompanions)].sort() };
}

function summarize(results) {
  const counts = { hosts: results.length, matched: 0, review: 0, unmatched: 0, byTier: {} };
  for (const result of results) {
    counts[result.decision] += 1;
    if (result.decision === 'matched') {
      counts.byTier[result.tier] = (counts.byTier[result.tier] || 0) + 1;
    }
  }
  counts.autoMatchRate = round(
    (counts.matched - (counts.byTier.override || 0)) / Math.max(1, counts.hosts),
    4
  );
  return counts;
}

function checkMatchDrift(previousRate, currentRate, { allowDrift = false } = {}) {
  if (previousRate === null || previousRate === undefined) {
    return { blocked: false, drift: null };
  }
  const drift = currentRate - previousRate;
  const exceeded = Math.abs(drift) > MAX_AUTO_MATCH_RATE_DRIFT;
  return { blocked: exceeded && !allowDrift, exceeded, drift: round(drift, 4) };
}

function isDriftOverride(argv, env) {
  return argv.includes('--allow-match-drift') || env.EXOPLANET_ALLOW_MATCH_DRIFT === '1';
}

function readPreviousReport() {
  if (!fs.existsSync(REPORT_FILE)) {
    return null;
  }
  const { records, ...metadata } = readJson(REPORT_FILE);
  metadata.reviewIds = new Set(
    records.filter((record) => record.decision === 'review').map((record) => record.hostId)
  );
  return metadata;
}

/**
 * D31: every host gets a deterministic distance. Matched hosts use AT-HYG;
 * the default for hosts with no usable data is the median archive distance
 * of the hosts that ship as archive-only stars.
 */
function buildResolvedDistances(hosts, resultsByHost) {
  const archiveOnly = hosts.filter((host) => resultsByHost.get(host.id).decision !== 'matched');
  const defaultDistance = defaultDistancePc(archiveOnly);
  const byHost = new Map();
  const bySource = {};
  for (const host of hosts) {
    const result = resultsByHost.get(host.id);
    const star = result.decision === 'matched' ? result.star : null;
    const resolved = resolveHostDistance(host, star, { defaultDistance });
    bySource[resolved.source] = (bySource[resolved.source] || 0) + 1;
    const block = { distancePc: round(resolved.distancePc, 4) ?? null, source: resolved.source };
    if (resolved.approximate) {
      block.approximate = true;
    }
    byHost.set(host.id, block);
  }
  return { byHost, summary: { defaultDistancePc: defaultDistance, bySource } };
}

function sourceSummary(source, previous) {
  const previousSha = previous && previous.sources && previous.sources[source.fileName];
  return {
    label: source.label,
    url: source.fileUrl,
    sha256: source.sha256,
    verified: source.verified,
    changedSinceLastRun: previousSha ? previousSha.sha256 !== source.sha256 : null,
  };
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const allowDrift = isDriftOverride(argv, env);
  const hostsSnapshot = readJson(HOSTS_FILE);
  const hosts = hostsSnapshot.records.map(
    ({ match: _match, resolvedDistance: _distance, ...host }) => host
  );
  const overrides = readJson(OVERRIDES_FILE);
  const overrideErrors = validateOverrides(overrides);
  if (overrideErrors.length) {
    throw new Error(`Invalid ${path.basename(OVERRIDES_FILE)}:\n${overrideErrors.join('\n')}`);
  }
  const hostIds = new Set(hosts.map((host) => host.id));
  const unknownOverrides = overrides.hostMatches.filter((entry) => !hostIds.has(entry.hostId));
  if (unknownOverrides.length) {
    console.warn(
      `WARNING: overrides for hosts no longer in the archive: ${unknownOverrides.map((entry) => entry.hostId).join(', ')}`
    );
  }
  const overridesByHost = new Map(overrides.hostMatches.map((entry) => [entry.hostId, entry]));
  const calibration = readJson(CALIBRATION_FILE);
  const previous = readPreviousReport();

  const hygSource = await ensureSource(HYG_SOURCES.hyg);
  const atHygSource = await ensureSource(HYG_SOURCES.atHyg);
  if (calibration.source.sha256 !== atHygSource.sha256) {
    console.warn(
      'WARNING: AT-HYG changed since calibration; run npm run catalog:exoplanet:calibrate'
    );
  }

  const hyg = await loadHygStars(hygSource.path);
  const companionHygIds = new Set([...hyg.baseGroups.values()].flat());
  const scan = await scanAtHyg(atHygSource.path, hosts, {
    neighborRadiusFor: coneRadiusArcsec,
    hygIds: companionHygIds,
    atHygIds: new Set(overrides.hostMatches.map((entry) => entry.atHygId).filter(Boolean)),
  });

  const results = enforceOneToOne(
    hosts.map((host) => {
      const override = overridesByHost.get(host.id);
      return matchHost(host, {
        idHits: scan.idHits.get(host.id),
        candidates: scan.neighbors.get(host.id),
        override,
        overrideStar: override && override.atHygId && scan.starsByAtHygId.get(override.atHygId),
        calibration,
      });
    })
  );

  const counts = summarize(results);
  const drift = checkMatchDrift(
    previous && previous.counts && previous.counts.autoMatchRate,
    counts.autoMatchRate,
    {
      allowDrift,
    }
  );
  if (drift.blocked) {
    throw new Error(
      `Auto-match rate moved ${(drift.drift * 100).toFixed(2)} points (limit ` +
        `${MAX_AUTO_MATCH_RATE_DRIFT * 100}). Review data/exoplanet-match-report.json, then ` +
        're-run with --allow-match-drift or EXOPLANET_ALLOW_MATCH_DRIFT=1.'
    );
  }

  const existingByHip = existingStarsByHip();
  const resultsByHost = new Map(results.map((result) => [result.hostId, result]));
  const distances = buildResolvedDistances(hosts, resultsByHost);
  const matchedHosts = hostsSnapshot.records.map(
    ({ match: _match, resolvedDistance: _distance, ...host }) => ({
      ...host,
      match: buildMatchBlock(resultsByHost.get(host.id), host, existingByHip),
      resolvedDistance: distances.byHost.get(host.id),
    })
  );
  const { records: hygStars, missingCompanions } = buildHygStarSlice(
    results,
    hyg,
    scan.starsByHygId,
    existingByHip
  );

  const { records: _hostRecords, ...hostsMetadata } = hostsSnapshot;
  const sources = {
    [hygSource.fileName]: sourceSummary(hygSource, previous),
    [atHygSource.fileName]: sourceSummary(atHygSource, previous),
  };
  const shared = {
    snapshotDate: hostsMetadata.snapshotDate,
    license: HYG_LICENSE,
    licenseFile: hostsMetadata.licenseFile,
  };
  fs.writeFileSync(HOSTS_FILE, serializeSnapshot(hostsMetadata, matchedHosts), 'utf8');
  fs.writeFileSync(
    HYG_STARS_FILE,
    serializeSnapshot(
      {
        source: `${HYG_SOURCES.atHyg.label} and ${HYG_SOURCES.hyg.label} (astronexus)`,
        sourceUrl: HYG_SOURCE_URL,
        ...shared,
        recordFormat: 'AT-HYG row for each matched host star and its HYG multiple-star companions',
        recordCount: hygStars.length,
      },
      hygStars
    ),
    'utf8'
  );
  fs.writeFileSync(
    REPORT_FILE,
    serializeSnapshot(
      {
        snapshotDate: hostsMetadata.snapshotDate,
        sources,
        calibration: {
          generatedDate: calibration.generatedDate,
          atHygSha256: calibration.source.sha256,
          holdout: calibration.metrics.holdout,
        },
        counts,
        drift,
        reviewCarriedOver: results.filter(
          (result) =>
            result.decision === 'review' && previous && previous.reviewIds.has(result.hostId)
        ).length,
        distances: distances.summary,
        companionsMissingFromAtHyg: missingCompanions,
        atHygRowsScanned: scan.rowCount,
        recordCount: results.length,
      },
      results.map((result) => buildReportRecord(result, previous ? previous.reviewIds : undefined))
    ),
    'utf8'
  );

  console.log(JSON.stringify(counts));
  console.log(`Distances: ${JSON.stringify(distances.summary)}`);
  console.log(
    `Wrote ${hygStars.length} HYG stars (${hygStars.filter((star) => star.role === 'companion').length} companions)`
  );
  if (missingCompanions.length) {
    console.log(`HYG companions missing from AT-HYG: ${missingCompanions.length}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildHygStarSlice,
  buildMatchBlock,
  buildReportRecord,
  buildResolvedDistances,
  checkMatchDrift,
  existingStarsByHip,
  isDriftOverride,
  summarize,
  validateOverrides,
};
