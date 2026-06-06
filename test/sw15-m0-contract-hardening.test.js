'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  BUST_FACE_SHAPE_VALUES,
  BUST_SKIN_TONE_VALUES,
  BUST_HAIR_STYLE_VALUES,
  BUST_HAIR_COLOR_VALUES,
  BUST_EYE_STYLE_VALUES,
  BUST_EYE_COLOR_VALUES,
  BUST_EXPRESSION_PRESET_VALUES,
  BUST_APPAREL_ACCENT_VALUES,
  BUST_SCHEMA_VERSION,
} = require('../src/model/bust-descriptor');

const ROOT = path.resolve(__dirname, '..');
const OPENAPI_PATH = path.join(ROOT, 'openapi.yaml');
const BUST_DESCRIPTOR_SCHEMA_PATH = path.join(ROOT, 'schemas', 'bust-descriptor.schema.json');
const BUST_VALIDATION_ERROR_SCHEMA_PATH = path.join(
  ROOT,
  'schemas',
  'bust-validation-error-response.schema.json'
);
const BUST_BLOCKED_SAVE_SCHEMA_PATH = path.join(
  ROOT,
  'schemas',
  'bust-blocked-save-response.schema.json'
);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function loadFixture(name) {
  return readJson(path.join(ROOT, 'test', 'fixtures', 'sw15', name));
}

function sortValues(values) {
  return [...values].sort();
}

