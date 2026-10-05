'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Ajv = require('ajv');
const fs = require('node:fs');
const path = require('node:path');
const { SURFACE_ARCHETYPE_VALUES } = require('../src/model/celestial-body-upsert');

const ROOT = path.resolve(__dirname, '..');
const readSchema = (name) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'schemas', name), 'utf8'));

test('celestial-body schemas require the canonical non-nullable surface archetype enum', () => {
  const solarSystemResponse = readSchema('solar-system-get-response.schema.json');
  const listResponse = readSchema('celestial-body-list-response.schema.json');
  const upsertRequest = readSchema('celestial-body-upsert-request.schema.json');
  const bodySchemas = [
    solarSystemResponse.definitions.celestialBody,
    listResponse.definitions.celestialBody,
    upsertRequest.properties.celestialBody,
  ];

  for (const bodySchema of bodySchemas) {
    assert.ok(bodySchema.required.includes('surfaceArchetype'));
    assert.deepEqual(bodySchema.properties.surfaceArchetype.enum, SURFACE_ARCHETYPE_VALUES);
    assert.equal(bodySchema.properties.surfaceArchetype.type, 'string');
  }
});

test('surfaceArchetype JSON Schema rejects missing and unsupported values', () => {
  const requestSchema = readSchema('celestial-body-upsert-request.schema.json');
  const archetypeSchema = requestSchema.properties.celestialBody.properties.surfaceArchetype;
  const validate = new Ajv().compile({
    type: 'object',
    properties: { surfaceArchetype: archetypeSchema },
    required: ['surfaceArchetype'],
  });

  assert.equal(validate({}), false);
  assert.equal(validate({ surfaceArchetype: null }), false);
  assert.equal(validate({ surfaceArchetype: 'volcanic' }), false);
  assert.equal(validate({ surfaceArchetype: 'rocky' }), true);
});
