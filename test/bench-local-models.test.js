'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const {
  median,
  outputTokensPerSecond,
  parseArgs,
  parseNvidiaDeviceInfo,
  parseNvidiaUsage,
  readResponsesStream,
  summarizeSamples,
  selectDownloadedModels,
  verifySoleLoadedModel,
  isQuietSample,
  waitForQuiet,
  runBenchmark,
} = require('../scripts/bench-local-models');

test('parseArgs accepts endpoint, run count, and output path', () => {
  assert.deepEqual(
    parseArgs([
      '--url',
      'http://localhost:1234/',
      '--runs',
      '5',
      '--models',
      'qwen_qwen3.5-9b',
      '--output',
      'out.json',
    ]),
    {
      url: 'http://localhost:1234',
      runs: 5,
      output: 'out.json',
      models: ['qwen_qwen3.5-9b'],
      help: false,
    }
  );
});

test('parseArgs defaults to discovering downloaded models', () => {
  assert.equal(parseArgs([]).models, null);
});

test('parseArgs rejects invalid run counts', () => {
  assert.throws(() => parseArgs(['--runs', '0']), /--runs must be an integer/);
});

test('parseArgs rejects empty or duplicated model IDs', () => {
  assert.throws(() => parseArgs(['--models', ' , ']), /--models must be a comma-separated list/);
  assert.throws(
    () => parseArgs(['--models', 'qwen_qwen3.5-9b,qwen_qwen3.5-9b']),
    /--models must be a comma-separated list/
  );
});

test('median and output rate use measured values only', () => {
  assert.equal(median([9, 2, 5, 6]), 5.5);
  assert.equal(outputTokensPerSecond(20, 250, 1250), 20);
  assert.equal(outputTokensPerSecond(null, 250, 1250), null);
});

test('summarizeSamples reports medians and ignores unavailable metrics', () => {
  const summary = summarizeSamples([
    { timeToFirstTextMs: 200, totalResponseMs: 1000, outputTokens: 20, outputTokensPerSecond: 25 },
    {
      timeToFirstTextMs: 400,
      totalResponseMs: 1200,
      outputTokens: null,
      outputTokensPerSecond: null,
    },
    {
      timeToFirstTextMs: 300,
      totalResponseMs: 1100,
      outputTokens: 18,
      outputTokensPerSecond: 22.5,
    },
  ]);
  assert.deepEqual(summary, {
    measuredRuns: 3,
    medianTimeToFirstTextMs: 300,
    medianTotalResponseMs: 1100,
    medianOutputTokens: 19,
    medianOutputTokensPerSecond: 23.75,
  });
});

test('NVIDIA telemetry parsers handle device and usage rows', () => {
  assert.deepEqual(parseNvidiaDeviceInfo('Quadro RTX 3000, 6144, 596.71\n'), [
    { name: 'Quadro RTX 3000', memoryTotalMiB: 6144, driverVersion: '596.71' },
  ]);
  assert.deepEqual(parseNvidiaUsage('Quadro RTX 3000, 37, 2048, 6144\n'), [
    { name: 'Quadro RTX 3000', utilizationPercent: 37, memoryUsedMiB: 2048, memoryTotalMiB: 6144 },
  ]);
});

test('readResponsesStream handles split SSE frames and captures completion usage', async () => {
  const encoder = new TextEncoder();
  const chunks = [
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"connect',
    'ivity"}\n\n',
    'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","usage":{"output_tokens":2},"output":[{"type":"message","content":[{"type":"output_text","text":"connectivity"}]}]}}\n\n',
  ];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  const result = await readResponsesStream({ body }, performance.now());
  assert.equal(result.outputText, 'connectivity');
  assert.equal(result.outputTokens, 2);
  assert.ok(result.firstTextMs >= 0);
});

const INVENTORY = [
  { type: 'llm', modelKey: 'large', indexedModelIdentifier: 'large-Q4.gguf' },
  { type: 'embedding', modelKey: 'embedding' },
  { type: 'llm', modelKey: 'small', indexedModelIdentifier: 'small-Q4.gguf' },
  { type: 'llm', modelKey: 'small', indexedModelIdentifier: 'small-Q6.gguf' },
];

test('discovery tests every chat artifact and explicitly skips non-chat models', () => {
  const { selectedModels, skippedModels } = selectDownloadedModels(INVENTORY, null);
  assert.deepEqual(
    selectedModels.map((model) => model.indexedModelIdentifier),
    ['large-Q4.gguf', 'small-Q4.gguf', 'small-Q6.gguf']
  );
  assert.equal(skippedModels[0].modelKey, 'embedding');
  assert.match(skippedModels[0].skipReason, /Not a chat model/);
  assert.equal(selectDownloadedModels(INVENTORY, ['small']).selectedModels.length, 2);
  assert.throws(() => selectDownloadedModels(INVENTORY, ['embedding']), /not found/);
});