function validateDescriptor(schema, descriptor) {
  const required = schema.required || [];
  const properties = schema.properties || {};

  for (const field of required) {
    if (!(field in descriptor)) {
      return { valid: false, errors: [{ field, reason: 'required field missing', rejectedValue: undefined }] };
    }
  }

  const errors = [];
  for (const [field, value] of Object.entries(descriptor)) {
    if (field === '_comment') continue;
    const propSchema = properties[field];
    if (!propSchema) {
      if (schema.additionalProperties === false) {
        errors.push({ field, reason: 'additional property not allowed', rejectedValue: value });
      }
      continue;
    }
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      errors.push({ field, reason: 'not a valid enum value', rejectedValue: value });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Enum alignment ───────────────────────────────────────────────────────────

test('SW-15 bust-descriptor schema enums remain aligned with runtime taxonomy', () => {
  const schema = readJson(BUST_DESCRIPTOR_SCHEMA_PATH);

  assert.deepEqual(
    sortValues(schema.properties.faceShape.enum),
    sortValues(BUST_FACE_SHAPE_VALUES)
  );
  assert.deepEqual(
    sortValues(schema.properties.skinTone.enum),
    sortValues(BUST_SKIN_TONE_VALUES)
  );
  assert.deepEqual(
    sortValues(schema.properties.hairStyle.enum),
    sortValues(BUST_HAIR_STYLE_VALUES)
  );
  assert.deepEqual(
    sortValues(schema.properties.hairColor.enum),
    sortValues(BUST_HAIR_COLOR_VALUES)
  );
  assert.deepEqual(
    sortValues(schema.properties.eyeStyle.enum),
    sortValues(BUST_EYE_STYLE_VALUES)
  );
  assert.deepEqual(
    sortValues(schema.properties.eyeColor.enum),
    sortValues(BUST_EYE_COLOR_VALUES)
  );
  assert.deepEqual(
    sortValues(schema.properties.expressionPreset.enum),
    sortValues(BUST_EXPRESSION_PRESET_VALUES)
  );
  assert.deepEqual(
    sortValues(schema.properties.apparelAccent.enum),
    sortValues(BUST_APPAREL_ACCENT_VALUES)
  );

  assert.equal(schema.additionalProperties, false);
});

test('SW-15 bust-descriptor schema schemaVersion enum contains only sw-15-m0-v1', () => {
  const schema = readJson(BUST_DESCRIPTOR_SCHEMA_PATH);
  assert.deepEqual(schema.properties.schemaVersion.enum, [BUST_SCHEMA_VERSION]);
});

// ─── Canonical pass fixture ───────────────────────────────────────────────────

test('SW-15 canonical character bust fixture passes schema validation', () => {
  const schema = readJson(BUST_DESCRIPTOR_SCHEMA_PATH);
  const fixture = loadFixture('character-bust-canonical-pass.json');

  const result = validateDescriptor(schema, fixture);
  assert.equal(
    result.valid,
    true,
    `Expected canonical fixture to pass but got errors: ${JSON.stringify(result.errors)}`
  );
});

test('SW-15 canonical character bust fixture has correct schemaVersion', () => {
  const fixture = loadFixture('character-bust-canonical-pass.json');
  assert.equal(fixture.schemaVersion, 'sw-15-m0-v1');
});

test('SW-15 canonical character bust fixture has required presetVersion', () => {
  const fixture = loadFixture('character-bust-canonical-pass.json');
  assert.ok(
    typeof fixture.presetVersion === 'string' && fixture.presetVersion.length > 0,
    'presetVersion must be a non-empty string'
  );
});

// ─── Intentional mismatch hard-fail ──────────────────────────────────────────

test('SW-15 mismatch character bust fixture hard-fails schema validation', () => {
  const schema = readJson(BUST_DESCRIPTOR_SCHEMA_PATH);
  const fixture = loadFixture('character-bust-mismatch-fail.json');

  const result = validateDescriptor(schema, fixture);
  assert.equal(
    result.valid,
    false,
    'Expected mismatch fixture to fail validation but it passed'
  );
  assert.ok(result.errors.length > 0, 'Expected at least one validation error');

  const faceShapeError = result.errors.find((e) => e.field === 'faceShape');
  assert.ok(faceShapeError, 'Expected a faceShape validation error');
  assert.equal(faceShapeError.rejectedValue, 'triangle');
});

// ─── NPC seed replay fixture ──────────────────────────────────────────────────

test('SW-15 NPC seed replay fixture has required deterministicSeed', () => {
  const fixture = loadFixture('npc-bust-seed-replay.json');
  assert.ok(
    typeof fixture.deterministicSeed === 'string' && fixture.deterministicSeed.length > 0,
    'deterministicSeed must be a non-empty string'
  );
});

test('SW-15 NPC seed replay fixture descriptor passes schema validation', () => {
  const schema = readJson(BUST_DESCRIPTOR_SCHEMA_PATH);
  const fixture = loadFixture('npc-bust-seed-replay.json');

  const result = validateDescriptor(schema, fixture.descriptor);
  assert.equal(
    result.valid,
    true,
    `Expected NPC seed replay descriptor to pass but got errors: ${JSON.stringify(result.errors)}`
  );
});

test('SW-15 NPC seed replay fixture has appliedOverrides array', () => {
  const fixture = loadFixture('npc-bust-seed-replay.json');
  assert.ok(Array.isArray(fixture.appliedOverrides), 'appliedOverrides must be an array');
});

// ─── OpenAPI contract presence ────────────────────────────────────────────────

test('SW-15 openapi.yaml contains Bust tag', () => {
  const content = readText(OPENAPI_PATH);
  assert.ok(content.includes('name: Bust'), 'Expected Bust tag to be present in openapi.yaml');
});

test('SW-15 openapi.yaml contains all 6 bust endpoint paths', () => {
  const content = readText(OPENAPI_PATH);

  const expectedPaths = [
    '/socket/character-bust-create',
    '/socket/character-bust-read',
    '/socket/character-bust-update',
    '/socket/npc-bust-create',
    '/socket/npc-bust-read',
    '/socket/npc-bust-update',
  ];

  for (const endpointPath of expectedPaths) {
    assert.ok(
      content.includes(endpointPath),
      `Expected openapi.yaml to contain path: ${endpointPath}`
    );
  }
});

test('SW-15 openapi.yaml contains all 15 bust component schema names', () => {
  const content = readText(OPENAPI_PATH);

  const expectedComponents = [
    'BustDescriptor:',
    'BustBlockedSaveResponse:',
    'BustValidationErrorResponse:',
    'CharacterBustCreateRequest:',
    'CharacterBustCreateResponse:',
    'CharacterBustReadRequest:',
    'CharacterBustReadResponse:',
    'CharacterBustUpdateRequest:',
    'CharacterBustUpdateResponse:',
    'NpcBustCreateRequest:',
    'NpcBustCreateResponse:',
    'NpcBustReadRequest:',
    'NpcBustReadResponse:',
    'NpcBustUpdateRequest:',
    'NpcBustUpdateResponse:',
  ];

  for (const componentName of expectedComponents) {
    assert.ok(
      content.includes(componentName),
      `Expected openapi.yaml to contain component: ${componentName}`
    );
  }
});

// ─── Bust validation error response schema ────────────────────────────────────

test('SW-15 bust-validation-error-response schema has success enum false', () => {
  const schema = readJson(BUST_VALIDATION_ERROR_SCHEMA_PATH);
  assert.deepEqual(schema.properties.success.enum, [false]);
});

test('SW-15 bust-validation-error-response schema has validationErrors array with required per-field shape', () => {
  const schema = readJson(BUST_VALIDATION_ERROR_SCHEMA_PATH);
  const errorsSchema = schema.properties.validationErrors;

  assert.equal(errorsSchema.type, 'array');
  assert.ok(errorsSchema.minItems >= 1, 'validationErrors must require at least 1 item');

  const itemRequired = errorsSchema.items.required;
  assert.ok(itemRequired.includes('field'), 'validationErrors item must require field');
  assert.ok(itemRequired.includes('reason'), 'validationErrors item must require reason');
  assert.ok(itemRequired.includes('rejectedValue'), 'validationErrors item must require rejectedValue');
});

test('SW-15 bust-blocked-save-response schema has success enum false and blockedSave.reason enum', () => {
  const schema = readJson(BUST_BLOCKED_SAVE_SCHEMA_PATH);
  assert.deepEqual(schema.properties.success.enum, [false]);

  const blockedSave = schema.properties.blockedSave;
  assert.equal(blockedSave.type, 'object');
  assert.ok(blockedSave.required.includes('reason'));
  assert.ok(blockedSave.required.includes('retryable'));

  const reasonEnum = blockedSave.properties.reason.enum;
  assert.deepEqual(reasonEnum, [
    'PLAYER_NOT_REGISTERED',
    'CHARACTER_NOT_FOUND',
    'CHARACTER_BUST_NOT_FOUND',
    'NPC_BUST_NOT_FOUND',
    'DATABASE_ERROR',
  ]);
});

// ─── Cross-schema consistency: request enum values match descriptor schema ────

test('SW-15 character-bust-create-request descriptor enum values match bust-descriptor schema', () => {
  const bustSchema = readJson(BUST_DESCRIPTOR_SCHEMA_PATH);
  const createRequestSchema = readJson(
    path.join(ROOT, 'schemas', 'character-bust-create-request.schema.json')
  );
  const requestDescriptor = createRequestSchema.properties.descriptor.properties;

  const domains = ['faceShape', 'skinTone', 'hairStyle', 'hairColor', 'eyeStyle', 'eyeColor', 'expressionPreset', 'apparelAccent'];
  for (const domain of domains) {
    assert.deepEqual(
      sortValues(requestDescriptor[domain].enum),
      sortValues(bustSchema.properties[domain].enum),
      `character-bust-create-request enum for ${domain} must match bust-descriptor schema`
    );
  }
});

test('SW-15 npc-bust-create-request override enum values match bust-descriptor schema', () => {
  const bustSchema = readJson(BUST_DESCRIPTOR_SCHEMA_PATH);
  const npcCreateRequestSchema = readJson(
    path.join(ROOT, 'schemas', 'npc-bust-create-request.schema.json')
  );
  const overrideProperties = npcCreateRequestSchema.properties.overrides.properties;

  const domains = ['faceShape', 'skinTone', 'hairStyle', 'hairColor', 'eyeStyle', 'eyeColor', 'expressionPreset', 'apparelAccent'];
  for (const domain of domains) {
    assert.deepEqual(
      sortValues(overrideProperties[domain].enum),
      sortValues(bustSchema.properties[domain].enum),
      `npc-bust-create-request override enum for ${domain} must match bust-descriptor schema`
    );
  }
});

test('SW-15 create/update bust response schemas include blocked-save response variant', () => {
  const responseSchemaPaths = [
    path.join(ROOT, 'schemas', 'character-bust-create-response.schema.json'),
    path.join(ROOT, 'schemas', 'character-bust-update-response.schema.json'),
    path.join(ROOT, 'schemas', 'npc-bust-create-response.schema.json'),
    path.join(ROOT, 'schemas', 'npc-bust-update-response.schema.json'),
  ];

  for (const responseSchemaPath of responseSchemaPaths) {
    const schema = readJson(responseSchemaPath);
    assert.ok(Array.isArray(schema.oneOf), `${path.basename(responseSchemaPath)} must define oneOf`);
    const schemaText = JSON.stringify(schema);
    assert.ok(
      schemaText.includes('bust-blocked-save-response.schema.json'),
      `${path.basename(responseSchemaPath)} must reference bust-blocked-save-response schema`
    );
  }
});
