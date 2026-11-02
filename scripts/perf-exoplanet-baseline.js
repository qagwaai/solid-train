#!/usr/bin/env node
'use strict';

/**
 * EX-7.1 server baseline: measures payload size and round-trip latency for the
 * list messages against a running Forge server. Phase 7 numbers were taken
 * before paging; since P2 (D68) every list response is one page (default 100,
 * maximum 500), so "no filters" scenarios measure the default first page.
 *
 * Usage: npm run perf:exoplanet:baseline -- [--url http://localhost:3000]
 *          [--runs 10] [--json <file>]
 *
 * Registers a throwaway player (perf-<timestamp>) on the target server.
 */

const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { io: createClient } = require('socket.io-client');

const {
  SOLAR_SYSTEM_LIST_REQUEST_EVENT,
  SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
} = require('../src/model/solar-system-list');
const { STAR_LIST_REQUEST_EVENT, STAR_LIST_RESPONSE_EVENT } = require('../src/model/star-list');
const { REGISTER_EVENT, REGISTER_RESPONSE_EVENT } = require('../src/model/register');
const { LOGIN_EVENT, LOGIN_RESPONSE_EVENT } = require('../src/model/login');

const RESPONSE_TIMEOUT_MS = 60_000;

/** Scenarios selected for Phase 7 (D63); ids kept stable across P2 for comparison. */
const SCENARIOS = [
  {
    id: 'solar-system-list-all',
    label: 'solar-system-list, no filters (default page of 100)',
    event: SOLAR_SYSTEM_LIST_REQUEST_EVENT,
    responseEvent: SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
    operation: 'solar-system-list',
    payload: {},
    itemsKey: 'solarSystems',
  },
  {
    id: 'solar-system-list-cap',
    label: 'solar-system-list, limit 1000 (clamped to 500)',
    event: SOLAR_SYSTEM_LIST_REQUEST_EVENT,
    responseEvent: SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
    operation: 'solar-system-list',
    payload: { limit: 1000 },
    itemsKey: 'solarSystems',
  },
  {
    id: 'solar-system-list-nova',
    label: 'solar-system-list, limit 50 (Nova viewer default)',
    event: SOLAR_SYSTEM_LIST_REQUEST_EVENT,
    responseEvent: SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
    operation: 'solar-system-list',
    payload: { limit: 50 },
    itemsKey: 'solarSystems',
  },
  {
    id: 'solar-system-list-nova-50pc',
    label: 'solar-system-list, limit 50 within 50 pc (Nova viewer)',
    event: SOLAR_SYSTEM_LIST_REQUEST_EVENT,
    responseEvent: SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
    operation: 'solar-system-list',
    payload: { limit: 50, maxDistanceParsec: 50 },
    itemsKey: 'solarSystems',
  },
  {
    id: 'star-list-all',
    label: 'star-list, no filters (default page of 100)',
    event: STAR_LIST_REQUEST_EVENT,
    responseEvent: STAR_LIST_RESPONSE_EVENT,
    operation: 'star-list',
    payload: {},
    itemsKey: 'stars',
  },
];

function parseArgs(argv) {
  const value = (flag, fallback) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : argv[index + 1];
  };
  return {
    url: value('--url', 'http://localhost:3000'),
    runs: Number(value('--runs', '10')),
    json: value('--json', null),
  };
}

function request(socket, event, responseEvent, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${responseEvent} timed out after ${RESPONSE_TIMEOUT_MS} ms`)),
      RESPONSE_TIMEOUT_MS
    );
    const started = process.hrtime.bigint();
    const onResponse = (response) => {
      if (payload.correlationId && response?.correlationId !== payload.correlationId) {
        return;
      }
      socket.off(responseEvent, onResponse);
      clearTimeout(timer);
      resolve({ response, ms: Number(process.hrtime.bigint() - started) / 1e6 });
    };
    socket.on(responseEvent, onResponse);
    socket.emit(event, payload);
  });
}

function percentile(sorted, fraction) {
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function login(socket) {
  const playerName = `perf-${Date.now()}`;
  const password = randomUUID();
  const { response: registered } = await request(socket, REGISTER_EVENT, REGISTER_RESPONSE_EVENT, {
    playerName,
    email: `${playerName}@example.invalid`,
    password,
  });
  if (!registered?.success) {
    throw new Error(`register failed: ${registered?.message}`);
  }
  const { response } = await request(socket, LOGIN_EVENT, LOGIN_RESPONSE_EVENT, {
    playerName,
    password,
  });
  if (!response?.success) {
    throw new Error(`login failed: ${response?.message}`);
  }
  return { playerName, sessionKey: response.sessionKey };
}

async function measure(socket, session, scenario, runs) {
  const samples = [];
  let bytes = 0;
  let items = 0;
  // One extra warm-up request is discarded.
  for (let run = 0; run <= runs; run += 1) {
    const payload = {
      ...session,
      correlationId: randomUUID(),
      requestIdentity: {
        operation: scenario.operation,
        entityType: 'all-sources',
        containerId: 'perf-baseline',
      },
      ...scenario.payload,
    };
    const { response, ms } = await request(socket, scenario.event, scenario.responseEvent, payload);
    if (!response?.success) {
      throw new Error(`${scenario.id} failed: ${response?.message}`);
    }
    if (run === 0) {
      continue;
    }
    samples.push(ms);
    bytes = Buffer.byteLength(JSON.stringify(response));
    items = response[scenario.itemsKey]?.length ?? 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    id: scenario.id,
    label: scenario.label,
    items,
    bytes,
    bytesPerItem: items ? Math.round(bytes / items) : null,
    runs,
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted[sorted.length - 1]),
  };
}

function formatTable(results) {
  const header =
    '| Scenario | Items | Payload | Bytes/item | p50 ms | p95 ms | max ms |\n' +
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |';
  const rows = results.map(
    (result) =>
      `| ${result.label} | ${result.items.toLocaleString('en-US')} | ${(result.bytes / 1e6).toFixed(2)} MB | ${
        result.bytesPerItem ?? '—'
      } | ${result.p50Ms} | ${result.p95Ms} | ${result.maxMs} |`
  );
  return [header, ...rows].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const socket = createClient(options.url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  try {
    const session = await login(socket);
    const results = [];
    for (const scenario of SCENARIOS) {
      results.push(await measure(socket, session, scenario, options.runs));
    }
    const report = {
      measuredAt: new Date().toISOString(),
      url: options.url,
      node: process.version,
      runs: options.runs,
      results,
    };
    console.log(formatTable(results));
    if (options.json) {
      fs.writeFileSync(options.json, `${JSON.stringify(report, null, 2)}\n`);
    }
    return report;
  } finally {
    socket.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { SCENARIOS, formatTable, percentile };