test('residency verification rejects other loaded models or a different artifact', () => {
  const model = INVENTORY[0];
  const loaded = { ...model, identifier: 'bench' };
  verifySoleLoadedModel([loaded], model, 'bench');
  assert.throws(() => verifySoleLoadedModel([loaded, loaded], model, 'bench'), /Expected only/);
  assert.throws(
    () => verifySoleLoadedModel([{ ...loaded, indexedModelIdentifier: 'wrong' }], model, 'bench'),
    /Expected only/
  );
});

test('quiet thresholds are inclusive and missing telemetry does not pass', () => {
  assert.equal(isQuietSample({ cpuUtilizationPercent: 30, gpuUtilizationPercent: 10 }), true);
  assert.equal(isQuietSample({ cpuUtilizationPercent: 30.01, gpuUtilizationPercent: 0 }), false);
  assert.equal(isQuietSample({ cpuUtilizationPercent: 0, gpuUtilizationPercent: 10.01 }), false);
  assert.equal(isQuietSample({ cpuUtilizationPercent: null, gpuUtilizationPercent: 0 }), false);
  assert.equal(isQuietSample({ cpuUtilizationPercent: 0, gpuUtilizationPercent: null }), false);
});

test('quiet waiting resets the five-second window after a busy sample and times out explicitly', async () => {
  let clock = 0;
  const result = await waitForQuiet(true, {
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    capture: async () => ({
      cpuUtilizationPercent: clock === 2500 ? 31 : 30,
      gpuUtilizationPercent: 10,
    }),
  });
  assert.equal(result.sustainedQuietMs, 5000);
  assert.equal(result.waitedMs, 8000);
  clock = 0;
  await assert.rejects(
    waitForQuiet(true, {
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
      capture: async () => ({ cpuUtilizationPercent: 31, gpuUtilizationPercent: 0 }),
      policy: { cpuMaxPercent: 30, gpuMaxPercent: 10, sustainedMs: 5000, timeoutMs: 2000 },
    }),
    /Machine did not stay quiet/
  );
  await assert.rejects(waitForQuiet(false), /telemetry is unavailable/);
});

test('managed sequence unloads, quiets, loads one artifact, measures, and unloads on success or failure', async () => {
  const events = [];
  let loaded = [];
  let failRequest = false;
  const runtime = {
    captureHardware: async () => ({ gpu: { status: 'available' } }),
    fetchModelList: async () => loaded.map((model) => ({ id: model.identifier })),
    inventory: async () => INVENTORY,
    unloadAllModels: async () => {
      events.push('unload');
      loaded = [];
      return { verifiedLoadedModels: [] };
    },
    loadOnlyModel: async (model, identifier) => {
      assert.equal(loaded.length, 0);
      events.push(`load:${model.indexedModelIdentifier}`);
      loaded = [{ ...model, identifier }];
      return { verifiedLoadedModels: loaded };
    },
    loadedModels: async () => loaded,
    waitForQuiet: async () => {
      events.push('quiet');
      return { sustainedQuietMs: 5000 };
    },
    requestResponse: async (url, identifier) => {
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].identifier, identifier);
      events.push('request');
      if (failRequest) {
        throw new Error('request failed');
      }
      return {
        timeToFirstTextMs: 100,
        totalResponseMs: 1100,
        outputTokens: 20,
        outputTokensPerSecond: 20,
      };
    },
    createSampler: () => ({
      start: async () => {},
      stop: async () => ({}),
    }),
  };
  const report = await runBenchmark(parseArgs(['--runs', '1']), runtime);
  assert.equal(report.results.length, 3);
  assert.equal(report.benchmark.skippedModels.length, 1);
  assert.deepEqual(events, [
    'unload',
    ...INVENTORY.filter((model) => model.type === 'llm')
      .map((model) => [
        'quiet',
        `load:${model.indexedModelIdentifier}`,
        'quiet',
        'request',
        'quiet',
        'request',
        'unload',
      ])
      .flat(),
  ]);
  assert.deepEqual(loaded, []);
  events.length = 0;
  failRequest = true;
  await assert.rejects(runBenchmark(parseArgs([]), runtime), /request failed/);
  assert.equal(events.at(-1), 'unload');
  assert.deepEqual(loaded, []);
});
