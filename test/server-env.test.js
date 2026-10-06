'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ENV_KEYS = [
  'PORT',
  'HOST',
  'MONGODB_URI',
  'CORS_ORIGIN',
  'LOG_LEVEL',
  'DOTENV_COMPAT_TEXT',
  'DOTENV_COMPAT_EMPTY',
];
const SERVER_PATH = require.resolve('../src/server');
const RESULT_PREFIX = 'ENV_COMPAT_RESULT=';

function loadServerEnvironment(t, contents, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solid-train-env-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  if (contents !== null) {
    fs.writeFileSync(path.join(directory, '.env'), contents);
  }

  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (ENV_KEYS.includes(key.toUpperCase()) || key.toUpperCase().startsWith('DOTENV_')) {
      delete env[key];
    }
  }
  Object.assign(env, overrides);

  const script = `
    const { resolvePort } = require(${JSON.stringify(SERVER_PATH)});
    const values = Object.fromEntries(
      ${JSON.stringify(ENV_KEYS)}.map(key => [key, process.env[key] ?? null])
    );
    console.log(${JSON.stringify(RESULT_PREFIX)} + JSON.stringify({
      ...values,
      resolvedPort: resolvePort(),
    }));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: directory,
    env,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith(RESULT_PREFIX));
  assert.ok(line, 'server import must report the loaded environment');
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

test('server loads its runtime settings and quoted values from the working-directory env file', (t) => {
  const loaded = loadServerEnvironment(
    t,
    [
      '# Synthetic compatibility fixture',
      'export PORT = 4321 # trailing comment',
      'HOST=127.0.0.1',
      'MONGODB_URI="mongodb://127.0.0.1:27017/env-compat"',
      "CORS_ORIGIN='https://example.test/#fragment'",
      'LOG_LEVEL=debug',
      'DOTENV_COMPAT_TEXT="first line\\nsecond line"',
      'DOTENV_COMPAT_EMPTY=',
      '',
    ].join('\r\n')
  );

  assert.deepEqual(loaded, {
    PORT: '4321',
    HOST: '127.0.0.1',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/env-compat',
    CORS_ORIGIN: 'https://example.test/#fragment',
    LOG_LEVEL: 'debug',
    DOTENV_COMPAT_TEXT: 'first line\nsecond line',
    DOTENV_COMPAT_EMPTY: '',
    resolvedPort: 4321,
  });
});

test('server preserves process environment values over env file settings', (t) => {
  const overrides = {
    PORT: '5432',
    HOST: 'localhost',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/process-env',
    CORS_ORIGIN: 'https://process.example.test',
    LOG_LEVEL: 'warn',
    DOTENV_COMPAT_EMPTY: '',
  };
  const contents = Object.keys(overrides)
    .map((key) => `${key}=file-value`)
    .join('\n');

  const loaded = loadServerEnvironment(t, contents, overrides);

  for (const [key, value] of Object.entries(overrides)) {
    assert.equal(loaded[key], value, `${key} must not be overwritten`);
  }
  assert.equal(loaded.resolvedPort, 5432);
});

test('server imports without an env file and retains its default port', (t) => {
  const loaded = loadServerEnvironment(t, null);

  assert.equal(loaded.resolvedPort, 3000);
  for (const key of ENV_KEYS) {
    assert.equal(loaded[key], null);
  }
});
