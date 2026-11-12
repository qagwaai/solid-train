#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { performance } = require('node:perf_hooks');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const RESOURCE_SAMPLE_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 180_000;
const QUIET_POLICY = {
  cpuMaxPercent: 30,
  gpuMaxPercent: 10,
  sustainedMs: 5000,
  timeoutMs: 120_000,
};
const MAX_OUTPUT_TOKENS = 128;
const PROMPT =
  'You are the market manager at a space station. Give a friendly greeting in 2-3 sentences and report current inventory: 1,200 iron, 640 titanium, and 80 platinum. Do not invent prices or offers.';

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:1234',
    runs: 3,
    output: null,
    models: null,
    help: false,
  };
  const valueOptions = new Set(['--url', '--runs', '--output', '--models']);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (!valueOptions.has(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Expected a value after ${argument}`);
    }
    index += 1;
    if (argument === '--url') {
      options.url = value.replace(/\/+$/, '');
    } else if (argument === '--runs') {
      options.runs = Number(value);
      if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 20) {
        throw new Error('--runs must be an integer from 1 to 20');
      }
    } else if (argument === '--models') {
      options.models = value
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);
      if (options.models.length === 0 || new Set(options.models).size !== options.models.length) {
        throw new Error('--models must be a comma-separated list of unique model IDs');
      }
    } else {
      options.output = value;
    }
  }

  return options;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function outputTokensPerSecond(outputTokens, firstTextMs, totalMs) {
  const generationMs = totalMs - firstTextMs;
  if (!Number.isFinite(outputTokens) || generationMs <= 0) {
    return null;
  }
  return round(outputTokens / (generationMs / 1000));
}

function summarizeSamples(samples) {
  return {
    measuredRuns: samples.length,
    medianTimeToFirstTextMs: round(median(samples.map((sample) => sample.timeToFirstTextMs))),
    medianTotalResponseMs: round(median(samples.map((sample) => sample.totalResponseMs))),
    medianOutputTokens: round(median(samples.map((sample) => sample.outputTokens))),
    medianOutputTokensPerSecond: round(
      median(samples.map((sample) => sample.outputTokensPerSecond))
    ),
  };
}

function parseCsvNumber(value) {
  const normalized = value.trim();
  if (!normalized || normalized.startsWith('[') || normalized.toLowerCase() === 'n/a') {
    return null;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseNvidiaDeviceInfo(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, memoryTotalMiB, driverVersion] = line.split(/,\s*/);
      return {
        name,
        memoryTotalMiB: parseCsvNumber(memoryTotalMiB),
        driverVersion: driverVersion || null,
      };
    });
}

function parseNvidiaUsage(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, utilizationPercent, memoryUsedMiB, memoryTotalMiB] = line.split(/,\s*/);
      return {
        name,
        utilizationPercent: parseCsvNumber(utilizationPercent),
        memoryUsedMiB: parseCsvNumber(memoryUsedMiB),
        memoryTotalMiB: parseCsvNumber(memoryTotalMiB),
      };
    });
}

async function queryNvidiaSmi(args) {
  const { stdout } = await execFileAsync('nvidia-smi', args, {
    timeout: 5000,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

async function runLms(args) {
  const { stdout } = await execFileAsync('lms', args, {
    timeout: REQUEST_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

async function listLmsModels(command) {
  const stdout = await runLms([command, '--json']);
  const models = JSON.parse(stdout);
  if (!Array.isArray(models)) {
    throw new Error(`lms ${command} --json did not return a model array`);
  }
  return models;
}

function selectDownloadedModels(inventory, requestedIds) {
  const chatModels = inventory.filter((model) => model.type === 'llm');
  const skippedModels = inventory
    .filter((model) => model.type !== 'llm')
    .map((model) => ({ ...model, skipReason: 'Not a chat model; generation benchmark only.' }));
  if (requestedIds) {
    const missing = requestedIds.filter(
      (id) =>
        !chatModels.some((model) => model.modelKey === id || model.indexedModelIdentifier === id)
    );
    if (missing.length) {
      throw new Error(`Downloaded chat model(s) not found: ${missing.join(', ')}`);
    }
  }
  for (const model of chatModels) {
    if (!model.modelKey || !model.indexedModelIdentifier) {
      throw new Error('Downloaded model is missing its model key or exact artifact identifier');
    }
  }
  const selectedModels = chatModels
    .filter(
      (model) =>
        !requestedIds ||
        requestedIds.includes(model.modelKey) ||
        requestedIds.includes(model.indexedModelIdentifier)
    )
    .sort((left, right) => left.indexedModelIdentifier.localeCompare(right.indexedModelIdentifier));
  if (!selectedModels.length) {
    throw new Error('No downloaded chat models found in LM Studio');
  }
  return { selectedModels, skippedModels };
}

async function unloadAllModels() {
  await runLms(['unload', '--all']);
  const started = performance.now();
  let loaded;
  do {
    loaded = await listLmsModels('ps');
    if (!loaded.length) {
      return { verifiedLoadedModels: [], waitedMs: round(performance.now() - started) };
    }
    await new Promise((resolve) => setTimeout(resolve, RESOURCE_SAMPLE_INTERVAL_MS));
  } while (performance.now() - started < 30_000);
  throw new Error(`Models remain loaded after unloading: ${JSON.stringify(loaded)}`);
}

async function loadOnlyModel(model, identifier) {
  const started = performance.now();
  await runLms(['load', model.modelKey, '--identifier', identifier, '-y']);
  const loaded = await listLmsModels('ps');
  verifySoleLoadedModel(loaded, model, identifier);
  return { loadTimeMs: round(performance.now() - started), verifiedLoadedModels: loaded };
}

function verifySoleLoadedModel(loaded, model, identifier) {
  if (
    loaded.length !== 1 ||
    loaded[0].identifier !== identifier ||
    loaded[0].indexedModelIdentifier !== model.indexedModelIdentifier
  ) {
    throw new Error(
      `Expected only ${model.indexedModelIdentifier} loaded: ${JSON.stringify(loaded)}`
    );
  }
}

async function captureHardware() {
  const cpus = os.cpus();
  let gpu;
  try {
    const stdout = await queryNvidiaSmi([
      '--query-gpu=name,memory.total,driver_version',
      '--format=csv,noheader,nounits',
    ]);
    gpu = { status: 'available', devices: parseNvidiaDeviceInfo(stdout) };
  } catch (error) {
    gpu = { status: 'unavailable', reason: error.message };
  }

  return {
    platform: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    cpu: {
      model: cpus[0]?.model || 'unknown',
      logicalProcessors: cpus.length,
    },
    memory: {
      totalBytes: os.totalmem(),
      totalGiB: round(os.totalmem() / 1024 ** 3),
    },
    gpu,
  };
}

async function fetchModelList(baseUrl) {
  const response = await fetch(`${baseUrl}/v1/models`, {
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GET /v1/models failed (${response.status}): ${body}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error(`GET /v1/models returned invalid JSON: ${error.message}`, { cause: error });
  }
  if (!Array.isArray(parsed.data)) {
    throw new Error('GET /v1/models response did not contain a data array');
  }
  return parsed.data;
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }
  return (response.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text || '')
    .join('');
}

async function readResponsesStream(response, startedAt) {
  if (!response.body) {
    throw new Error('Responses API returned no streaming response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let firstTextMs = null;
  let outputText = '';
  let completedResponse = null;

  function handleFrame(frame) {
    const lines = frame.split(/\r?\n/);
    const eventName = lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim();
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      throw new Error(`Responses API sent invalid event JSON: ${error.message}`, { cause: error });
    }
    const type = payload.type || eventName;
    if (type === 'response.output_text.delta' && typeof payload.delta === 'string') {
      if (payload.delta.length > 0) {
        if (firstTextMs === null) {
          firstTextMs = performance.now() - startedAt;
        }
        outputText += payload.delta;
      }
    } else if (type === 'response.completed') {
      completedResponse = payload.response;
    } else if (type === 'response.failed' || type === 'response.incomplete' || type === 'error') {
      const detail =
        payload.response?.error || payload.error || payload.response?.incomplete_details;
      throw new Error(`Responses API stream ended with ${type}: ${JSON.stringify(detail)}`);
    }
  }

  function processFrames(final = false) {
    let boundary;
    while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
      handleFrame(buffer.slice(0, boundary.index));
      buffer = buffer.slice(boundary.index + boundary[0].length);
    }
    if (final && buffer.trim()) {
      handleFrame(buffer);
      buffer = '';
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        processFrames(true);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      processFrames();
    }
  } finally {
    reader.releaseLock();
  }

  if (!completedResponse) {
    throw new Error('Responses API stream ended without a response.completed event');
  }
  if (completedResponse.status === 'failed') {
    throw new Error(`Responses API reported failure: ${JSON.stringify(completedResponse.error)}`);
  }

  if (!outputText) {
    outputText = extractOutputText(completedResponse);
  }
  const usage = completedResponse.usage || {};
  const outputTokens = Number.isFinite(usage.output_tokens) ? usage.output_tokens : null;
  if (!outputText.trim()) {
    throw new Error('Model completed the request without visible text output');
  }

  return { firstTextMs, outputText, outputTokens };
}

async function requestResponse(baseUrl, model, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}/v1/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: PROMPT,
        reasoning: { effort: 'none' },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`POST /v1/responses for ${model} failed (${response.status}): ${body}`);
    }

    const result = await readResponsesStream(response, startedAt);
    const totalResponseMs = performance.now() - startedAt;
    const timeToFirstTextMs = result.firstTextMs;
    return {
      totalResponseMs: round(totalResponseMs),
      timeToFirstTextMs: round(timeToFirstTextMs),
      outputTokens: result.outputTokens,
      outputTokensPerSecond:
        timeToFirstTextMs === null
          ? null
          : outputTokensPerSecond(result.outputTokens, timeToFirstTextMs, totalResponseMs),
      outputText: result.outputText,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readCpuTimes() {
  return os.cpus().reduce(
    (totals, cpu) => {
      for (const [name, value] of Object.entries(cpu.times)) {
        totals[name] = (totals[name] || 0) + value;
      }
      return totals;
    },
    { idle: 0 }
  );
}

function isQuietSample(sample, policy = QUIET_POLICY) {
  return (
    Number.isFinite(sample.cpuUtilizationPercent) &&
    sample.cpuUtilizationPercent <= policy.cpuMaxPercent &&
    Number.isFinite(sample.gpuUtilizationPercent) &&
    sample.gpuUtilizationPercent <= policy.gpuMaxPercent
  );
}

async function waitForQuiet(gpuAvailable, overrides = {}) {
  if (!gpuAvailable) {
    throw new Error('Cannot enforce the GPU quiet threshold: NVIDIA telemetry is unavailable');
  }
  const sampler = new ResourceSampler(true);
  const capture =
    overrides.capture ||
    (async () => {
      await sampler.capture();
      if (sampler.errors.length) {
        throw new Error(`Quiet-machine telemetry failed: ${sampler.errors.join('; ')}`);
      }
      return sampler.samples.at(-1);
    });
  const now = overrides.now || (() => performance.now());
  const sleep = overrides.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const policy = overrides.policy || QUIET_POLICY;
  const started = now();
  let quietSince = null;
  let sample;
  while (now() - started < policy.timeoutMs) {
    sample = await capture();
    const observedAt = now();
    if (isQuietSample(sample, policy)) {
      quietSince ??= observedAt;
      if (observedAt - quietSince >= policy.sustainedMs) {
        return {
          waitedMs: round(observedAt - started),
          sustainedQuietMs: round(observedAt - quietSince),
          finalSample: sample,
        };
      }
    } else {
      quietSince = null;
    }
    await sleep(RESOURCE_SAMPLE_INTERVAL_MS);
  }
  throw new Error(
    `Machine did not stay quiet for ${policy.sustainedMs} ms within ${policy.timeoutMs} ms. ` +
      `Required CPU <=${policy.cpuMaxPercent}%, GPU <=${policy.gpuMaxPercent}%; ` +
      `last sample: ${JSON.stringify(sample)}`
  );
}

class ResourceSampler {
  constructor(gpuAvailable) {
    this.gpuAvailable = gpuAvailable;
    this.samples = [];
    this.errors = [];
    this.previousCpuTimes = null;
    this.timer = null;
    this.collecting = false;
  }

  async capture() {
    if (this.collecting) {
      return;
    }
    this.collecting = true;
    try {
      let gpuDevices = [];
      if (this.gpuAvailable) {
        try {
          const stdout = await queryNvidiaSmi([
            '--query-gpu=name,utilization.gpu,memory.used,memory.total',
            '--format=csv,noheader,nounits',
          ]);
          gpuDevices = parseNvidiaUsage(stdout);
        } catch (error) {
          this.errors.push(error.message);
        }
      }

      const cpuTimes = readCpuTimes();
      const totalCpuTime = Object.values(cpuTimes).reduce((sum, value) => sum + value, 0);
      const previousTotalCpuTime = this.previousCpuTimes
        ? Object.values(this.previousCpuTimes).reduce((sum, value) => sum + value, 0)
        : null;
      const cpuUtilizationPercent =
        previousTotalCpuTime === null ||
        totalCpuTime === previousTotalCpuTime ||
        cpuTimes.idle < this.previousCpuTimes.idle
          ? null
          : round(
              100 -
                (100 * (cpuTimes.idle - this.previousCpuTimes.idle)) /
                  (totalCpuTime - previousTotalCpuTime)
            );
      this.previousCpuTimes = cpuTimes;

      const gpuUtilizations = gpuDevices
        .map((device) => device.utilizationPercent)
        .filter(Number.isFinite);
      const gpuMemoryUsed = gpuDevices
        .map((device) => device.memoryUsedMiB)
        .filter(Number.isFinite);
      const gpuMemoryTotal = gpuDevices
        .map((device) => device.memoryTotalMiB)
        .filter(Number.isFinite);
      this.samples.push({
        cpuUtilizationPercent,
        memoryUsedBytes: os.totalmem() - os.freemem(),
        gpuUtilizationPercent:
          gpuDevices.length && gpuUtilizations.length === gpuDevices.length
            ? Math.max(...gpuUtilizations)
            : null,
        gpuMemoryUsedMiB: gpuMemoryUsed.length
          ? gpuMemoryUsed.reduce((sum, value) => sum + value, 0)
          : null,
        gpuMemoryTotalMiB: gpuMemoryTotal.length
          ? gpuMemoryTotal.reduce((sum, value) => sum + value, 0)
          : null,
      });
    } catch (error) {
      this.errors.push(error.message);
    } finally {
      this.collecting = false;
    }
  }

  async start() {
    await this.capture();
    this.timer = setInterval(() => {
      this.capture();
    }, RESOURCE_SAMPLE_INTERVAL_MS);
  }

  async stop() {
    clearInterval(this.timer);
    while (this.collecting) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await this.capture();
    return this.summary();
  }

  summary() {
    const cpuValues = this.samples
      .map((sample) => sample.cpuUtilizationPercent)
      .filter(Number.isFinite);
    const memoryValues = this.samples
      .map((sample) => sample.memoryUsedBytes)
      .filter(Number.isFinite);
    const gpuUtilizationValues = this.samples
      .map((sample) => sample.gpuUtilizationPercent)
      .filter(Number.isFinite);
    const gpuMemoryValues = this.samples
      .map((sample) => sample.gpuMemoryUsedMiB)
      .filter(Number.isFinite);
    const gpuMemoryTotalValues = this.samples
      .map((sample) => sample.gpuMemoryTotalMiB)
      .filter(Number.isFinite);
    const gpuTelemetryStatus = !this.gpuAvailable
      ? 'unavailable'
      : gpuMemoryValues.length > 0
        ? this.errors.length > 0
          ? 'partial'
          : 'available'
        : 'unavailable';

    return {
      scope: 'system-wide',
      sampleIntervalMs: RESOURCE_SAMPLE_INTERVAL_MS,
      sampleCount: this.samples.length,
      peakCpuUtilizationPercent: cpuValues.length ? Math.max(...cpuValues) : null,
      peakSystemMemoryUsedGiB: memoryValues.length
        ? round(Math.max(...memoryValues) / 1024 ** 3)
        : null,
      peakSystemMemoryUsedPercent: memoryValues.length
        ? round((100 * Math.max(...memoryValues)) / os.totalmem())
        : null,
      gpuTelemetryStatus,
      peakNvidiaGpuUtilizationPercent: gpuUtilizationValues.length
        ? Math.max(...gpuUtilizationValues)
        : null,
      peakNvidiaVramUsedMiB: gpuMemoryValues.length ? Math.max(...gpuMemoryValues) : null,
      nvidiaVramTotalMiB: gpuMemoryTotalValues.length ? Math.max(...gpuMemoryTotalValues) : null,
      errors: this.errors,
    };
  }
}

function defaultOutputPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(ROOT, 'reports', `local-model-benchmark-${timestamp}.json`);
}

async function runBenchmark(options, overrides = {}) {
  const runtime = {
    captureHardware,
    fetchModelList,
    inventory: () => listLmsModels('ls'),
    unloadAllModels,
    loadOnlyModel,
    waitForQuiet,
    requestResponse,
    loadedModels: () => listLmsModels('ps'),
    createSampler: (gpuAvailable) => new ResourceSampler(gpuAvailable),
    ...overrides,
  };
  const baseUrl = options.url.replace(/\/+$/, '');
  const url = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error(
      'The managed benchmark requires a local LM Studio URL because lms controls local models'
    );
  }
  const [hardware, availableModels, inventory] = await Promise.all([
    runtime.captureHardware(),
    runtime.fetchModelList(baseUrl),
    runtime.inventory(),
  ]);
  const availableIds = availableModels.map((model) => model.id);
  const { selectedModels, skippedModels } = selectDownloadedModels(inventory, options.models);
  if (hardware.gpu.status !== 'available') {
    throw new Error(`Cannot enforce GPU quiet threshold: ${hardware.gpu.reason}`);
  }

  const results = [];
  let unloaded = await runtime.unloadAllModels();
  for (const [index, model] of selectedModels.entries()) {
    const identifier = `local-benchmark-${index + 1}`;
    let result;
    try {
      console.log(`\nWaiting for a quiet machine before loading ${model.modelKey}...`);
      const quietBeforeLoad = await runtime.waitForQuiet(true);
      const load = await runtime.loadOnlyModel(model, identifier);
      const apiModels = await runtime.fetchModelList(baseUrl);
      if (!apiModels.some((entry) => entry.id === identifier)) {
        throw new Error(
          `Local API does not expose CLI-loaded model ${identifier}; check the LM Studio endpoint`
        );
      }
      console.log(`Waiting for a quiet machine before warming up ${model.modelKey}...`);
      const quietBeforeWarmup = await runtime.waitForQuiet(true);
      const warmup = await runtime.requestResponse(baseUrl, identifier);
      console.log(`Waiting for a quiet machine before measuring ${model.modelKey}...`);
      const quietBeforeMeasurements = await runtime.waitForQuiet(true);
      verifySoleLoadedModel(await runtime.loadedModels(), model, identifier);
      const sampler = runtime.createSampler(true);
      await sampler.start();
      const samples = [];
      let resources;
      try {
        for (let run = 1; run <= options.runs; run += 1) {
          console.log(`Measuring ${model.modelKey}: run ${run}/${options.runs}`);
          samples.push(await runtime.requestResponse(baseUrl, identifier));
        }
      } finally {
        resources = await sampler.stop();
      }
      verifySoleLoadedModel(await runtime.loadedModels(), model, identifier);
      result = {
        modelId: model.modelKey,
        apiIdentifier: identifier,
        artifact: model,
        lifecycle: {
          unloadedBeforeLoad: unloaded,
          quietBeforeLoad,
          load,
          quietBeforeWarmup,
          quietBeforeMeasurements,
        },
        warmup: {
          totalResponseMs: warmup.totalResponseMs,
          outputTokens: warmup.outputTokens,
        },
        summary: summarizeSamples(samples),
        resourcePeaks: resources,
        samples,
      };
    } finally {
      unloaded = await runtime.unloadAllModels();
    }
    result.lifecycle.unloadedAfterMeasurements = unloaded;
    results.push(result);
    console.log(
      `${model.modelKey}: median TTFT ${result.summary.medianTimeToFirstTextMs ?? 'n/a'} ms, ` +
        `total ${result.summary.medianTotalResponseMs ?? 'n/a'} ms, ` +
        `${result.summary.medianOutputTokensPerSecond ?? 'n/a'} output tokens/sec`
    );
  }

  return {
    capturedAt: new Date().toISOString(),
    hardware,
    runner: {
      name: 'LM Studio OpenAI-compatible local API',
      baseUrl,
      availableModelIds: availableIds,
      loadSettings:
        'lms load with ordinary default placement/settings; exact loaded-model metadata recorded per model.',
    },
    benchmark: {
      selectedModelIds: selectedModels.map((model) => model.modelKey),
      skippedModels,
      quietPolicy: QUIET_POLICY,
      lifecycle:
        'Unload all and verify empty; wait for quiet; load one exact artifact; warm up and measure; unload all, including on failure.',
      measuredRequestsPerModel: options.runs,
      warmupRequestsPerModel: 1,
      prompt: PROMPT,
      reasoningEffort: 'none',
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      outputTokensPerSecondFormula:
        'output tokens / (total response time - time to first generated text)',
      resourceScope: 'System-wide samples at 500 ms intervals; not isolated to the model process.',
    },
    results,
  };
}

function printUsage() {
  console.log(
    'Usage: node scripts/bench-local-models.js [--url http://127.0.0.1:1234] ' +
      '[--runs 3] [--models id,id,...] [--output reports/result.json]'
  );
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printUsage();
    return;
  }

  console.log('Checking LM Studio endpoint and capturing hardware...');
  const report = await runBenchmark(options);
  const outputPath = path.resolve(options.output || defaultOutputPath());
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(`\nSaved results to ${outputPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Local model benchmark failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  median,
  outputTokensPerSecond,
  parseArgs,
  parseNvidiaDeviceInfo,
  parseNvidiaUsage,
  selectDownloadedModels,
  verifySoleLoadedModel,
  isQuietSample,
  waitForQuiet,
  runBenchmark,
  readResponsesStream,
  summarizeSamples,
};
