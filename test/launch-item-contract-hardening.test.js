'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CANONICAL_ITEM_TYPES,
  RUNTIME_FORBIDDEN_ITEMTYPE_PREFIXES,
} = require('../src/model/canonical-item-type-registry');

const ROOT = path.resolve(__dirname, '..');
const OPENAPI_PATH = path.join(ROOT, 'api', 'openapi', 'items', 'openapi.yaml');
const SCHEMAS_DIR = path.join(ROOT, 'api', 'schemas');
const CANONICAL_ITEM_TYPE_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'canonical-item-type.schema.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function extractLaunchItemSection(openApiText) {
  const start = openApiText.indexOf('/socket/launch-item:');
  if (start < 0) {
    return '';
  }

  const afterStart = openApiText.slice(start);
  const nextPathMatch = afterStart.match(/\n  \/socket\/[a-z0-9-]+:/i);
  if (!nextPathMatch || typeof nextPathMatch.index !== 'number') {
    return afterStart;
  }

  return afterStart.slice(0, nextPathMatch.index);
}

function extractItemTypeValues(yamlBlock) {
  const matches = yamlBlock.matchAll(/itemType:\s*([a-z0-9-]+)/gi);
  return Array.from(matches, (match) => String(match[1] || '').trim());
}

function listJsonFilesRecursively(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFilesRecursively(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectUnconstrainedItemTypeNodes(value, pathSegments, findings) {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      collectUnconstrainedItemTypeNodes(child, [...pathSegments, `[${index}]`], findings);
    });
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...pathSegments, key];
    if (
      key === 'itemType' &&
      child &&
      typeof child === 'object' &&
      !Array.isArray(child) &&
      child.type === 'string' &&
      !Object.prototype.hasOwnProperty.call(child, '$ref')
    ) {
      findings.push(nextPath.join('.'));
    }

    collectUnconstrainedItemTypeNodes(child, nextPath, findings);
  }
}

test('canonical runtime item registry forbids raw-material-* item types', () => {
  assert.ok(Array.isArray(CANONICAL_ITEM_TYPES));
  assert.ok(CANONICAL_ITEM_TYPES.length > 0);

  const forbiddenPrefixes = Array.isArray(RUNTIME_FORBIDDEN_ITEMTYPE_PREFIXES)
    ? RUNTIME_FORBIDDEN_ITEMTYPE_PREFIXES
    : [];

  for (const itemType of CANONICAL_ITEM_TYPES) {
    for (const prefix of forbiddenPrefixes) {
      assert.equal(
        itemType.startsWith(prefix),
        false,
        `Canonical runtime itemType must not use forbidden prefix ${prefix}: ${itemType}`
      );
    }
  }
});

test('canonical-item-type schema stays synchronized with runtime canonical registry', () => {
  const schema = readJson(CANONICAL_ITEM_TYPE_SCHEMA_PATH);
  const schemaEnum = Array.isArray(schema.enum) ? [...schema.enum].sort() : [];
  const runtimeEnum = [...CANONICAL_ITEM_TYPES].sort();

  assert.deepEqual(schemaEnum, runtimeEnum);
  assert.deepEqual(schema.not, { pattern: '^raw-material-' });
});

test('launch-item contract guarantees text remains present and strict', () => {
  const openApiText = readText(OPENAPI_PATH);
  const launchSection = extractLaunchItemSection(openApiText);

  assert.ok(launchSection.includes('exactly one terminal'));
  assert.ok(launchSection.includes('canonical inventory projection'));
  assert.ok(launchSection.includes('raw-material-*'));
});

test('launch-item OpenAPI examples do not emit raw-material-* item types', () => {
  const openApiText = readText(OPENAPI_PATH);
  const launchSection = extractLaunchItemSection(openApiText);

  assert.equal(/itemType:\s*raw-material-/i.test(launchSection), false);

  const itemTypes = extractItemTypeValues(launchSection);
  for (const itemType of itemTypes) {
    if (!itemType || itemType === 'launch-item' || itemType === 'ship' || itemType === 'mission') {
      continue;
    }

    if (itemType.startsWith('raw-material-')) {
      assert.fail(`launch-item example emitted forbidden raw-material itemType: ${itemType}`);
    }
  }
});

test('response schemas that emit runtime items reference shared canonical itemType constraint', () => {
  const files = [
    'item.schema.json',
    'launch-item-response.schema.json',
    'ship-list-by-owner-response.schema.json',
    'market-inventory-list-response.schema.json',
    'item-remove-response.schema.json',
    'solar-system-get-response.schema.json',
    'celestial-body-list-response.schema.json',
    'catalog-item-definition.schema.json',
  ];

  for (const fileName of files) {
    const text = readText(path.join(SCHEMAS_DIR, fileName));
    assert.ok(
      text.includes('./canonical-item-type.schema.json'),
      `${fileName} must reference ./canonical-item-type.schema.json for runtime itemType constraints`
    );
  }
});

test('all schemas avoid unconstrained itemType string definitions', () => {
  const schemaFiles = listJsonFilesRecursively(SCHEMAS_DIR);
  const offenders = [];

  for (const filePath of schemaFiles) {
    if (path.basename(filePath) === 'canonical-item-type.schema.json') {
      continue;
    }

    const schema = readJson(filePath);
    const findings = [];
    collectUnconstrainedItemTypeNodes(schema, [], findings);
    if (findings.length > 0) {
      offenders.push(`${path.relative(ROOT, filePath)} (${findings.join(', ')})`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Schemas with unconstrained itemType definitions found: ${offenders.join(', ')}`
  );
});
